import type { CodeTemplate, CodeModel, ImportStatement } from './base.js';
import type { SupportedLanguage } from '../../types/target.js';

export class TypeScriptTemplate implements CodeTemplate {
  language: SupportedLanguage = 'typescript';

  render(model: CodeModel): string {
    const lines: string[] = [];

    if (model.pattern === 'function') {
      lines.push(`export function ${model.functionName}(source: ${model.sourceType}): ${model.targetType} {`);
      lines.push(`  return {`);

      for (const assignment of model.fieldAssignments) {
        const comment = assignment.comment ? ` // ${assignment.comment}` : '';
        const value = assignment.transformation || assignment.sourceExpression;
        lines.push(`    ${assignment.targetPath}: ${value},${comment}`);
      }

      lines.push(`  };`);
      lines.push(`}`);
    } else if (model.pattern === 'class') {
      const className = model.className || `${model.targetType}Mapper`;
      lines.push(`export class ${className} {`);
      lines.push(`  static fromApi(source: ${model.sourceType}): ${model.targetType} {`);
      lines.push(`    return {`);

      for (const assignment of model.fieldAssignments) {
        const comment = assignment.comment ? ` // ${assignment.comment}` : '';
        const value = assignment.transformation || assignment.sourceExpression;
        lines.push(`      ${assignment.targetPath}: ${value},${comment}`);
      }

      lines.push(`    };`);
      lines.push(`  }`);
      lines.push(`}`);
    }

    // 헬퍼 함수 추가
    for (const helper of model.helperFunctions) {
      lines.push('');
      lines.push(helper.code);
    }

    return lines.join('\n');
  }

  renderImports(imports: ImportStatement[]): string {
    return imports.map(imp => {
      const keyword = imp.isType ? 'import type' : 'import';
      return `${keyword} { ${imp.names.join(', ')} } from '${imp.module}';`;
    }).join('\n');
  }
}
