# API Convert Plugin

외부 API 응답을 비즈니스 모델로 변환하는 Claude Code 플러그인.

MCP Server + Skill 하이브리드 아키텍처로 구성되어, 핵심 엔진(MCP Tool)과 가이드 워크플로우(Skill)가 분리된 구조입니다.

## 주요 기능

- **API 분석**: JSON, cURL, Swagger/OpenAPI, XML 소스를 파싱하여 API 프로파일 생성
- **자동 매핑**: 다차원 필드 매칭(이름 60% + 타입 30% + 위치 5% + 패턴 5%)으로 소스-타겟 필드 매핑
- **코드 생성**: TypeScript, PHP, Java, Python, Kotlin, Go 6개 언어 지원
- **매핑 검증**: Dry-run, 테스트 코드 생성, 비주얼 에디터 HTML 생성
- **히스토리 관리**: 버전 관리, 롤백, 버전 비교, 최대 버전 수 제한
- **API 실행**: 실제 API 호출 + 비정상 응답 감지 + 지수 백오프 재시도

## 설치

```bash
npm install
npm run build
```

## Claude Code에 등록

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "api-convert": {
      "command": "node",
      "args": ["/path/to/api-convert-plugin/dist/index.js"]
    }
  }
}
```

Skill 파일들(`src/skill/*.md`)은 Claude Code의 skill 디렉토리에 복사합니다.

## MCP Tools (7개)

| Tool | 설명 |
|------|------|
| `analyze_api` | API 소스를 분석하여 프로파일 생성 |
| `generate_mapping` | 프로파일 + 타겟 기반 매핑 규칙 생성 |
| `generate_code` | 매핑 규칙을 실행 가능한 코드로 변환 |
| `update_mapping` | 매핑 필드 수정/추가/삭제 |
| `validate_mapping` | Dry-run, 테스트 코드/페이지 생성 |
| `execute_api_call` | 실제 API 호출 및 응답 캡처 |
| `manage_history` | 히스토리 조회, 롤백, 버전 비교 |

## MCP Resources (6개)

| URI | 설명 |
|-----|------|
| `api-convert://profiles` | 분석된 API 프로파일 목록 |
| `api-convert://targets` | 타겟 프로파일 목록 |
| `api-convert://mappings` | 매핑 규칙 목록 |
| `api-convert://config` | 플러그인 설정 |
| `api-convert://status` | 전체 상태 요약 |
| `api-convert://{type}/{id}` | 개별 리소스 상세 |

## Skills (5개)

| Skill | 설명 |
|-------|------|
| `/api-convert` | 전체 워크플로우 (분석 → 매핑 → 코드 → 검증) |
| `/api-map` | 빠른 매핑 워크플로우 |
| `/api-test` | 테스트 및 검증 워크플로우 |
| `/api-analyze` | API 소스 분석 전용 |
| `/api-mapping-edit` | 매핑 수정 및 히스토리 관리 |

## 프로젝트 구조

```
src/
├── mcp/
│   ├── server.ts              # MCP 서버 (createServer, startServer)
│   ├── tools/index.ts         # 7개 Tool 정의
│   └── resources/index.ts     # 6개 Resource 정의
├── core/
│   ├── analyzer/              # API 소스 분석 (JSON, cURL, Swagger, XML)
│   ├── mapper/                # 필드 매칭, 타입 변환, 충돌 해소
│   ├── generator/             # 6개 언어 코드 생성 템플릿
│   ├── validator/             # Dry-run, 테스트 생성, 에디터
│   ├── executor/              # API 호출, 재시도, 인증
│   ├── history/               # 버전 관리, 롤백
│   ├── services/              # Storage, Config, Log
│   ├── types/                 # 타입 정의 (Profile, Target, Mapping 등)
│   └── errors.ts              # 27개 에러 코드
├── reference/                 # 프로젝트 코드 스캔 (DTO 감지, 패턴 분석)
├── skill/                     # 5개 Skill 마크다운
└── index.ts                   # 엔트리포인트
```

## 요구사항

- Node.js >= 20.0.0
- Claude Code (MCP 클라이언트)

## 라이선스

MIT
