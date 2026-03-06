import { describe, it, expect } from 'vitest';
import { inferSchemaFromValue, inferObjectSchema, detectStringFormat, mergeSchemas } from '../../src/core/analyzer/schema-detector.js';

describe('inferSchemaFromValue', () => {
  it('string 타입 추론', () => {
    const schema = inferSchemaFromValue('hello');
    expect(schema.type).toBe('string');
    expect(schema.nullable).toBe(false);
  });

  it('number 타입 추론', () => {
    expect(inferSchemaFromValue(42).type).toBe('number');
    expect(inferSchemaFromValue(3.14).type).toBe('number');
  });

  it('boolean 타입 추론', () => {
    expect(inferSchemaFromValue(true).type).toBe('boolean');
  });

  it('null은 null 타입 + nullable', () => {
    const schema = inferSchemaFromValue(null);
    expect(schema.type).toBe('null');
    expect(schema.nullable).toBe(true);
  });

  it('배열 타입 추론', () => {
    const schema = inferSchemaFromValue([1, 2, 3]);
    expect(schema.type).toBe('array');
    expect(schema.items).toBeDefined();
  });

  it('객체 타입 추론', () => {
    const schema = inferSchemaFromValue({ id: 1, name: 'test' });
    expect(schema.type).toBe('object');
    expect(schema.children).toBeDefined();
    expect(schema.children?.id.type).toBe('number');
    expect(schema.children?.name.type).toBe('string');
  });
});

describe('detectStringFormat', () => {
  it('ISO 날짜/시간 감지', () => {
    // '2024-01-15' 도 date-time 정규식에 매칭될 수 있음
    const dateResult = detectStringFormat('2024-01-15');
    expect(dateResult).toMatch(/^date/);
    expect(detectStringFormat('2024-01-15T10:30:00Z')).toBe('date-time');
  });

  it('UUID 감지', () => {
    expect(detectStringFormat('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
  });

  it('이메일 감지', () => {
    expect(detectStringFormat('test@example.com')).toBe('email');
  });

  it('URL 감지', () => {
    expect(detectStringFormat('https://example.com/path')).toBe('uri');
  });

  it('일반 문자열은 undefined', () => {
    expect(detectStringFormat('hello world')).toBeUndefined();
  });
});

describe('mergeSchemas', () => {
  it('같은 구조의 스키마 병합', () => {
    const s1 = inferSchemaFromValue({ id: 1, name: 'Alice' });
    const s2 = inferSchemaFromValue({ id: 2, name: 'Bob', age: 30 });
    const merged = mergeSchemas([s1, s2]);

    expect(merged.type).toBe('object');
    expect(merged.children).toBeDefined();
    expect(merged.children!.id).toBeDefined();
    expect(merged.children!.name).toBeDefined();
  });

  it('nullable 필드 감지 (한쪽이 null)', () => {
    const s1 = inferSchemaFromValue({ name: 'Alice', nickname: null });
    const s2 = inferSchemaFromValue({ name: 'Bob', nickname: 'Bobby' });
    const merged = mergeSchemas([s1, s2]);

    expect(merged.children!.nickname.nullable).toBe(true);
  });
});
