import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { ConfigService } from '../core/services/config.js';
import type { LogService } from '../core/services/log.js';
import type { SupportedLanguage } from '../core/types/target.js';
import { detectDtoFromSource } from './dto-detector.js';
import { analyzeProjectPattern, type FileAnalysis } from './pattern-analyzer.js';

export interface DetectedDto {
  filePath: string;
  className: string;
  language: SupportedLanguage;
  fields: Array<{ name: string; type: string }>;
  confidence: number;
}

export interface DetectedMapper {
  filePath: string;
  functionName: string;
  sourceType: string;
  targetType: string;
}

export interface ProjectPattern {
  style: 'class' | 'function' | 'builder';
  naming: 'camelCase' | 'snake_case' | 'PascalCase';
  framework?: string;
}

export interface InferredPurpose {
  purpose: 'direct_consumption' | 'api_hub' | 'data_integration' | 'migration' | 'unknown';
  confidence: number;
  evidence: string[];
}

export interface DtoPatterns {
  filePatterns: string[];
  codePatterns: RegExp[];
  directoryPatterns: string[];
}

export class ReferenceScanner {
  constructor(
    private config: ConfigService,
    private log: LogService,
  ) {}

  async scanForDtos(language: SupportedLanguage): Promise<DetectedDto[]> {
    const patterns = this.getDtoPatterns(language);
    await this.log.info('ReferenceScanner', `Scanning for DTOs (${language})`, { patterns: patterns.filePatterns });

    const results: DetectedDto[] = [];
    const projectRoot = this.getProjectRoot();

    try {
      const files = await this.findFilesByExtension(projectRoot, this.getExtension(language));
      for (const filePath of files) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const hasDtoPattern = patterns.codePatterns.some(p => p.test(content));
          if (!hasDtoPattern) continue;

          const detected = detectDtoFromSource(filePath, content, language);
          if (detected) {
            results.push(detected);
          }
        } catch {
          // 파일 읽기 실패 무시
        }
      }
    } catch {
      await this.log.info('ReferenceScanner', 'File system scan not available, returning empty results');
    }

    await this.log.info('ReferenceScanner', `Found ${results.length} DTOs`);
    return results;
  }

  async scanForMappers(language: SupportedLanguage): Promise<DetectedMapper[]> {
    await this.log.info('ReferenceScanner', `Scanning for existing mappers (${language})`);

    const results: DetectedMapper[] = [];
    const projectRoot = this.getProjectRoot();

    try {
      const files = await this.findFilesByExtension(projectRoot, this.getExtension(language));
      const mapperPatterns = [
        /(?:function|const)\s+(\w*(?:map|convert|transform)\w*)\s*[=(]/i,
        /(\w+)\s*\.\s*(?:map|convert|transform)\s*\(/i,
      ];

      for (const filePath of files) {
        try {
          const content = await readFile(filePath, 'utf-8');
          for (const pattern of mapperPatterns) {
            const match = content.match(pattern);
            if (match) {
              results.push({
                filePath,
                functionName: match[1],
                sourceType: 'unknown',
                targetType: 'unknown',
              });
              break;
            }
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // file system not available
    }

    await this.log.info('ReferenceScanner', `Found ${results.length} mappers`);
    return results;
  }

  async detectProjectPattern(language: SupportedLanguage): Promise<ProjectPattern> {
    await this.log.info('ReferenceScanner', `Detecting project pattern (${language})`);

    const projectRoot = this.getProjectRoot();
    const files: FileAnalysis[] = [];

    try {
      const sourceFiles = await this.findFilesByExtension(projectRoot, this.getExtension(language), 20);
      for (const filePath of sourceFiles) {
        try {
          const content = await readFile(filePath, 'utf-8');
          files.push({ filePath, content, language });
        } catch {
          // ignore
        }
      }
    } catch {
      // file system not available
    }

    if (files.length > 0) {
      return analyzeProjectPattern(files);
    }

    // 파일을 찾을 수 없으면 언어별 기본값
    const defaultPatterns: Record<SupportedLanguage, ProjectPattern> = {
      typescript: { style: 'function', naming: 'camelCase' },
      php: { style: 'class', naming: 'camelCase' },
      java: { style: 'class', naming: 'camelCase' },
      python: { style: 'function', naming: 'snake_case' },
      kotlin: { style: 'class', naming: 'camelCase' },
      go: { style: 'function', naming: 'camelCase' },
    };

    return defaultPatterns[language] ?? { style: 'function', naming: 'camelCase' };
  }

  async inferPurpose(): Promise<InferredPurpose> {
    await this.log.info('ReferenceScanner', 'Inferring purpose from project context');

    const evidence: string[] = [];
    const projectRoot = this.getProjectRoot();

    try {
      const files = await this.findFilesByExtension(projectRoot, '.ts', 30);
      const allContent = await Promise.all(
        files.slice(0, 30).map(async f => {
          try { return await readFile(f, 'utf-8'); } catch { return ''; }
        }),
      );
      const combined = allContent.join('\n');

      // API Hub 감지: 여러 API 클라이언트, 라우터 패턴
      if (combined.match(/(?:app|router)\.\s*(?:get|post|put|delete)\s*\(/gi)?.length ?? 0 > 5) {
        evidence.push('Multiple route handlers detected');
      }

      // 마이그레이션 감지: 기존 매핑/변환 코드
      if (combined.includes('mapFrom') || combined.includes('convertFrom') || combined.includes('transformFrom')) {
        evidence.push('Existing mapper/converter functions found');
      }

      // 데이터 통합 감지: 여러 fetch/axios 호출
      const fetchCount = combined.match(/fetch\s*\(|axios\.\w+\s*\(|\.get\s*\(/gi)?.length ?? 0;
      if (fetchCount > 3) {
        evidence.push(`${fetchCount} external API calls detected`);
      }

      if (evidence.some(e => e.includes('mapper/converter'))) {
        return { purpose: 'migration', confidence: 0.7, evidence };
      }
      if (evidence.some(e => e.includes('route handlers')) && fetchCount > 3) {
        return { purpose: 'api_hub', confidence: 0.6, evidence };
      }
      if (fetchCount > 3) {
        return { purpose: 'data_integration', confidence: 0.5, evidence };
      }
      if (evidence.length === 0) {
        return { purpose: 'direct_consumption', confidence: 0.4, evidence: ['Default: no special patterns detected'] };
      }
    } catch {
      // file system not available
    }

    return {
      purpose: 'unknown',
      confidence: 0,
      evidence,
    };
  }

  getDtoPatterns(language: SupportedLanguage): DtoPatterns {
    const patterns: Record<SupportedLanguage, DtoPatterns> = {
      typescript: {
        filePatterns: ['**/*Dto.ts', '**/*Model.ts', '**/*Response.ts', '**/*Entity.ts'],
        codePatterns: [/(?:interface|type|class)\s+\w+(?:Dto|Model|Response|Entity)/],
        directoryPatterns: ['src/types', 'src/models', 'src/dto', 'src/entities'],
      },
      php: {
        filePatterns: ['**/*Dto.php', '**/*Model.php', '**/*Entity.php'],
        codePatterns: [/class\s+\w+(?:Dto|Model|Entity)/],
        directoryPatterns: ['app/Models', 'app/Dto', 'src/Entity'],
      },
      java: {
        filePatterns: ['**/*Dto.java', '**/*Model.java', '**/*Entity.java', '**/*VO.java'],
        codePatterns: [/class\s+\w+(?:Dto|Model|Entity|VO)/],
        directoryPatterns: ['src/main/java/**/dto', 'src/main/java/**/model', 'src/main/java/**/entity'],
      },
      python: {
        filePatterns: ['**/*_model.py', '**/*_dto.py', '**/models.py', '**/schemas.py'],
        codePatterns: [/class\s+\w+(?:Model|Schema|DTO)/],
        directoryPatterns: ['models', 'schemas', 'dto'],
      },
      kotlin: {
        filePatterns: ['**/*Dto.kt', '**/*Model.kt', '**/*Entity.kt'],
        codePatterns: [/data\s+class\s+\w+(?:Dto|Model|Entity)/],
        directoryPatterns: ['src/main/kotlin/**/dto', 'src/main/kotlin/**/model'],
      },
      go: {
        filePatterns: ['**/*_model.go', '**/*_dto.go', '**/types.go'],
        codePatterns: [/type\s+\w+\s+struct/],
        directoryPatterns: ['internal/models', 'pkg/models', 'types'],
      },
    };

    return patterns[language] ?? { filePatterns: [], codePatterns: [], directoryPatterns: [] };
  }

  private getProjectRoot(): string {
    return process.cwd();
  }

  private getExtension(language: SupportedLanguage): string {
    const map: Record<SupportedLanguage, string> = {
      typescript: '.ts',
      php: '.php',
      java: '.java',
      python: '.py',
      kotlin: '.kt',
      go: '.go',
    };
    return map[language] ?? '.ts';
  }

  private async findFilesByExtension(dir: string, ext: string, maxFiles = 100): Promise<string[]> {
    const results: string[] = [];
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.api-convert', '.next', 'vendor']);

    const walk = async (currentDir: string) => {
      if (results.length >= maxFiles) return;
      try {
        const entries = await readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) return;
          if (entry.isDirectory() && !skipDirs.has(entry.name)) {
            await walk(join(currentDir, entry.name));
          } else if (entry.isFile() && extname(entry.name) === ext) {
            results.push(join(currentDir, entry.name));
          }
        }
      } catch {
        // directory not accessible
      }
    };

    await walk(dir);
    return results;
  }
}
