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

`generate_mapping` 도구가 자동으로 필드 매핑을 수행합니다:
- 높은 신뢰도 (>= 0.8): 자동 확정
- 낮은 신뢰도 (< 0.8): 사용자 확인 요청
- N:1 충돌 자동 해소

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

매핑 생성 시 추가 옵션:
- `strictMode`: true면 낮은 신뢰도 매핑을 제외
- `includeNullHandling`: nullable 필드 처리 포함
- `namingConvention`: 'camelCase' | 'snake_case' | 'PascalCase'

## 다음 단계

- `/api-test`로 매핑 검증
- `update_mapping`으로 개별 필드 수정
- `manage_history`로 변경 이력 관리
