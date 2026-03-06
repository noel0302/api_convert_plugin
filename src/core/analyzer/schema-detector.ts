import type { FieldSchema, FieldType, ObjectSchema } from '../types/profile.js';

/**
 * JSON 데이터에서 스키마를 추론하는 유틸리티.
 * 실제 값을 분석하여 타입, nullable, enum, format 등을 감지.
 */

export function inferSchemaFromValue(value: unknown): FieldSchema {
  if (value === null) {
    return { type: 'null', nullable: true, required: false };
  }

  if (value === undefined) {
    return { type: 'unknown', nullable: true, required: false };
  }

  if (typeof value === 'string') {
    return {
      type: 'string',
      nullable: false,
      required: true,
      format: detectStringFormat(value),
      example: value,
    };
  }

  if (typeof value === 'number') {
    return {
      type: 'number',
      nullable: false,
      required: true,
      example: value,
    };
  }

  if (typeof value === 'boolean') {
    return {
      type: 'boolean',
      nullable: false,
      required: true,
      example: value,
    };
  }

  if (Array.isArray(value)) {
    const items = value.length > 0 ? inferSchemaFromValue(value[0]) : { type: 'unknown' as FieldType, nullable: true, required: false };
    return {
      type: 'array',
      nullable: false,
      required: true,
      items,
      example: value.length > 0 ? value.slice(0, 2) : undefined,
    };
  }

  if (typeof value === 'object') {
    const children: Record<string, FieldSchema> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      children[key] = inferSchemaFromValue(val);
    }
    return {
      type: 'object',
      nullable: false,
      required: true,
      children,
    };
  }

  return { type: 'unknown', nullable: true, required: false };
}

export function inferObjectSchema(obj: Record<string, unknown>): ObjectSchema {
  const children: Record<string, FieldSchema> = {};
  for (const [key, value] of Object.entries(obj)) {
    children[key] = inferSchemaFromValue(value);
  }
  return { type: 'object', children };
}

export function detectStringFormat(value: string): string | undefined {
  // ISO 8601 날짜
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) return 'date-time';

  // yyyyMMddHHmmss
  if (/^\d{14}$/.test(value)) return 'date-compact';

  // yyyyMMdd
  if (/^\d{8}$/.test(value) && parseInt(value.slice(0, 4)) > 1900) return 'date-compact';

  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid';

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';

  // URL
  if (/^https?:\/\/.+/.test(value)) return 'uri';

  // IP address
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return 'ipv4';

  // Phone (한국 전화번호)
  if (/^0\d{1,2}-\d{3,4}-\d{4}$/.test(value)) return 'phone';

  return undefined;
}

/**
 * 여러 샘플을 병합하여 보다 정확한 스키마를 추론.
 * nullable, required 등을 샘플 간 비교로 결정.
 */
export function mergeSchemas(schemas: FieldSchema[]): FieldSchema {
  if (schemas.length === 0) return { type: 'unknown', nullable: true, required: false };
  if (schemas.length === 1) return schemas[0];

  const types = new Set(schemas.map(s => s.type));
  const hasNull = types.has('null');
  types.delete('null');
  types.delete('unknown');

  const primaryType: FieldType = types.size === 1
    ? [...types][0]
    : types.size === 0 ? 'unknown' : 'string'; // fallback to string if mixed

  return {
    type: primaryType,
    nullable: hasNull || schemas.some(s => s.nullable),
    required: schemas.every(s => s.required),
    format: schemas.find(s => s.format)?.format,
    children: primaryType === 'object'
      ? mergeObjectChildren(schemas.filter(s => s.children).map(s => s.children!))
      : undefined,
    items: primaryType === 'array'
      ? schemas.find(s => s.items)?.items
      : undefined,
  };
}

function mergeObjectChildren(childrenList: Record<string, FieldSchema>[]): Record<string, FieldSchema> {
  const allKeys = new Set(childrenList.flatMap(c => Object.keys(c)));
  const merged: Record<string, FieldSchema> = {};

  for (const key of allKeys) {
    const fieldSchemas = childrenList
      .filter(c => c[key])
      .map(c => c[key]);
    merged[key] = mergeSchemas(fieldSchemas);

    // key가 모든 샘플에 없으면 required=false
    if (fieldSchemas.length < childrenList.length) {
      merged[key].required = false;
    }
  }

  return merged;
}
