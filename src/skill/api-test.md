# API Test - 매핑 테스트 가이드

> 생성된 매핑의 정확성을 검증하는 테스트 워크플로우

## 사용법

이 스킬은 매핑 규칙을 다양한 방법으로 검증합니다.

### Step 1: 매핑 선택

테스트할 매핑을 선택합니다:
- `api-convert://mappings` 리소스로 매핑 목록 조회
- `api-convert://mappings/{id}` 로 상세 조회

### Step 2: 테스트 유형 선택

#### Dry Run (기본)

샘플 데이터로 변환 시뮬레이션:
```json
{
  "mappingId": "...",
  "mode": "dry_run",
  "sampleData": {
    "id": 1,
    "name": "test",
    "email": "test@example.com"
  }
}
```

결과에는 필드별 상세 정보가 포함됩니다:
- 변환 전/후 값
- 예상/실제 타입
- 성공/경고/실패 요약

#### 테스트 코드 생성

자동 테스트 코드를 생성합니다:
```json
{
  "mappingId": "...",
  "mode": "generate_test",
  "testConfig": {
    "language": "typescript",
    "framework": "vitest",
    "outputPath": "tests/mapping.test.ts"
  }
}
```

지원 프레임워크:
- TypeScript: vitest, jest
- Python: pytest
- PHP: phpunit
- Java/Kotlin: junit
- Go: testing

#### 테스트 페이지 생성

인터랙티브 HTML 테스트 페이지를 생성합니다:
```json
{
  "mappingId": "...",
  "mode": "generate_test_page"
}
```

브라우저에서 소스/타겟 패널로 실시간 변환을 확인할 수 있습니다.

### Step 3: 결과 확인

**Dry Run 결과 예시:**
```json
{
  "summary": {
    "totalFields": 10,
    "successFields": 8,
    "warningFields": 1,
    "failedFields": 1
  },
  "fieldResults": [
    {
      "field": "userName",
      "sourceValue": "test",
      "transformedValue": "test",
      "isValid": true
    }
  ]
}
```

### Step 4: 문제 수정

검증에서 발견된 문제는 `update_mapping` 도구로 수정합니다:
- 잘못된 소스 필드 매핑 → `modify` 변경
- 누락된 필드 → `add` 변경
- 불필요한 필드 → `remove` 변경

수정 후 다시 검증을 실행하여 확인합니다.

## 팁

- dry_run은 빠르지만 타입 변환을 시뮬레이션하지 않음
- generate_test는 프로젝트에 통합 가능한 테스트 파일 생성
- generate_test_page는 비개발자도 결과를 확인할 수 있는 HTML 페이지 제공
- 매핑 수정 후에는 항상 재검증을 권장

## 다음 단계

- 검증 통과 후 `generate_code`로 최종 코드 생성
- `manage_history`로 변경 이력 확인 및 롤백
