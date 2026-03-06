import type { ApiProfile, ApiEndpoint, ObjectSchema } from '../../types/profile.js';
import { inferObjectSchema } from '../schema-detector.js';
import { PluginError } from '../../errors.js';

/**
 * JSON 샘플 데이터에서 API 프로파일을 생성하는 파서.
 * 실제 응답 JSON을 분석하여 스키마를 추론.
 */

export interface JsonParseOptions {
  profileId?: string;
  profileName?: string;
  endpoint?: string;
  method?: string;
  baseUrl?: string;
}

export function parseJsonSample(content: string, options: JsonParseOptions = {}): ApiProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new PluginError('PARSE_FAILED', 'Invalid JSON', err);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new PluginError('PARSE_FAILED', 'JSON root must be an object or array');
  }

  const responseSchema = Array.isArray(parsed)
    ? inferArrayResponseSchema(parsed)
    : inferObjectSchema(parsed as Record<string, unknown>);

  const profileId = options.profileId || `json-sample-${Date.now()}`;
  const endpoint: ApiEndpoint = {
    method: (options.method as ApiProfile['endpoints'][0]['method']) || 'GET',
    path: options.endpoint || '/unknown',
    description: 'Inferred from JSON sample',
    request: {},
    response: {
      statusCodes: { 200: responseSchema },
    },
  };

  return {
    id: profileId,
    name: options.profileName || profileId,
    baseUrl: options.baseUrl || '',
    endpoints: [endpoint],
    authentication: { type: 'none' },
    analyzedFrom: {
      sourceType: 'json_sample',
      analyzedAt: new Date().toISOString(),
    },
    metadata: {
      confidence: 0.7, // JSON 샘플 기반 추론은 중간 수준 신뢰도
    },
    notes: [
      'JSON 샘플에서 추론된 스키마입니다. 실제 API 스펙과 다를 수 있습니다.',
      'nullable, required 등은 단일 샘플 기준이므로 정확도가 낮을 수 있습니다.',
    ],
  };
}

function inferArrayResponseSchema(arr: unknown[]): ObjectSchema {
  if (arr.length === 0) {
    return {
      type: 'object',
      children: {
        items: {
          type: 'array',
          nullable: false,
          required: true,
          items: { type: 'unknown', nullable: true, required: false },
        },
      },
    };
  }

  // 배열의 첫 번째 요소가 객체면 배열 래핑
  const first = arr[0];
  if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
    const itemSchema = inferObjectSchema(first as Record<string, unknown>);
    return {
      type: 'object',
      children: {
        _root: {
          type: 'array',
          nullable: false,
          required: true,
          items: { ...itemSchema, type: 'object', nullable: false, required: true },
        },
      },
      description: 'Array response - root is array of objects',
    };
  }

  return {
    type: 'object',
    children: {
      _root: {
        type: 'array',
        nullable: false,
        required: true,
        items: { type: typeof first as 'string' | 'number' | 'boolean', nullable: false, required: true },
      },
    },
  };
}
