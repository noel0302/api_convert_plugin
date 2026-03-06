import { describe, it, expect } from 'vitest';
import { calculateNameScore, calculateTypeScore, calculateMatchScore } from '../../src/core/mapper/field-matcher.js';

describe('calculateNameScore', () => {
  it('정확히 일치하면 1.0', () => {
    expect(calculateNameScore('userId', 'userId')).toBe(1.0);
  });

  it('네이밍 컨벤션 변환 후 일치하면 0.95', () => {
    expect(calculateNameScore('user_name', 'userName')).toBe(0.95);
    expect(calculateNameScore('firstName', 'first_name')).toBe(0.95);
  });

  it('약어 확장 후 일치하면 0.85', () => {
    expect(calculateNameScore('nm', 'name')).toBe(0.85);
    expect(calculateNameScore('addr', 'address')).toBe(0.85);
    expect(calculateNameScore('tel', 'telephone')).toBe(0.85);
  });

  it('phone ↔ tel은 약어 사전에서 0.85', () => {
    // tel → ['telephone', 'phone'] 이므로 약어 확장으로 매칭
    expect(calculateNameScore('phone', 'tel')).toBe(0.85);
  });

  it('완전히 다른 이름은 낮은 점수', () => {
    const score = calculateNameScore('apple', 'zebra');
    expect(score).toBeLessThan(0.3);
  });

  it('dot notation에서 마지막 부분만 비교', () => {
    expect(calculateNameScore('user.name', 'profile.name')).toBe(1.0);
    expect(calculateNameScore('response.data.id', 'item.id')).toBe(1.0);
  });
});

describe('calculateTypeScore', () => {
  it('같은 타입이면 1.0', () => {
    expect(calculateTypeScore('string', 'string')).toBe(1.0);
    expect(calculateTypeScore('number', 'number')).toBe(1.0);
  });

  it('string ↔ number 변환은 0.7', () => {
    expect(calculateTypeScore('string', 'number')).toBe(0.7);
    expect(calculateTypeScore('number', 'string')).toBe(0.7);
  });

  it('호환 불가 타입은 낮은 점수', () => {
    expect(calculateTypeScore('string', 'array')).toBe(0.1);
    expect(calculateTypeScore('boolean', 'object')).toBe(0.1);
  });
});

describe('calculateMatchScore', () => {
  it('종합 점수 계산 (이름 60%, 타입 30%, 위치 10%)', () => {
    const result = calculateMatchScore('userId', 'userId', 'string', 'string');
    // nameScore=1.0, typeScore=1.0, positionScore=0.5
    // total = 1.0*0.6 + 1.0*0.3 + 0.5*0.1 = 0.95
    expect(result.totalScore).toBeCloseTo(0.95, 2);
  });

  it('이름 일치 + 타입 불일치', () => {
    const result = calculateMatchScore('count', 'count', 'string', 'number');
    expect(result.nameScore).toBe(1.0);
    expect(result.typeScore).toBe(0.7);
    expect(result.totalScore).toBeGreaterThan(0.8);
  });
});
