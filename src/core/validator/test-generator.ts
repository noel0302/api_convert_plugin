import type { MappingRule, FieldMapping } from '../types/mapping.js';
import type { SupportedLanguage } from '../types/target.js';

export interface TestConfig {
  framework?: string;
  language?: SupportedLanguage;
  outputPath?: string;
}

export interface GeneratedTest {
  framework: string;
  code: string;
  filePath: string;
}

export function generateTestCode(mapping: MappingRule, config?: TestConfig): GeneratedTest {
  const language = config?.language ?? mapping.target.language ?? 'typescript';
  const framework = config?.framework ?? detectFramework(language);
  const code = renderTest(mapping, language, framework);
  const ext = getExtension(language);
  const filePath = config?.outputPath ?? `tests/${mapping.id}.test.${ext}`;

  return { framework, code, filePath };
}

function detectFramework(language: SupportedLanguage): string {
  switch (language) {
    case 'typescript': return 'vitest';
    case 'java': return 'junit';
    case 'python': return 'pytest';
    case 'php': return 'phpunit';
    case 'kotlin': return 'junit';
    case 'go': return 'testing';
    default: return 'vitest';
  }
}

function getExtension(language: SupportedLanguage): string {
  switch (language) {
    case 'typescript': return 'ts';
    case 'java': return 'java';
    case 'python': return 'py';
    case 'php': return 'php';
    case 'kotlin': return 'kt';
    case 'go': return 'go';
    default: return 'ts';
  }
}

function renderTest(mapping: MappingRule, language: SupportedLanguage, framework: string): string {
  switch (language) {
    case 'typescript': return renderTypescriptTest(mapping, framework);
    case 'python': return renderPythonTest(mapping);
    case 'php': return renderPhpTest(mapping);
    case 'java': return renderJavaTest(mapping);
    case 'kotlin': return renderKotlinTest(mapping);
    case 'go': return renderGoTest(mapping);
    default: return renderTypescriptTest(mapping, framework);
  }
}

function buildSampleInput(mappings: FieldMapping[]): Record<string, unknown> {
  const sample: Record<string, unknown> = {};
  for (const fm of mappings) {
    if (fm.sourceField === null) continue;
    const field = Array.isArray(fm.sourceField) ? fm.sourceField[0] : fm.sourceField;
    const topLevel = field.split('.')[0];
    if (!(topLevel in sample)) {
      sample[topLevel] = fm.transformation.config?.value ?? `sample_${topLevel}`;
    }
  }
  return sample;
}

function renderTypescriptTest(mapping: MappingRule, framework: string): string {
  const sample = buildSampleInput(mapping.fieldMappings);
  const lines: string[] = [];

  if (framework === 'vitest') {
    lines.push(`import { describe, it, expect } from 'vitest';`);
  } else {
    lines.push(`import { describe, it, expect } from 'jest';`);
  }
  lines.push('');
  lines.push(`describe('${mapping.name} mapping', () => {`);
  lines.push(`  const sampleInput = ${JSON.stringify(sample, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')};`);
  lines.push('');

  for (const fm of mapping.fieldMappings) {
    lines.push(`  it('should map ${fm.sourceField ?? 'constant'} → ${fm.targetField}', () => {`);
    lines.push(`    // transformation: ${fm.transformation.type}`);
    lines.push(`    expect(true).toBe(true); // TODO: replace with actual mapping call`);
    lines.push(`  });`);
    lines.push('');
  }

  lines.push('});');
  return lines.join('\n');
}

function renderPythonTest(mapping: MappingRule): string {
  const lines: string[] = [];
  lines.push(`import pytest`);
  lines.push('');
  lines.push(`class Test${toPascal(mapping.name)}Mapping:`);

  for (const fm of mapping.fieldMappings) {
    const testName = `test_map_${(fm.sourceField ?? 'constant').toString().replace(/\./g, '_')}_to_${fm.targetField}`;
    lines.push(`    def ${testName}(self):`);
    lines.push(`        # transformation: ${fm.transformation.type}`);
    lines.push(`        assert True  # TODO: replace with actual mapping call`);
    lines.push('');
  }

  return lines.join('\n');
}

function renderPhpTest(mapping: MappingRule): string {
  const className = `${toPascal(mapping.name)}MappingTest`;
  const lines: string[] = [];
  lines.push(`<?php`);
  lines.push(`use PHPUnit\\Framework\\TestCase;`);
  lines.push('');
  lines.push(`class ${className} extends TestCase`);
  lines.push(`{`);

  for (const fm of mapping.fieldMappings) {
    const methodName = `testMap${toPascal(fm.targetField)}`;
    lines.push(`    public function ${methodName}(): void`);
    lines.push(`    {`);
    lines.push(`        // transformation: ${fm.transformation.type}`);
    lines.push(`        $this->assertTrue(true); // TODO: replace with actual mapping call`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

function renderJavaTest(mapping: MappingRule): string {
  const className = `${toPascal(mapping.name)}MappingTest`;
  const lines: string[] = [];
  lines.push(`import org.junit.jupiter.api.Test;`);
  lines.push(`import static org.junit.jupiter.api.Assertions.*;`);
  lines.push('');
  lines.push(`class ${className} {`);

  for (const fm of mapping.fieldMappings) {
    const methodName = `testMap${toPascal(fm.targetField)}`;
    lines.push(`    @Test`);
    lines.push(`    void ${methodName}() {`);
    lines.push(`        // transformation: ${fm.transformation.type}`);
    lines.push(`        assertTrue(true); // TODO: replace with actual mapping call`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

function renderKotlinTest(mapping: MappingRule): string {
  const className = `${toPascal(mapping.name)}MappingTest`;
  const lines: string[] = [];
  lines.push(`import org.junit.jupiter.api.Test`);
  lines.push(`import org.junit.jupiter.api.Assertions.*`);
  lines.push('');
  lines.push(`class ${className} {`);

  for (const fm of mapping.fieldMappings) {
    const methodName = `\`should map ${fm.sourceField ?? 'constant'} to ${fm.targetField}\``;
    lines.push(`    @Test`);
    lines.push(`    fun ${methodName}() {`);
    lines.push(`        // transformation: ${fm.transformation.type}`);
    lines.push(`        assertTrue(true) // TODO: replace with actual mapping call`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push(`}`);
  return lines.join('\n');
}

function renderGoTest(mapping: MappingRule): string {
  const lines: string[] = [];
  lines.push(`package mapping`);
  lines.push('');
  lines.push(`import "testing"`);
  lines.push('');

  for (const fm of mapping.fieldMappings) {
    const funcName = `TestMap${toPascal(fm.targetField)}`;
    lines.push(`func ${funcName}(t *testing.T) {`);
    lines.push(`\t// transformation: ${fm.transformation.type}`);
    lines.push(`\t// TODO: replace with actual mapping call`);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

function toPascal(s: string): string {
  return s.replace(/(?:^|[-_ .])(\w)/g, (_, c) => c.toUpperCase());
}
