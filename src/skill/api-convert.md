# API Convert - 변환 가이드

> API 응답을 비즈니스 모델로 변환하는 대화형 가이드

## 사용법

이 스킬은 API 응답 → 비즈니스 모델 변환 과정을 단계별로 안내합니다.

### Step 0: 사용 목적 파악

ReferenceScanner를 통해 프로젝트의 기존 코드를 분석하여 사용 목적을 추론합니다:
- 직접 소비: 표준 플로우 (Step 1~6)
- API 허브: Step 4에서 1:N 매핑 안내
- 데이터 통합: Step 1에서 복수 API 수집 안내
- 마이그레이션: Step 1에서 기존 매퍼 코드 분석 추가

목적을 자동으로 추론할 수 없으면 선택지를 제시합니다.

### Step 1: API 소스 분석

다음 중 하나의 방법으로 API를 분석할 수 있습니다:

**JSON 샘플:**
```
analyze_api 도구를 사용하여 JSON 응답 샘플을 분석하세요.
sourceType: "json_sample"
```

**curl 명령어:**
```
curl 명령어를 붙여넣으면 자동으로 실행하고 응답을 분석합니다.
sourceType: "curl"
```

**Swagger/OpenAPI:**
```
Swagger 문서 URL을 제공하면 전체 API 스펙을 분석합니다.
sourceType: "swagger"
```

**XML:**
```
XML 응답을 제공하면 구조를 분석합니다.
sourceType: "xml"
```

### Step 2: 타겟 정의

비즈니스에서 사용할 데이터 구조를 정의합니다:
- ReferenceScanner가 프로젝트의 DTO/Model 파일을 자동 감지
- 감지된 DTO를 선택하거나 JSON 형태로 직접 정의
- 분석 결과 기반 자동 생성

### Step 3: 매핑 생성

`generate_mapping` 도구로 매핑 컨텍스트를 생성하고, 소스/타겟 구조를 분석하여 의미 기반 매핑을 수행합니다.

- 기본 동작: 스캐폴드 + 컨텍스트 반환 → `update_mapping`으로 매핑 채우기
- `fieldMappings` 제공 시: 분석된 매핑을 직접 저장

### Step 4: API 실행 (선택)

`execute_api_call` 도구로 실제 API를 호출하여 응답을 확인할 수 있습니다.
- 인증 지원: Bearer, Basic, API Key
- 응답 결과를 기존 프로파일에 반영 가능
- 자동 재시도 (429 Rate Limit, 5xx 서버 에러)

### Step 5: 코드 생성

`generate_code` 도구로 선택한 언어의 변환 코드를 생성합니다.
지원 언어: TypeScript, PHP, Java, Python, Kotlin, Go

프로젝트 패턴(class/function/builder)을 자동 감지하여 적절한 코드 스타일을 적용합니다.

### Step 6: 검증

`validate_mapping` 도구로 매핑의 정확성을 검증합니다:
- **dry_run**: 샘플 데이터로 변환 시뮬레이션 (필드별 상세 결과)
- **generate_test**: 테스트 코드 자동 생성 (Vitest, Jest, PHPUnit, JUnit, pytest, go test)
- **generate_test_page**: 인터랙티브 HTML 테스트 페이지 생성

## 버전 관리

`manage_history` 도구로 매핑 변경 이력을 관리합니다:
- 변경 이력 조회 (list)
- 특정 버전 조회 (get_version)
- 버전 비교 (compare)
- 이전 버전으로 롤백 (rollback)

## 팁

- 여러 API를 하나의 비즈니스 모델로 합칠 수 있습니다 (N:1 매핑)
- 하나의 API를 여러 비즈니스 모델로 나눌 수 있습니다 (1:N 매핑)
- 매핑 결과는 언제든 수정할 수 있으며, 변경 이력이 추적됩니다
- `update_mapping` 도구로 개별 필드를 추가/수정/삭제할 수 있습니다
- 비주얼 매핑 에디터(editor.html)로 드래그&드롭 편집이 가능합니다
