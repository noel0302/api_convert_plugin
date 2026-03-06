import type { FieldMapping } from '../types/mapping.js';
import type { ConflictResolution } from '../types/conflict.js';

export interface ConflictInfo {
  targetField: string;
  candidates: { sourceField: string; confidence: number }[];
  resolution?: ConflictResolution;
}

export function detectConflicts(mappings: FieldMapping[]): ConflictInfo[] {
  const targetMap = new Map<string, FieldMapping[]>();

  for (const fm of mappings) {
    const existing = targetMap.get(fm.targetField) || [];
    existing.push(fm);
    targetMap.set(fm.targetField, existing);
  }

  const conflicts: ConflictInfo[] = [];

  for (const [targetField, fms] of targetMap) {
    if (fms.length > 1) {
      conflicts.push({
        targetField,
        candidates: fms.map(fm => ({
          sourceField: Array.isArray(fm.sourceField) ? fm.sourceField.join(', ') : (fm.sourceField || 'null'),
          confidence: fm.confidence,
        })),
      });
    }
  }

  return conflicts;
}

export function resolveConflict(
  conflict: ConflictInfo,
  strategy: 'highest_confidence' | 'first_match' | 'merge' | 'user_choice' = 'highest_confidence',
): ConflictResolution {
  switch (strategy) {
    case 'highest_confidence': {
      const best = conflict.candidates.sort((a, b) => b.confidence - a.confidence)[0];
      return {
        targetField: conflict.targetField,
        strategy,
        resolvedSource: best.sourceField,
        confidence: best.confidence,
      };
    }
    case 'first_match': {
      const first = conflict.candidates[0];
      return {
        targetField: conflict.targetField,
        strategy,
        resolvedSource: first.sourceField,
        confidence: first.confidence,
      };
    }
    case 'merge':
      return {
        targetField: conflict.targetField,
        strategy,
        resolvedSource: conflict.candidates.map(c => c.sourceField).join(' + '),
        confidence: Math.max(...conflict.candidates.map(c => c.confidence)),
      };
    case 'user_choice':
    default:
      return {
        targetField: conflict.targetField,
        strategy: 'user_choice',
        resolvedSource: '',
        confidence: 0,
      };
  }
}
