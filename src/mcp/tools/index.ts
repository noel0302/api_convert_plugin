import type { AnalyzerModule } from '../../core/analyzer/index.js';
import type { MapperModule, GenerateMappingParams } from '../../core/mapper/index.js';
import type { GeneratorModule } from '../../core/generator/index.js';
import type { ValidatorModule } from '../../core/validator/index.js';
import type { HistoryModule } from '../../core/history/index.js';
import type { ExecutorModule } from '../../core/executor/index.js';
import type { ReferenceScanner } from '../../reference/index.js';
import type { StorageService } from '../../core/services/storage.js';
import type { ConfigService } from '../../core/services/config.js';
import type { LogService } from '../../core/services/log.js';
import type { InputSourceType } from '../../core/types/profile.js';
import type { SupportedLanguage } from '../../core/types/target.js';
import type { ChangeSource } from '../../core/types/history.js';
import { PluginError } from '../../core/errors.js';

type ExecuteAuthParam =
  | { type: 'bearer'; token: string }
  | { type: 'basic'; credentials: string }
  | { type: 'api_key'; header: string; value: string }
  | { type: 'oauth'; token: string }
  | { type: 'custom'; headerName: string; headerValue: string };

export interface Modules {
  analyzer: AnalyzerModule;
  mapper: MapperModule;
  generator: GeneratorModule;
  validator: ValidatorModule;
  history: HistoryModule;
  executor: ExecutorModule;
  scanner: ReferenceScanner;
  storage: StorageService;
  config: ConfigService;
  log: LogService;
}

