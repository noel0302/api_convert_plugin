import type { CodeTemplate, CodeModel, ImportStatement } from './base.js';
import type { SupportedLanguage } from '../../types/target.js';

export class JavaTemplate implements CodeTemplate {
  language: SupportedLanguage = 'java';

  render(model: CodeModel): string {
    const lines: string[] = [];
    const className = model.className || `${model.targetType}Mapper`;

    lines.push(`public class ${className} {`);
    lines.push(`    public static ${model.targetType} fromApi(Map<String, Object> source) {`);
    lines.push(`        ${model.targetType} target = new ${model.targetType}();`);

    for (const assignment of model.fieldAssignments) {
      const comment = assignment.comment ? ` // ${assignment.comment}` : '';
      const value = assignment.transformation || assignment.sourceExpression;
      lines.push(`        target.set${capitalize(assignment.targetPath)}(${value});${comment}`);
    }

    lines.push(`        return target;`);
    lines.push(`    }`);
    lines.push(`}`);

    for (const helper of model.helperFunctions) {
      lines.push('');
      lines.push(helper.code);
    }

    return lines.join('\n');
  }

  renderImports(imports: ImportStatement[]): string {
    return imports.map(imp => `import ${imp.module};`).join('\n');
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
