import type { StorageService } from '../services/storage.js';
import type { ConfigService } from '../services/config.js';
import type { LogService } from '../services/log.js';
import type { MappingRule, FieldMapping } from '../types/mapping.js';
import type { SupportedLanguage } from '../types/target.js';
import type { CodeTemplate, CodeModel, FieldAssignment, HelperFunction, GeneratedCode, ImportStatement } from './templates/base.js';
import { buildSourceExpression, wrapTransformation } from './templates/base.js';
import { TypeScriptTemplate } from './templates/typescript.js';
import { PhpTemplate } from './templates/php.js';
import { JavaTemplate } from './templates/java.js';
import { PythonTemplate } from './templates/python.js';
import { KotlinTemplate } from './templates/kotlin.js';
import { GoTemplate } from './templates/go.js';
import { PluginError } from '../errors.js';

export interface GenerateCodeParams {
  mappingId: string;
  language?: SupportedLanguage;
  pattern?: 'class' | 'function' | 'builder';
  className?: string;
  outputPath?: string;
}

export class GeneratorModule {
  private templates: Map<SupportedLanguage, CodeTemplate>;

  constructor(
    private storage: StorageService,
    private config: ConfigService,
    private log: LogService,
  ) {
    this.templates = new Map();
    this.templates.set('typescript', new TypeScriptTemplate());
    this.templates.set('php', new PhpTemplate());
    this.templates.set('java', new JavaTemplate());
    this.templates.set('python', new PythonTemplate());
    this.templates.set('kotlin', new KotlinTemplate());
    this.templates.set('go', new GoTemplate());
  }

  async generateCode(params: GenerateCodeParams): Promise<GeneratedCode> {
    const mapping = await this.storage.loadMappingById(params.mappingId);
    const language = params.language || mapping.target.language;
    const pattern = params.pattern || (language === 'php' || language === 'java' || language === 'kotlin' ? 'class' : 'function');

    const template = this.templates.get(language);
    if (!template) {
      throw new PluginError('GENERATION_FAILED', `Unsupported language: ${language}`);
    }

    const model = this.buildCodeModel(mapping, language, pattern, params.className);
    const code = template.render(model);
    const imports = this.resolveImports(mapping, language);
    const importCode = template.renderImports(imports);
    const fullCode = imports.length > 0 ? `${importCode}\n\n${code}` : code;

    const ext = this.getFileExtension(language);
    const filePath = params.outputPath || `${mapping.target.typeName}Mapper.${ext}`;

    await this.log.info('Generator', `Code generated: ${filePath} (${language})`);

    return { code: fullCode, language, filePath, imports };
  }

  async detectProjectPattern(language: SupportedLanguage): Promise<'class' | 'function' | 'builder'> {
    // 프로젝트 내 기존 패턴을 감지하여 코드 생성 스타일 결정
    // 기본: 언어별 관례 기반
    switch (language) {
      case 'java':
      case 'kotlin':
      case 'php':
        return 'class';
      case 'typescript':
      case 'python':
      case 'go':
      default:
        return 'function';
    }
  }

  async previewCode(mappingId: string, language?: SupportedLanguage): Promise<string> {
    const result = await this.generateCode({ mappingId, language });
    return result.code;
  }

  private buildCodeModel(
    mapping: MappingRule,
    language: SupportedLanguage,
    pattern: 'class' | 'function' | 'builder',
    className?: string,
  ): CodeModel {
    const fieldAssignments: FieldAssignment[] = mapping.fieldMappings.map(fm => {
      const sourceExpr = buildSourceExpression(fm, language);
      const transformation = fm.transformation.type !== 'direct' && fm.transformation.type !== 'rename'
        ? wrapTransformation(sourceExpr, fm.transformation.type, fm.transformation.config, language)
        : undefined;

      return {
        targetPath: fm.targetField,
        sourceExpression: sourceExpr,
        transformation,
        comment: fm.isAmbiguous ? `confidence: ${fm.confidence.toFixed(2)}` : undefined,
      };
    });

    const helperFunctions: HelperFunction[] = this.collectHelperFunctions(mapping.fieldMappings, language);

    return {
      className: className || `${mapping.target.typeName}Mapper`,
      functionName: `map${mapping.target.typeName}`,
      sourceType: this.getSourceTypeName(language),
      targetType: mapping.target.typeName,
      fieldAssignments,
      helperFunctions,
      pattern,
    };
  }

  private collectHelperFunctions(mappings: FieldMapping[], language: SupportedLanguage): HelperFunction[] {
    const helpers: HelperFunction[] = [];
    const hasArrayMap = mappings.some(fm => fm.transformation.type === 'array_map');

    if (hasArrayMap && language === 'php') {
      helpers.push({
        name: 'mapArray',
        code: `function mapArray(array $items, callable $mapper): array {\n    return array_map($mapper, $items);\n}`,
      });
    }

    return helpers;
  }

  private resolveImports(mapping: MappingRule, language: SupportedLanguage): ImportStatement[] {
    const imports: ImportStatement[] = [];
    const hasDate = mapping.fieldMappings.some(fm => fm.transformation.type === 'format');

    if (language === 'python' && hasDate) {
      imports.push({ module: 'datetime', names: ['datetime'], isType: false });
    }

    return imports;
  }

  private getSourceTypeName(language: SupportedLanguage): string {
    switch (language) {
      case 'typescript': return 'Record<string, unknown>';
      case 'php': return 'array';
      case 'java': return 'Map<String, Object>';
      case 'python': return 'dict';
      case 'kotlin': return 'Map<String, Any>';
      case 'go': return 'map[string]interface{}';
      default: return 'any';
    }
  }

  private getFileExtension(language: SupportedLanguage): string {
    switch (language) {
      case 'typescript': return 'ts';
      case 'php': return 'php';
      case 'java': return 'java';
      case 'python': return 'py';
      case 'kotlin': return 'kt';
      case 'go': return 'go';
      default: return 'txt';
    }
  }
}
