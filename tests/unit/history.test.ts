import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryModule } from '../../src/core/history/index.js';
import type { MappingRule } from '../../src/core/types/mapping.js';
import type { MappingHistory } from '../../src/core/types/history.js';

const baseMappingRule: MappingRule = {
  id: 'test-mapping',
  version: 1,
  name: 'Test Mapping',
  source: { apiProfileId: 'api-1', endpoint: 'GET /users', responseCode: 200 },
  target: { businessContext: '', language: 'typescript', typeName: 'User' },
  fieldMappings: [
    { sourceField: 'id', targetField: 'userId', transformation: { type: 'direct' }, confidence: 1.0, isAmbiguous: false },
  ],
  metadata: { createdAt: '2026-01-01', updatedAt: '2026-01-01', confidence: 1.0, userVerified: false, ambiguousFields: [] },
};

let storedHistory: MappingHistory;

const mockStorage = {
  loadHistory: vi.fn().mockImplementation(() => Promise.resolve(storedHistory)),
  saveHistory: vi.fn().mockImplementation((h: MappingHistory) => { storedHistory = h; return Promise.resolve(); }),
  loadMappingById: vi.fn().mockResolvedValue(baseMappingRule),
  saveMapping: vi.fn().mockResolvedValue('path'),
} as any;

const mockLog = {
  info: vi.fn().mockResolvedValue(undefined),
} as any;

describe('HistoryModule', () => {
  let history: HistoryModule;

  beforeEach(() => {
    storedHistory = {
      mappingId: 'test-mapping',
      versions: [{
        version: 1,
        timestamp: '2026-01-01',
        source: 'conversation',
        changes: [{ type: 'add', field: '*', reason: 'Initial' }],
        snapshot: baseMappingRule,
      }],
    };
    history = new HistoryModule(mockStorage, mockLog);
  });

  it('recordChange: 변경 기록 추가', async () => {
    const v2 = { ...baseMappingRule, version: 2 };
    const entry = await history.recordChange('test-mapping', [{ type: 'modify', field: 'userId' }], 'conversation', v2);
    expect(entry.version).toBe(2);
    expect(storedHistory.versions).toHaveLength(2);
  });

  it('getVersion: 특정 버전 조회', async () => {
    const entry = await history.getVersion('test-mapping', 1);
    expect(entry).toBeDefined();
    expect(entry?.version).toBe(1);
  });

  it('diffVersions: 버전 간 차이 비교', async () => {
    const v2 = {
      ...baseMappingRule,
      version: 2,
      fieldMappings: [
        { sourceField: 'user_id', targetField: 'userId', transformation: { type: 'rename' }, confidence: 1.0, isAmbiguous: false },
      ],
    };
    storedHistory.versions.push({
      version: 2,
      timestamp: '2026-01-02',
      source: 'conversation',
      changes: [],
      snapshot: v2,
    });

    const diff = await history.diffVersions('test-mapping', 1, 2);
    expect(diff.version1).toBe(1);
    expect(diff.version2).toBe(2);
    expect(diff.changes.length).toBeGreaterThan(0);
  });

  it('rollback: 이전 버전으로 복원', async () => {
    const restored = await history.rollback('test-mapping', 1);
    expect(restored.version).toBe(2); // current.version + 1
    expect(mockStorage.saveMapping).toHaveBeenCalled();
  });
});