export const toolDefinitions = [
  {
    name: 'analyze_api',
    description: 'API 소스(JSON 샘플, curl, Swagger URL)를 분석하여 프로파일 생성',
    inputSchema: {
      type: 'object' as const,
      properties: {
        source: { type: 'string', description: '분석할 소스 데이터 (JSON, curl 명령어, 또는 Swagger URL)' },
        sourceType: { type: 'string', enum: ['json_sample', 'curl', 'swagger', 'xml'], description: '소스 타입' },
        name: { type: 'string', description: '프로파일 이름' },
        baseUrl: { type: 'string', description: 'API base URL' },
        profileId: { type: 'string', description: '기존 프로파일 업데이트 시 프로파일 ID' },
        auth: { type: 'object', description: '인증 정보 ({type, token} 등)' },
        timeout: { type: 'number', description: '요청 타임아웃 (ms)' },
        followRedirects: { type: 'boolean', description: '리다이렉트 자동 추적 여부' },
      },
      required: ['source', 'sourceType'],
    },
  },
  {
    name: 'generate_mapping',
    description: '필드 매핑 규칙 저장. Claude가 분석한 fieldMappings를 받아 MappingRule로 저장.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        apiProfile: { type: 'string', description: '소스 API 프로파일 ID' },
        endpoint: { type: 'string', description: '대상 엔드포인트 (예: "GET /users")' },
        targetProfileId: { type: 'string', description: '기존 타겟 프로파일 ID' },
        targetDefinition: { type: 'string', description: '타겟 필드 정의 (JSON 문자열)' },
        language: { type: 'string', enum: ['typescript', 'php', 'java', 'python', 'kotlin', 'go'], description: '대상 언어' },
        typeName: { type: 'string', description: '타겟 타입명' },
        fieldMappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceField: { description: '소스 필드 경로. null이면 매핑 없음 (값 지정 필요)' },
              targetField: { type: 'string', description: '타겟 필드 경로' },
              transformation: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: '변환 타입 (direct, rename, type_cast, computed 등)' },
                  config: { type: 'object', description: '변환 설정 (mapping, value 등)' },
                },
              },
              confidence: { type: 'number', description: '신뢰도 (0-1, 기본: 1.0)' },
              userNote: { type: 'string', description: '참고 메모' },
            },
            required: ['targetField'],
          },
          description: '필드 매핑 배열.',
        },
      },
      required: ['apiProfile', 'endpoint', 'language', 'fieldMappings'],
    },
  },
  {
    name: 'generate_code',
    description: '매핑 규칙 기반으로 변환 코드를 생성',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mappingId: { type: 'string', description: '매핑 규칙 ID' },
        language: { type: 'string', enum: ['typescript', 'php', 'java', 'python', 'kotlin', 'go'], description: '출력 언어 (기본: 매핑 규칙의 언어)' },
        pattern: { type: 'string', enum: ['class', 'function', 'builder'], description: '코드 패턴' },
        className: { type: 'string', description: '클래스명 (class 패턴일 때)' },
      },
      required: ['mappingId'],
    },
  },
  {
    name: 'validate_mapping',
    description: '매핑 규칙을 검증하고 dry-run 테스트 수행 또는 테스트 코드 생성',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mappingId: { type: 'string', description: '매핑 규칙 ID' },
        mode: { type: 'string', enum: ['dry_run', 'generate_test', 'generate_test_page'], description: '검증 모드 (기본: dry_run)' },
        sampleData: { type: 'object', description: 'dry-run에 사용할 샘플 데이터 (선택)' },
        testConfig: {
          type: 'object',
          properties: {
            framework: { type: 'string', description: '테스트 프레임워크' },
            language: { type: 'string', enum: ['typescript', 'php', 'java', 'python', 'kotlin', 'go'], description: '테스트 코드 언어' },
            outputPath: { type: 'string', description: '출력 파일 경로' },
          },
          description: '테스트 생성 설정 (generate_test 모드)',
        },
      },
      required: ['mappingId'],
    },
  },
  {
    name: 'update_mapping',
    description: '기존 매핑 규칙의 필드를 수정, 추가, 삭제',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mappingId: { type: 'string', description: '매핑 규칙 ID' },
        source: { type: 'string', enum: ['conversation', 'visual_editor', 'json_direct', 'code_sync', 'cascade', 'auto_regenerate'], description: '변경 소스 (기본: conversation)' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['add', 'modify', 'remove'] },
              field: { type: 'string' },
              after: { type: 'object' },
            },
            required: ['type', 'field'],
          },
          description: '적용할 변경 목록',
        },
      },
      required: ['mappingId', 'changes'],
    },
  },
  {
    name: 'execute_api_call',
    description: '외부 API를 직접 호출하고 응답을 분석하여 프로파일에 반영',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'API URL' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], description: 'HTTP 메서드' },
        headers: { type: 'object', description: '요청 헤더' },
        body: { type: 'string', description: '요청 바디 (JSON 문자열)' },
        auth: { type: 'object', description: '인증 정보 ({type, token} 또는 {type, credentials} 또는 {type, header, value})' },
        timeout: { type: 'number', description: '타임아웃 (ms)' },
        profileId: { type: 'string', description: '응답을 저장할 프로파일 ID (선택)' },
        followRedirects: { type: 'boolean', description: '리다이렉트 자동 추적 (기본: true)' },
        captureFullResponse: { type: 'boolean', description: '전체 응답 원문 캡처 여부' },
      },
      required: ['url'],
    },
  },
  {
    name: 'manage_history',
    description: '매핑 규칙의 변경 이력 조회, 버전 비교, 롤백',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: { type: 'string', enum: ['list', 'get_version', 'rollback', 'compare', 'export'], description: '수행할 작업' },
        mappingId: { type: 'string', description: '매핑 규칙 ID' },
        version: { type: 'number', description: '대상 버전 (get_version, rollback)' },
        version1: { type: 'number', description: '비교할 버전 1 (compare)' },
        version2: { type: 'number', description: '비교할 버전 2 (compare)' },
      },
      required: ['action', 'mappingId'],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  modules: Modules,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    let result: unknown;

    switch (name) {
      case 'analyze_api':
        result = await modules.analyzer.analyze(
          { type: args.sourceType as InputSourceType, content: args.source as string },
          { profileName: args.name as string | undefined, baseUrl: args.baseUrl as string | undefined },
        );
        break;

      case 'generate_mapping':
        result = await modules.mapper.generateMapping({
          apiProfile: args.apiProfile as string,
          endpoint: args.endpoint as string,
          target: {
            type: args.targetProfileId ? 'existing_dto' : args.targetDefinition ? 'user_defined' : 'auto_generate',
            reference: args.targetDefinition as string | undefined,
            language: ((args.language as string) || 'typescript') as SupportedLanguage,
            typeName: args.typeName as string | undefined,
            targetProfileId: args.targetProfileId as string | undefined,
          },
          fieldMappings: args.fieldMappings as GenerateMappingParams['fieldMappings'],
        });
        break;

      case 'generate_code':
        result = await modules.generator.generateCode({
          mappingId: args.mappingId as string,
          language: args.language as SupportedLanguage | undefined,
          pattern: args.pattern as 'class' | 'function' | 'builder' | undefined,
          className: args.className as string | undefined,
        });
        break;

      case 'validate_mapping': {
        const mode = (args.mode as string) || 'dry_run';
        if (mode === 'generate_test_page') {
          result = await modules.validator.generateTestPage(args.mappingId as string);
        } else if (mode === 'generate_test') {
          const testConfig = args.testConfig as { framework?: string; language?: string; outputPath?: string } | undefined;
          result = await modules.validator.generateTest(args.mappingId as string, testConfig ? {
            framework: testConfig.framework,
            language: testConfig.language as import('../../core/types/target.js').SupportedLanguage | undefined,
            outputPath: testConfig.outputPath,
          } : undefined);
        } else {
          const validation = await modules.validator.validateMapping(args.mappingId as string);
          if (args.sampleData) {
            const dryRun = await modules.validator.dryRun(
              args.mappingId as string,
              args.sampleData as Record<string, unknown>,
            );
            result = { validation, dryRun };
          } else {
            result = validation;
          }
        }
        break;
      }

      case 'update_mapping':
        result = await modules.mapper.updateMapping(
          args.mappingId as string,
          args.changes as Array<{ type: 'add' | 'modify' | 'remove'; field: string; after?: unknown }>,
          (args.source as ChangeSource) || 'conversation',
        );
        break;

      case 'execute_api_call':
        result = await modules.executor.execute({
          url: args.url as string,
          method: args.method as string | undefined,
          headers: args.headers as Record<string, string> | undefined,
          body: args.body as string | undefined,
          auth: args.auth as ExecuteAuthParam | undefined,
          timeout: args.timeout as number | undefined,
          profileId: args.profileId as string | undefined,
          followRedirects: args.followRedirects as boolean | undefined,
          captureFullResponse: args.captureFullResponse as boolean | undefined,
        });
        break;

      case 'manage_history': {
        const action = args.action as string;
        const mappingId = args.mappingId as string;

        switch (action) {
          case 'list':
            result = await modules.history.getHistory(mappingId);
            break;
          case 'get_version':
            result = await modules.history.getVersion(mappingId, args.version as number);
            break;
          case 'rollback':
            result = await modules.history.rollback(mappingId, args.version as number);
            break;
          case 'compare':
            result = await modules.history.diffVersions(mappingId, args.version1 as number, args.version2 as number);
            break;
          case 'export': {
            const history = await modules.history.getHistory(mappingId);
            result = {
              exported: JSON.stringify(history, null, 2),
              exportedAt: new Date().toISOString(),
              mappingId,
              versionCount: history.versions.length,
            };
            break;
          }
          default:
            throw new PluginError('INVALID_INPUT', `Unknown history action: ${action}`);
        }
        break;
      }

      default:
        throw new PluginError('INVALID_INPUT', `Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof PluginError ? err.userMessage : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
