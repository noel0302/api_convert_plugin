import { describe, it, expect } from 'vitest';
import { parseXml } from '../../src/core/analyzer/parsers/xml-parser.js';

describe('parseXml', () => {
  it('기본 XML 파싱', () => {
    const xml = `<user><id>1</id><name>Test</name><email>test@test.com</email></user>`;
    const profile = parseXml(xml);
    expect(profile.endpoints).toHaveLength(1);
    expect(profile.endpoints[0].path).toBe('/user');
    expect(profile.endpoints[0].response.statusCodes[200]).toBeDefined();
    expect(profile.endpoints[0].response.statusCodes[200].children).toHaveProperty('id');
    expect(profile.endpoints[0].response.statusCodes[200].children).toHaveProperty('name');
    expect(profile.endpoints[0].response.statusCodes[200].children).toHaveProperty('email');
  });

  it('타입 추론: number', () => {
    const xml = `<data><count>42</count></data>`;
    const profile = parseXml(xml);
    expect(profile.endpoints[0].response.statusCodes[200].children['count'].type).toBe('number');
  });

  it('타입 추론: boolean', () => {
    const xml = `<data><active>true</active></data>`;
    const profile = parseXml(xml);
    expect(profile.endpoints[0].response.statusCodes[200].children['active'].type).toBe('boolean');
  });

  it('커스텀 profileName', () => {
    const xml = `<root><field>val</field></root>`;
    const profile = parseXml(xml, { profileName: 'MyAPI' });
    expect(profile.name).toBe('MyAPI');
  });

  it('잘못된 XML → PARSE_FAILED', () => {
    expect(() => parseXml('not xml')).toThrow('PARSE_FAILED');
  });

  it('빈 요소 → nullable', () => {
    const xml = `<data><empty></empty></data>`;
    const profile = parseXml(xml);
    expect(profile.endpoints[0].response.statusCodes[200].children['empty'].nullable).toBe(true);
  });

  it('self-closing 요소', () => {
    const xml = `<data><field>test</field><optional /></data>`;
    const profile = parseXml(xml);
    expect(profile.endpoints[0].response.statusCodes[200].children).toHaveProperty('optional');
    expect(profile.endpoints[0].response.statusCodes[200].children['optional'].nullable).toBe(true);
  });
});
