import { describe, it, expect } from 'vitest';
import { detectAmbiguities, suggestUserActions } from '../../src/core/mapper/ambiguity-detector.js';
import type { FieldMapping } from '../../src/core/types/mapping.js';

const makeFm = (target: string, source: string | null, confidence: number): FieldMapping => ({
  sourceField: source,
  targetField: target,
  transformation: { type: 'direct' },
  confidence,
  isAmbiguous: confidence < 0.9,
  alternatives: [],
});

describe('detectAmbiguities', () => {
  it('높은 신뢰도 매핑은 모호하지 않음', () => {
    const mappings = [makeFm('name', 'name', 0.95), makeFm('email', 'email', 1.0)];
    const report = detectAmbiguities(mappings);
    expect(report.ambiguousCount).toBe(0);
    expect(report.ambiguityRate).toBe(0);
  });

  it('낮은 신뢰도 매핑을 감지', () => {
    const mappings = [makeFm('name', 'nm', 0.6), makeFm('email', 'email', 1.0)];
    const report = detectAmbiguities(mappings);
    expect(report.ambiguousCount).toBe(1);
    expect(report.ambiguousFields[0].reason).toContain('확인 필요');
  });

  it('매우 낮은 신뢰도(< 0.5)', () => {
    const mappings = [makeFm('address', 'addr', 0.3)];
    const report = detectAmbiguities(mappings);
    expect(report.ambiguousFields[0].reason).toContain('수동 매핑');
  });

  it('sourceField가 null인 경우', () => {
    const mappings = [makeFm('defaultRole', null, 0)];
    const report = detectAmbiguities(mappings);
    expect(report.ambiguousCount).toBe(1);
    expect(report.ambiguousFields[0].reason).toContain('대응 필드 없음');
  });

  it('빈 매핑 → ambiguityRate 0', () => {
    const report = detectAmbiguities([]);
    expect(report.ambiguityRate).toBe(0);
    expect(report.totalFields).toBe(0);
  });
});

describe('suggestUserActions', () => {
  it('모호율 높으면 전체 확인 권장', () => {
    const report = detectAmbiguities([makeFm('a', 'x', 0.5), makeFm('b', null, 0)]);
    const suggestions = suggestUserActions(report);
    expect(suggestions.some(s => s.includes('대부분이 모호'))).toBe(true);
  });

  it('null sourceField 대응 안내', () => {
    const report = detectAmbiguities([makeFm('role', null, 0)]);
    const suggestions = suggestUserActions(report);
    expect(suggestions.some(s => s.includes('update_mapping'))).toBe(true);
  });
});
