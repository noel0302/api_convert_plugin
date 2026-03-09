/** Plugin Configuration */

import type { SupportedLanguage } from './target.js';

export interface PluginConfig {
  version: string;
  defaultLanguage: SupportedLanguage;
  naming: {
    convention: 'camelCase' | 'snake_case' | 'PascalCase';
    detectFromProject: boolean;
  };
  api: {
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  mapping: {
    confidenceThreshold: number;
  };
  storage: {
    baseDir: string;
    maxHistoryVersions: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    toFile: boolean;
  };
}

export const DEFAULT_CONFIG: PluginConfig = {
  version: '1.0',
  defaultLanguage: 'typescript',
  naming: {
    convention: 'camelCase',
    detectFromProject: true,
  },
  api: {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },
  mapping: {
    confidenceThreshold: 0.9,
  },
  storage: {
    baseDir: '.api-convert',
    maxHistoryVersions: 50,
  },
  logging: {
    level: 'info',
    toFile: true,
  },
};
