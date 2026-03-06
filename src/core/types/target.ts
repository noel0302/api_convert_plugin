/** Target Profile - 비즈니스 모델(타겟) 분석 결과 */

import type { FieldSchema } from './profile.js';

export type SupportedLanguage = 'typescript' | 'php' | 'java' | 'kotlin' | 'python' | 'go';

export interface TargetProfile {
  id: string;
  name: string;
  analyzedFrom: {
    sourceType: 'dto_file' | 'code_scan' | 'user_defined' | 'document';
    originalPath?: string;
    analyzedAt: string;
  };
  language: SupportedLanguage;
  fields: Record<string, TargetFieldSchema>;
}

export interface TargetFieldSchema extends FieldSchema {
  businessContext?: BusinessContext;
}

export interface BusinessContext {
  meaning?: string;
  constraints?: string;
  source?: string;
  caution?: string;
  codeMapping?: Record<string, string>;
}
