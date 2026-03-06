import type { CodeTemplate, CodeModel, ImportStatement } from './base.js';
import type { SupportedLanguage } from '../../types/target.js';

export class PythonTemplate implements CodeTemplate {
  language: SupportedLanguage = 'python';

  render(model: CodeModel): string {
    const lines: string[] = [];

    if (model.pattern === 'class') {
      const className = model.className || `${model.targetType}Mapper`;
      lines.push(`class ${className}:`);
      lines.push(`    @staticmethod`);
      lines.push(`    def from_api(source: dict) -> "${model.targetType}":`);
      lines.push(`        return ${model.targetType}(`);

      for (const assignment of model.fieldAssignments) {
        const comment = assignment.comment ? `  # ${assignment.comment}` : '';
        const value = assignment.transformation || assignment.sourceExpression;
        lines.push(`            ${to_snake_case(assignment.targetPath)}=${value},${comment}`);
      }

      lines.push(`        )`);
    } else {
      lines.push(`def map_${to_snake_case(model.targetType)}(source: dict) -> "${model.targetType}":`);
      lines.push(`    return ${model.targetType}(`);

      for (const assignment of model.fieldAssignments) {
        const comment = assignment.comment ? `  # ${assignment.comment}` : '';
        const value = assignment.transformation || assignment.sourceExpression;
        lines.push(`        ${to_snake_case(assignment.targetPath)}=${value},${comment}`);
      }

      lines.push(`    )`);
    }

    for (const helper of model.helperFunctions) {
      lines.push('');
      lines.push(helper.code);
    }

    return lines.join('\n');
  }

  renderImports(imports: ImportStatement[]): string {
    return imports.map(imp => `from ${imp.module} import ${imp.names.join(', ')}`).join('\n');
  }
}

function to_snake_case(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}
