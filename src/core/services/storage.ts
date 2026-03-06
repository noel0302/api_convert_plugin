import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ConfigService } from './config.js';
import type { ApiProfile } from '../types/profile.js';
import type { TargetProfile } from '../types/target.js';
import type { MappingRule } from '../types/mapping.js';
import type { MappingHistory } from '../types/history.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import { PluginError } from '../errors.js';

export class StorageService {
  private baseDir: string;

  constructor(private config: ConfigService) {
    this.baseDir = config.getBaseDir() || DEFAULT_CONFIG.storage.baseDir;
  }

  async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      this.baseDir,
      join(this.baseDir, 'profiles'),
      join(this.baseDir, 'targets'),
      join(this.baseDir, 'mappings'),
      join(this.baseDir, 'history'),
      join(this.baseDir, 'editors'),
      join(this.baseDir, 'logs'),
    ];

    for (const dir of dirs) {
      await mkdir(dir, { recursive: true });
    }

    const configPath = join(this.baseDir, 'config.json');
    if (!(await this.exists(configPath))) {
      await this.writeJson(configPath, DEFAULT_CONFIG);
    }
  }

  // --- Profile CRUD ---

  async saveProfile(profile: ApiProfile): Promise<string> {
    const path = join(this.baseDir, 'profiles', `${profile.id}.profile.json`);
    await this.writeJson(path, profile);
    return path;
  }

  async loadProfile(id: string): Promise<ApiProfile> {
    const path = join(this.baseDir, 'profiles', `${id}.profile.json`);
    return this.readJson<ApiProfile>(path, 'PROFILE_NOT_FOUND', id);
  }

  async listProfiles(): Promise<ApiProfile[]> {
    return this.listJsonFiles<ApiProfile>(join(this.baseDir, 'profiles'), '.profile.json');
  }

  // --- Target CRUD ---

  async saveTarget(target: TargetProfile): Promise<string> {
    const path = join(this.baseDir, 'targets', `${target.id}.target.json`);
    await this.writeJson(path, target);
    return path;
  }

  async loadTarget(id: string): Promise<TargetProfile> {
    const path = join(this.baseDir, 'targets', `${id}.target.json`);
    return this.readJson<TargetProfile>(path, 'TARGET_NOT_FOUND', id);
  }

  async listTargets(): Promise<TargetProfile[]> {
    return this.listJsonFiles<TargetProfile>(join(this.baseDir, 'targets'), '.target.json');
  }

  // --- Mapping CRUD ---

  async saveMapping(mapping: MappingRule): Promise<string> {
    const dir = join(this.baseDir, 'mappings', mapping.source.apiProfileId);
    await mkdir(dir, { recursive: true });
    const fileName = `${mapping.target.typeName.toLowerCase()}.mapping.json`;
    const path = join(dir, fileName);
    await this.writeJson(path, mapping);
    return path;
  }

  async loadMappingById(id: string): Promise<MappingRule> {
    const allMappings = await this.listMappings();
    const found = allMappings.find(m => m.id === id);
    if (!found) throw new PluginError('MAPPING_NOT_FOUND', id);
    return found;
  }

  async listMappings(): Promise<MappingRule[]> {
    const mappingsDir = join(this.baseDir, 'mappings');
    const results: MappingRule[] = [];

    try {
      const apiDirs = await readdir(mappingsDir, { withFileTypes: true });
      for (const apiDir of apiDirs) {
        if (!apiDir.isDirectory()) continue;
        const apiPath = join(mappingsDir, apiDir.name);
        const files = await readdir(apiPath);
        for (const file of files) {
          if (file.endsWith('.mapping.json')) {
            try {
              const data = await readFile(join(apiPath, file), 'utf-8');
              results.push(JSON.parse(data));
            } catch { /* skip invalid files */ }
          }
        }
      }
    } catch { /* mappings dir may not exist */ }

    return results;
  }

  // --- History CRUD ---

  async initHistory(mapping: MappingRule): Promise<void> {
    const history: MappingHistory = {
      mappingId: mapping.id,
      versions: [{
        version: 1,
        timestamp: mapping.metadata.createdAt,
        source: 'conversation',
        changes: [{ type: 'add', field: '*', reason: 'Initial mapping creation' }],
        snapshot: mapping,
      }],
    };
    await this.saveHistory(history);
  }

  async saveHistory(history: MappingHistory): Promise<void> {
    const mapping = history.versions[0]?.snapshot;
    if (!mapping) return;

    const dir = join(this.baseDir, 'history', mapping.source.apiProfileId);
    await mkdir(dir, { recursive: true });
    const fileName = `${mapping.target.typeName.toLowerCase()}.history.json`;
    await this.writeJson(join(dir, fileName), history);
  }

  async loadHistory(mappingId: string): Promise<MappingHistory> {
    const mapping = await this.loadMappingById(mappingId);
    const dir = join(this.baseDir, 'history', mapping.source.apiProfileId);
    const fileName = `${mapping.target.typeName.toLowerCase()}.history.json`;
    try {
      return await this.readJson<MappingHistory>(join(dir, fileName), 'MAPPING_NOT_FOUND', mappingId);
    } catch {
      return { mappingId, versions: [] };
    }
  }

  // --- Log ---

  async appendLog(date: string, entry: unknown): Promise<void> {
    const path = join(this.baseDir, 'logs', `${date}.log.json`);
    let entries: unknown[] = [];
    try {
      const raw = await readFile(path, 'utf-8');
      entries = JSON.parse(raw);
    } catch { /* file doesn't exist yet */ }
    entries.push(entry);
    await this.writeJson(path, entries);
  }

  // --- Utilities ---

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async readJson<T>(path: string, errorCode: PluginError['code'], detail?: string): Promise<T> {
    try {
      const raw = await readFile(path, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (err) {
      throw new PluginError(errorCode, detail || path, err);
    }
  }

  private async writeJson(path: string, data: unknown): Promise<void> {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      throw new PluginError('FILE_WRITE_ERROR', path, err);
    }
  }

  private async listJsonFiles<T>(dir: string, suffix: string): Promise<T[]> {
    const results: T[] = [];
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (file.endsWith(suffix)) {
          try {
            const raw = await readFile(join(dir, file), 'utf-8');
            results.push(JSON.parse(raw));
          } catch { /* skip invalid */ }
        }
      }
    } catch { /* dir may not exist */ }
    return results;
  }
}
