import type { StorageService } from '../services/storage.js';
import type { ConfigService } from '../services/config.js';
import type { LogService } from '../services/log.js';
import { PluginError } from '../errors.js';

export interface ExecuteParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  auth?:
    | { type: 'bearer'; token: string }
    | { type: 'basic'; credentials: string }
    | { type: 'api_key'; header: string; value: string }
    | { type: 'oauth'; token: string }
    | { type: 'custom'; headerName: string; headerValue: string };
  timeout?: number;
  followRedirects?: boolean;
  profileId?: string;
  maxRetries?: number;
  retryDelay?: number;
  captureFullResponse?: boolean;
}

export interface ExecuteResult {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  timing: { total: number; };
  rawResponse?: string;
  warnings: string[];
  profileUpdated?: string;
}

export class ExecutorModule {
  constructor(
    private storage: StorageService,
    private config: ConfigService,
    private log: LogService,
  ) {}

  async execute(params: ExecuteParams): Promise<ExecuteResult> {
    const maxRetries = params.maxRetries ?? 3;
    const baseDelay = params.retryDelay ?? 1000;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeOnce(params);

        // Rate limit (429) → retry with Retry-After
        if (result.statusCode === 429 && attempt < maxRetries) {
          const retryAfter = this.parseRetryAfter(result.headers['retry-after']);
          const delay = retryAfter ?? baseDelay * Math.pow(2, attempt);
          await this.log.info('Executor', `Rate limited (429). Retry in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delay);
          continue;
        }

        // Server error (5xx) → retry with exponential backoff
        if (result.statusCode >= 500 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await this.log.info('Executor', `Server error (${result.statusCode}). Retry in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delay);
          continue;
        }

        return result;
      } catch (err) {
        lastError = err;

        if (!this.isRetryable(err) || attempt >= maxRetries) {
          throw err;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        await this.log.info('Executor', `Request failed. Retry in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private async executeOnce(params: ExecuteParams): Promise<ExecuteResult> {
    const timeout = params.timeout || (this.config.get('api.timeout') as number) || 30000;
    const method = params.method || 'GET';

    await this.log.info('Executor', `${method} ${params.url}`);

    const headers: Record<string, string> = { ...params.headers };

    if (params.auth) {
      switch (params.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${params.auth.token}`;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${params.auth.credentials}`;
          break;
        case 'api_key':
          headers[params.auth.header] = params.auth.value;
          break;
        case 'oauth':
          headers['Authorization'] = `Bearer ${params.auth.token}`;
          break;
        case 'custom':
          headers[params.auth.headerName] = params.auth.headerValue;
          break;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const startTime = Date.now();

      const response = await fetch(params.url, {
        method,
        headers,
        body: params.body,
        signal: controller.signal,
        redirect: params.followRedirects !== false ? 'follow' : 'manual',
      });

      const responseTime = Date.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let body: unknown;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      const warnings = this.checkAbnormalResponse(response.status, contentType, body);

      const result: ExecuteResult = {
        statusCode: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body,
        timing: { total: responseTime },
        rawResponse: params.captureFullResponse ? JSON.stringify(body) : undefined,
        warnings,
      };

      // 프로파일이 지정되어 있으면 응답 스키마로 업데이트
      if (params.profileId && typeof body === 'object' && body !== null) {
        await this.updateProfileResponse(params.profileId, params.url, method, response.status, body);
        result.profileUpdated = params.profileId;
      }

      await this.log.info('Executor', `Response: ${response.status} (${responseTime}ms)`);

      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PluginError('TIMEOUT', `Request timed out after ${timeout}ms`);
      }
      throw new PluginError('API_CALL_FAILED', err instanceof Error ? err.message : String(err), err);
    } finally {
      clearTimeout(timer);
    }
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof PluginError) {
      return err.code === 'TIMEOUT' || err.code === 'API_CALL_FAILED';
    }
    if (err instanceof Error) {
      return err.name === 'AbortError' || err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED');
    }
    return false;
  }

  private parseRetryAfter(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const seconds = parseInt(value, 10);
    if (!isNaN(seconds)) return seconds * 1000;
    const date = new Date(value);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private checkAbnormalResponse(statusCode: number, contentType: string, body: unknown): string[] {
    const warnings: string[] = [];

    // 200 OK but body looks like an error
    if (statusCode >= 200 && statusCode < 300 && typeof body === 'object' && body !== null) {
      const bodyObj = body as Record<string, unknown>;
      if (bodyObj.error || bodyObj.errors || bodyObj.errorCode || bodyObj.error_code) {
        warnings.push('Response has 2xx status but body contains error-like fields');
      }
    }

    // HTML response when expecting JSON
    if (contentType.includes('text/html') && !contentType.includes('json')) {
      warnings.push('Response is HTML — expected JSON. Possible error page or wrong endpoint');
    }

    // Empty body
    if (body === '' || body === null || body === undefined) {
      warnings.push('Response body is empty');
    }

    return warnings;
  }

  private async updateProfileResponse(
    profileId: string,
    url: string,
    method: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    try {
      const profile = await this.storage.loadProfile(profileId);
      const path = new URL(url).pathname;
      const endpoint = profile.endpoints.find(
        ep => ep.path === path && ep.method === method,
      );

      if (endpoint) {
        const { inferObjectSchema } = await import('../analyzer/schema-detector.js');
        const schema = inferObjectSchema(body as Record<string, unknown>);
        endpoint.response.statusCodes[status] = schema;
        await this.storage.saveProfile(profile);
      }
    } catch {
      // 프로파일 업데이트 실패는 무시
    }
  }
}
