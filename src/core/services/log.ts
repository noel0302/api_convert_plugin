import type { StorageService } from './storage.js';
import type { ConfigService } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = new Set([
  'credentials', 'token', 'apikey', 'api_key', 'password',
  'secret', 'authorization', 'bearer', 'access_token', 'refresh_token',
]);

export class LogService {
  private configLevel: LogLevel;
  private toFile: boolean;

  constructor(
    private storage: StorageService,
    config: ConfigService,
  ) {
    this.configLevel = (config.get('logging.level') as LogLevel) || 'info';
    this.toFile = (config.get('logging.toFile') as boolean) ?? true;
  }

  async debug(module: string, message: string, data?: unknown): Promise<void> {
    await this.log('debug', module, message, data);
  }

  async info(module: string, message: string, data?: unknown): Promise<void> {
    await this.log('info', module, message, data);
  }

  async warn(module: string, message: string, data?: unknown): Promise<void> {
    await this.log('warn', module, message, data);
  }

  async error(module: string, message: string, data?: unknown): Promise<void> {
    await this.log('error', module, message, data);
  }

  private async log(level: LogLevel, module: string, message: string, data?: unknown): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data: data !== undefined ? this.sanitize(data) : undefined,
    };

    if (this.configLevel === 'debug') {
      console.error(`[${level.toUpperCase()}] ${module}: ${message}`);
    }

    if (this.toFile) {
      const date = new Date().toISOString().slice(0, 10);
      try {
        await this.storage.appendLog(date, entry);
      } catch { /* don't crash on log failure */ }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_PRIORITY[level] >= LOG_PRIORITY[this.configLevel];
  }

  private sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = this.sanitize(value);
      }
    }
    return result;
  }
}
