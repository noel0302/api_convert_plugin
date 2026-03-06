import { describe, it, expect } from 'vitest';
import { inferObjectSchema } from '../../src/core/analyzer/schema-detector.js';
import { calculateNameScore } from '../../src/core/mapper/field-matcher.js';

describe('Large Schema Performance', () => {
  it('1000+ 필드 스키마 추론', () => {
    const largeObject: Record<string, unknown> = {};
    for (let i = 0; i < 1000; i++) {
      largeObject[`field_${i}`] = i % 3 === 0 ? `value_${i}` : i % 3 === 1 ? i : i % 2 === 0;
    }

    const start = Date.now();
    const schema = inferObjectSchema(largeObject);
    const elapsed = Date.now() - start;

    expect(Object.keys(schema.children ?? {}).length).toBe(1000);
    expect(elapsed).toBeLessThan(5000); // 5초 이내
  });

  it('1000 필드 매칭 계산 성능', () => {
    // 동일 필드명을 사용하여 매칭 확인
    const fields = Array.from({ length: 1000 }, (_, i) => `field_${i}`);

    const start = Date.now();
    let matchCount = 0;

    // 100x100 매칭 성능 테스트
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 100; j++) {
        const score = calculateNameScore(fields[i], fields[j]);
        if (score > 0.5) matchCount++;
      }
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
    // 대각선 (i === j)일 때 완전 일치 → 최소 100개
    expect(matchCount).toBeGreaterThanOrEqual(100);
  });

  it('깊은 중첩 스키마 (10레벨)', () => {
    let nested: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 10; i++) {
      nested = { [`level_${i}`]: nested };
    }

    const schema = inferObjectSchema(nested);
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.children ?? {}).length).toBeGreaterThan(0);
  });
});
