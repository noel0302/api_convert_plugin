import type { SupportedLanguage } from '../core/types/target.js';
import type { ProjectPattern } from './index.js';

export interface FileAnalysis {
  filePath: string;
  content: string;
  language: SupportedLanguage;
}

export function analyzeProjectPattern(files: FileAnalysis[]): ProjectPattern {
  if (files.length === 0) {
    return { style: 'function', naming: 'camelCase' };
  }

  const style = detectCodeStyle(files);
  const naming = detectNamingConvention(files);
  const framework = detectFramework(files);

  return { style, naming, framework };
}

function detectCodeStyle(files: FileAnalysis[]): 'class' | 'function' | 'builder' {
  let classCount = 0;
  let functionCount = 0;

  for (const file of files) {
    const classMatches = file.content.match(/\bclass\s+\w+/g);
    const funcMatches = file.content.match(/\bfunction\s+\w+/g)
      || file.content.match(/\bconst\s+\w+\s*=\s*(?:async\s+)?\(/g)
      || file.content.match(/\bdef\s+\w+/g)
      || file.content.match(/\bfunc\s+\w+/g);

    classCount += classMatches?.length ?? 0;
    functionCount += funcMatches?.length ?? 0;
  }

  return classCount > functionCount ? 'class' : 'function';
}

function detectNamingConvention(files: FileAnalysis[]): 'camelCase' | 'snake_case' | 'PascalCase' {
  let camelCount = 0;
  let snakeCount = 0;

  for (const file of files) {
    const identifiers = file.content.match(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g);
    const snakes = file.content.match(/\b[a-z]+_[a-z]+\b/g);

    camelCount += identifiers?.length ?? 0;
    snakeCount += snakes?.length ?? 0;
  }

  if (snakeCount > camelCount * 2) return 'snake_case';
  return 'camelCase';
}

function detectFramework(files: FileAnalysis[]): string | undefined {
  const content = files.map(f => f.content).join('\n');

  if (content.includes('express') || content.includes('Express')) return 'express';
  if (content.includes('fastify') || content.includes('Fastify')) return 'fastify';
  if (content.includes('next/') || content.includes('Next')) return 'nextjs';
  if (content.includes('spring') || content.includes('Spring')) return 'spring';
  if (content.includes('django') || content.includes('Django')) return 'django';
  if (content.includes('flask') || content.includes('Flask')) return 'flask';
  if (content.includes('laravel') || content.includes('Laravel')) return 'laravel';
  if (content.includes('gin.') || content.includes('gin"')) return 'gin';

  return undefined;
}
