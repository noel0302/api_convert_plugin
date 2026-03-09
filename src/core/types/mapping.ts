/** Mapping Rule - 소스→타겟 매핑 규칙 */

import type { SupportedLanguage } from './target.js';

export interface MappingRule {
  id: string;
  version: number;
  name: string;
  description?: string;

  source: {
    apiProfileId: string;
    endpoint: string;
    responseCode: number;
  };

  target: {
    businessContext: string;
    language: SupportedLanguage;
    filePath?: string;
    typeName: string;
    targetProfileId?: string;
  };

  fieldMappings: FieldMapping[];

  metadata: {
    createdAt: string;
    updatedAt: string;
    confidence: number;
    userVerified: boolean;
    ambiguousFields: string[];
    derivedFrom?: string;
  };
}

export interface MappingCandidate {
  sourceField: string;
  confidence: number;
  scoreBreakdown: {
    nameScore: number;
    typeScore: number;
    descriptionBoost: number;
  };
  transformationType: TransformationType;
}

export interface FieldMapping {
  sourceField: string | string[] | null;
  targetField: string;
  transformation: {
    type: TransformationType;
    config?: TransformConfig;
  };
  confidence: number;
  isAmbiguous: boolean;
  userNote?: string;
  candidates?: MappingCandidate[];
}

export type TransformationType =
  | 'direct'
  | 'type_cast'
  | 'rename'
  | 'nested_extract'
  | 'array_map'
  | 'array_flatten'
  | 'array_to_object'
  | 'object_merge'
  | 'conditional'
  | 'computed'
  | 'constant'
  | 'default_value'
  | 'format'
  | 'restructure'
  | 'custom';

export interface TransformConfig {
  value?: unknown;
  fallback?: unknown;
  expression?: string;
  mapping?: Record<string, unknown>;
  strategy?: string;
  pattern?: string;
  unmatchedStrategy?: 'throw' | 'null' | 'passthrough';
  [key: string]: unknown;
}
