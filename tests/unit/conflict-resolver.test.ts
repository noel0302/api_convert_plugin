import { describe, it, expect } from 'vitest';
import { detectConflicts, resolveConflict } from '../../src/core/mapper/conflict-resolver.js';
import type { FieldMapping } from '../../src/core/types/mapping.js';

describe('detectConflicts', () => {
  it('중복 타겟 필드 감지', () => {
    const mappings: FieldMapping[] = [
      { sourceField: 'name', targetField: 'userName', transformation: { type: 'direct' }, confidence: 0.9, isAmbiguous: false },
      { sourceField: 'display_name', targetField: 'userName', transformation: { type: 'rename' }, confidence: 0.7, isAmbiguous: true },
      { sourceField: 'id', targetField: 'userId', transformation: { type: 'direct' }, confidence: 1.0, isAmbiguous: false },
    ];

    const conflicts = detectConflicts(mappings);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].targetField).toBe('userName');
    expect(conflicts[0].candidates).toHaveLength(2);
  });

  it('충돌 없으면 빈 배열', () => {
    const mappings: FieldMapping[] = [
      { sourceField: 'id', targetField: 'userId', transformation: { type: 'direct' }, confidence: 1.0, isAmbiguous: false },
      { sourceField: 'name', targetField: 'userName', transformation: { type: 'direct' }, confidence: 1.0, isAmbiguous: false },
    ];

    expect(detectConflicts(mappings)).toHaveLength(0);
  });
});

describe('resolveConflict', () => {
  const conflict = {
    targetField: 'userName',
    candidates: [
      { sourceField: 'name', confidence: 0.9 },
      { sourceField: 'display_name', confidence: 0.7 },
    ],
  };

  it('highest_confidence: 가장 높은 신뢰도 선택', () => {
    const resolution = resolveConflict(conflict, 'highest_confidence');
    expect(resolution.resolvedSource).toBe('name');
    expect(resolution.confidence).toBe(0.9);
  });

  it('first_match: 첫 번째 후보 선택', () => {
    const resolution = resolveConflict(conflict, 'first_match');
    expect(resolution.resolvedSource).toBe('name');
  });

  it('merge: 모든 후보 합산', () => {
    const resolution = resolveConflict(conflict, 'merge');
    expect(resolution.resolvedSource).toContain('+');
  });
});
