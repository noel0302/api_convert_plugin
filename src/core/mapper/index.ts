import type { StorageService } from '../services/storage.js';
import type { ConfigService } from '../services/config.js';
import type { LogService } from '../services/log.js';
import type { FieldSchema, ObjectSchema } from '../types/profile.js';
import type { TargetProfile, TargetFieldSchema, SupportedLanguage } from '../types/target.js';
import type { MappingRule, FieldMapping, MappingCandidate, TransformationType } from '../types/mapping.js';
import type { ChangeSource, FieldChange } from '../types/history.js';
import { calculateMatchScore, type MatchContext, type DescriptionContext } from './field-matcher.js';
import { PluginError } from '../errors.js';

export interface GenerateMappingParams {
  apiProfile: string;
  endpoint: string;
  responseCode?: number;
  target: {
    type: 'existing_dto' | 'existing_code' | 'user_defined' | 'auto_generate';
    reference?: string;
    language: SupportedLanguage;
    typeName?: string;
    targetProfileId?: string;
  };
  options?: {
    strictMode?: boolean;
    includeNullHandling?: boolean;
    namingConvention?: 'camelCase' | 'snake_case' | 'PascalCase';
  };
}

export interface GenerateMappingResult {
  mappingRule: MappingRule;
  preview: MappingPreview;
  savedTo: string;
}

export interface MappingPreview {
  confirmedMappings: FieldMapping[];
  ambiguousMappings: FieldMapping[];
  unmappedSourceFields: string[];
  missingTargetFields: string[];
}

export class MapperModule {
  constructor(
    private storage: StorageService,
    private config: ConfigService,
    private log: LogService,
  ) {}

  async generateMapping(params: GenerateMappingParams): Promise<GenerateMappingResult> {
    await this.log.info('Mapper', `Generating mapping for ${params.apiProfile} → ${params.target.typeName || 'unknown'}`);

    // 1. 소스 프로파일 로드
    const sourceProfile = await this.storage.loadProfile(params.apiProfile);

    // 2. 엔드포인트 찾기
    const endpoint = sourceProfile.endpoints.find(
      ep => `${ep.method} ${ep.path}` === params.endpoint || ep.path === params.endpoint,
    );
    if (!endpoint) {
      throw new PluginError('ENDPOINT_NOT_FOUND', params.endpoint);
    }

    // 3. 응답 스키마 가져오기
    const responseCode = params.responseCode || 200;
    const responseSchema = endpoint.response.statusCodes[responseCode];
    if (!responseSchema) {
      throw new PluginError('SCHEMA_EXTRACTION_FAILED', `Response code ${responseCode} not found`);
    }

    // 4. 타겟 프로파일 결정
    const targetProfile = await this.resolveTarget(params);

    // 5. 필드 매핑 도출
    const fieldMappings = this.mapFields(responseSchema, targetProfile.fields, params.options);

    // 6. 매핑 규칙 조립
    const confidenceThreshold = (this.config.get('mapping.confidenceThreshold') as number) || 0.9;
    const now = new Date().toISOString();

    const mappingRule: MappingRule = {
      id: `${params.apiProfile}-to-${targetProfile.id}-${Date.now()}`,
      version: 1,
      name: `${sourceProfile.name} → ${targetProfile.name}`,
      source: {
        apiProfileId: params.apiProfile,
        endpoint: params.endpoint,
        responseCode,
      },
      target: {
        businessContext: '',
        language: params.target.language,
        typeName: targetProfile.name,
        targetProfileId: targetProfile.id,
      },
      fieldMappings,
      metadata: {
        createdAt: now,
        updatedAt: now,
        confidence: this.calculateOverallConfidence(fieldMappings),
        userVerified: false,
        ambiguousFields: fieldMappings
          .filter(fm => fm.isAmbiguous)
          .map(fm => fm.targetField),
      },
    };

    // 7. 저장
    const savedTo = await this.storage.saveMapping(mappingRule);

    // 8. 히스토리 초기화
    await this.storage.initHistory(mappingRule);

    // 9. 프리뷰 생성
    const preview = this.buildPreview(fieldMappings, responseSchema, targetProfile, confidenceThreshold);

    await this.log.info('Mapper', `Mapping generated: ${mappingRule.id}`, {
      confirmed: preview.confirmedMappings.length,
      ambiguous: preview.ambiguousMappings.length,
      unmapped: preview.unmappedSourceFields.length,
      missing: preview.missingTargetFields.length,
    });

    return { mappingRule, preview, savedTo };
  }

  async updateMapping(
    mappingId: string,
    changes: FieldChange[],
    source: ChangeSource,
  ): Promise<MappingRule> {
    const mapping = await this.storage.loadMappingById(mappingId);

    for (const change of changes) {
      if (change.type === 'modify') {
        const fm = mapping.fieldMappings.find(f => f.targetField === change.field);
        if (fm && change.after !== undefined) {
          Object.assign(fm, change.after);
          fm.isAmbiguous = false;
          fm.confidence = 1.0;
        }
      } else if (change.type === 'add' && change.after) {
        mapping.fieldMappings.push(change.after as FieldMapping);
      } else if (change.type === 'remove') {
        mapping.fieldMappings = mapping.fieldMappings.filter(f => f.targetField !== change.field);
      }
    }

    mapping.version++;
    mapping.metadata.updatedAt = new Date().toISOString();
    mapping.metadata.userVerified = source === 'conversation' || source === 'visual_editor';

    await this.storage.saveMapping(mapping);
    return mapping;
  }

