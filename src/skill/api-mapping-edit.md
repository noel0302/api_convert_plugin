# API Mapping Edit - 매핑 편집 가이드

> 생성된 매핑 규칙을 수정하고 관리하는 가이드

## 사용법

### 매핑 조회

현재 매핑 목록을 확인합니다:
- `api-convert://mappings` 리소스로 전체 목록 조회
- `api-convert://mappings/{id}` 로 개별 매핑 상세 조회

### 매핑 수정

`update_mapping` 도구를 사용하여 매핑을 수정합니다:

**필드 매핑 변경:**
```json
{
  "mappingId": "...",
  "changes": [
    {
      "type": "modify",
      "field": "userName",
      "after": {
        "sourceField": "user.display_name",
        "transformation": { "type": "rename" }
      }
    }
  ]
}
```

**필드 추가:**
```json
{
  "type": "add",
  "field": "fullAddress",
  "after": {
    "sourceField": ["address.city", "address.street"],
    "targetField": "fullAddress",
    "transformation": {
      "type": "computed",
      "config": { "expression": "`${address.city} ${address.street}`" }
    }
  }
}
```

**필드 제거:**
```json
{
  "type": "remove",
  "field": "unnecessaryField"
}
```

### 버전 관리

`manage_history` 도구로 변경 이력을 관리합니다:

**이력 조회:**
```json
{ "action": "list", "mappingId": "..." }
```

**버전 비교:**
```json
{ "action": "compare", "mappingId": "...", "version1": 1, "version2": 3 }
```

**롤백:**
```json
{ "action": "rollback", "mappingId": "...", "version": 2 }
```

모든 변경은 자동으로 버전 이력에 기록됩니다.
- 이전 버전으로 롤백 가능
- 변경 소스 추적 (대화, 에디터, 코드 동기화 등)

### 검증

수정 후 `validate_mapping` 도구로 검증을 권장합니다:
- 매핑 무결성 확인
- 샘플 데이터로 dry-run 테스트
- 중복 매핑, 순환 참조 감지

## 고급 기능

### N:1 매핑
여러 소스 필드를 하나의 타겟 필드로 합치기:
- `sourceField`에 배열로 여러 필드 지정
- `transformation.type: "computed"`로 합산 로직 정의

### 조건부 매핑
조건에 따라 다른 값을 매핑:
- `transformation.type: "conditional"`
- `config.mapping`에 조건별 값 정의

### 기본값 처리
소스 필드가 없거나 null일 때 대체값:
- `transformation.type: "default_value"`
- `config.fallback`에 기본값 지정
