import type { FieldSchema, ObjectSchema } from '../types/profile.js';

export interface FlattenedField {
  path: string;
  schema: FieldSchema;
  depth: number;
}

export function flattenObjectSchema(
  schema: ObjectSchema,
  maxDepth: number = 10,
): FlattenedField[] {
  const result: FlattenedField[] = [];
  flattenRecursive(schema.children, '', 0, maxDepth, result);
  return result;
}

function flattenRecursive(
  fields: Record<string, FieldSchema>,
  prefix: string,
  depth: number,
  maxDepth: number,
  result: FlattenedField[],
): void {
  if (depth > maxDepth) return;

  for (const [key, field] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    result.push({ path, schema: field, depth });

    if (field.type === 'object' && field.children) {
      flattenRecursive(field.children, path, depth + 1, maxDepth, result);
    }

    if (field.type === 'array' && field.items?.type === 'object' && field.items.children) {
      flattenRecursive(field.items.children, `${path}[]`, depth + 1, maxDepth, result);
    }
  }
}

export function buildNestedPath(flatPath: string): { parts: string[]; hasArray: boolean } {
  const parts = flatPath.split('.');
  const hasArray = parts.some(p => p.endsWith('[]'));
  return {
    parts: parts.map(p => p.replace('[]', '')),
    hasArray,
  };
}

export function extractNestedValue(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = source;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;

    if (part.endsWith('[]')) {
      const key = part.slice(0, -2);
      const arr = (current as Record<string, unknown>)[key];
      return Array.isArray(arr) ? arr : undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
