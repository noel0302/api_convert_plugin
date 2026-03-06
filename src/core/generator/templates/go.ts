import type { CodeTemplate, CodeModel, ImportStatement } from './base.js';
import type { SupportedLanguage } from '../../types/target.js';

export class GoTemplate implements CodeTemplate {
  language: SupportedLanguage = 'go';

  render(model: CodeModel): string {
    const lines: string[] = [];
    const funcName = `Map${model.targetType}`;

    lines.push(`func ${funcName}(source map[string]interface{}) ${model.targetType} {`);
    lines.push(`\treturn ${model.targetType}{`);

    for (const assignment of model.fieldAssignments) {
      const comment = assignment.comment ? ` // ${assignment.comment}` : '';
      const value = assignment.transformation || assignment.sourceExpression;
      lines.push(`\t\t${capitalize(assignment.targetPath)}: ${value},${comment}`);
    }

    lines.push(`\t}`);
    lines.push(`}`);

    for (const helper of model.helperFunctions) {
      lines.push('');
      lines.push(helper.code);
    }

    return lines.join('\n');
  }

  renderImports(imports: ImportStatement[]): string {
    if (imports.length === 0) return '';
    const modules = imports.map(imp => `\t"${imp.module}"`).join('\n');
    return `import (\n${modules}\n)`;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
