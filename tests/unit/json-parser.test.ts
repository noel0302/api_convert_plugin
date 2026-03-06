import { describe, it, expect } from 'vitest';
import { parseJsonSample } from '../../src/core/analyzer/parsers/json-parser.js';

describe('parseJsonSample', () => {
  it('단순 JSON 객체를 ApiProfile로 변환', () => {
    const json = JSON.stringify({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      active: true,
    });

    const profile = parseJsonSample(json, {});
    expect(profile.endpoints).toHaveLength(1);

    const response = profile.endpoints[0].response.statusCodes[200];
    expect(response).toBeDefined();
    expect(response.children.id.type).toBe('number');
    expect(response.children.name.type).toBe('string');
    expect(response.children.email.type).toBe('string');
    expect(response.children.active.type).toBe('boolean');
  });

  it('중첩 객체 처리', () => {
    const json = JSON.stringify({
      user: {
        id: 1,
        address: {
          city: 'Seoul',
          zip: '12345',
        },
      },
    });

    const profile = parseJsonSample(json, {});
    const response = profile.endpoints[0].response.statusCodes[200];

    expect(response.children.user.type).toBe('object');
    expect(response.children.user.children?.address.type).toBe('object');
    expect(response.children.user.children?.address.children?.city.type).toBe('string');
  });

  it('배열 루트 응답 처리', () => {
    const json = JSON.stringify([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);

    const profile = parseJsonSample(json, {});
    const response = profile.endpoints[0].response.statusCodes[200];
    expect(response.children._root.type).toBe('array');
  });

  it('잘못된 JSON이면 에러', () => {
    expect(() => parseJsonSample('not json', {})).toThrow();
  });
});
