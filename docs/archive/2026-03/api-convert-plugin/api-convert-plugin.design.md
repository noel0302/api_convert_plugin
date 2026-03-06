# API Convert Plugin - Design Document

> **Summary**: 외부 API 응답을 비즈니스 모델로 변환하는 Claude Code 플러그인의 상세 설계
>
> **Project**: api-convert-plugin
> **Version**: v1.0
> **Author**: Claude
> **Date**: 2026-03-06
> **Status**: Draft
> **Planning Doc**: [PLAN-api-convert-plugin.md](../../01-plan/PLAN-api-convert-plugin.md)

---

## 1. Overview

### 1.1 Design Goals

1. **유연성 최우선**: 소스/타겟 구조, 매핑 규칙, 비즈니스 맥락 — 어떤 것이든 언제든 변경 가능한 구조
2. **토큰 효율**: Analyze Once, Reference Summary — 대용량 문서를 프로파일로 압축하여 재사용
3. **MCP + Skill 하이브리드**: 핵심 엔진(MCP Tool)과 가이드 워크플로우(Skill)의 분리
4. **언어 무관 코드 생성**: TypeScript, PHP, Java, Python, Kotlin, Go 등 다양한 언어 지원
5. **연쇄 변경 대응**: 소스/타겟 변경 시 영향 분석 → 자동 제안 → 사용자 확인 → 업데이트

### 1.2 Design Principles

- **Flexibility First**: 모든 설계 결정에서 유연함이 최우선. 변경에 자연스럽게 대응하지 못하면 잘못된 설계
- **Minimum Viable Context**: 비즈니스 맥락은 필요할 때만 수집. 단순 리네이밍에 불필요한 정보를 요구하지 않음
- **Plugin as Engine**: 플러그인은 판단의 보조자. 최종 결정은 항상 사용자
- **Separation of Concerns**: 분석, 매핑, 생성, 검증, 히스토리를 독립 모듈로 분리
- **Convention over Configuration**: 사용자 프로젝트의 기존 패턴을 감지하여 그대로 따름

---

## 2. Architecture

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Claude Code Host                               │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      Skill Layer (진입점)                           │  │
│  │                                                                     │  │
│  │  /api-convert    /api-map    /api-test    /api-analyze   /api-mapping-edit │  │
│  │  (전체 워크플로우) (매핑)     (테스트)     (분석)         (매핑 편집)       │  │
│  │                                                                     │  │
│  │  Markdown 기반 Skill → MCP Tool 호출을 가이드                      │  │
│  └────────────────────────────┬───────────────────────────────────────┘  │
│                                │                                         │
│                       MCP Tool 호출 (JSON-RPC)                          │
│                                │                                         │
│  ┌────────────────────────────▼───────────────────────────────────────┐  │
│  │                    MCP Server (핵심 엔진)                           │  │
│  │                                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │  Tool Router  │  │  Resource    │  │  Server Lifecycle        │ │  │
│  │  │  (7 Tools)    │  │  Provider    │  │  (init, shutdown)       │ │  │
│  │  │               │  │  (6 URIs)    │  │                         │ │  │
│  │  └───────┬───────┘  └──────┬──────┘  └─────────────────────────┘ │  │
│  │          │                  │                                      │  │
│  │  ┌───────▼──────────────────▼──────────────────────────────────┐  │  │
│  │  │                    Core Engine Layer                         │  │  │
│  │  │                                                              │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │  │  │
│  │  │  │ Analyzer  │  │  Mapper   │  │Generator │  │ Validator  │  │  │  │
│  │  │  │ Module    │  │  Module   │  │ Module   │  │ Module     │  │  │  │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │  │  │
│  │  │       │              │              │              │         │  │  │
│  │  │  ┌────▼──────────────▼──────────────▼──────────────▼─────┐  │  │  │
│  │  │  │              Shared Services                           │  │  │  │
│  │  │  │                                                        │  │  │  │
│  │  │  │  StorageService  │  HistoryService  │  ConfigService  │  │  │  │
│  │  │  │  ReferenceScanner│  ExecutorService  │  LogService     │  │  │  │
│  │  │  └────────────────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │                    File System Layer                          │  │  │
│  │  │                                                               │  │  │
│  │  │  .api-convert/                                                │  │  │
│  │  │  ├── config.json     profiles/    targets/                   │  │  │
│  │  │  ├── mappings/       history/     editors/     logs/         │  │  │
│  │  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  External                                                           │  │
│  │  ├── 외부 API 서버 (HTTP/HTTPS)                                    │  │
│  │  ├── 사용자 프로젝트 코드베이스 (파일 시스템)                        │  │
│  │  └── 브라우저 (비주얼 매핑 에디터 HTML)                              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
[사용자 입력]
    │
    ▼
