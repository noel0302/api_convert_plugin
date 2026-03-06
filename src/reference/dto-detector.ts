import type { SupportedLanguage } from '../core/types/target.js';
import type { DetectedDto } from './index.js';

export interface DtoDetectionOptions {
  language: SupportedLanguage;
  rootDir?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export function detectDtoFromSource(
  filePath: string,
  content: string,
  language: SupportedLanguage,
): DetectedDto | null {
  const fields = extractFields(content, language);
  const className = extractClassName(content, language);

  if (!className || fields.length === 0) return null;

  return {
    filePath,
    className,
    language,
    fields,
    confidence: fields.length > 2 ? 0.8 : 0.5,
  };
}

function extractClassName(content: string, language: SupportedLanguage): string | null {
  const patterns: Record<SupportedLanguage, RegExp> = {
    typescript: /(?:export\s+)?(?:interface|type|class)\s+(\w+)/,
    php: /class\s+(\w+)/,
    java: /(?:public\s+)?class\s+(\w+)/,
    python: /class\s+(\w+)/,
    kotlin: /(?:data\s+)?class\s+(\w+)/,
    go: /type\s+(\w+)\s+struct/,
  };

  const match = content.match(patterns[language]);
  return match ? match[1] : null;
}

function extractFields(content: string, language: SupportedLanguage): Array<{ name: string; type: string }> {
  const fields: Array<{ name: string; type: string }> = [];

  switch (language) {
    case 'typescript': {
      const regex = /(\w+)\s*[?]?\s*:\s*([^;,\n]+)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        fields.push({ name: match[1], type: match[2].trim() });
      }
      break;
    }
    case 'java':
    case 'kotlin': {
      const regex = /(?:private|public|protected)?\s*(?:val|var)?\s*(\w+)\s*:\s*(\w+)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        fields.push({ name: match[1], type: match[2] });
      }
      break;
    }
    case 'python': {
      const regex = /(\w+)\s*:\s*(\w+)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (!match[1].startsWith('_')) {
          fields.push({ name: match[1], type: match[2] });
        }
      }
      break;
    }
    case 'go': {
      const regex = /(\w+)\s+(string|int|float64|bool|\[\]\w+|\*\w+)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        fields.push({ name: match[1], type: match[2] });
      }
      break;
    }
    case 'php': {
      const regex = /(?:public|private|protected)\s+(?:\?\s*)?(string|int|float|bool|array|\w+)\s+\$(\w+)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        fields.push({ name: match[2], type: match[1] });
      }
      break;
    }
  }

  return fields;
}
