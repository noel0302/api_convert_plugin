import { describe, it, expect } from 'vitest';
import { detectArrayMapping, determineArrayTransformationType } from '../../src/core/mapper/array-handler.js';
import type { FieldSchema } from '../../src/core/types/profile.js';

const field = (type: string): FieldSchema => ({ type: type as any, nullable: false, required: true });

describe('detectArrayMapping', () => {
  it('array → array: map', () => {
    const result = detectArrayMapping(field('array'), field('array'));
    expect(result.type).toBe('map');
  });

  it('array → number: reduce', () => {
    const result = detectArrayMapping(field('array'), field('number'));
    expect(result.type).toBe('reduce');
  });

  it('array → string: first', () => {
    const result = detectArrayMapping(field('array'), field('string'));
    expect(result.type).toBe('first');
  });

  it('string → array: collect', () => {
    const result = detectArrayMapping(field('string'), field('array'));
    expect(result.type).toBe('collect');
  });

  it('string → string: map (fallback)', () => {
    const result = detectArrayMapping(field('string'), field('string'));
    expect(result.type).toBe('map');
  });
});

describe('determineArrayTransformationType', () => {
  it('map → array_map', () => {
    expect(determineArrayTransformationType({ type: 'map' })).toBe('array_map');
  });

  it('flatten → array_flatten', () => {
    expect(determineArrayTransformationType({ type: 'flatten' })).toBe('array_flatten');
  });

  it('reduce → computed', () => {
    expect(determineArrayTransformationType({ type: 'reduce' })).toBe('computed');
  });

  it('first → nested_extract', () => {
    expect(determineArrayTransformationType({ type: 'first' })).toBe('nested_extract');
  });

  it('collect → restructure', () => {
    expect(determineArrayTransformationType({ type: 'collect' })).toBe('restructure');
  });
});
