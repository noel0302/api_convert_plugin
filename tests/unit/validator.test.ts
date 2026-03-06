import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidatorModule } from '../../src/core/validator/index.js';
import type { MappingRule } from '../../src/core/types/mapping.js';

const mockMapping: MappingRule = {
  id: 'test-mapping',
  version: 1,
  name: 'Test Mapping',
  source: { apiProfileId: 'api-1', endpoint: 'GET /users', responseCode: 200 },
  target: { businessContext: '', language: 'typescript', typeName: 'User' },
  fieldMappings: [
    { sourceField: 'id', targetField: 'userId', transformation: { type: 'rename' }, confidence: 0.95, isAmbiguous: false },
    { sourceField: 'name', targetField: 'userName', transformation: { type: 'direct' }, confidence: 1.0, isAmbiguous: false },
    { sourceField: null, targetField: 'role', transformation: { type: 'constant', config: { value: 'user' } }, confidence: 0, isAmbiguous: true },
    { sourceField: 'status', targetField: 'active', transformation: { type: 'type_cast' }, confidence: 0.4, isAmbiguous: true },
  ],
  metadata: { createdAt: '', updatedAt: '', confidence: 0.6, userVerified: false, ambiguousFields: ['role', 'active'] },
};

const mockStorage = {
  loadMappingById: vi.fn().mockResolvedValue(mockMapping),
} as any;

const mockLog = {
  info: vi.fn().mockResolvedValue(undefined),
  debug: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
} as any;

describe('ValidatorModule', () => {
  let validator: ValidatorModule;

  beforeEach(() => {
    validator = new ValidatorModule(mockStorage, mockLog);
  });

  describe('validateMapping', () => {
    it('유효한 매핑은 valid: true', async () => {
      const result = await validator.validateMapping('test-mapping');
      expect(result.valid).toBe(true);
    });

    it('ambiguous 필드에 대해 warning 생성', async () => {
      const result = await validator.validateMapping('test-mapping');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.field === 'active')).toBe(true);
    });

    it('소스 없고 constant 아닌 경우 error', async () => {
      const badMapping = {
        ...mockMapping,
        fieldMappings: [
          { sourceField: null, targetField: 'missing', transformation: { type: 'rename' }, confidence: 0, isAmbiguous: true },
        ],
      };
      mockStorage.loadMappingById.mockResolvedValueOnce(badMapping);
      const result = await validator.validateMapping('test-mapping');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('dryRun', () => {
    it('샘플 데이터로 변환 시뮬레이션', async () => {
      const result = await validator.dryRun('test-mapping', { id: 123, name: 'Alice', status: true });
      expect(result.output.userId).toBe(123);
      expect(result.output.userName).toBe('Alice');
      expect(result.appliedMappings).toContain('userId');
      expect(result.appliedMappings).toContain('userName');
    });

    it('constant 타입은 고정값 반환', async () => {
      const result = await validator.dryRun('test-mapping', {});
      expect(result.output.role).toBe('user');
    });
  });
});
