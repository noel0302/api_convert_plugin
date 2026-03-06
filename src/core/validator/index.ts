import type { StorageService } from '../services/storage.js';
import type { LogService } from '../services/log.js';
import type { MappingRule, FieldMapping } from '../types/mapping.js';
import type { SupportedLanguage } from '../types/target.js';
import { generateTestCode, type TestConfig, type GeneratedTest } from './test-generator.js';
import { generateTestPageHtml } from './test-page-generator.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sampleOutput?: unknown;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

export interface FieldResult {
  field: string;
  sourceValue: unknown;
  transformedValue: unknown;
  expectedType: string;
  actualType: string;
  isValid: boolean;
  warning?: string;
}

export interface DryRunResult {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  fieldResults: FieldResult[];
  appliedMappings: string[];
  skippedMappings: { field: string; reason: string }[];
  summary: {
    totalFields: number;
    successFields: number;
    warningFields: number;
    failedFields: number;
  };
}

export class ValidatorModule {
  constructor(
    private storage: StorageService,
    private log: LogService,
  ) {}

  async validateMapping(mappingId: string): Promise<ValidationResult> {
    const mapping = await this.storage.loadMappingById(mappingId);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const fm of mapping.fieldMappings) {
      if (fm.sourceField === null && fm.transformation.type !== 'constant' && fm.transformation.type !== 'default_value') {
        errors.push({
          field: fm.targetField,
          message: `소스 필드 없음, transformation type이 '${fm.transformation.type}'이면 값 생성 불가`,
          severity: 'error',
        });
      }

      if (fm.isAmbiguous) {
        warnings.push({
          field: fm.targetField,
          message: `신뢰도 ${fm.confidence.toFixed(2)} - 수동 확인 필요`,
          severity: 'warning',
        });
      }

      if (fm.confidence < 0.5 && fm.sourceField !== null) {
        warnings.push({
          field: fm.targetField,
          message: `낮은 신뢰도 (${fm.confidence.toFixed(2)}) - 매핑이 부정확할 수 있음`,
          severity: 'warning',
        });
      }
    }

    this.checkDuplicateTargets(mapping.fieldMappings, errors);
    this.checkCircularDependencies(mapping.fieldMappings, errors);

    await this.log.info('Validator', `Validation: ${errors.length} errors, ${warnings.length} warnings`);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async dryRun(mappingId: string, sampleData: Record<string, unknown>): Promise<DryRunResult> {
    const mapping = await this.storage.loadMappingById(mappingId);
    const output: Record<string, unknown> = {};
    const appliedMappings: string[] = [];
    const skippedMappings: { field: string; reason: string }[] = [];
    const fieldResults: FieldResult[] = [];

    for (const fm of mapping.fieldMappings) {
      try {
        const sourceValue = this.resolveValue(fm, sampleData);
        const transformedValue = sourceValue;
        output[fm.targetField] = transformedValue;
        appliedMappings.push(fm.targetField);

        const expectedType = fm.transformation.type === 'type_cast'
          ? (fm.transformation.config?.targetType as string ?? typeof transformedValue)
          : typeof sourceValue === 'object' && sourceValue !== null
            ? (Array.isArray(sourceValue) ? 'array' : 'object')
            : typeof sourceValue;
        const actualType = transformedValue === null ? 'null'
          : Array.isArray(transformedValue) ? 'array'
          : typeof transformedValue;
        const isValid = actualType === expectedType || expectedType === 'unknown';
        const warning = fm.isAmbiguous ? `신뢰도 ${fm.confidence.toFixed(2)} - 확인 필요` : undefined;

        fieldResults.push({
          field: fm.targetField,
          sourceValue,
          transformedValue,
          expectedType,
          actualType,
          isValid,
          warning,
        });
      } catch (err) {
        skippedMappings.push({
          field: fm.targetField,
          reason: err instanceof Error ? err.message : String(err),
        });
        fieldResults.push({
          field: fm.targetField,
          sourceValue: undefined,
          transformedValue: undefined,
          expectedType: 'unknown',
          actualType: 'undefined',
          isValid: false,
          warning: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const successFields = fieldResults.filter(r => r.isValid && !r.warning).length;
    const warningFields = fieldResults.filter(r => r.isValid && r.warning).length;
    const failedFields = fieldResults.filter(r => !r.isValid).length;

    await this.log.info('Validator', `Dry run: ${appliedMappings.length} applied, ${skippedMappings.length} skipped`);

    return {
      input: sampleData,
      output,
      fieldResults,
      appliedMappings,
      skippedMappings,
      summary: {
        totalFields: fieldResults.length,
        successFields,
        warningFields,
        failedFields,
      },
    };
  }

  private resolveValue(fm: FieldMapping, source: Record<string, unknown>): unknown {
    if (fm.sourceField === null) {
      if (fm.transformation.type === 'constant') {
        return fm.transformation.config?.value ?? null;
      }
      return fm.transformation.config?.fallback ?? null;
    }

    const field = Array.isArray(fm.sourceField) ? fm.sourceField[0] : fm.sourceField;
    const parts = field.split('.');
    let value: unknown = source;

    for (const part of parts) {
      if (value == null || typeof value !== 'object') return null;
      value = (value as Record<string, unknown>)[part];
    }

    if (fm.transformation.type === 'default_value' && value == null) {
      return fm.transformation.config?.fallback ?? null;
    }

    return value;
  }

  async generateTest(mappingId: string, config?: TestConfig): Promise<GeneratedTest> {
    const mapping = await this.storage.loadMappingById(mappingId);
    const result = generateTestCode(mapping, config);
    await this.log.info('Validator', `Test generated: ${result.framework} → ${result.filePath}`);
    return result;
  }

  async generateTestPage(mappingId: string): Promise<string> {
    const mapping = await this.storage.loadMappingById(mappingId);
    const html = generateTestPageHtml(mapping);
    await this.log.info('Validator', `Test page generated for ${mappingId}`);
    return html;
  }

  private checkDuplicateTargets(mappings: FieldMapping[], errors: ValidationError[]): void {
    const seen = new Set<string>();
    for (const fm of mappings) {
      if (seen.has(fm.targetField)) {
        errors.push({
          field: fm.targetField,
          message: `타겟 필드 중복 매핑 - 하나의 타겟에 여러 소스가 매핑됨`,
          severity: 'error',
        });
      }
      seen.add(fm.targetField);
    }
  }

  private checkCircularDependencies(mappings: FieldMapping[], errors: ValidationError[]): void {
    for (const fm of mappings) {
      if (fm.transformation.type === 'computed' && fm.transformation.config?.expression) {
        const expr = String(fm.transformation.config.expression);
        if (expr.includes(fm.targetField)) {
          errors.push({
            field: fm.targetField,
            message: `자기 참조 순환 의존성 감지`,
            severity: 'error',
          });
        }
      }
    }
  }
}
