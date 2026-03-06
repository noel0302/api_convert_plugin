import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type PluginConfig } from '../types/config.js';

export class ConfigService {
  private config: PluginConfig = { ...DEFAULT_CONFIG };
  private baseDir: string = DEFAULT_CONFIG.storage.baseDir;

  async load(projectRoot?: string): Promise<void> {
    this.baseDir = projectRoot
      ? join(projectRoot, DEFAULT_CONFIG.storage.baseDir)
      : join(process.cwd(), DEFAULT_CONFIG.storage.baseDir);
    const configPath = join(this.baseDir, 'config.json');

    try {
      const raw = await readFile(configPath, 'utf-8');
      const userConfig = JSON.parse(raw) as Partial<PluginConfig>;
      this.config = this.mergeWithDefaults(userConfig);
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  get<K extends string>(key: K): unknown {
    return key.split('.').reduce<unknown>((obj, k) => {
      if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k];
      return undefined;
    }, this.config);
  }

  getAll(): Readonly<PluginConfig> {
    return this.config;
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  async save(): Promise<void> {
    const configPath = join(this.baseDir, 'config.json');
    await writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  private mergeWithDefaults(partial: Partial<PluginConfig>): PluginConfig {
    return {
      ...DEFAULT_CONFIG,
      ...partial,
      naming: { ...DEFAULT_CONFIG.naming, ...partial.naming },
      api: { ...DEFAULT_CONFIG.api, ...partial.api },
      mapping: { ...DEFAULT_CONFIG.mapping, ...partial.mapping },
      storage: { ...DEFAULT_CONFIG.storage, ...partial.storage },
      logging: { ...DEFAULT_CONFIG.logging, ...partial.logging },
    };
  }
}
