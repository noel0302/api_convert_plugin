import type { FieldType } from '../types/profile.js';
import type { TransformationType } from '../types/mapping.js';

export interface TypeConversion {
  possible: boolean;
  transformation: TransformationType;
  warning?: string;
}

const TYPE_COMPATIBILITY: Record<string, Record<string, { possible: boolean; type: TransformationType; warning?: string }>> = {
  string: {
    string: { possible: true, type: 'direct' },
    number: { possible: true, type: 'type_cast', warning: 'parseFloat/parseInt 변환 필요' },
    boolean: { possible: true, type: 'type_cast', warning: '"true"/"false" 문자열 변환' },
    object: { possible: false, type: 'custom' },
    array: { possible: false, type: 'custom' },
  },
  number: {
    string: { possible: true, type: 'type_cast' },
    number: { possible: true, type: 'direct' },
    boolean: { possible: true, type: 'type_cast', warning: '0/1 → boolean 변환' },
    object: { possible: false, type: 'custom' },
    array: { possible: false, type: 'custom' },
  },
  boolean: {
    string: { possible: true, type: 'type_cast' },
    number: { possible: true, type: 'type_cast' },
    boolean: { possible: true, type: 'direct' },
    object: { possible: false, type: 'custom' },
    array: { possible: false, type: 'custom' },
  },
  object: {
    string: { possible: true, type: 'format', warning: 'JSON.stringify 변환' },
    number: { possible: false, type: 'custom' },
    boolean: { possible: false, type: 'custom' },
    object: { possible: true, type: 'restructure' },
    array: { possible: false, type: 'custom' },
  },
  array: {
    string: { possible: true, type: 'format', warning: 'JSON.stringify 변환' },
    number: { possible: true, type: 'computed', warning: 'array.length 등 집계' },
    boolean: { possible: true, type: 'computed', warning: 'array.length > 0 등 변환' },
    object: { possible: true, type: 'array_to_object' },
    array: { possible: true, type: 'array_map' },
  },
};

export function checkTypeConversion(sourceType: FieldType, targetType: FieldType): TypeConversion {
  if (sourceType === targetType) {
    return { possible: true, transformation: 'direct' };
  }

  const compat = TYPE_COMPATIBILITY[sourceType]?.[targetType];
  if (compat) {
    return {
      possible: compat.possible,
      transformation: compat.type,
      warning: compat.warning,
    };
  }

  return { possible: false, transformation: 'custom', warning: `${sourceType} → ${targetType} 자동 변환 불가` };
}