  private mapFields(
    sourceSchema: ObjectSchema,
    targetFields: Record<string, TargetFieldSchema>,
    options?: GenerateMappingParams['options'],
  ): FieldMapping[] {
    const mappings: FieldMapping[] = [];
    const sourceFields = this.flattenFields(sourceSchema.children, '');
    const mappedSourceFields = new Set<string>();
    const targetEntries = Object.entries(targetFields);

    for (let targetIdx = 0; targetIdx < targetEntries.length; targetIdx++) {
      const [targetPath, targetField] = targetEntries[targetIdx];

      // top-3 후보 수집
      const TOP_N = 3;
      let topCandidates: { sourceField: string; score: ReturnType<typeof calculateMatchScore>; type: TransformationType }[] = [];

      for (let sourceIdx = 0; sourceIdx < sourceFields.length; sourceIdx++) {
        const [sourcePath, sourceField] = sourceFields[sourceIdx];
        const context: MatchContext = {
          sourceIndex: sourceIdx,
          sourceTotal: sourceFields.length,
          targetIndex: targetIdx,
          targetTotal: targetEntries.length,
          existingMappings: mappings
            .filter(m => m.sourceField !== null)
            .map(m => ({ sourceField: m.sourceField as string, targetField: m.targetField })),
        };
        const descriptionCtx: DescriptionContext = {
          targetDescription: targetField.description,
          targetMeaning: targetField.businessContext?.meaning,
        };
        const score = calculateMatchScore(
          sourcePath, targetPath,
          sourceField.type, targetField.type,
          context,
          descriptionCtx,
        );

        // object 소스가 children을 가지고 있고 타겟이 scalar면 스킵
        if (sourceField.type === 'object' && sourceField.children &&
            Object.keys(sourceField.children).length > 0 && targetField.type !== 'object') {
          continue;
        }

        const candidate = {
          sourceField: sourcePath,
          score,
          type: this.determineTransformationType(sourceField, targetField, score.nameScore),
        };

        if (topCandidates.length < TOP_N) {
          topCandidates.push(candidate);
          topCandidates.sort((a, b) => b.score.totalScore - a.score.totalScore);
        } else if (score.totalScore > topCandidates[TOP_N - 1].score.totalScore) {
          topCandidates[TOP_N - 1] = candidate;
          topCandidates.sort((a, b) => b.score.totalScore - a.score.totalScore);
        }
      }

      const bestMatch = topCandidates[0] ?? null;
      const ambiguousThreshold = options?.strictMode ? 1.0 : 0.9;

      // candidates 배열 생성 (ambiguous일 때만)
      const buildCandidates = (): MappingCandidate[] | undefined => {
        if (topCandidates.length <= 1) return undefined;
        return topCandidates.map(c => ({
          sourceField: c.sourceField,
          confidence: c.score.totalScore,
          scoreBreakdown: {
            nameScore: c.score.nameScore,
            typeScore: c.score.typeScore,
            descriptionBoost: c.score.descriptionBoost,
          },
          transformationType: c.type,
        }));
      };

      if (bestMatch && bestMatch.score.totalScore >= 0.4) {
        mappedSourceFields.add(bestMatch.sourceField);
        const transformation = this.determineTransformation(bestMatch.sourceField, targetField, bestMatch.type);
        const isAmbiguous = bestMatch.score.totalScore < ambiguousThreshold;
        mappings.push({
          sourceField: bestMatch.sourceField,
          targetField: targetPath,
          transformation,
          confidence: bestMatch.score.totalScore,
          isAmbiguous,
          ...(isAmbiguous ? { candidates: buildCandidates() } : {}),
        });
      } else if (bestMatch && bestMatch.score.totalScore >= 0.3) {
        mappings.push({
          sourceField: null,
          targetField: targetPath,
          transformation: {
            type: targetField.required ? 'constant' : 'default_value',
            config: { value: targetField.required ? undefined : null },
          },
          confidence: bestMatch.score.totalScore,
          isAmbiguous: true,
          userNote: `낮은 신뢰도 후보: "${bestMatch.sourceField}" (${(bestMatch.score.totalScore * 100).toFixed(0)}%). update_mapping으로 확인해주세요.`,
          candidates: buildCandidates(),
        });
      } else if (options?.includeNullHandling !== false) {
        mappings.push({
          sourceField: null,
          targetField: targetPath,
          transformation: {
            type: targetField.required ? 'constant' : 'default_value',
            config: { value: targetField.required ? undefined : null },
          },
          confidence: 0,
          isAmbiguous: true,
          userNote: targetField.required
            ? '필수 필드인데 소스에 대응 필드가 없습니다. 값을 지정해주세요.'
            : '소스에 대응 필드가 없습니다. null로 처리됩니다.',
        });
      }
    }

    return mappings;
  }

