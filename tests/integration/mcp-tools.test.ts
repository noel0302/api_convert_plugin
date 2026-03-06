import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '../../src/core/services/config.js';
import { StorageService } from '../../src/core/services/storage.js';
import { LogService } from '../../src/core/services/log.js';
import { AnalyzerModule } from '../../src/core/analyzer/index.js';
import { MapperModule } from '../../src/core/mapper/index.js';
import { GeneratorModule } from '../../src/core/generator/index.js';
import { ValidatorModule } from '../../src/core/validator/index.js';
import { HistoryModule } from '../../src/core/history/index.js';
import { ExecutorModule } from '../../src/core/executor/index.js';
import { ReferenceScanner } from '../../src/reference/index.js';
import { handleToolCall, type Modules } from '../../src/mcp/tools/index.js';

const TEST_DIR = join(process.cwd(), '.test-integration');

describe('MCP Tool Integration', () => {
  let modules: Modules;

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(join(TEST_DIR, 'config.json'), JSON.stringify({ storage: { baseDir: TEST_DIR } }));

    const config = new ConfigService();
    await config.load(TEST_DIR);

    const storage = new StorageService(config);
    await storage.ensureDirectoryStructure();

    const log = new LogService(storage, config);
    const analyzer = new AnalyzerModule(storage, config, log);
    const mapper = new MapperModule(storage, config, log);
    const generator = new GeneratorModule(storage, config, log);
    const validator = new ValidatorModule(storage, log);
    const history = new HistoryModule(storage, log);
    const executor = new ExecutorModule(storage, config, log);
    const scanner = new ReferenceScanner(config, log);

    modules = { analyzer, mapper, generator, validator, history, executor, scanner, storage, config, log };
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('analyze_api → JSON 프로파일 생성', async () => {
    const result = await handleToolCall('analyze_api', {
      sourceType: 'json_sample',
      source: JSON.stringify({ id: 1, name: 'Test', email: 'test@test.com', active: true }),
      name: 'TestAPI',
    }, modules);

    expect(result.content[0].text).not.toContain('Error');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.profile).toBeDefined();
    expect(parsed.profile.name).toBe('TestAPI');
    expect(parsed.profile.endpoints).toHaveLength(1);
  });

  it('analyze_api → curl 파싱', async () => {
    const result = await handleToolCall('analyze_api', {
      sourceType: 'curl',
      source: 'curl -H "Authorization: Bearer token123" https://api.example.com/users',
    }, modules);

    expect(result.content[0].text).not.toContain('Error');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.profile.authentication.type).toBe('bearer');
  });

  it('validate_mapping → 존재하지 않는 매핑 에러', async () => {
    const result = await handleToolCall('validate_mapping', {
      mappingId: 'non-existent',
    }, modules);

    expect(result.content[0].text).toContain('Error');
  });

  it('manage_history → 존재하지 않는 매핑 에러', async () => {
    const result = await handleToolCall('manage_history', {
      action: 'list',
      mappingId: 'non-existent',
    }, modules);

    expect(result.content[0].text).toContain('Error');
  });

  it('unknown tool → INVALID_INPUT 에러', async () => {
    const result = await handleToolCall('unknown_tool', {}, modules);
    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain('Unknown tool');
  });
});
