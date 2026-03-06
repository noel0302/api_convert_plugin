import { describe, it, expect } from 'vitest';
import { parseCurlCommand } from '../../src/core/analyzer/parsers/curl-parser.js';

describe('parseCurlCommand', () => {
  it('기본 GET 요청 파싱', () => {
    const result = parseCurlCommand('curl https://api.example.com/users');
    expect(result.method).toBe('GET');
    expect(result.url).toBe('https://api.example.com/users');
  });

  it('POST 요청 + 바디 파싱', () => {
    const result = parseCurlCommand(
      `curl -X POST https://api.example.com/users -d '{"name":"test"}'`,
    );
    expect(result.method).toBe('POST');
    expect(result.body).toBe('{"name":"test"}');
  });

  it('헤더 파싱', () => {
    const result = parseCurlCommand(
      `curl -H "Content-Type: application/json" -H "X-API-Key: abc123" https://api.example.com/data`,
    );
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['X-API-Key']).toBe('abc123');
  });

  it('Bearer 인증 감지', () => {
    const result = parseCurlCommand(
      `curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9" https://api.example.com/me`,
    );
    expect(result.auth).toBeDefined();
    expect(result.auth?.type).toBe('bearer');
  });

  it('-d 플래그로 POST 자동 감지', () => {
    const result = parseCurlCommand(
      `curl -d '{"key":"value"}' https://api.example.com/data`,
    );
    expect(result.method).toBe('POST');
  });

  it('빈 입력도 기본 결과 반환', () => {
    const result = parseCurlCommand('');
    expect(result.method).toBe('GET');
    expect(result.url).toBe('');
  });
});
