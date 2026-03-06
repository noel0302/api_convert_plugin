import type { FieldSchema } from '../types/profile.js';
import type { FieldMapping, TransformationType } from '../types/mapping.js';

export interface ArrayMappingStrategy {
  type: 'map' | 'flatten' | 'filter' | 'reduce' | 'first' | 'collect';
  itemMapping?: FieldMapping[];
}

export function detectArrayMapping(
  sourceField: FieldSchema,
  targetField: FieldSchema,
): ArrayMappingStrategy {
  // 배열 → 배열: array_map (요소별 변환)
  if (sourceField.type === 'array' && targetField.type === 'array') {
    return { type: 'map' };
  }

  // 배열 → 단일값: first 또는 reduce
  if (sourceField.type === 'array' && targetField.type !== 'array') {
    if (targetField.type === 'number') {
      return { type: 'reduce' }; // count, sum 등
    }
    return { type: 'first' }; // 첫 번째 요소
  }

  // 단일값 → 배열: collect (단일을 배열로 래핑)
  if (sourceField.type !== 'array' && targetField.type === 'array') {
    return { type: 'collect' };
  }

  return { type: 'map' };
}

export function determineArrayTransformationType(strategy: ArrayMappingStrategy): TransformationType {
  switch (strategy.type) {
    case 'map': return 'array_map';
    case 'flatten': return 'array_flatten';
    case 'filter': return 'array_map';
    case 'reduce': return 'computed';
    case 'first': return 'nested_extract';
    case 'collect': return 'restructure';
    default: return 'array_map';
  }
}
