import { describe, it, expect } from 'vitest';
import { flattenObjectSchema, buildNestedPath, extractNestedValue } from '../../src/core/mapper/nested-handler.js';
import type { ObjectSchema } from '../../src/core/types/profile.js';

describe('flattenObjectSchema', () => {
  it('단순 객체 플래튼', () => {
    const schema: ObjectSchema = {
      type: 'object',
      children: {
        id: { type: 'number', nullable: false, required: true },
        name: { type: 'string', nullable: false, required: true },
      },
      nullable: false,
      required: true,
    };
    const result = flattenObjectSchema(schema);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('id');
    expect(result[1].path).toBe('name');
  });

  it('중첩 객체 플래튼', () => {
    const schema: ObjectSchema = {
      type: 'object',
      children: {
        user: {
          type: 'object',
          nullable: false,
          required: true,
          children: {
            name: { type: 'string', nullable: false, required: true },
            age: { type: 'number', nullable: false, required: true },
          },
        },
      },
      nullable: false,
      required: true,
    };
    const result = flattenObjectSchema(schema);
    expect(result.some(r => r.path === 'user.name')).toBe(true);
    expect(result.some(r => r.path === 'user.age')).toBe(true);
  });

  it('maxDepth 제한', () => {
    const schema: ObjectSchema = {
      type: 'object',
      children: {
        a: { type: 'object', nullable: false, required: true, children: {
          b: { type: 'object', nullable: false, required: true, children: {
            c: { type: 'string', nullable: false, required: true },
          }},
        }},
      },
      nullable: false,
      required: true,
    };
    const result = flattenObjectSchema(schema, 1);
    expect(result.some(r => r.path === 'a.b')).toBe(true);
    expect(result.some(r => r.path === 'a.b.c')).toBe(false);
  });
});

describe('buildNestedPath', () => {
  it('단순 경로', () => {
    expect(buildNestedPath('name')).toEqual({ parts: ['name'], hasArray: false });
  });

  it('중첩 경로', () => {
    expect(buildNestedPath('user.address.city')).toEqual({
      parts: ['user', 'address', 'city'],
      hasArray: false,
    });
  });

  it('배열 경로', () => {
    expect(buildNestedPath('items[].name')).toEqual({
      parts: ['items', 'name'],
      hasArray: true,
    });
  });
});

describe('extractNestedValue', () => {
  it('단순 경로 추출', () => {
    expect(extractNestedValue({ name: 'test' }, 'name')).toBe('test');
  });

  it('중첩 경로 추출', () => {
    expect(extractNestedValue({ user: { name: 'test' } }, 'user.name')).toBe('test');
  });

  it('존재하지 않는 경로 → undefined', () => {
    expect(extractNestedValue({ name: 'test' }, 'user.name')).toBeUndefined();
  });

  it('배열 경로 추출', () => {
    const result = extractNestedValue({ items: [1, 2, 3] }, 'items[]');
    expect(result).toEqual([1, 2, 3]);
  });
});
