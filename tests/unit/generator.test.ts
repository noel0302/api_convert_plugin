import { describe, it, expect } from 'vitest';
import { TypeScriptTemplate } from '../../src/core/generator/templates/typescript.js';
import { PhpTemplate } from '../../src/core/generator/templates/php.js';
import { JavaTemplate } from '../../src/core/generator/templates/java.js';
import { PythonTemplate } from '../../src/core/generator/templates/python.js';
import { KotlinTemplate } from '../../src/core/generator/templates/kotlin.js';
import { GoTemplate } from '../../src/core/generator/templates/go.js';
import { buildSourceExpression, wrapTransformation } from '../../src/core/generator/templates/base.js';
import type { CodeModel, FieldAssignment } from '../../src/core/generator/templates/base.js';
import type { FieldMapping } from '../../src/core/types/mapping.js';

const sampleAssignments: FieldAssignment[] = [
  { targetPath: 'id', sourceExpression: 'source.id' },
  { targetPath: 'name', sourceExpression: 'source.user_name', transformation: 'String(source.user_name)' },
];

const sampleModel: CodeModel = {
  functionName: 'mapUser',
  sourceType: 'Record<string, unknown>',
  targetType: 'User',
  fieldAssignments: sampleAssignments,
  helperFunctions: [],
  pattern: 'function',
};

describe('TypeScriptTemplate', () => {
  const template = new TypeScriptTemplate();

  it('function 패턴 코드 생성', () => {
    const code = template.render(sampleModel);
    expect(code).toContain('function mapUser');
    expect(code).toContain('source.id');
    expect(code).toContain('User');
  });

  it('class 패턴 코드 생성', () => {
    const code = template.render({ ...sampleModel, pattern: 'class', className: 'UserMapper' });
    expect(code).toContain('class UserMapper');
    expect(code).toContain('static fromApi');
  });
});

describe('PhpTemplate', () => {
  const template = new PhpTemplate();

  it('PHP 클래스 코드 생성', () => {
    const code = template.render({ ...sampleModel, pattern: 'class', className: 'UserMapper' });
    expect(code).toContain('class UserMapper');
    expect(code).toContain('public static function fromApi');
    expect(code).toContain('$source');
  });
});

describe('JavaTemplate', () => {
  const template = new JavaTemplate();

  it('Java 클래스 코드 생성', () => {
    const code = template.render({ ...sampleModel, pattern: 'class' });
    expect(code).toContain('public class');
    expect(code).toContain('Map<String, Object> source');
  });
});

describe('PythonTemplate', () => {
  const template = new PythonTemplate();

  it('Python function 패턴 생성', () => {
    const code = template.render({ ...sampleModel, pattern: 'function' });
    expect(code).toContain('def map_user');
    expect(code).toContain('source: dict');
  });

  it('Python class 패턴 생성', () => {
    const code = template.render({ ...sampleModel, pattern: 'class', className: 'UserMapper' });
    expect(code).toContain('class UserMapper');
    expect(code).toContain('@staticmethod');
  });
});

describe('KotlinTemplate', () => {
  const template = new KotlinTemplate();

  it('Kotlin object 코드 생성', () => {
    const code = template.render({ ...sampleModel, pattern: 'class' });
    expect(code).toContain('object');
    expect(code).toContain('fun fromApi');
    expect(code).toContain('Map<String, Any>');
  });
});

describe('GoTemplate', () => {
  const template = new GoTemplate();

  it('Go 함수 코드 생성', () => {
    const code = template.render(sampleModel);
    expect(code).toContain('func MapUser');
    expect(code).toContain('map[string]interface{}');
    expect(code).toContain('return User{');
  });
});

describe('buildSourceExpression', () => {
  const fm: FieldMapping = {
    sourceField: 'user.name',
    targetField: 'userName',
    transformation: { type: 'rename' },
    confidence: 0.9,
    isAmbiguous: false,
  };

  it('TypeScript 소스 표현식', () => {
    expect(buildSourceExpression(fm, 'typescript')).toBe('source.user.name');
  });

  it('PHP 소스 표현식', () => {
    expect(buildSourceExpression(fm, 'php')).toBe("$source['user']['name']");
  });

  it('Python 소스 표현식', () => {
    expect(buildSourceExpression(fm, 'python')).toBe('source["user"]["name"]');
  });

  it('null 소스 필드면 null 반환', () => {
    const nullFm: FieldMapping = { ...fm, sourceField: null, transformation: { type: 'constant' } };
    expect(buildSourceExpression(nullFm, 'typescript')).toBe('null');
  });
});

describe('wrapTransformation', () => {
  it('type_cast: TypeScript', () => {
    expect(wrapTransformation('source.id', 'type_cast', undefined, 'typescript')).toBe('Number(source.id)');
  });

  it('default_value: fallback', () => {
    expect(wrapTransformation('source.name', 'default_value', { fallback: 'unknown' }, 'typescript'))
      .toBe('source.name ?? "unknown"');
  });

  it('constant: 값 반환', () => {
    expect(wrapTransformation('', 'constant', { value: 42 }, 'typescript')).toBe('42');
  });
});
