# API Map - 빠른 매핑 가이드

> 기존 프로파일에서 빠르게 매핑을 생성하는 단축 워크플로우

## 사용법

이 스킬은 이미 분석된 API 프로파일이 있을 때 빠르게 매핑을 생성합니다.

### Step 1: 프로파일 선택

기존 프로파일 목록을 확인합니다:
- `api-convert://profiles` 리소스로 목록 조회
- `api-convert://profiles/{id}` 로 상세 조회

### Step 2: 엔드포인트 선택

프로파일에서 매핑할 엔드포인트를 선택합니다:
```
예: "GET /users", "POST /orders"
```

### Step 3: 타겟 DTO 선택 또는 생성

ReferenceScanner가 프로젝트에서 감지한 DTO를 선택하거나 새로 정의합니다:

**기존 DTO 사용:**
```json
{
  "apiProfile": "profile-id",
  "endpoint": "GET /users",
  "targetProfileId": "existing-dto-id",
  "language": "typescript"
}
```

**직접 정의:**
```json
{
  "apiProfile": "profile-id",
  "endpoint": "GET /users",
  "targetDefinition": "{\"name\": \"string\", \"email\": \"string\"}",
  "language": "typescript"
}
```

**자동 생성:**
```json
{
  "apiProfile": "profile-id",
  "endpoint": "GET /users",
  "language": "typescript",
  "typeName": "UserDto"
}
```

### Step 4: 매핑 생성

**방법 A — 2단계 워크플로우 (권장)**

1단계: `generate_mapping`을 fieldMappings 없이 호출 → 스캐폴드 + 컨텍스트 반환
- `context.sourceFields`: 소스 API의 모든 필드 (경로, 타입, 설명, 예시)
- `context.targetFields`: 타겟 DTO의 모든 필드 (경로, 타입, 필수, 비즈니스 컨텍스트)

2단계: 컨텍스트를 분석하여 `update_mapping`으로 매핑 채우기
- 소스/타겟 필드의 의미를 비교하여 최적 매핑 결정
- transformation 타입과 config 지정

**방법 B — 1단계 워크플로우**

소스/타겟 구조를 이미 알고 있다면, `generate_mapping`에 fieldMappings를 직접 제공:
```json
{
  "apiProfile": "...", "endpoint": "...", "language": "typescript",
  "fieldMappings": [
    {"targetField": "sippCode", "sourceField": "carCategoryCode",
     "transformation": {"type": "rename"}},
    {"targetField": "model", "sourceField": "carCategorySample",
     "transformation": {"type": "rename"}}
  ]
}
```

### Step 5: 코드 생성

`generate_code` 도구로 즉시 변환 코드를 생성합니다:
```json
{
  "mappingId": "생성된 매핑 ID",
  "language": "typescript",
  "pattern": "function"
}
```

지원 패턴: `class`, `function`, `builder`
지원 언어: TypeScript, PHP, Java, Python, Kotlin, Go

### Step 6: 적용

생성된 코드를 프로젝트에 추가하고 필요시 수정합니다.

## 옵션

매핑 생성 시 `fieldMappings` 배열의 각 항목:
- `targetField` (필수): 타겟 필드 경로
- `sourceField`: 소스 필드 경로 (null이면 매핑 없음)
- `transformation`: `{ type, config }` — 변환 타입과 설정
- `confidence`: 신뢰도 (0-1, 기본 1.0)
- `userNote`: 참고 메모

## 다음 단계

- `/api-test`로 매핑 검증
- `update_mapping`으로 개별 필드 수정
- `manage_history`로 변경 이력 관리
