import type { CodeTemplate, CodeModel, ImportStatement } from './base.js';
import type { SupportedLanguage } from '../../types/target.js';

export class KotlinTemplate implements CodeTemplate {
  language: SupportedLanguage = 'kotlin';

  render(model: CodeModel): string {
    const lines: string[] = [];
    const className = model.className || `${model.targetType}Mapper`;

    lines.push(`object ${className} {`);
    lines.push(`    fun fromApi(source: Map<String, Any>): ${model.targetType} {`);
    lines.push(`        return ${model.targetType}(`);

    for (let i = 0; i < model.fieldAssignments.length; i++) {
      const assignment = model.fieldAssignments[i];
      const comment = assignment.comment ? ` // ${assignment.comment}` : '';
      const value = assignment.transformation || assignment.sourceExpression;
      const comma = i < model.fieldAssignments.length - 1 ? ',' : '';
      lines.push(`            ${assignment.targetPath} = ${value}${comma}${comment}`);
    }

    lines.push(`        )`);
    lines.push(`    }`);
    lines.push(`}`);

    for (const helper of model.helperFunctions) {
      lines.push('');
      lines.push(helper.code);
    }

    return lines.join('\n');
  }

  renderImports(imports: ImportStatement[]): string {
    return imports.map(imp => `import ${imp.module}`).join('\n');
  }
}
