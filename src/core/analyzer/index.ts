import type { StorageService } from '../services/storage.js';
import type { ConfigService } from '../services/config.js';
import type { LogService } from '../services/log.js';
import type { ApiProfile, InputSourceType } from '../types/profile.js';
import { parseJsonSample } from './parsers/json-parser.js';
import { parseCurlCommand } from './parsers/curl-parser.js';
import { parseSwaggerSpec } from './parsers/swagger-parser.js';
import { parseXml } from './parsers/xml-parser.js';
import { PluginError } from '../errors.js';

export interface SourceInput {
  type: InputSourceType;
  content: string;
}

export interface AnalyzeOptions {
  profileId?: string;
  profileName?: string;
  endpoint?: string;
  method?: string;
  baseUrl?: string;
  followRedirects?: boolean;
  timeout?: number;
}

export interface AnalyzeResult {
  profile: ApiProfile;
  confidence: number;
  warnings: string[];
  suggestions: string[];
  savedTo: string;
}

export class AnalyzerModule {
  constructor(
    private storage: StorageService,
    private config: ConfigService,
    private log: LogService,
  ) {}

  async analyze(source: SourceInput, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
    await this.log.info('Analyzer', `Analyzing source: ${source.type}`, { contentLength: source.content.length });

    let profile: ApiProfile;
    const warnings: string[] = [];
    const suggestions: string[] = [];

    switch (source.type) {
      case 'json_sample':
        profile = parseJsonSample(source.content, options);
        suggestions.push('JSON 샘플 기반 추론입니다. Swagger 스펙이 있으면 더 정확한 분석이 가능합니다.');
        break;

      case 'curl':
        profile = await this.analyzeCurl(source.content, options);
        break;

      case 'swagger':
        profile = await this.analyzeSwagger(source.content, options);
        break;

      case 'xml':
        profile = this.analyzeXml(source.content, options);
        break;

      case 'url':
      case 'document':
      case 'git':
        throw new PluginError('UNSUPPORTED_FORMAT', `${source.type} 분석은 아직 구현되지 않았습니다 (v0.2 예정)`);

      default:
        throw new PluginError('UNSUPPORTED_FORMAT', source.type);
    }

    // 프로파일 ID 오버라이드
    if (options.profileId) profile.id = options.profileId;
    if (options.profileName) profile.name = options.profileName;
    if (options.baseUrl) profile.baseUrl = options.baseUrl;

    // 저장
    const savedTo = await this.storage.saveProfile(profile);
    await this.log.info('Analyzer', `Profile saved: ${profile.id}`, { savedTo });

    return {
      profile,
      confidence: profile.metadata.confidence,
      warnings,
      suggestions,
      savedTo,
    };
  }

  private async analyzeCurl(content: string, options: AnalyzeOptions): Promise<ApiProfile> {
    const parsed = parseCurlCommand(content);

    // curl 파싱 결과를 JSON 샘플 분석과 연결
    // body가 있으면 그것도 스키마로 분석
    const profileId = options.profileId || `curl-${Date.now()}`;

    const profile: ApiProfile = {
      id: profileId,
      name: options.profileName || profileId,
      baseUrl: this.extractBaseUrl(parsed.url),
      endpoints: [{
        method: parsed.method,
        path: this.extractPath(parsed.url),
        description: 'Parsed from curl command',
        request: {
          headers: Object.fromEntries(
            Object.entries(parsed.headers)
              .filter(([k]) => k.toLowerCase() !== 'authorization')
              .map(([k, v]) => [k, { type: 'string' as const, nullable: false, required: true, example: v }]),
          ),
          body: parsed.body ? this.tryParseBody(parsed.body) : undefined,
        },
        response: {
          statusCodes: {},  // curl만으로는 응답 스키마를 알 수 없음
        },
      }],
      authentication: parsed.auth
        ? { type: parsed.auth.type, tokenSource: 'curl command', notes: '인증 정보는 저장되지 않습니다' }
        : { type: 'none' },
      analyzedFrom: {
        sourceType: 'curl',
        analyzedAt: new Date().toISOString(),
      },
      metadata: { confidence: 0.5 },
      notes: [
        'curl 명령어에서 파싱한 요청 정보입니다.',
        '응답 스키마는 실제 API 호출 후 분석해야 합니다.',
        'execute_api_call로 실제 호출하면 응답 스키마가 추가됩니다.',
      ],
    };

    return profile;
  }

  private async analyzeSwagger(content: string, options: AnalyzeOptions): Promise<ApiProfile> {
    return parseSwaggerSpec(content, {
      baseUrl: options.baseUrl,
      profileName: options.profileName,
    });
  }

  async diffProfile(existingProfileId: string, newSource: SourceInput): Promise<{ added: string[]; removed: string[]; changed: string[] }> {
    const existing = await this.storage.loadProfile(existingProfileId);
    const newResult = await this.analyze(newSource);
    const newProfile = newResult.profile;

    const existingFields = new Set<string>();
    const newFields = new Set<string>();

    for (const ep of existing.endpoints) {
      for (const [, schema] of Object.entries(ep.response.statusCodes)) {
        for (const key of Object.keys(schema.children)) {
          existingFields.add(`${ep.method} ${ep.path}:${key}`);
        }
      }
    }

    for (const ep of newProfile.endpoints) {
      for (const [, schema] of Object.entries(ep.response.statusCodes)) {
        for (const key of Object.keys(schema.children)) {
          newFields.add(`${ep.method} ${ep.path}:${key}`);
        }
      }
    }

    const added = [...newFields].filter(f => !existingFields.has(f));
    const removed = [...existingFields].filter(f => !newFields.has(f));
    const changed: string[] = [];

    return { added, removed, changed };
  }

  private analyzeXml(content: string, options: AnalyzeOptions): ApiProfile {
    return parseXml(content, { profileName: options.profileName, baseUrl: options.baseUrl });
  }

  private extractBaseUrl(url: string): string {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return '';
    }
  }

  private extractPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  private tryParseBody(body: string): { type: 'object'; children: Record<string, import('../types/profile.js').FieldSchema>; description?: string; nullable: boolean; required: boolean } | undefined {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === 'object' && parsed !== null) {
        // 간략한 인라인 추론 (동적 import 회피)
        const children: Record<string, import('../types/profile.js').FieldSchema> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          children[key] = {
            type: typeof value === 'number' ? 'number'
              : typeof value === 'boolean' ? 'boolean'
              : typeof value === 'string' ? 'string'
              : value === null ? 'string'
              : Array.isArray(value) ? 'array'
              : 'object',
            nullable: value === null,
            required: true,
          };
        }
        return { type: 'object', children, nullable: false, required: true };
      }
    } catch { /* not JSON body */ }
    return undefined;
  }
}
