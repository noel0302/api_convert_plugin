import type { CodeTemplate, CodeModel, ImportStatement } from './base.js';
import type { SupportedLanguage } from '../../types/target.js';

export class PhpTemplate implements CodeTemplate {
  language: SupportedLanguage = 'php';

  render(model: CodeModel): string {
    const lines: string[] = [];
    const className = model.className || `${model.targetType}Mapper`;

    lines.push(`<?php`);
    lines.push('');
    lines.push(`class ${className}`);
    lines.push(`{`);
    lines.push(`    public static function fromApi(array $source): ${model.targetType}`);
    lines.push(`    {`);
    lines.push(`        return new ${model.targetType}(`);

    for (let i = 0; i < model.fieldAssignments.length; i++) {
      const assignment = model.fieldAssignments[i];
      const comment = assignment.comment ? ` // ${assignment.comment}` : '';
      const value = assignment.transformation || assignment.sourceExpression;
      const comma = i < model.fieldAssignments.length - 1 ? ',' : ',';
      lines.push(`            ${assignment.targetPath}: ${value}${comma}${comment}`);
    }

    lines.push(`        );`);
    lines.push(`    }`);
    lines.push(`}`);

    return lines.join('\n');
  }

  renderImports(imports: ImportStatement[]): string {
    return imports.map(imp => `use ${imp.module};`).join('\n');
  }
}
