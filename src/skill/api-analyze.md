# API Analyze - API 분석 가이드

> 외부 API 소스를 분석하여 구조화된 프로파일을 생성하는 가이드

## 사용법

### JSON 응답 분석

API 응답 JSON을 붙여넣으면 다음을 자동으로 추출합니다:
- 필드명과 타입
- 중첩 구조 (nested objects, arrays)
- nullable 여부
- 문자열 포맷 (date, UUID, email, URL 등)

```
analyze_api 도구 사용:
- sourceType: "json_sample"
- source: '{"id": 1, "name": "test", ...}'
```

### curl 명령어 분석

curl 명령어를 전달하면:
1. HTTP 메서드, URL, 헤더, 바디 파싱
2. 인증 정보 추출 (Bearer, Basic, API Key)
3. 프로파일 생성

```
analyze_api 도구 사용:
- sourceType: "curl"
- source: 'curl -H "Authorization: Bearer ..." https://api.example.com/users'
```

### Swagger/OpenAPI 분석

Swagger URL을 제공하면 전체 스펙을 분석하여
모든 엔드포인트의 프로파일을 한번에 생성합니다.

```
analyze_api 도구 사용:
- sourceType: "swagger"
- source: 'https://api.example.com/swagger.json'
```

## 분석 결과

분석이 완료되면 다음이 생성됩니다:
- **ApiProfile**: 구조화된 API 프로파일 (JSON)
- **신뢰도 점수**: 분석의 정확성 지표
- **경고/제안사항**: 주의할 점이나 개선 제안

## API 실행으로 실제 응답 분석

curl 분석 후 실제 API를 호출하여 응답 스키마를 보강할 수 있습니다:

```
execute_api_call 도구 사용:
- url: 'https://api.example.com/users'
- method: 'GET'
- auth: { type: 'bearer', token: '...' }
- profileId: '기존 프로파일 ID' (선택, 응답을 프로파일에 반영)
```

## 프로파일 비교

기존 프로파일과 새 소스를 비교하여 변경된 필드를 감지할 수 있습니다.
API 버전 업데이트 시 유용합니다.

## 다음 단계

분석 완료 후 `generate_mapping` 도구로 매핑을 생성할 수 있습니다.
