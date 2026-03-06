import type { FieldMapping } from '../types/mapping.js';

export interface AmbiguityReport {
  ambiguousFields: AmbiguousField[];
  totalFields: number;
  ambiguousCount: number;
  ambiguityRate: number;
}

export interface AmbiguousField {
  targetField: string;
  currentMatch: { sourceField: string | null; confidence: number };
  alternatives: { sourceField: string; confidence: number }[];
  reason: string;
}

export function detectAmbiguities(
  mappings: FieldMapping[],
  threshold: number = 0.9,
): AmbiguityReport {
  const ambiguousFields: AmbiguousField[] = [];

  for (const fm of mappings) {
    if (fm.confidence < threshold && fm.confidence > 0) {
      ambiguousFields.push({
        targetField: fm.targetField,
        currentMatch: {
          sourceField: Array.isArray(fm.sourceField) ? fm.sourceField[0] : fm.sourceField,
          confidence: fm.confidence,
        },
        alternatives: [],
        reason: fm.confidence < 0.5
          ? '매우 낮은 신뢰도 - 수동 매핑 권장'
          : fm.confidence < 0.7
            ? '낮은 신뢰도 - 확인 필요'
            : '중간 신뢰도 - 자동 매핑 가능하나 확인 권장',
      });
    } else if (fm.sourceField === null) {
      ambiguousFields.push({
        targetField: fm.targetField,
        currentMatch: { sourceField: null, confidence: 0 },
        alternatives: [],
        reason: '소스에 대응 필드 없음 - 값 지정 필요',
      });
    }
  }

  return {
    ambiguousFields,
    totalFields: mappings.length,
    ambiguousCount: ambiguousFields.length,
    ambiguityRate: mappings.length > 0 ? ambiguousFields.length / mappings.length : 0,
  };
}

export function suggestUserActions(report: AmbiguityReport): string[] {
  const suggestions: string[] = [];

  if (report.ambiguityRate > 0.5) {
    suggestions.push('매핑 대부분이 모호합니다. 타겟 필드 정의를 다시 확인해주세요.');
  }

  for (const field of report.ambiguousFields) {
    if (field.currentMatch.sourceField === null) {
      suggestions.push(`"${field.targetField}": 소스에 대응 필드가 없습니다. update_mapping으로 값을 지정해주세요.`);
    } else if (field.alternatives.length > 0) {
      suggestions.push(`"${field.targetField}": ${field.alternatives.length}개의 대안이 있습니다. 확인해주세요.`);
    }
  }

  return suggestions;
}