[Skill Layer] ──대화형 가이드──→ [MCP Tool 호출]
    │                                    │
    │                                    ▼
    │                          [Tool Router]
    │                                    │
    │        ┌───────────────────────────┼───────────────────────────┐
    │        ▼                           ▼                           ▼
    │   analyze_api      generate_mapping           validate_mapping
    │        │                           │                           │
    │        ▼                           ▼                           ▼
    │   [Analyzer Module]          [Mapper Module]           [Validator Module]
    │        │                           │                           │
    │        ▼                           ▼                           ▼
    │   profiles/*.json            mappings/*.json           DryRunResult
    │                                    │
    │                                    ▼
    │                           [Generator Module]
    │                                    │
    │                                    ▼
    │                           generated source code
    │                                    │
    │        ┌───────────────────────────┤
    │        ▼                           ▼
    │   [History Module]         [사용자 프로젝트에 저장]
    │        │
    │        ▼
    │   history/*.json
    │
    ▼
[사용자에게 결과 반환]
```

### 2.3 Module Dependencies

| Module | Depends On | Purpose |
|--------|-----------|---------|
| Tool Router | Core Engine 전체 | MCP Tool 요청을 적절한 모듈로 라우팅 |
| Resource Provider | StorageService | MCP Resource 요청에 저장된 데이터 반환 |
| Analyzer Module | StorageService, ConfigService | API 소스 분석 → 프로파일 생성 |
| Mapper Module | StorageService, Analyzer | 프로파일 기반 매핑 규칙 생성 |
| Generator Module | Mapper, ConfigService | 매핑 규칙 → 언어별 코드 생성 |
| Validator Module | Mapper, Generator | Dry-run, 테스트 생성, 검증 |
| History Module | StorageService | 버전 관리, 변경 추적, 롤백 |
| Executor Module | ConfigService | 외부 API 직접 호출 |
| Reference Scanner | ConfigService | 프로젝트 코드베이스 분석 |
| Storage Service | (없음) | 파일 시스템 I/O 추상화 |
| Config Service | Storage Service | 플러그인 설정 관리 |
| Log Service | Storage Service | 구조화된 로깅 |

---

## 3. Data Model

### 3.1 Core Entity Definitions

모든 타입은 Plan 문서의 정의를 기반으로 하되, 구현에 필요한 세부 사항을 보완한다.

#### 3.1.1 API Profile (소스 분석 결과)

```typescript
// src/core/types/profile.ts

interface ApiProfile {
  id: string;                            // kebab-case 고유 ID (예: "payment-api")
  name: string;                          // 표시명 (예: "PG사 결제 API")
  version?: string;                      // API 버전 (예: "2.1")
  baseUrl: string;                       // 기본 URL
  endpoints: ApiEndpoint[];              // 엔드포인트 목록
  authentication: AuthConfig;            // 인증 설정
  analyzedFrom: AnalysisSource;          // 분석 원본 정보
  metadata: {
    confidence: number;                  // 분석 신뢰도 (0-1)
    documentUrl?: string;                // 원본 문서 URL
  };
  notes?: string[];                      // 분석 시 발견한 주의사항
}

interface AnalysisSource {
  sourceType: InputSourceType;
  originalPath?: string;
  originalSize?: string;
  analyzedAt: string;                    // ISO 8601
}

interface ApiEndpoint {
  method: HttpMethod;
  path: string;                          // URL 경로 (예: "/payments/{id}")
  description?: string;
  request: {
    headers?: Record<string, FieldSchema>;
    queryParams?: Record<string, FieldSchema>;
    pathParams?: string[];               // URL 경로 변수 (예: ["id"])
    body?: ObjectSchema;
  };
  response: {
    statusCodes: Record<number, ObjectSchema>;
  };
}

interface FieldSchema {
  type: FieldType;
  nullable: boolean;
  required: boolean;
  description?: string;
  example?: unknown;
  children?: Record<string, FieldSchema>;  // object
  items?: FieldSchema;                      // array
  enum?: unknown[];
  format?: string;                          // date, email, uuid 등
}

// ObjectSchema and AuthConfig are separate exported interfaces
interface ObjectSchema {
  type: 'object';
  children: Record<string, FieldSchema>;
  description?: string;
}

interface AuthConfig {
  type: 'bearer' | 'api_key' | 'basic' | 'oauth' | 'custom' | 'none';
  tokenSource?: string;
  notes?: string;
}

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
type InputSourceType = 'swagger' | 'json_sample' | 'curl' | 'url' | 'document' | 'git' | 'xml';

// SupportedLanguage is defined in target.ts (not profile.ts)
// type SupportedLanguage → see 3.1.2
```

#### 3.1.2 Target Profile (타겟 분석 결과)

```typescript
// src/core/types/target.ts

type SupportedLanguage = 'typescript' | 'php' | 'java' | 'kotlin' | 'python' | 'go';

interface TargetProfile {
  id: string;                            // kebab-case 고유 ID
  name: string;                          // 클래스/인터페이스명 (예: "OrderPaymentDto")
  analyzedFrom: {
    sourceType: 'dto_file' | 'code_scan' | 'user_defined' | 'document';
    originalPath?: string;
    analyzedAt: string;
  };
  language: SupportedLanguage;
  fields: Record<string, TargetFieldSchema>;
}

interface TargetFieldSchema extends FieldSchema {
  businessContext?: BusinessContext;
}

interface BusinessContext {
  meaning?: string;                      // 비즈니스 의미
  constraints?: string;                  // 제약 조건
  source?: string;                       // 정보 출처
  caution?: string;                      // 주의사항
  codeMapping?: Record<string, string>;  // 코드 매핑 테이블
}
```

#### 3.1.3 Mapping Rule (매핑 규칙)

```typescript
// src/core/types/mapping.ts

interface MappingRule {
  id: string;                            // 고유 ID (uuid 또는 의미있는 slug)
  version: number;                       // 버전 번호 (1부터 시작)
  name: string;                          // 매핑명 (예: "배송API→이커머스 주문")
  description?: string;

  source: {
    apiProfileId: string;                // API 프로파일 참조
    endpoint: string;                    // 대상 엔드포인트 (예: "POST /payments")
    responseCode: number;                // 대상 응답 코드 (예: 200)
  };

  target: {
    businessContext: string;             // 비즈니스 컨텍스트명
    language: SupportedLanguage;
    filePath?: string;                   // 대상 파일 경로
    typeName: string;                    // 대상 타입/클래스명
    targetProfileId?: string;            // 타겟 프로파일 참조
  };

  fieldMappings: FieldMapping[];

  metadata: {
    createdAt: string;
    updatedAt: string;
    confidence: number;                  // 전체 자동 매핑 신뢰도
    userVerified: boolean;               // 사용자가 전체 검증했는지
    ambiguousFields: string[];           // 모호한 필드 목록
    derivedFrom?: string;               // 파생 원본 매핑 ID
  };
}

interface FieldMapping {
  sourceField: string | string[] | null;
  targetField: string;
  transformation: {
    type: TransformationType;
    config?: TransformConfig;
  };
  confidence: number;
  isAmbiguous: boolean;
  userNote?: string;
}

type TransformationType =
  | 'direct'           // 직접 매핑
  | 'type_cast'        // 타입 변환
  | 'rename'           // 필드명 변경
  | 'nested_extract'   // 중첩 추출
  | 'array_map'        // 배열 매핑
  | 'array_flatten'    // 배열 평탄화
  | 'array_to_object'  // 배열→객체
  | 'object_merge'     // 여러 필드 합침
  | 'conditional'      // 조건부 변환
  | 'computed'         // 계산된 값
  | 'constant'         // 상수값
  | 'default_value'    // 기본값
  | 'format'           // 포맷 변환
  | 'restructure'      // 구조 재조합
  | 'custom';          // 사용자 정의

interface TransformConfig {
  value?: unknown;                       // constant, default_value
  fallback?: unknown;                    // default_value
  expression?: string;                   // computed
  mapping?: Record<string, unknown>;     // conditional (코드 매핑 테이블)
  strategy?: string;                     // restructure
  pattern?: string;                      // restructure
  unmatchedStrategy?: 'throw' | 'null' | 'passthrough';
  [key: string]: unknown;               // 확장
}
```

#### 3.1.4 History & Change Tracking

```typescript
// src/core/types/history.ts

interface MappingHistory {
  mappingId: string;
  versions: HistoryEntry[];
}

interface HistoryEntry {
  version: number;
  timestamp: string;                     // ISO 8601
  source: ChangeSource;
  changes: FieldChange[];
  relatedVersions?: number[];            // 연쇄 수정 시 관련 버전
  snapshot: MappingRule;                 // 해당 버전의 전체 스냅샷
}

interface FieldChange {
  type: 'add' | 'modify' | 'remove';
  field: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

type ChangeSource =
  | 'conversation'
  | 'visual_editor'
  | 'json_direct'
  | 'code_sync'
  | 'cascade'
  | 'auto_regenerate';
```

#### 3.1.5 Conflict Resolution (N:1 매핑)

```typescript
// src/core/types/conflict.ts

type ConflictStrategy =
  | 'priority'
  | 'latest'
  | 'custom'
  | 'ask_user'
  | 'highest_confidence'
  | 'first_match'
  | 'merge'
  | 'user_choice';

interface ConflictResolution {
  targetField: string;
  sources: {
    apiProfileId: string;
    sourceField: string;
    priority: number;                    // 낮을수록 높음
  }[];
  strategy: ConflictStrategy;
  resolvedSource: string;                // 최종 선택된 소스 필드
  confidence: number;                    // 해소 신뢰도 (0-1)
  customLogic?: string;
}
```

#### 3.1.6 Configuration

```typescript
// src/core/types/config.ts

interface PluginConfig {
  version: string;                       // 설정 스키마 버전
  defaultLanguage: SupportedLanguage;
  naming: {
    convention: 'camelCase' | 'snake_case' | 'PascalCase';
    detectFromProject: boolean;          // 프로젝트 패턴 자동 감지
  };
  api: {
    timeout: number;                     // ms (기본: 30000)
    maxRetries: number;                  // 기본: 3
    retryDelay: number;                  // ms (기본: 1000, 지수 백오프)
  };
  mapping: {
    confidenceThreshold: number;         // 자동 확정 기준 (기본: 0.9)
    strictMode: boolean;                 // 모호한 매핑 전부 확인 (기본: false)
  };
  storage: {
    baseDir: string;                     // 기본: ".api-convert"
    maxHistoryVersions: number;          // 기본: 50
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    toFile: boolean;
  };
}
```

### 3.2 Entity Relationships

```
[ApiProfile]           [TargetProfile]
    │                       │
    │ 1                     │ 1
    │                       │
    ├────── N ──── [MappingRule] ──── N ────┤
    │                   │                    │
    │                   │ 1                  │
    │                   │                    │
    │              [MappingHistory]           │
    │                   │                    │
    │              N [HistoryEntry]           │
    │                                        │
    │         [ConflictResolution]            │
    │         (N:1 매핑 시에만)               │
    │                                        │
    └────────────────────────────────────────┘

관계 요약:
- ApiProfile 1 : N MappingRule (하나의 API → 여러 비즈니스 모델)
- TargetProfile 1 : N MappingRule (하나의 타겟에 여러 소스 매핑 가능)
- MappingRule 1 : 1 MappingHistory (각 매핑의 변경 이력)
- MappingHistory 1 : N HistoryEntry (버전별 스냅샷)
```

### 3.3 File Storage Schema

```
.api-convert/
├── config.json                              → PluginConfig
├── profiles/
│   └── {api-id}.profile.json                → ApiProfile
├── targets/
│   └── {target-id}.target.json              → TargetProfile
├── mappings/
│   └── {api-id}/
│       └── {target-name}.mapping.json       → MappingRule
├── history/
│   └── {api-id}/
│       └── {target-name}.history.json       → MappingHistory
├── editors/
│   └── {mapping-name}.editor.html           → Visual Editor HTML
└── logs/
    └── {YYYY-MM-DD}.log.json                → LogEntry[]
```

---

## 4. Module Design

### 4.1 MCP Server (Entry Point)

```typescript
// src/mcp/server.ts

/**
 * MCP 서버 엔트리포인트.
 * @modelcontextprotocol/sdk를 사용하여 서버 인스턴스를 생성하고
 * Tool과 Resource를 등록한다.
 */

// 서버 초기화 흐름:
// 1. ConfigService 로드 (config.json 읽기 또는 기본값 생성)
// 2. StorageService 초기화 (.api-convert/ 디렉토리 구조 확인/생성)
// 3. LogService 초기화
// 4. Core Module 인스턴스 생성 (Analyzer, Mapper, Generator, Validator, History, Executor)
// 5. Tool 등록 (7개) via server.setRequestHandler
// 6. Resource 등록 (6개 URI) via server.setRequestHandler
// 7. stdio transport 시작

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Modules 인터페이스: 의존성 주입을 위한 모듈 컨테이너.
 * createServer()에서 생성되어 Tool/Resource 핸들러에 전달.
 */
interface Modules {
  storage: StorageService;
  config: ConfigService;
  log: LogService;
  analyzer: AnalyzerModule;
  mapper: MapperModule;
  generator: GeneratorModule;
  validator: ValidatorModule;
  history: HistoryModule;
  executor: ExecutorModule;
  scanner: ReferenceScanner;
}

/**
 * 서버 인스턴스와 모듈을 생성하는 팩토리 함수.
 * setRequestHandler 패턴으로 Tool/Resource 핸들러 등록.
 */
