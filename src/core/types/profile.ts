/** API Profile - 외부 API 소스 분석 결과 */

export interface ApiProfile {
  id: string;
  name: string;
  version?: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
  authentication: AuthConfig;
  analyzedFrom: AnalysisSource;
  metadata: {
    confidence: number;
    documentUrl?: string;
  };
  notes?: string[];
}

export interface AnalysisSource {
  sourceType: InputSourceType;
  originalPath?: string;
  originalSize?: string;
  analyzedAt: string;
}

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description?: string;
  request: {
    headers?: Record<string, FieldSchema>;
    queryParams?: Record<string, FieldSchema>;
    pathParams?: string[];
    body?: ObjectSchema;
  };
  response: {
    statusCodes: Record<number, ObjectSchema>;
  };
}

export interface FieldSchema {
  type: FieldType;
  nullable: boolean;
  required: boolean;
  description?: string;
  example?: unknown;
  children?: Record<string, FieldSchema>;
  items?: FieldSchema;
  enum?: unknown[];
  format?: string;
}

export interface ObjectSchema {
  type: 'object';
  children: Record<string, FieldSchema>;
  description?: string;
}

export interface AuthConfig {
  type: 'bearer' | 'api_key' | 'basic' | 'oauth' | 'custom' | 'none';
  tokenSource?: string;
  notes?: string;
}

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type InputSourceType = 'swagger' | 'json_sample' | 'curl' | 'url' | 'document' | 'git' | 'xml';
