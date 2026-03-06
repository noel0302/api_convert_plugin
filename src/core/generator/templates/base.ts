import type { SupportedLanguage } from '../../types/target.js';
import type { FieldMapping, TransformationType } from '../../types/mapping.js';

export interface CodeModel {
  className?: string;
  functionName: string;
  sourceType: string;
  targetType: string;
  fieldAssignments: FieldAssignment[];
  helperFunctions: HelperFunction[];
  pattern: 'class' | 'function' | 'builder';
}

export interface FieldAssignment {
  targetPath: string;
  sourceExpression: string;
  transformation?: string;
  comment?: string;
}

export interface HelperFunction {
  name: string;
  code: string;
}

export interface ImportStatement {
  module: string;
  names: string[];
  isType?: boolean;
}

export interface GeneratedCode {
  code: string;
  language: SupportedLanguage;
  filePath: string;
  imports: ImportStatement[];
}

export interface CodeTemplate {
  language: SupportedLanguage;
  render(model: CodeModel): string;
  renderImports(imports: ImportStatement[]): string;
}

export function buildSourceExpression(fm: FieldMapping, language: SupportedLanguage): string {
  if (fm.sourceField === null) {
    if (fm.transformation.config?.value !== undefined) {
      return JSON.stringify(fm.transformation.config.value);
    }
    return 'null';
  }

  const field = Array.isArray(fm.sourceField) ? fm.sourceField[0] : fm.sourceField;
  const parts = field.split('.');

  switch (language) {
    case 'typescript':
      return `source.${parts.join('.')}`;
    case 'php':
      return parts.reduce((acc, p) => `${acc}['${p}']`, '$source');
    case 'java':
      return parts.reduce((acc, p) => `${acc}.get${capitalize(p)}()`, 'source');
    case 'python':
      return parts.reduce((acc, p) => `${acc}["${p}"]`, 'source');
    default:
      return `source.${parts.join('.')}`;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function wrapTransformation(
  expr: string,
  type: TransformationType,
  config: Record<string, unknown> | undefined,
  language: SupportedLanguage,
): string {
  switch (type) {
    case 'direct':
    case 'rename':
      return expr;
    case 'type_cast':
      if (language === 'typescript') return `Number(${expr})`;
      if (language === 'php') return `(int) ${expr}`;
      if (language === 'python') return `int(${expr})`;
      return expr;
    case 'format':
      if (language === 'typescript') return `new Date(${expr}).toISOString()`;
      if (language === 'php') return `new \\DateTimeImmutable(${expr})`;
      if (language === 'python') return `datetime.fromisoformat(${expr})`;
      return expr;
    case 'constant':
      return JSON.stringify(config?.value ?? null);
    case 'default_value':
      return `${expr} ?? ${JSON.stringify(config?.fallback ?? null)}`;
    default:
      return expr;
  }
}
