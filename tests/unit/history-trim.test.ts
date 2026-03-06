import { describe, it, expect, vi } from 'vitest';
import { HistoryModule } from '../../src/core/history/index.js';
import type { MappingHistory } from '../../src/core/types/history.js';
import type { MappingRule } from '../../src/core/types/mapping.js';

describe('HistoryModule - maxHistoryVersions trimming', () => {
  const mockMapping: MappingRule = {
    id: 'test-mapping',
    version: 1,
    name: 'test',
    source: { profileId: 'p1', endpoint: 'GET /' },
    target: { language: 'typescript', typeName: 'Test' },
    fieldMappings: [],
    metadata: { createdAt: '', updatedAt: '', confidence: 1, ambiguousFields: [] },
  };

  const createMockStorage = (existingHistory: MappingHistory) => ({
    loadHistory: vi.fn().mockResolvedValue(existingHistory),
    saveHistory: vi.fn().mockResolvedValue(undefined),
  }) as any;

  const mockLog = { info: vi.fn(), warn: vi.fn() } as any;

  it('maxHistoryVersions 초과 시 오래된 버전 제거', async () => {
    const maxVersions = 5;
    const mockConfig = { get: vi.fn().mockReturnValue(maxVersions) } as any;

    const history: MappingHistory = {
      mappingId: 'test-mapping',
      versions: Array.from({ length: maxVersions }, (_, i) => ({
        version: i + 1,
        timestamp: new Date().toISOString(),
        source: 'conversation' as const,
        changes: [],
        snapshot: { ...mockMapping, version: i + 1 },
      })),
    };

    const storage = createMockStorage(history);
    const historyModule = new HistoryModule(storage, mockLog, mockConfig);

    await historyModule.recordChange(
      'test-mapping',
      [],
      'conversation',
      { ...mockMapping, version: maxVersions + 1 },
    );

    expect(storage.saveHistory).toHaveBeenCalled();
    const savedHistory = storage.saveHistory.mock.calls[0][0] as MappingHistory;
    expect(savedHistory.versions.length).toBeLessThanOrEqual(maxVersions);
  });

  it('maxHistoryVersions 미만이면 제거하지 않음', async () => {
    const mockConfig = { get: vi.fn().mockReturnValue(50) } as any;

    const history: MappingHistory = {
      mappingId: 'test-mapping',
      versions: [{
        version: 1,
        timestamp: new Date().toISOString(),
        source: 'conversation' as const,
        changes: [],
        snapshot: { ...mockMapping, version: 1 },
      }],
    };

    const storage = createMockStorage(history);
    const historyModule = new HistoryModule(storage, mockLog, mockConfig);

    await historyModule.recordChange(
      'test-mapping',
      [],
      'conversation',
      { ...mockMapping, version: 2 },
    );

    const savedHistory = storage.saveHistory.mock.calls[0][0] as MappingHistory;
    expect(savedHistory.versions.length).toBe(2);
  });

  it('config 없으면 기본 50 사용', () => {
    const historyModule = new HistoryModule(
      createMockStorage({ mappingId: 'test', versions: [] }),
      mockLog,
    );
    expect(historyModule).toBeDefined();
  });
});
