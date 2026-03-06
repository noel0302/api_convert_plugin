import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigService } from '../core/services/config.js';
import { StorageService } from '../core/services/storage.js';
import { LogService } from '../core/services/log.js';
import { AnalyzerModule } from '../core/analyzer/index.js';
import { MapperModule } from '../core/mapper/index.js';
import { GeneratorModule } from '../core/generator/index.js';
import { ValidatorModule } from '../core/validator/index.js';
import { HistoryModule } from '../core/history/index.js';
import { ExecutorModule } from '../core/executor/index.js';
import { ReferenceScanner } from '../reference/index.js';
import { toolDefinitions, handleToolCall } from './tools/index.js';
import { resourceDefinitions, handleResourceRead } from './resources/index.js';

export async function createServer() {
  const config = new ConfigService();
  await config.load();

  const storage = new StorageService(config);
  await storage.ensureDirectoryStructure();

  const log = new LogService(storage, config);

  const analyzer = new AnalyzerModule(storage, config, log);
  const mapper = new MapperModule(storage, config, log);
  const generator = new GeneratorModule(storage, config, log);
  const validator = new ValidatorModule(storage, log);
  const history = new HistoryModule(storage, log, config);
  const executor = new ExecutorModule(storage, config, log);
  const scanner = new ReferenceScanner(config, log);

  const modules = { analyzer, mapper, generator, validator, history, executor, scanner, storage, config, log };

  const server = new Server(
    { name: 'api-convert-plugin', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {}, modules);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceDefinitions,
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return handleResourceRead(uri, modules);
  });

  return server;
}

export async function startServer() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
