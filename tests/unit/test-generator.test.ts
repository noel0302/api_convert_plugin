import { describe, it, expect } from 'vitest';
import { generateTestCode } from '../../src/core/validator/test-generator.js';
import type { MappingRule } from '../../src/core/types/mapping.js';

const mockMapping: MappingRule = {
  id: 'test-mapping-1',
  version: 1,
  name: 'UserMapping',
  source: { profileId: 'src-1', endpoint: 'GET /users' },
  target: { language: 'typescript', typeName: 'User' },
  fieldMappings: [
    {
      sourceField: 'user_name',
      targetField: 'userName',
      transformation: { type: 'rename' },
      confidence: 0.95,
      isAmbiguous: false,
      alternatives: [],
    },
    {
      sourceField: 'email',
      targetField: 'email',
      transformation: { type: 'direct' },
      confidence: 1.0,
      isAmbiguous: false,
      alternatives: [],
    },
    {
      sourceField: null,
      targetField: 'defaultRole',
      transformation: { type: 'constant', config: { value: 'user' } },
      confidence: 1.0,
      isAmbiguous: false,
      alternatives: [],
    },
  ],
  metadata: {
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    confidence: 0.9,
    ambiguousFields: [],
  },
};

describe('generateTestCode', () => {
  it('TypeScript (vitest) 테스트 코드 생성', () => {
    const result = generateTestCode(mockMapping);
    expect(result.framework).toBe('vitest');
    expect(result.filePath).toBe('tests/test-mapping-1.test.ts');
    expect(result.code).toContain('import { describe, it, expect }');
    expect(result.code).toContain('UserMapping mapping');
    expect(result.code).toContain('user_name → userName');
    expect(result.code).toContain('email → email');
    expect(result.code).toContain('constant → defaultRole');
  });

  it('Python (pytest) 테스트 코드 생성', () => {
    const result = generateTestCode(mockMapping, { language: 'python' });
    expect(result.framework).toBe('pytest');
    expect(result.filePath).toBe('tests/test-mapping-1.test.py');
    expect(result.code).toContain('import pytest');
    expect(result.code).toContain('class TestUserMapping');
  });

  it('PHP (phpunit) 테스트 코드 생성', () => {
    const result = generateTestCode(mockMapping, { language: 'php' });
    expect(result.framework).toBe('phpunit');
    expect(result.filePath).toBe('tests/test-mapping-1.test.php');
    expect(result.code).toContain('PHPUnit');
    expect(result.code).toContain('TestCase');
  });

  it('Java (junit) 테스트 코드 생성', () => {
    const result = generateTestCode(mockMapping, { language: 'java' });
    expect(result.framework).toBe('junit');
    expect(result.code).toContain('@Test');
    expect(result.code).toContain('import org.junit');
  });

  it('Go (testing) 테스트 코드 생성', () => {
    const result = generateTestCode(mockMapping, { language: 'go' });
    expect(result.framework).toBe('testing');
    expect(result.code).toContain('import "testing"');
    expect(result.code).toContain('func Test');
  });

  it('Kotlin (junit) 테스트 코드 생성', () => {
    const result = generateTestCode(mockMapping, { language: 'kotlin' });
    expect(result.framework).toBe('junit');
    expect(result.filePath).toBe('tests/test-mapping-1.test.kt');
    expect(result.code).toContain('import org.junit');
    expect(result.code).toContain('class UserMappingMappingTest');
    expect(result.code).toContain('@Test');
    expect(result.code).toContain('assertTrue');
  });

  it('커스텀 outputPath 지정', () => {
    const result = generateTestCode(mockMapping, { outputPath: 'custom/path.test.ts' });
    expect(result.filePath).toBe('custom/path.test.ts');
  });
});
