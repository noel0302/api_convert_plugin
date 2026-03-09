import type { StorageService } from '../services/storage.js';
import type { ConfigService } from '../services/config.js';
import type { LogService } from '../services/log.js';
import type { ObjectSchema } from '../types/profile.js';
import type { TargetProfile, SupportedLanguage } from '../types/target.js';
import type { MappingRule, FieldMapping, TransformationType, TransformConfig } from '../types/mapping.js';
import type { ChangeSource, FieldChange } from '../types/history.js';
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
  fieldMappings: Array<{
    sourceField: string | string[] | null;
    targetField: string;
    transformation?: { type: TransformationType; config?: TransformConfig };
    confidence?: number;
    userNote?: string;
  }>;
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

    // 5. 필드 매핑 변환
    const fieldMappings: FieldMapping[] = params.fieldMappings.map(fm => ({
      sourceField: fm.sourceField,
      targetField: fm.targetField,
      transformation: fm.transformation ?? { type: 'rename' as TransformationType },
      confidence: fm.confidence ?? 1.0,
      isAmbiguous: false,
      ...(fm.userNote ? { userNote: fm.userNote } : {}),
    }));

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
