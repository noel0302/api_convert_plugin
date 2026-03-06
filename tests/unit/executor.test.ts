import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutorModule } from '../../src/core/executor/index.js';
import { PluginError } from '../../src/core/errors.js';

const mockStorage = {
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
} as any;

const mockConfig = {
  get: vi.fn().mockReturnValue(undefined),
} as any;

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;

describe('ExecutorModule', () => {
  let executor: ExecutorModule;

  beforeEach(() => {
    vi.restoreAllMocks();
    executor = new ExecutorModule(mockStorage, mockConfig, mockLog);
  });

  it('isRetryable: TIMEOUT 에러는 재시도 가능', () => {
    const err = new PluginError('TIMEOUT', 'timed out');
    expect((executor as any).isRetryable(err)).toBe(true);
  });

  it('isRetryable: PARSE_FAILED 에러는 재시도 불가', () => {
    const err = new PluginError('PARSE_FAILED', 'parse error');
    expect((executor as any).isRetryable(err)).toBe(false);
  });

  it('parseRetryAfter: 초 단위 파싱', () => {
    expect((executor as any).parseRetryAfter('30')).toBe(30000);
    expect((executor as any).parseRetryAfter('5')).toBe(5000);
  });

  it('parseRetryAfter: undefined 입력', () => {
    expect((executor as any).parseRetryAfter(undefined)).toBeUndefined();
  });

  it('parseRetryAfter: 유효하지 않은 값', () => {
    expect((executor as any).parseRetryAfter('invalid')).toBeUndefined();
  });

  it('ExecuteParams에 maxRetries, retryDelay, captureFullResponse 포함', () => {
    const params = {
      url: 'https://example.com',
      maxRetries: 5,
      retryDelay: 2000,
      captureFullResponse: true,
    };
    expect(params.maxRetries).toBe(5);
    expect(params.retryDelay).toBe(2000);
    expect(params.captureFullResponse).toBe(true);
  });

  it('checkAbnormalResponse: 200 with error body', () => {
    const warnings = (executor as any).checkAbnormalResponse(200, 'application/json', { error: 'bad request' });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('error-like fields');
  });

  it('checkAbnormalResponse: HTML response', () => {
    const warnings = (executor as any).checkAbnormalResponse(200, 'text/html', '<html>error</html>');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('HTML');
  });

  it('checkAbnormalResponse: empty body', () => {
    const warnings = (executor as any).checkAbnormalResponse(200, 'application/json', '');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('empty');
  });

  it('checkAbnormalResponse: normal response no warnings', () => {
    const warnings = (executor as any).checkAbnormalResponse(200, 'application/json', { data: 'ok' });
    expect(warnings.length).toBe(0);
  });

  it('ExecuteResult에 statusCode, timing, warnings 필드', () => {
    const result = {
      statusCode: 200,
      statusText: 'OK',
      headers: {},
      body: {},
      timing: { total: 150 },
      warnings: [],
    };
    expect(result.statusCode).toBe(200);
    expect(result.timing.total).toBe(150);
    expect(result.warnings).toEqual([]);
  });

  it('oauth 인증 타입 지원', () => {
    const auth = { type: 'oauth' as const, token: 'abc' };
    expect(auth.type).toBe('oauth');
  });

  it('custom 인증 타입 지원', () => {
    const auth = { type: 'custom' as const, headerName: 'X-Custom', headerValue: 'val' };
    expect(auth.type).toBe('custom');
  });
});