async function createServer(): Promise<Server> {
  const server = new Server(
    { name: 'api-convert-plugin', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  const config = new ConfigService();
  const storage = new StorageService(config);
  const log = new LogService(storage, config);

  const modules: Modules = {
    storage, config, log,
    analyzer: new AnalyzerModule(storage, config, log),
    mapper: new MapperModule(storage, config, log),
    generator: new GeneratorModule(storage, config, log),
    validator: new ValidatorModule(storage, log),
    history: new HistoryModule(storage, log, config),    // config is optional
    executor: new ExecutorModule(storage, config, log),
    scanner: new ReferenceScanner(config, log),
  };

  // 7개 MCP Tool 핸들러 등록 (상세 스펙은 4.2에서)
  // server.setRequestHandler(CallToolRequestSchema, ...)

  // 6개 MCP Resource 핸들러 등록 (상세 스펙은 4.3에서)
  // server.setRequestHandler(ReadResourceRequestSchema, ...)

  return server;
}

/**
 * 서버를 시작하는 함수.
 */
async function startServer(): Promise<void> {
  const server = await createServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### 4.2 MCP Tool Specifications

#### 4.2.1 analyze_api

```typescript
// src/mcp/tools/index.ts (consolidated tool definitions)

/**
 * 외부 API 정보를 수집하고 응답 구조를 분석하여 프로파일로 저장.
 *
 * 처리 흐름:
 * 1. InputNormalizer: 입력 소스를 통일된 내부 포맷으로 변환
 *    - swagger → OpenAPI 파서 → 정규화된 엔드포인트
 *    - json_sample → JSON 구조 분석 → 스키마 추론
 *    - curl → curl 파싱 → 실행 → 응답 캡처 → 스키마 추론
 *    - url → HTTP 호출 → 응답 캡처 → 스키마 추론
 *    - document → 텍스트 추출 → Claude 분석 (MCP Tool 외부에서 처리)
 *    - git → 파일 시스템 읽기 → 코드 구조 분석
 *    - xml → XML 파싱 → JSON 정규화 → 스키마 추론
 * 2. SchemaExtractor: 필드명, 타입, 중첩구조, 필수/선택 추출
 * 3. ProfileGenerator: ApiProfile JSON 생성 및 저장
 */

// Input Schema (MCP Tool inputSchema) - flat structure, no nested source object
const analyzeInputSchema = {
  type: 'object',
  properties: {
    source: { type: 'string' },                // 내용 또는 파일 경로
    sourceType: {
      type: 'string',
      enum: ['swagger', 'json_sample', 'curl', 'url', 'document', 'git', 'xml'],
    },
    name: { type: 'string' },                  // optional: 프로파일 표시명
    baseUrl: { type: 'string' },               // optional: API 기본 URL
    profileId: { type: 'string' },             // optional: 기존 프로파일 갱신 시
    auth: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['bearer', 'api_key', 'basic', 'oauth', 'custom'] },
        credentials: { type: 'string' },
      },
    },
    timeout: { type: 'number', default: 30000 },
    followRedirects: { type: 'boolean', default: true },
  },
  required: ['source', 'sourceType'],
} as const;

// Output
interface AnalyzeResult {
  profile: ApiProfile;
  confidence: number;
  warnings: string[];
  suggestions: string[];                 // 추가 정보 요청 제안
  savedTo: string;                       // 저장된 파일 경로
}
```

#### 4.2.2 generate_mapping

```typescript
// src/mcp/tools/index.ts (consolidated)

/**
 * API 프로파일과 타겟 정보를 기반으로 매핑 규칙 생성.
 *
 * 처리 흐름:
 * 1. 소스 프로파일 로드 (apiProfile ID로 참조)
 * 2. 타겟 결정
 *    - existing_dto: 파일에서 DTO 분석 → TargetProfile 생성
 *    - existing_code: 코드베이스 스캔 → 관련 모델 감지
 *    - user_defined: 사용자가 직접 구조 정의
 *    - auto_generate: 소스 구조 기반 타겟 자동 생성
 * 3. FieldMapper: 필드 간 매핑 도출
 *    - 필드명 유사도 비교 (편집 거리, 의미 유사도)
 *    - 타입 호환성 검사
 *    - 구조적 위치 유사성
 *    - 기존 매핑 패턴 참조
 * 4. AmbiguityDetector: 모호한 매핑 식별 → ambiguousFields 마킹
 * 5. 소스 미존재 필드 감지 → 처리 방안 제안
 * 6. MappingRule 생성 및 저장
 */

const generateMappingInputSchema = {
  type: 'object',
  properties: {
    apiProfile: { type: 'string' },
    endpoint: { type: 'string' },
    targetProfileId: { type: 'string' },
    targetDefinition: { type: 'string' },
    language: { type: 'string', enum: ['typescript', 'php', 'java', 'kotlin', 'python', 'go'] },
    typeName: { type: 'string' },
    options: {
      type: 'object',
      properties: {
        strictMode: { type: 'boolean', default: false },
        includeNullHandling: { type: 'boolean', default: true },
        namingConvention: { type: 'string', enum: ['camelCase', 'snake_case', 'PascalCase'] },
      },
    },
  },
  required: ['apiProfile', 'endpoint', 'language'],
} as const;

// Output
interface GenerateMappingResult {
  mappingRule: MappingRule;
  preview: {
    confirmedMappings: FieldMapping[];    // 확정
    ambiguousMappings: FieldMapping[];    // 확인 필요
    unmappedSourceFields: string[];       // 소스에는 있으나 타겟에 없음
    missingTargetFields: string[];        // 타겟에 필요하나 소스에 없음
  };
  generatedCode?: string;                // 코드 프리뷰
  savedTo: string;
}
```

#### 4.2.3 generate_code

```typescript
/**
 * 매핑 규칙을 기반으로 코드를 생성.
 * GeneratorModule을 통해 언어별 변환 코드 출력.
 */

const generateCodeInputSchema = {
  type: 'object',
  properties: {
    mappingId: { type: 'string' },                // 매핑 규칙 ID
    language: { type: 'string', enum: ['typescript', 'php', 'java', 'kotlin', 'python', 'go'] },
    pattern: { type: 'string', enum: ['class', 'function', 'builder'] },
    className: { type: 'string' },                // optional: 생성할 클래스/함수명
  },
  required: ['mappingId'],
} as const;

// Output
interface GenerateCodeResult {
  code: string;
  language: SupportedLanguage;
  filePath: string;
  imports: string[];
}
```

#### 4.2.4 update_mapping

```typescript
/**
 * 기존 매핑 규칙을 부분 수정.
 * 사용자 수정, 연쇄 변경 등에 대응.
 */

const updateMappingInputSchema = {
  type: 'object',
  properties: {
    mappingId: { type: 'string' },                // 매핑 규칙 ID
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['add', 'modify', 'remove'] },
          field: { type: 'string' },
          before: {},
          after: {},
          reason: { type: 'string' },
        },
        required: ['type', 'field'],
      },
    },
    source: { type: 'string', enum: ['conversation', 'visual_editor', 'json_direct', 'code_sync', 'cascade', 'auto_regenerate'] },
  },
  required: ['mappingId', 'changes'],
} as const;

// Output
interface UpdateMappingResult {
  mappingRule: MappingRule;
  version: number;
  savedTo: string;
}
```

#### 4.2.5 execute_api_call

```typescript
// src/mcp/tools/index.ts (consolidated)

/**
 * 실제 외부 API를 호출하고 응답을 캡처.
 * 사용자 확인 후에만 실행.
 * checkAbnormalResponse()로 비정상 응답 감지 (200 OK이지만 에러 body, HTML 응답 등).
 * 429 및 5xx 응답 시 지수 백오프로 자동 재시도.
 *
 * 안전장치:
 * - Rate Limiting: 429 응답 시 Retry-After 헤더 준수
 * - Timeout: 설정 가능 (기본 30초)
 * - 재시도: 지수 백오프, 최대 config.api.maxRetries 회
 * - 사용자 승인: 실제 호출 전 Claude가 사용자에게 확인 (Skill 레벨에서)
 */

const executeApiCallInputSchema = {
  type: 'object',
  properties: {
    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], default: 'GET' },
    url: { type: 'string' },
    headers: { type: 'object' },
    body: {},
    auth: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['bearer', 'api_key', 'basic', 'oauth', 'custom'] },
        credentials: { type: 'string' },
      },
    },
    profileId: { type: 'string' },
    timeout: { type: 'number', default: 30000 },
    followRedirects: { type: 'boolean', default: true },
    captureFullResponse: { type: 'boolean', default: false },
  },
  required: ['url'],
} as const;

// Output
interface ExecuteResult {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  timing: {
    total: number;
  };
  rawResponse?: string;
  warnings: string[];                    // 비정상 응답 경고
}
```

#### 4.2.6 validate_mapping

```typescript
// src/mcp/tools/index.ts (consolidated)

/**
 * 매핑 결과를 검증하고 테스트를 생성.
 *
 * 모드 (optional, default: 'dry_run'):
 * - dry_run: 샘플 데이터로 변환 시뮬레이션 → DryRunResult
 * - generate_test: 프로젝트 프레임워크별 테스트 코드 생성
 * - generate_test_page: 인터랙티브 HTML 테스트 페이지 생성
 */

const validateMappingInputSchema = {
  type: 'object',
  properties: {
    mappingId: { type: 'string' },
    mode: {
      type: 'string',
      enum: ['dry_run', 'generate_test', 'generate_test_page'],
      default: 'dry_run',               // mode is optional, defaults to dry_run
    },
    sampleData: {},                      // top-level (not inside testConfig)
    testConfig: {
      type: 'object',
      properties: {
        framework: { type: 'string' },   // 자동 감지 가능
        outputPath: { type: 'string' },
      },
    },
  },
  required: ['mappingId'],               // mode is optional
} as const;

// Output
interface ValidateResult {
  result: DryRunResult | GeneratedTest | string;   // string = 테스트 페이지 경로
  summary: {
    status: 'pass' | 'warn' | 'fail';
    message: string;
    details: string[];
  };
}

interface DryRunResult {
  input: unknown;
  output: unknown;
  fieldResults: {
    field: string;
    sourceValue: unknown;
    transformedValue: unknown;
    expectedType: string;
    actualType: string;
    isValid: boolean;
    warning?: string;
  }[];
  summary: {
    totalFields: number;
    successFields: number;
    warningFields: number;
    failedFields: number;                // 'failedFields' (not 'errorFields')
  };
  appliedMappings: string[];             // 적용된 매핑 필드 목록
  skippedMappings: { field: string; reason: string }[];  // 스킵된 매핑 (사유 포함)
}

interface GeneratedTest {
  framework: string;
  code: string;
  filePath: string;
}
```

#### 4.2.7 manage_history

```typescript
// src/mcp/tools/index.ts (consolidated)

/**
 * 매핑 히스토리 조회, 롤백, 비교, 내보내기.
 *
 * 연쇄 수정 지원:
 * - relatedVersions 필드로 연쇄 수정 그룹 추적
 * - 롤백 시 연쇄 수정 전체를 롤백할지 개별 버전만 롤백할지 선택 가능
 */

const manageHistoryInputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['list', 'get_version', 'rollback', 'compare', 'export'] },
    mappingId: { type: 'string' },
    version: { type: 'number' },
    version1: { type: 'number' },         // compare 시 첫 번째 버전 (별도 파라미터)
    version2: { type: 'number' },         // compare 시 두 번째 버전 (별도 파라미터)
  },
  required: ['action', 'mappingId'],
} as const;

// Output
interface HistoryResult {
  history?: MappingHistory;
  version?: HistoryEntry;
  comparison?: VersionDiff;
  exported?: string;
  rolledBackTo?: number;
}

interface VersionDiff {
  version1: number;
  version2: number;
  changes: FieldChange[];
}
```

### 4.3 MCP Resource Specifications

```typescript
// src/mcp/resources/index.ts (consolidated resource definitions)

/**
 * MCP Resource는 Claude가 현재 프로젝트의 매핑 상태를 참조하기 위한 읽기 전용 인터페이스.
 * Tool과 달리 사이드이펙트가 없다.
 */

// Resource 1: api-convert://mappings
// 전체 매핑 규칙 목록 반환
interface MappingsResource {
  mappings: {
    id: string;
    name: string;
    source: { apiProfileId: string; endpoint: string };
    target: { typeName: string; language: SupportedLanguage };
    version: number;
    updatedAt: string;
    confidence: number;
    fieldCount: number;                  // 매핑된 필드 수
    ambiguousCount: number;              // 모호한 필드 수
  }[];
}

// Resource 2: api-convert://profiles
// 분석된 API 프로파일 목록
interface ProfilesResource {
  profiles: {
    id: string;
    name: string;
    version?: string;
    endpointCount: number;
    analyzedAt: string;
    confidence: number;
  }[];
}

// Resource 3: api-convert://targets
// 타겟 프로파일 목록
interface TargetsResource {
  targets: {
    id: string;
    name: string;
    language: SupportedLanguage;
    fieldCount: number;
    analyzedAt: string;
  }[];
}

// Resource 4: api-convert://mappings/{id}   (plural 'mappings')
// 특정 매핑 규칙 상세 (MappingRule 전체 반환)

// Resource 5: api-convert://profiles/{id}
// 특정 프로파일 상세 (ApiProfile 전체 반환)

// Resource 6: api-convert://targets/{id}
// 특정 타겟 프로파일 상세 (TargetProfile 전체 반환)

// Resource 7: api-convert://config
// 현재 플러그인 설정 반환

// Resource 8: api-convert://status
// 플러그인 전체 상태 요약 반환
interface StatusResource {
  profiles: number;                      // 등록된 프로파일 수
  targets: number;                       // 등록된 타겟 수
  mappings: number;                      // 등록된 매핑 수
  version: string;                       // 플러그인 버전
}
```

### 4.4 Core Engine Modules

#### 4.4.1 Analyzer Module

```typescript
// src/core/analyzer/

/**
 * API 소스를 분석하여 ApiProfile을 생성하는 모듈.
 * 다양한 입력 소스를 통일된 프로파일로 변환.
 */

class AnalyzerModule {
  constructor(
    private storage: StorageService,
    private config: ConfigService,
    private log: LogService,
  ) {}

  /**
   * 입력 소스를 분석하여 ApiProfile 생성
   */
  async analyze(source: SourceInput, options?: AnalyzeOptions): Promise<AnalyzeResult> {
    // 1. 입력 소스 정규화
    const normalized = await this.normalizeSource(source);

    // 2. 스키마 추출
    const schema = await this.extractSchema(normalized);

    // 3. 프로파일 생성
    const profile = this.buildProfile(schema, source);

    // 4. 저장
    const savedPath = await this.storage.saveProfile(profile);

    return { profile, confidence: profile.metadata.confidence, warnings: [], suggestions: [], savedTo: savedPath };
  }

  /**
   * 기존 프로파일과 새 소스의 diff 비교
   * 변경 감지 & 연쇄 업데이트의 시작점
   */
  async diffProfile(existingProfileId: string, newSource: SourceInput): Promise<ProfileDiff> {
    // ...
  }

  private async normalizeSource(source: SourceInput): Promise<NormalizedSource> {
    // 소스 타입별 파서 호출
  }

  private async extractSchema(normalized: NormalizedSource): Promise<ExtractedSchema> {
    // 필드, 타입, 중첩구조, 필수/선택 추출
  }

  private buildProfile(schema: ExtractedSchema, source: SourceInput): ApiProfile {
    // ApiProfile 객체 구성
  }
}

// --- Sub-modules ---

// src/core/analyzer/parsers/swagger-parser.ts
// OpenAPI/Swagger 스펙 파싱 (@apidevtools/swagger-parser 활용)

// src/core/analyzer/parsers/json-parser.ts
// JSON 샘플에서 스키마 추론

// src/core/analyzer/parsers/curl-parser.ts
// curl 명령어 파싱 + 실행 + 응답 분석

// src/core/analyzer/parsers/xml-parser.ts
// XML/SOAP 응답 파싱 → JSON 정규화

// src/core/analyzer/schema-detector.ts
// 추출된 데이터에서 타입, nullable, enum 등 추론
```

#### 4.4.2 Mapper Module

```typescript
// src/core/mapper/

/**
 * 소스 프로파일과 타겟 프로파일을 비교하여 매핑 규칙을 생성.
 * 필드 유사도, 타입 호환성, 구조적 위치를 기반으로 자동 매핑 도출.
 */

class MapperModule {
  constructor(
    private storage: StorageService,
    private config: ConfigService,
    private log: LogService,
  ) {}

  /**
   * 매핑 규칙 생성
   */
  async generateMapping(params: GenerateMappingParams): Promise<GenerateMappingResult> {
    // 1. 소스 프로파일 로드
    const sourceProfile = await this.storage.loadProfile(params.apiProfile);
    const endpoint = this.findEndpoint(sourceProfile, params.endpoint);

    // 2. 타겟 프로파일 결정
    const targetProfile = await this.resolveTarget(params.target);

    // 3. 필드 매핑 도출
    const fieldMappings = this.mapFields(
      endpoint.response.statusCodes[params.responseCode || 200],
      targetProfile.fields,
      params.options,
    );

    // 4. 매핑 규칙 조립
    const mappingRule = this.buildMappingRule(params, fieldMappings, sourceProfile, targetProfile);

    // 5. 저장
    const savedPath = await this.storage.saveMapping(mappingRule);

    // 6. 히스토리 초기 기록
    await this.storage.initHistory(mappingRule);

    return { mappingRule, preview: this.buildPreview(fieldMappings), savedTo: savedPath };
  }

  /**
   * 기존 매핑 규칙 업데이트 (부분 수정)
   * 사용자 수정, 연쇄 변경 등에 대응
   */
  async updateMapping(
    mappingId: string,
    changes: FieldChange[],
    source: ChangeSource,
  ): Promise<MappingRule> {
    // 1. 기존 매핑 로드
    // 2. 변경 적용
    // 3. 버전 증가
    // 4. 히스토리 기록
    // 5. 저장
    // ...
  }

  private mapFields(
    sourceSchema: ObjectSchema,
    targetFields: Record<string, TargetFieldSchema>,
    options?: MappingOptions,
  ): FieldMapping[] {
    // 각 타겟 필드에 대해:
    // 1. 소스에서 후보 필드 탐색 (이름 유사도 + 타입 호환성)
    // 2. 신뢰도 계산
    // 3. 변환 유형 결정
    // 4. 소스 미존재 필드 감지
    // ...
  }
}

// --- Sub-modules ---

// src/core/mapper/field-mapper.ts
// 필드명 유사도 비교 알고리즘 (편집 거리, 의미 유사도, 약어 확장 등)

// src/core/mapper/type-converter.ts
// 소스 타입 → 타겟 타입 변환 가능 여부 + 변환 코드 결정

// src/core/mapper/ambiguity-detector.ts
// 신뢰도 < threshold 인 매핑 식별 + 대안 후보 제시

// src/core/mapper/nested-handler.ts
// 중첩 객체, 배열 내 요소 매핑 처리

// src/core/mapper/conflict-resolver.ts
// N:1 매핑 시 충돌 감지 + 해소 전략 적용
```

**필드 유사도 계산 전략:**

```typescript
// src/core/mapper/field-matcher.ts

/**
 * 필드명 유사도를 다차원으로 계산하여 최적 매핑 후보를 결정.
 * 단일 기준이 아닌 복합 점수로 판단.
 */

interface MatchScore {
  nameScore: number;         // 0-1: 필드명 유사도
  typeScore: number;         // 0-1: 타입 호환성
  positionScore: number;     // 0-1: 구조적 위치 유사성
  patternScore: number;      // 0-1: 기존 매핑 패턴 일관성
  totalScore: number;        // 가중 평균
}

interface MatchContext {
  sourceIndex?: number;      // 소스 필드 인덱스
  sourceTotal?: number;      // 전체 소스 필드 수
  targetIndex?: number;      // 타겟 필드 인덱스
  targetTotal?: number;      // 전체 타겟 필드 수
  existingMappings?: Array<{ sourceField: string; targetField: string }>;
}

// positionScore: 소스/타겟의 상대적 위치 비교 (1.0 - |srcRelative - tgtRelative|)
// patternScore: 기존 매핑들의 이름 변환 패턴과 일관성 비교
// context 미제공 시 기본값 0.5

// 이름 유사도 비교 규칙:
// 1. 정확히 일치 → 1.0
// 2. 네이밍 컨벤션 변환 후 일치 (user_name ↔ userName) → 0.95
// 3. 약어 확장 후 일치 (nm ↔ name, addr ↔ address) → 0.85
// 4. 편집 거리 2 이내 (maxLen >= 4 가드: 짧은 필드명의 오탐 방지) → 0.7
// 5. 의미적 유사 (tel ↔ phone, amt ↔ amount) via SYNONYM_MAP → 0.6
// 6. 매핑 불가 → 0.0

// 약어 사전 (28 entries, 확장 가능):
const ABBREVIATION_MAP: Record<string, string[]> = {
  nm: ['name'],
  addr: ['address'],
  tel: ['telephone', 'phone'],
  amt: ['amount'],
  dt: ['date', 'datetime'],
  cd: ['code'],
  no: ['number'],
  qty: ['quantity'],
  desc: ['description'],
  idx: ['index'],
  img: ['image'],
  pwd: ['password'],
  msg: ['message'],
  btn: ['button'],
  cnt: ['count'],
  st: ['status', 'state'],
  prc: ['price'],
  ctg: ['category'],
  usr: ['user'],
  cust: ['customer'],
  prdt: ['product'],
  ordr: ['order'],
  pymt: ['payment'],
  rsp: ['response'],
  req: ['request'],
  reg: ['register', 'registration'],
  upd: ['update', 'updated'],
  crt: ['create', 'created'],
  del: ['delete', 'deleted'],
  // ... 프로젝트별 커스텀 추가 가능
};

// 의미 유사어 사전: 양방향 동의어 매핑
const SYNONYM_MAP: Record<string, string[]> = {
  phone: ['tel', 'telephone', 'mobile', 'contact'],
  address: ['addr', 'location'],
  name: ['nm', 'title', 'label'],
  amount: ['amt', 'price', 'total', 'sum'],
  date: ['dt', 'datetime', 'timestamp', 'time'],
  code: ['cd', 'id', 'key'],
  status: ['st', 'state', 'phase'],
  description: ['desc', 'detail', 'comment', 'note'],
  email: ['mail', 'email_addr'],
  created: ['crt', 'created_at', 'createdAt', 'reg_dt'],
  updated: ['upd', 'updated_at', 'updatedAt', 'mod_dt'],
  deleted: ['del', 'deleted_at', 'deletedAt', 'removed'],
  // ... 확장 가능
};
```

#### 4.4.3 Generator Module

```typescript
// src/core/generator/

/**
 * 매핑 규칙을 실행 가능한 코드로 변환.
 * 언어별 템플릿 패턴을 사용하되, 사용자 프로젝트의 기존 패턴을 우선.
 */

class GeneratorModule {
  private templates: Map<SupportedLanguage, CodeTemplate>;

  constructor(
    private storage: StorageService,     // storage 의존성 추가
    private config: ConfigService,
    private log: LogService,
  ) {
    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  /**
   * 매핑 규칙을 기반으로 코드 생성
   * generate_code 툴에서 호출되는 메인 메서드
   */
  async generateCode(params: GenerateCodeParams): Promise<GeneratedCode> {
    const mapping = await this.storage.loadMappingById(params.mappingId);
    const language = params.language || mapping.target.language;
    const template = this.templates.get(language);
    if (!template) throw new PluginError('UNSUPPORTED_LANGUAGE', language);

    // 1. 사용자 프로젝트 패턴 감지
    const pattern = params.pattern || await this.detectProjectPattern(language);

    // 2. 매핑 규칙을 코드 AST로 변환
    const codeModel = this.buildCodeModel(mapping, pattern, params.className);

    // 3. 템플릿으로 코드 텍스트 생성
    const code = template.render(codeModel);

    return {
      code,
      language,
      filePath: this.suggestFilePath(mapping, pattern),
      imports: this.collectImports(codeModel),
    };
  }

  /**
   * 프로젝트 내 기존 패턴 감지
   * 클래스 기반? 함수 기반? 네이밍 컨벤션?
   */
  async detectProjectPattern(language: SupportedLanguage): Promise<ProjectPattern> {
    // 프로젝트 내 기존 매퍼/변환 코드 분석
    // ...
  }
}

// --- Language Templates ---

// src/core/generator/templates/typescript.ts
// src/core/generator/templates/php.ts
// src/core/generator/templates/java.ts
// src/core/generator/templates/python.ts
// src/core/generator/templates/kotlin.ts
// src/core/generator/templates/go.ts

/**
 * 각 언어 템플릿은 CodeTemplate 인터페이스를 구현.
 * 단순 문자열 연결이 아닌, 코드 모델 기반으로 생성.
 */
interface CodeTemplate {
  language: SupportedLanguage;

  /**
   * 코드 모델을 해당 언어의 소스 코드로 렌더링
   */
  render(model: CodeModel): string;

  /**
   * 해당 언어의 import/use 구문 생성
   */
  renderImports(imports: ImportStatement[]): string;
}

// CodeModel is defined in templates/base.ts (merged with CodeTemplate)
interface CodeModel {
  className?: string;                    // 클래스명 (OOP 패턴)
  functionName: string;                  // 함수명
  sourceType: string;                    // 소스 타입명
  targetType: string;                    // 타겟 타입명
  fieldAssignments: FieldAssignment[];   // 필드 할당 목록
  helperFunctions: HelperFunction[];     // 필요한 헬퍼 함수
  pattern: 'class' | 'function' | 'builder';
}

interface FieldAssignment {
  targetPath: string;                    // 대상 필드 경로
  sourceExpression: string;              // 소스 값 추출 표현식
  transformation?: string;              // 변환 로직 (인라인)
  comment?: string;                      // 주석 (복잡한 변환 설명)
}
```

#### 4.4.4 Validator Module

```typescript
// src/core/validator/

/**
 * 매핑 결과를 검증하는 모듈.
 * Dry-run, 테스트 코드 생성, HTML 테스트 페이지 생성.
 */

class ValidatorModule {
  constructor(
    private storage: StorageService,
    private log: LogService,
  ) {}

  /**
   * Dry-run: 샘플 데이터로 변환 시뮬레이션
   */
  async dryRun(mappingRule: MappingRule, sampleData?: unknown): Promise<DryRunResult> {
    // 1. 샘플 데이터 결정 (제공됨 or 프로파일의 example 사용)
    const input = sampleData || this.generateSampleFromSchema(mappingRule);

    // 2. 각 FieldMapping을 순회하며 변환 시뮬레이션
    const fieldResults = mappingRule.fieldMappings.map(fm => {
      const sourceValue = this.extractValue(input, fm.sourceField);
      const transformedValue = this.simulateTransform(sourceValue, fm.transformation);
      return {
        field: fm.targetField,
        sourceValue,
        transformedValue,
        expectedType: this.getExpectedType(fm),
        actualType: typeof transformedValue,
        isValid: this.validateType(transformedValue, fm),
        warning: this.checkWarnings(sourceValue, transformedValue, fm),
      };
    });

    // 3. 결과 조립
    return {
      input,
      output: this.buildOutput(fieldResults),
      fieldResults,
      summary: this.summarize(fieldResults),
    };
  }

  /**
   * 테스트 코드 생성
   */
  async generateTest(mappingRule: MappingRule, config?: TestConfig): Promise<GeneratedTest> {
    // 1. 프레임워크 감지 (config.framework || auto-detect)
    // 2. 테스트 케이스 생성 (happy path + edge cases)
    // 3. 프레임워크별 테스트 코드 렌더링
    // ...
  }

  /**
   * HTML 테스트 페이지 생성
   */
  async generateTestPage(mappingRule: MappingRule): Promise<string> {
    // 정적 HTML + JS로 인터랙티브 테스트 페이지 생성
    // ...
  }
}
```

#### 4.4.5 History Module

```typescript
// src/core/history/

/**
 * 매핑 규칙의 변경 이력을 관리.
 * 연쇄 수정, 롤백, 버전 비교를 지원.
 */

class HistoryModule {
  constructor(
    private storage: StorageService,
    private log: LogService,
    private config?: ConfigService,       // config is optional
  ) {}

  /**
   * 변경 기록 추가
   */
  async recordChange(
    mappingId: string,
    changes: FieldChange[],
    source: ChangeSource,
    snapshot: MappingRule,
    relatedVersions?: number[],
  ): Promise<HistoryEntry> {
    const history = await this.storage.loadHistory(mappingId);
    const newVersion = (history.versions.length > 0)
      ? history.versions[history.versions.length - 1].version + 1
      : 1;

    const entry: HistoryEntry = {
      version: newVersion,
      timestamp: new Date().toISOString(),
      source,
      changes,
      relatedVersions,
      snapshot,
    };

    history.versions.push(entry);

    // maxHistoryVersions 제한 (config가 있을 때만 적용)
    const maxVersions = this.config?.get('storage.maxHistoryVersions') ?? 50;
    if (history.versions.length > maxVersions) {
      history.versions = history.versions.slice(-maxVersions);
    }

    await this.storage.saveHistory(history);
    return entry;
  }

  /**
   * 특정 버전으로 롤백
   */
  async rollback(mappingId: string, targetVersion: number): Promise<MappingRule> {
    const history = await this.storage.loadHistory(mappingId);
    const entry = history.versions.find(v => v.version === targetVersion);
    if (!entry) throw new PluginError('VERSION_NOT_FOUND', targetVersion);

    // 롤백도 하나의 변경으로 기록
    await this.recordChange(
      mappingId,
      [{ type: 'modify', field: '*', reason: `Rollback to v${targetVersion}` }],
      'conversation',
      entry.snapshot,
    );

    await this.storage.saveMapping(entry.snapshot);
    return entry.snapshot;
  }

  /**
   * 두 버전 간 차이 비교
   */
  async compare(mappingId: string, v1: number, v2: number): Promise<VersionDiff> {
    // ...
  }
}
```

#### 4.4.6 Executor Module

```typescript
// src/core/executor/

/**
 * 외부 API를 직접 호출하는 모듈.
 * 안전장치와 비정상 응답 대처 포함.
 */

class ExecutorModule {
  constructor(
    private storage: StorageService,     // storage 의존성 추가
    private config: ConfigService,
    private log: LogService,
  ) {}

  async execute(params: ExecuteParams): Promise<ExecuteResult> {
    const { method, url, headers, body, auth, options } = params;
    const timeout = options?.timeout || this.config.get('api.timeout');
    const maxRetries = this.config.get('api.maxRetries');

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // 지수 백오프
          const delay = this.config.get('api.retryDelay') * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }

        const startTime = Date.now();
        const response = await this.httpRequest(method, url, {
          headers: this.buildHeaders(headers, auth),
          body,
          timeout,
          followRedirects: options?.followRedirects ?? true,
        });
        const elapsed = Date.now() - startTime;

        // 비정상 응답 검사
        const warnings = this.checkAbnormalResponse(response);

        return {
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: await this.parseBody(response),
          timing: { total: elapsed },
          warnings,
        };
      } catch (error) {
        lastError = error as Error;

        // 429 Rate Limit → Retry-After 준수
        if (this.isRateLimited(error)) {
          const retryAfter = this.getRetryAfter(error);
          await this.sleep(retryAfter);
          continue;
        }

        // 5xx 서버 오류 → 지수 백오프로 재시도
        if (this.isServerError(error)) continue;

        // 재시도 가능한 오류인지 확인
        if (!this.isRetryable(error)) break;
      }
    }

    throw new PluginError('API_CALL_FAILED', lastError?.message);
  }

  /**
   * 비정상 응답 검사: 200 OK이지만 에러 body, HTML 응답, 빈 body 등 감지
   */
  checkAbnormalResponse(response: Response): string[] {
    const warnings: string[] = [];
    const contentType = response.headers.get('content-type') || '';

    // 200 OK인데 에러 body
    if (response.status === 200 && this.looksLikeErrorBody(response)) {
      warnings.push('200 OK 응답이지만 에러 형태의 body가 감지됨');
    }

    // HTML 응답 (로그인 리다이렉트 등)
    if (contentType.includes('text/html')) {
      warnings.push('JSON이 아닌 HTML 응답입니다. 인증 만료일 수 있습니다');
    }

    // 빈 body
    if (!response.body || response.headers.get('content-length') === '0') {
      warnings.push('응답 body가 비어 있습니다');
    }

    return warnings;
  }
}
```

### 4.5 Shared Services

#### 4.5.1 Storage Service

```typescript
// src/core/services/storage.ts

/**
 * 파일 시스템 I/O를 추상화하는 서비스.
 * 모든 파일 읽기/쓰기는 이 서비스를 통해 수행.
 */

class StorageService {
  private baseDir: string;               // .api-convert/

  constructor(private config: ConfigService) {
    this.baseDir = config.get('storage.baseDir') || '.api-convert';
  }

  /**
   * 초기 디렉토리 구조 보장
   */
  async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      this.baseDir,
      `${this.baseDir}/profiles`,
      `${this.baseDir}/targets`,
      `${this.baseDir}/mappings`,
      `${this.baseDir}/history`,
      `${this.baseDir}/editors`,
      `${this.baseDir}/logs`,
    ];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // config.json 없으면 기본값 생성
    const configPath = `${this.baseDir}/config.json`;
    if (!await this.exists(configPath)) {
      await this.writeJson(configPath, DEFAULT_CONFIG);
    }
  }

  // Profile CRUD
  async saveProfile(profile: ApiProfile): Promise<string> {
    const path = `${this.baseDir}/profiles/${profile.id}.profile.json`;
    await this.writeJson(path, profile);
    return path;
  }

  async loadProfile(id: string): Promise<ApiProfile> {
    return this.readJson(`${this.baseDir}/profiles/${id}.profile.json`);
  }

  async listProfiles(): Promise<ApiProfile[]> {
    return this.listJsonFiles(`${this.baseDir}/profiles`, '*.profile.json');
  }

  // Target CRUD
  async saveTarget(target: TargetProfile): Promise<string> { /* ... */ }
  async loadTarget(id: string): Promise<TargetProfile> { /* ... */ }
  async listTargets(): Promise<TargetProfile[]> { /* ... */ }

  // Mapping CRUD
  async saveMapping(mapping: MappingRule): Promise<string> {
    const dir = `${this.baseDir}/mappings/${mapping.source.apiProfileId}`;
    await fs.mkdir(dir, { recursive: true });
    const path = `${dir}/${mapping.target.typeName.toLowerCase()}.mapping.json`;
    await this.writeJson(path, mapping);
    return path;
  }

  async loadMapping(apiProfileId: string, targetName: string): Promise<MappingRule> { /* ... */ }
  async loadMappingById(id: string): Promise<MappingRule> { /* ... */ }
  async listMappings(): Promise<MappingRule[]> { /* ... */ }

  // History CRUD
  async saveHistory(history: MappingHistory): Promise<void> { /* ... */ }
  async loadHistory(mappingId: string): Promise<MappingHistory> { /* ... */ }
  async initHistory(mapping: MappingRule): Promise<void> { /* ... */ }

  // 공통 유틸리티
  private async readJson<T>(path: string): Promise<T> { /* ... */ }
  private async writeJson(path: string, data: unknown): Promise<void> { /* ... */ }
  private async exists(path: string): Promise<boolean> { /* ... */ }
  private async listJsonFiles<T>(dir: string, pattern: string): Promise<T[]> { /* ... */ }
}
```

#### 4.5.2 Config Service

```typescript
// src/core/services/config.ts

/**
 * 플러그인 설정 관리.
 * .api-convert/config.json을 읽고 기본값과 병합.
 */

class ConfigService {
  private config: PluginConfig;

  async load(baseDir: string): Promise<void> {
    const userConfig = await this.readConfigFile(baseDir);
    this.config = this.mergeWithDefaults(userConfig);
  }

  get<K extends keyof FlatConfig>(key: K): FlatConfig[K] {
    // dot notation 지원: config.get('api.timeout')
    return this.resolvePath(this.config, key);
  }
}

const DEFAULT_CONFIG: PluginConfig = {
  version: '1.0',
  defaultLanguage: 'typescript',
  naming: {
    convention: 'camelCase',
    detectFromProject: true,
  },
  api: {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },
  mapping: {
    confidenceThreshold: 0.9,
    strictMode: false,
  },
  storage: {
    baseDir: '.api-convert',
    maxHistoryVersions: 50,
  },
  logging: {
    level: 'info',
    toFile: true,
  },
};
```

#### 4.5.3 Reference Scanner

```typescript
// src/reference/

/**
 * 사용자 프로젝트의 코드베이스를 스캔하여
 * DTO/Model, 기존 매퍼 코드, 프로젝트 패턴을 감지.
 */

class ReferenceScanner {
  constructor(
    private config: ConfigService,
    private log: LogService,
  ) {}

  /**
   * 프로젝트에서 DTO/Model 파일 자동 감지.
   * 실제 파일 시스템 스캔을 수행하며, dto-detector.ts의
   * detectDtoFromSource() 함수를 사용하여 소스 코드에서 DTO를 감지.
   */
  async scanForDtos(language: SupportedLanguage): Promise<DetectedDto[]> {
    const patterns = this.getDtoPatterns(language);
    // 1. 파일명 패턴 + directoryPatterns으로 후보 파일 탐색
    // 2. 파일을 읽고 detectDtoFromSource()로 DTO/Model 확인
    // 3. 필드 추출 → TargetProfile로 변환 가능
    // ...
  }

  /**
   * 기존 매퍼/변환 코드 감지
   */
  async scanForMappers(language: SupportedLanguage): Promise<DetectedMapper[]> {
    // ...
  }

  /**
   * 프로젝트 코딩 패턴 감지 (네이밍, 구조, 스타일)
   */
  async detectProjectPattern(language: SupportedLanguage): Promise<ProjectPattern> {
    // ...
  }

  /**
   * 사용자의 사용 목적 추론 (기존 코드 분석 기반).
   * pattern-analyzer.ts를 사용하여 프로젝트를 분석:
   * - fetch 호출 패턴 감지
   * - route handler 패턴 감지
   * - mapper 함수 패턴 감지
   */
  async inferPurpose(): Promise<InferredPurpose> {
    // API 호출 패턴, 매핑 코드 위치, 결과 사용처 분석
    // ...
  }

  /**
   * DtoPatterns has three fields:
   * - filePatterns: glob patterns for matching DTO file names
   * - codePatterns: regex patterns for detecting DTO declarations in source code
   * - directoryPatterns: glob patterns for common DTO directories
   */
  private getDtoPatterns(language: SupportedLanguage): DtoPatterns {
    const patterns: Record<SupportedLanguage, DtoPatterns> = {
      typescript: {
        filePatterns: ['**/*Dto.ts', '**/*Model.ts', '**/*Response.ts', '**/*Entity.ts'],
        codePatterns: [/interface\s+\w+Dto/, /type\s+\w+Response/, /class\s+\w+Model/],
        directoryPatterns: ['**/dto/', '**/models/', '**/entities/', '**/types/'],
      },
      php: {
        filePatterns: ['**/*Dto.php', '**/*Model.php', '**/*Entity.php'],
        codePatterns: [/class\s+\w+Dto/, /class\s+\w+Model/],
        directoryPatterns: ['**/Dto/', '**/Models/', '**/Entity/'],
      },
      java: {
        filePatterns: ['**/*Dto.java', '**/*Response.java', '**/*Entity.java'],
        codePatterns: [/class\s+\w+Dto/, /record\s+\w+Response/],
        directoryPatterns: ['**/dto/', '**/model/', '**/entity/'],
      },
      kotlin: {
        filePatterns: ['**/*Dto.kt', '**/*Response.kt'],
        codePatterns: [/data\s+class\s+\w+Dto/],
        directoryPatterns: ['**/dto/', '**/model/'],
      },
      python: {
        filePatterns: ['**/*_dto.py', '**/*_model.py', '**/schemas.py'],
        codePatterns: [/@dataclass/, /class\s+\w+\(BaseModel\)/],
        directoryPatterns: ['**/models/', '**/schemas/'],
      },
      go: {
        filePatterns: ['**/*_dto.go', '**/*_model.go'],
        codePatterns: [/type\s+\w+\s+struct/],
        directoryPatterns: ['**/models/', '**/dto/'],
      },
    };
    return patterns[language];
  }
}
```

#### 4.5.4 Log Service

```typescript
// src/core/services/log.ts

/**
 * 구조화된 로깅 서비스.
 * JSON 형식으로 .api-convert/logs/ 에 저장.
 */

class LogService {
  constructor(
    private storage: StorageService,
    private config: ConfigService,
  ) {}

  async log(level: LogLevel, module: string, message: string, data?: unknown): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data: this.sanitize(data),         // 인증 정보 마스킹
    };

    // 콘솔 출력 (디버그용)
    if (this.config.get('logging.level') === 'debug') {
      console.error(`[${level}] ${module}: ${message}`);
    }

    // 파일 저장
    if (this.config.get('logging.toFile')) {
      await this.appendToFile(entry);
    }
  }

  /**
   * 민감 정보 마스킹
   */
  private sanitize(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const sensitiveKeys = ['credentials', 'token', 'apiKey', 'password', 'secret', 'authorization'];
    // ... 재귀적으로 마스킹
  }
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}
```

---

## 5. Skill Workflow Design

### 5.1 /api-convert (메인 워크플로우)

```markdown
# /api-convert Skill

사용자에게 전체 API 변환 프로세스를 단계별로 가이드하는 대화형 워크플로우.
각 단계에서 적절한 MCP Tool을 호출하고 결과를 사용자에게 보여준다.

## Step 0: 사용 목적 파악
- ReferenceScanner.inferPurpose() 호출로 기존 코드 분석
- 추론 가능하면 확인 질문, 불가능하면 선택지 제시
  - 직접 소비 / API 허브 / 데이터 통합 / 마이그레이션 / 기타
- 목적에 따라 후속 Step 분기:
  - 직접 소비 → 표준 플로우 (Step 1-6)
  - API 허브 → Step 4에서 1:N 매핑 안내
  - 데이터 통합 → Step 1에서 복수 API 수집 안내
  - 마이그레이션 → Step 1에서 기존 매퍼 코드 분석 추가

## Step 1: API 정보 수집
- 사용자에게 입력 소스 유형 안내
- 제공된 자료로 analyze_api 호출
- 결과 프로파일을 요약 형태로 표시

## Step 2: 분석 결과 확인
- 추출된 엔드포인트, 필드, 타입 표시
- 누락/오류 확인
- 주의사항(notes) 안내

## Step 3: 매핑 대상 지정
- ReferenceScanner.scanForDtos() 결과 표시
- 사용자가 기존 DTO 선택 또는 새로 정의

## Step 4: 매핑 결과 확인
- generate_mapping 호출
- 확정/모호/미매핑 필드를 구분하여 표시
- 사용자 수정 반영

## Step 5: 코드 생성
- Generator로 코드 생성
- Dry-run 결과 표시
- 테스트 생성 여부 확인

## Step 6: 프로젝트 적용
- 생성된 코드를 파일로 저장
- 히스토리 초기 기록
```

### 5.2 /api-map (매핑 워크플로우)

```markdown
# /api-map Skill (api-map.md)

전체 매핑 워크플로우를 가이드하는 Skill.
프로파일 선택부터 매핑 생성, 코드 생성, 검증까지 포함.

## 플로우
1. api-convert://profiles 리소스로 기존 프로파일 목록 로드
2. 사용자가 프로파일 + 엔드포인트 선택
3. 타겟 DTO 선택/생성
4. generate_mapping 호출 → 매핑 규칙 생성
5. 매핑 결과 확인 및 수정
6. generate_code 호출 → 코드 생성
7. validate_mapping 호출 → 검증
```

### 5.3 /api-test (테스트 워크플로우)

```markdown
# /api-test Skill (api-test.md)

기존 매핑의 테스트/검증 워크플로우.

## 플로우
1. api-convert://mappings 리소스로 매핑 목록 로드
2. 사용자가 매핑 선택
3. 테스트 유형 선택 (dry_run / generate_test / generate_test_page)
4. validate_mapping 호출 → 결과 표시
5. 필요 시 execute_api_call로 실제 API 호출 → 응답 검증
```

### 5.4 /api-analyze (분석 워크플로우)

```markdown
# /api-analyze Skill (api-analyze.md)

API 소스를 분석하여 프로파일을 생성하는 워크플로우.
analyze_api 툴의 사용을 가이드.
```

### 5.5 /api-mapping-edit (매핑 편집 워크플로우)

```markdown
# /api-mapping-edit Skill (api-mapping-edit.md)

기존 매핑 규칙을 편집하는 워크플로우.
update_mapping 툴과 비주얼 에디터 사용을 가이드.
```

---

## 6. Visual Editor Design

### 6.1 Architecture

```
정적 HTML + Vanilla JS (또는 경량 라이브러리)
서버 불필요, 오프라인 동작

┌────────────────────────────────────────────────────────┐
│  editor.html                                            │
│                                                         │
│  <script id="mapping-data" type="application/json">    │
│    { ... 현재 매핑 규칙 JSON 임베드 ... }               │
│  </script>                                              │
│                                                         │
│  ┌─ Source Panel ─┐  ┌─ Connection Lines ─┐  ┌─ Target Panel ─┐  │
│  │ 소스 필드 트리   │  │ SVG 연결선 렌더링  │  │ 타겟 필드 트리   │  │
│  └────────────────┘  └────────────────────┘  └─────────────────┘  │
│                                                         │
│  ┌─ Dry-run Preview ──────────────────────────────────┐ │
│  │ 입력 JSON → 변환 결과 JSON 실시간 미리보기          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Export ───────────────────────────────────────────┐ │
│  │ [내보내기] → modifications JSON 파일 저장/다운로드  │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow

```
플러그인 → 에디터 HTML 생성 (매핑 데이터 임베드)
    ↓
사용자가 브라우저에서 열기
    ↓
수정 작업 (드래그&드롭, 연결선 수정, 변환 규칙 편집)
    ↓
[내보내기] → modifications JSON 파일 저장
    ↓
사용자가 대화에서 "수정 파일 적용해줘" 또는 직접 .mapping.json에 반영
    ↓
플러그인이 modifications 파일 읽기 → 매핑 규칙에 적용 → 히스토리 기록
```

### 6.3 Export Format

```typescript
interface EditorExport {
  mappingId: string;                     // 매핑 ID
  mappingVersion?: number;               // 매핑 버전
  modifications: EditorModification[];
  exportedAt: string;                    // ISO 8601
  editorVersion: string;                 // 에디터 버전
}

interface EditorModification {
  targetField: string;
  action: 'add' | 'modify' | 'remove';
  before?: {
    sourceField: string | string[] | null;
    transformation: string;
  };
  after?: {
    sourceField: string | string[] | null;
    transformation: string;
    config?: Record<string, unknown>;
  };
}

// editor-generator.ts: 비주얼 에디터 HTML 파일 생성기
// 매핑 데이터를 HTML에 임베드하여 정적 에디터 파일을 생성
// generateEditorHtml(mapping: MappingRule): string
```

---

## 7. Error Handling

### 7.1 Error Code Definition

```typescript
// src/core/errors.ts

class PluginError extends Error {
  constructor(
    public readonly code: ErrorCode,       // readonly modifier
    public readonly detail?: string,       // readonly modifier
    public readonly context?: unknown,     // readonly modifier
  ) {
    // conditional colon: detail이 있을 때만 ': detail' 추가
    super(`[${code}] ${ERROR_MESSAGES[code]}${detail ? `: ${detail}` : ''}`);
    this.name = 'PluginError';
  }
}

type ErrorCode =
  // 분석 오류 (1xx)
  | 'PARSE_FAILED'           // 입력 소스 파싱 실패
  | 'UNSUPPORTED_FORMAT'     // 지원하지 않는 입력 형식
  | 'SCHEMA_EXTRACTION_FAILED' // 스키마 추출 실패
  | 'PROFILE_NOT_FOUND'      // 프로파일 없음
  // 매핑 오류 (2xx)
  | 'MAPPING_NOT_FOUND'      // 매핑 규칙 없음
  | 'TARGET_NOT_FOUND'       // 타겟 프로파일 없음
  | 'ENDPOINT_NOT_FOUND'     // 엔드포인트 없음
  | 'CONFLICT_UNRESOLVED'    // N:1 충돌 미해소
  // 생성 오류 (3xx)
  | 'UNSUPPORTED_LANGUAGE'   // 지원하지 않는 언어
  | 'CODE_GENERATION_FAILED' // 코드 생성 실패
  | 'GENERATION_FAILED'      // 일반 생성 실패
  | 'TEMPLATE_ERROR'         // 템플릿 렌더링 오류
  // 실행 오류 (4xx)
  | 'API_CALL_FAILED'        // API 호출 실패
  | 'AUTH_REQUIRED'          // 인증 필요
  | 'RATE_LIMITED'           // Rate Limit 초과
  | 'TIMEOUT'                // 타임아웃
  | 'INVALID_INPUT'          // 잘못된 입력값
  // 검증 오류 (5xx)
  | 'DRY_RUN_FAILED'         // Dry-run 실패
  | 'TYPE_MISMATCH'          // 타입 불일치
  | 'VALIDATION_FAILED'      // 검증 실패
  // 히스토리 오류 (6xx)
  | 'VERSION_NOT_FOUND'      // 버전 없음
  | 'ROLLBACK_FAILED'        // 롤백 실패
  // 스토리지 오류 (7xx)
  | 'FILE_READ_ERROR'        // 파일 읽기 실패
  | 'FILE_WRITE_ERROR'       // 파일 쓰기 실패
  | 'CONFIG_INVALID'         // 설정 파일 오류
  // 리소스 오류
  | 'RESOURCE_NOT_FOUND'     // 리소스 없음
  // 일반 오류
  | 'UNKNOWN_ERROR';

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  PARSE_FAILED: '입력 소스 파싱에 실패했습니다',
  UNSUPPORTED_FORMAT: '지원하지 않는 형식입니다',
  SCHEMA_EXTRACTION_FAILED: '스키마 추출에 실패했습니다',
  PROFILE_NOT_FOUND: 'API 프로파일을 찾을 수 없습니다',
  MAPPING_NOT_FOUND: '매핑 규칙을 찾을 수 없습니다',
  TARGET_NOT_FOUND: '타겟 프로파일을 찾을 수 없습니다',
  ENDPOINT_NOT_FOUND: '엔드포인트를 찾을 수 없습니다',
  CONFLICT_UNRESOLVED: 'N:1 매핑 충돌이 해소되지 않았습니다',
  UNSUPPORTED_LANGUAGE: '지원하지 않는 프로그래밍 언어입니다',
  CODE_GENERATION_FAILED: '코드 생성에 실패했습니다',
  GENERATION_FAILED: '생성에 실패했습니다',
  TEMPLATE_ERROR: '템플릿 렌더링 중 오류가 발생했습니다',
  API_CALL_FAILED: 'API 호출에 실패했습니다',
  AUTH_REQUIRED: '인증이 필요합니다',
  RATE_LIMITED: 'API 호출 제한에 도달했습니다',
  TIMEOUT: '요청 시간이 초과되었습니다',
  INVALID_INPUT: '잘못된 입력값입니다',
  DRY_RUN_FAILED: 'Dry-run 시뮬레이션에 실패했습니다',
  TYPE_MISMATCH: '타입이 일치하지 않습니다',
  VALIDATION_FAILED: '검증에 실패했습니다',
  VERSION_NOT_FOUND: '해당 버전을 찾을 수 없습니다',
  ROLLBACK_FAILED: '롤백에 실패했습니다',
  FILE_READ_ERROR: '파일 읽기에 실패했습니다',
  FILE_WRITE_ERROR: '파일 쓰기에 실패했습니다',
  CONFIG_INVALID: '설정 파일이 올바르지 않습니다',
  RESOURCE_NOT_FOUND: '리소스를 찾을 수 없습니다',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다',
};
```

### 7.2 Error Handling Strategy

```
에러 발생
    │
    ├─ PluginError (예상된 오류)
    │   → 사용자 친화적 메시지 + 에러 코드
    │   → 로그 기록
    │   → 가능한 해결 방법 제안 (suggestions)
    │
    ├─ 부분 실패 (Partial Failure)
    │   → 성공한 부분까지 결과 반환
    │   → 실패한 부분 목록 + 이유
    │   → 예: "100개 필드 중 97개 매핑 성공, 3개 실패"
    │
    └─ 예상치 못한 오류 (Unexpected)
        → 전체 스택트레이스를 로그에 기록
        → 사용자에게는 간략한 메시지 + 로그 파일 경로 안내
```

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool |
|------|--------|------|
| Unit Test | Core 모듈 로직 (Analyzer, Mapper, Generator, Validator) | Vitest |
| Unit Test | 유틸리티 (필드 유사도, 타입 변환, 약어 확장) | Vitest |
| Integration Test | MCP Tool 호출 → Core 모듈 → 파일 저장 | Vitest |
| Integration Test | Storage Service 파일 I/O | Vitest |
| E2E Test | Skill 워크플로우 시뮬레이션 | 수동 (Claude Code에서 실행) |

### 8.2 Test Cases (Key)

**Analyzer:**
- [ ] JSON 샘플에서 스키마 정확히 추출 (중첩, 배열, nullable 포함)
- [ ] Swagger/OpenAPI 스펙 파싱 → 엔드포인트별 스키마 추출
- [ ] curl 명령어 파싱 → 요청 구조 추출
- [ ] XML 응답 → JSON 정규화
- [ ] 대용량 스키마 (1000+ 필드) 처리

**Mapper:**
- [ ] 정확히 일치하는 필드명 → 신뢰도 1.0 자동 매핑
- [ ] 네이밍 컨벤션 차이 (snake_case ↔ camelCase) 자동 인식
- [ ] 약어 확장 (nm → name, addr → address) 인식
- [ ] 타입 변환 필요 감지 (string → number, string → Date)
- [ ] 소스에 없는 타겟 필수 필드 감지
- [ ] 모호한 매핑 (50-89% 신뢰도) 올바르게 플래그
- [ ] N:1 매핑 충돌 감지

**Generator:**
- [ ] TypeScript 매핑 코드 생성 (함수형, 클래스형)
- [ ] PHP 매핑 코드 생성
- [ ] 복잡한 변환 (restructure, conditional) 코드 정확성
- [ ] 사용자 프로젝트 패턴 감지 및 적용

**Validator:**
- [ ] Dry-run: 올바른 변환 결과 확인
- [ ] Dry-run: 타입 불일치 경고
- [ ] 테스트 코드 생성 (Jest, PHPUnit)

**History:**
- [ ] 변경 기록 정확성
- [ ] 롤백 후 매핑 규칙 복원
- [ ] 연쇄 수정 relatedVersions 추적
- [ ] maxHistoryVersions 제한 동작

---

## 9. Security Considerations

- [x] 인증 정보 비저장: API 키, 토큰은 매핑 파일에 저장하지 않음 (메모리에서만 사용)
- [x] 사용자 동의: .env 접근 시 사용자 확인 필수
- [x] 민감정보 마스킹: LogService.sanitize()로 로그에 인증 정보 노출 방지
- [x] 사용자 제어권: 모든 외부 API 호출은 Skill 레벨에서 사용자 확인 후 실행
- [x] 입력 검증: MCP Tool inputSchema로 입력값 검증
- [x] 파일 시스템 접근: .api-convert/ 디렉토리 내에서만 파일 생성/수정

---

## 10. Implementation Guide

### 10.1 File Structure

```
api-convert-plugin/
├── src/
│   ├── mcp/
│   │   ├── server.ts                    # MCP 서버 엔트리포인트 (createServer, startServer)
│   │   ├── tools/
│   │   │   └── index.ts                # 7개 Tool 통합 정의 (analyze_api, generate_mapping,
│   │   │                                #   generate_code, update_mapping, execute_api_call,
│   │   │                                #   validate_mapping, manage_history)
│   │   └── resources/
│   │       └── index.ts                # 6개 Resource 통합 정의 (mappings, profiles, targets,
│   │                                    #   mappings/{id}, profiles/{id}, targets/{id},
│   │                                    #   config, status)
│   │
│   ├── skill/
│   │   ├── api-convert.md               # /api-convert 전체 워크플로우
│   │   ├── api-map.md                   # /api-map 매핑 워크플로우
│   │   ├── api-test.md                  # /api-test 테스트 워크플로우
│   │   ├── api-analyze.md               # /api-analyze 분석 워크플로우
│   │   └── api-mapping-edit.md          # /api-mapping-edit 매핑 편집 워크플로우
│   │
│   ├── core/
│   │   ├── types/
│   │   │   ├── profile.ts              # ApiProfile, ApiEndpoint, FieldSchema, ObjectSchema, AuthConfig
│   │   │   ├── target.ts               # TargetProfile, TargetFieldSchema, SupportedLanguage
│   │   │   ├── mapping.ts              # MappingRule, FieldMapping, TransformationType
│   │   │   ├── history.ts              # MappingHistory, HistoryEntry, ChangeSource
│   │   │   ├── conflict.ts             # ConflictResolution, ConflictStrategy
│   │   │   ├── config.ts               # PluginConfig
│   │   │   └── index.ts                # re-export
│   │   │
│   │   ├── analyzer/
│   │   │   ├── index.ts                # AnalyzerModule
│   │   │   ├── parsers/
│   │   │   │   ├── swagger-parser.ts
│   │   │   │   ├── json-parser.ts
│   │   │   │   ├── curl-parser.ts
│   │   │   │   └── xml-parser.ts
│   │   │   └── schema-detector.ts
│   │   │
│   │   ├── mapper/
│   │   │   ├── index.ts                # MapperModule
│   │   │   ├── field-matcher.ts        # 필드 유사도 계산
│   │   │   ├── type-converter.ts
│   │   │   ├── ambiguity-detector.ts
│   │   │   ├── nested-handler.ts
│   │   │   ├── array-handler.ts
│   │   │   └── conflict-resolver.ts
│   │   │
│   │   ├── generator/
│   │   │   ├── index.ts                # GeneratorModule
│   │   │   └── templates/
│   │   │       ├── base.ts             # CodeTemplate 인터페이스 + CodeModel (merged)
│   │   │       ├── typescript.ts
│   │   │       ├── php.ts
│   │   │       ├── java.ts
│   │   │       ├── python.ts
│   │   │       ├── kotlin.ts
│   │   │       └── go.ts
│   │   │
│   │   ├── validator/
│   │   │   ├── index.ts                # ValidatorModule (dry-run logic merged here)
│   │   │   ├── test-generator.ts
│   │   │   ├── editor-generator.ts     # 비주얼 에디터 HTML 생성기
│   │   │   └── test-page-generator.ts  # HTML 테스트 페이지 생성기
│   │   │
│   │   ├── executor/
│   │   │   ├── index.ts                # ExecutorModule
│   │   │   └── auth-handler.ts
│   │   │
│   │   ├── history/
│   │   │   └── index.ts                # HistoryModule
│   │   │
│   │   ├── services/
│   │   │   ├── storage.ts              # StorageService
│   │   │   ├── config.ts               # ConfigService
│   │   │   └── log.ts                  # LogService
│   │   │
│   │   └── errors.ts                   # PluginError, ErrorCode
│   │
│   ├── reference/
│   │   ├── index.ts                    # ReferenceScanner
│   │   ├── dto-detector.ts             # detectDtoFromSource(): 소스 코드에서 DTO 감지
│   │   └── pattern-analyzer.ts         # 프로젝트 패턴 분석 (fetch, route, mapper)
│   │
│   └── index.ts                        # main entry
│
├── templates/
│   ├── test-page.html                  # HTML 테스트 페이지 템플릿
│   └── editor.html                     # 비주얼 매핑 에디터 템플릿
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 10.2 Implementation Order

MVP (v0.1) 기준, 의존성 순서로 구현:

```
Phase 1: Foundation (기반)
─────────────────────────
1. [ ] 프로젝트 스캐폴딩 (package.json, tsconfig, vitest)
2. [ ] Core Types 정의 (src/core/types/)
3. [ ] PluginError 정의 (src/core/errors.ts)
4. [ ] ConfigService 구현 (기본값 + 파일 로드)
5. [ ] StorageService 구현 (파일 I/O + 디렉토리 관리)
6. [ ] LogService 구현 (구조화 로깅 + 민감정보 마스킹)

Phase 2: Analysis Engine (분석 엔진)
────────────────────────────────────
7. [ ] JSON Parser (json-parser.ts) — JSON 샘플에서 스키마 추론
8. [ ] Schema Detector (schema-detector.ts) — 타입, nullable, enum 추론
9. [ ] Swagger Parser (swagger-parser.ts) — OpenAPI 파싱
10. [ ] AnalyzerModule 조립 (parsers + detector → ApiProfile)
11. [ ] analyze_api MCP Tool 등록 (tools/index.ts)

Phase 3: Mapping Engine (매핑 엔진)
───────────────────────────────────
12. [ ] Field Matcher (field-matcher.ts) — 필드 유사도 계산
13. [ ] Type Converter (type-converter.ts) — 타입 호환성 검사
14. [ ] Ambiguity Detector (ambiguity-detector.ts) — 모호성 감지
15. [ ] MapperModule 조립 → MappingRule 생성
16. [ ] generate_mapping, update_mapping MCP Tool 등록

Phase 4: Code Generation (코드 생성)
────────────────────────────────────
17. [ ] CodeModel 빌더 (code-model.ts)
18. [ ] TypeScript 템플릿 (templates/typescript.ts) — MVP 최우선
19. [ ] GeneratorModule 조립

Phase 5: Server & Resources (서버 통합)
───────────────────────────────────────
20. [ ] MCP Server 엔트리포인트 (server.ts — createServer/startServer)
21. [ ] MCP Resource 등록 (6개 URI, resources/index.ts)
22. [ ] generate_code MCP Tool 등록
23. [ ] 서버 통합 테스트

Phase 6: Validation (검증)
──────────────────────────
24. [ ] Dry-run 시뮬레이션 (validator/index.ts에 통합)
25. [ ] validate_mapping MCP Tool 등록
26. [ ] Ambiguity 감지 사용자 확인 플로우

Phase 7: Skill (워크플로우)
──────────────────────────
27. [ ] /api-convert Skill 작성
28. [ ] /api-map Skill 작성
29. [ ] /api-test Skill 작성
30. [ ] /api-analyze Skill 작성
31. [ ] /api-mapping-edit Skill 작성
```

### 10.3 Dependencies (package.json)

```json
{
  "name": "api-convert-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "api-convert-plugin": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@apidevtools/swagger-parser": "^10.1.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**의존성 최소화 원칙:**
- `@modelcontextprotocol/sdk`: MCP 서버 구현 (필수)
- `@apidevtools/swagger-parser`: OpenAPI 파싱 (필수)
- HTTP 클라이언트: Node.js 내장 `fetch` 또는 `undici` 사용 (별도 설치 불필요)
- XML 파싱: v0.2에서 추가 시 `fast-xml-parser` 검토
- 코드 AST: 필요 시 `ts-morph` (선택적)

---

## 11. Naming Conventions

| Target | Rule | Example |
|--------|------|---------|
| 파일명 (모듈) | kebab-case.ts | `field-matcher.ts`, `swagger-parser.ts` |
| 파일명 (타입) | kebab-case.ts | `profile.ts`, `mapping.ts` |
| 클래스 | PascalCase | `AnalyzerModule`, `StorageService` |
| 인터페이스 | PascalCase | `ApiProfile`, `FieldMapping` |
| 타입 별칭 | PascalCase | `TransformationType`, `ErrorCode` |
| 함수 | camelCase | `mapFields()`, `extractSchema()` |
| 상수 | UPPER_SNAKE_CASE | `DEFAULT_CONFIG`, `ERROR_MESSAGES` |
| MCP Tool 이름 | snake_case | `analyze_api`, `generate_mapping` |
| MCP Resource URI | kebab-case | `api-convert://mappings` |
| 저장 파일 ID | kebab-case | `payment-api.profile.json` |
| 디렉토리 | kebab-case | `core/`, `analyzer/`, `templates/` |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-06 | Initial design draft | Claude |
| 0.2 | 2026-03-06 | Updated to reflect actual implementation: functional server pattern, 7 tools, 6+ resources, consolidated files, expanded field matcher, corrected module constructors | Claude |