  private determineTransformationType(
    source: FieldSchema,
    target: TargetFieldSchema,
    nameScore: number,
  ): TransformationType {
    // codeMapping이 존재하면 computed (value_map)
    if (target.businessContext?.codeMapping && Object.keys(target.businessContext.codeMapping).length > 0) {
      return 'computed';
    }

    // description에 value_map 패턴 ("A -> B") 감지
    if (target.description && /\w+\s*(?:->|→)\s*\S+/.test(target.description)) {
      return 'computed';
    }

    // 타입이 동일하고 이름도 동일하면 direct
    if (source.type === target.type && nameScore >= 0.95) return 'direct';

    // 이름이 다르지만 타입이 같으면 rename
    if (source.type === target.type) return 'rename';

    // 타입이 다르면 type_cast
    if (source.type !== target.type) return 'type_cast';

    return 'rename';
  }

  /**
   * transformation 결정 + value_map config 생성
   */
  private determineTransformation(
    sourceField: string,
    target: TargetFieldSchema,
    baseType: TransformationType,
  ): FieldMapping['transformation'] {
    // codeMapping → computed with mapping config
    if (target.businessContext?.codeMapping && Object.keys(target.businessContext.codeMapping).length > 0) {
      return { type: 'computed', config: { mapping: target.businessContext.codeMapping } };
    }

    // description에서 value_map 패턴 파싱
    if (baseType === 'computed' && target.description) {
      const valueMap = this.parseValueMapFromDescription(target.description);
      if (valueMap) {
        return { type: 'computed', config: { mapping: valueMap } };
      }
    }

    return { type: baseType };
  }

  private parseValueMapFromDescription(description: string): Record<string, string> | null {
    const pattern = /(\w+)\s*(?:->|→)\s*(\S+)/g;
    const map: Record<string, string> = {};
    let match;
    let found = false;
    while ((match = pattern.exec(description)) !== null) {
      map[match[1]] = match[2].replace(/,\s*$/, '');
      found = true;
    }
    return found ? map : null;
  }

  private flattenFields(
    fields: Record<string, FieldSchema>,
    prefix: string,
  ): [string, FieldSchema][] {
    const result: [string, FieldSchema][] = [];

    for (const [key, field] of Object.entries(fields)) {
      const path = prefix ? `${prefix}.${key}` : key;
      result.push([path, field]);

      if (field.type === 'object' && field.children) {
        result.push(...this.flattenFields(field.children, path));
      }
    }

    return result;
  }

  private async resolveTarget(params: GenerateMappingParams): Promise<TargetProfile> {
    if (params.target.targetProfileId) {
      return this.storage.loadTarget(params.target.targetProfileId);
    }

    // user_defined: reference를 JSON으로 파싱
    if (params.target.type === 'user_defined' && params.target.reference) {
      try {
        const parsed = JSON.parse(params.target.reference);
        const target: TargetProfile = {
          id: `user-defined-${Date.now()}`,
          name: params.target.typeName || 'UserDefined',
          analyzedFrom: {
            sourceType: 'user_defined',
            analyzedAt: new Date().toISOString(),
          },
          language: params.target.language,
          fields: parsed,
        };
        await this.storage.saveTarget(target);
        return target;
      } catch {
        throw new PluginError('PARSE_FAILED', 'Target reference is not valid JSON');
      }
    }

    throw new PluginError('TARGET_NOT_FOUND', 'No target profile specified');
  }

  private buildPreview(
    fieldMappings: FieldMapping[],
    sourceSchema: ObjectSchema,
    targetProfile: TargetProfile,
    threshold: number,
  ): MappingPreview {
    const confirmed = fieldMappings.filter(fm => fm.confidence >= threshold && !fm.isAmbiguous);
    const ambiguous = fieldMappings.filter(fm => fm.isAmbiguous || (fm.confidence > 0 && fm.confidence < threshold));

    const mappedSources = new Set(
      fieldMappings
        .filter(fm => fm.sourceField !== null)
        .flatMap(fm => Array.isArray(fm.sourceField) ? fm.sourceField : [fm.sourceField!]),
    );
    const allSourceFields = Object.keys(sourceSchema.children);
    const unmapped = allSourceFields.filter(sf => !mappedSources.has(sf));

    const mappedTargets = new Set(fieldMappings.map(fm => fm.targetField));
    const allTargetFields = Object.keys(targetProfile.fields);
    const missing = allTargetFields.filter(tf =>
      !mappedTargets.has(tf) ||
      fieldMappings.find(fm => fm.targetField === tf)?.sourceField === null,
    );

    return {
      confirmedMappings: confirmed,
      ambiguousMappings: ambiguous,
      unmappedSourceFields: unmapped,
      missingTargetFields: missing,
    };
  }

  private calculateOverallConfidence(mappings: FieldMapping[]): number {
    if (mappings.length === 0) return 0;
    return mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;
  }
}
