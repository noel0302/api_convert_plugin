import { describe, it, expect } from 'vitest';
import { checkTypeConversion } from '../../src/core/mapper/type-converter.js';

describe('checkTypeConversion', () => {
  it('같은 타입이면 direct', () => {
    const result = checkTypeConversion('string', 'string');
    expect(result.possible).toBe(true);
    expect(result.transformation).toBe('direct');
  });

  it('string → number: type_cast', () => {
    const result = checkTypeConversion('string', 'number');
    expect(result.possible).toBe(true);
    expect(result.transformation).toBe('type_cast');
  });

  it('number → string: type_cast', () => {
    const result = checkTypeConversion('number', 'string');
    expect(result.possible).toBe(true);
    expect(result.transformation).toBe('type_cast');
  });

  it('object → string: format (JSON.stringify)', () => {
    const result = checkTypeConversion('object', 'string');
    expect(result.possible).toBe(true);
    expect(result.transformation).toBe('format');
  });

  it('string → object: 불가', () => {
    const result = checkTypeConversion('string', 'object');
    expect(result.possible).toBe(false);
  });

  it('array → array: direct (같은 타입)', () => {
    const result = checkTypeConversion('array', 'array');
    expect(result.possible).toBe(true);
    expect(result.transformation).toBe('direct');
  });

  it('array → object: array_to_object', () => {
    const result = checkTypeConversion('array', 'object');
    expect(result.possible).toBe(true);
    expect(result.transformation).toBe('array_to_object');
  });

  it('boolean → object: 불가', () => {
    const result = checkTypeConversion('boolean', 'object');
    expect(result.possible).toBe(false);
  });
});
