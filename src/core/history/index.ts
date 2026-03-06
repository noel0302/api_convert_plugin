import type { StorageService } from '../services/storage.js';
import type { ConfigService } from '../services/config.js';
import type { LogService } from '../services/log.js';
import type { MappingRule } from '../types/mapping.js';
import type { MappingHistory, HistoryEntry, FieldChange, ChangeSource, VersionDiff } from '../types/history.js';
import { PluginError } from '../errors.js';

export class HistoryModule {
  constructor(
    private storage: StorageService,
    private log: LogService,
    private config?: ConfigService,
  ) {}

  async recordChange(
    mappingId: string,
    changes: FieldChange[],
    source: ChangeSource,
    snapshot: MappingRule,
    relatedVersions?: number[],
  ): Promise<HistoryEntry> {
    const history = await this.storage.loadHistory(mappingId);

    const entry: HistoryEntry = {
      version: snapshot.version,
      timestamp: new Date().toISOString(),
      source,
      changes,
      relatedVersions,
      snapshot,
    };

    history.versions.push(entry);

    // maxHistoryVersions 제한
    const maxVersions = (this.config?.get('storage.maxHistoryVersions') as number | undefined) ?? 50;
    if (history.versions.length > maxVersions) {
      history.versions = history.versions.slice(-maxVersions);
    }

    await this.storage.saveHistory(history);

    await this.log.info('History', `Recorded v${entry.version} for ${mappingId}`, {
      source,
      changeCount: changes.length,
    });

    return entry;
  }

  async getHistory(mappingId: string): Promise<MappingHistory> {
    return this.storage.loadHistory(mappingId);
  }

  async getVersion(mappingId: string, version: number): Promise<HistoryEntry | undefined> {
    const history = await this.storage.loadHistory(mappingId);
    return history.versions.find(v => v.version === version);
  }

  async diffVersions(mappingId: string, v1: number, v2: number): Promise<VersionDiff> {
    const history = await this.storage.loadHistory(mappingId);

    const entry1 = history.versions.find(v => v.version === v1);
    const entry2 = history.versions.find(v => v.version === v2);

    if (!entry1 || !entry2) {
      throw new PluginError('MAPPING_NOT_FOUND', `Version ${!entry1 ? v1 : v2} not found`);
    }

    const changes = this.computeDiff(entry1.snapshot, entry2.snapshot);

    return { version1: v1, version2: v2, changes };
  }

  async rollback(mappingId: string, toVersion: number): Promise<MappingRule> {
    const entry = await this.getVersion(mappingId, toVersion);
    if (!entry) {
      throw new PluginError('MAPPING_NOT_FOUND', `Version ${toVersion} not found`);
    }

    const current = await this.storage.loadMappingById(mappingId);
    const restored = { ...entry.snapshot, version: current.version + 1 };
    restored.metadata = { ...restored.metadata, updatedAt: new Date().toISOString() };

    await this.storage.saveMapping(restored);

    await this.recordChange(
      mappingId,
      [{ type: 'modify', field: '*', reason: `Rollback to version ${toVersion}` }],
      'conversation',
      restored,
    );

    await this.log.info('History', `Rolled back ${mappingId} to v${toVersion}`);

    return restored;
  }

  private computeDiff(before: MappingRule, after: MappingRule): FieldChange[] {
    const changes: FieldChange[] = [];

    const beforeMap = new Map(before.fieldMappings.map(fm => [fm.targetField, fm]));
    const afterMap = new Map(after.fieldMappings.map(fm => [fm.targetField, fm]));

    for (const [field, afterFm] of afterMap) {
      const beforeFm = beforeMap.get(field);
      if (!beforeFm) {
        changes.push({ type: 'add', field, after: afterFm });
      } else if (JSON.stringify(beforeFm) !== JSON.stringify(afterFm)) {
        changes.push({ type: 'modify', field, before: beforeFm, after: afterFm });
      }
    }

    for (const field of beforeMap.keys()) {
      if (!afterMap.has(field)) {
        changes.push({ type: 'remove', field, before: beforeMap.get(field) });
      }
    }

    return changes;
  }
}
