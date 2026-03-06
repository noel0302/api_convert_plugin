# API Convert Plugin - Plan Document

> **프로젝트명**: API Convert Plugin
> **버전**: v1.0 (Plan)
> **작성일**: 2026-03-06
> **목적**: 외부 API 응답값을 비즈니스에서 사용 가능한 형태로 변환하는 Claude Code 플러그인

---

## 1. 프로젝트 개요

### 1.1 핵심 목적
외부 API의 응답 구조(필드 경로, 필드명, 타입)를 비즈니스 로직에서 기대하는 내부 구조로 **매핑하는 변환 코드를 자동 생성**하는 Claude Code 플러그인.

**본질**: 두 개의 서로 다른 데이터 구조 사이의 **필드 경로 리매핑 + 변환 함수/클래스 코드 생성**

### 1.2 핵심 컨셉 예시

외부 API가 이렇게 응답하지만:
```json
{
  "shop": {
    "name": "a지점",
    "addr": "서울시 강남구",
    "tel": "02-1234-5678",
    "open_dt": "2024-01-15"
  }
}
```

비즈니스 로직에서는 이렇게 사용하고 싶다:
```json
{
  "location": {
    "name": "a지점",
    "address": "서울시 강남구",
    "phone": "02-1234-5678",
    "openedAt": "2024-01-15T00:00:00Z"
  }
}
```

**이 플러그인이 하는 일:**
1. 양쪽 구조를 파악 (외부 API 응답 + 내부 비즈니스 모델)
2. 필드 간 매핑 규칙을 도출 (`shop.name` → `location.name`, `shop.addr` → `location.address`)
3. 모호한 매핑은 사용자에게 확인 (`shop.tel` → `location.phone`? `location.contact`?)
4. **변환 함수/클래스 코드를 자동 생성**

```
shop.name     →  location.name       (필드 경로 리매핑)
shop.addr     →  location.address    (필드명 변경)
shop.tel      →  location.phone      (필드명 변경, 모호성 확인 필요)
shop.open_dt  →  location.openedAt   (필드명 변경 + 날짜 포맷 변환)
```

### 1.3 해결하려는 문제
- 외부 API 응답의 필드 경로/이름이 내부 비즈니스 모델과 달라서 **매번 수동으로 매핑 코드를 작성**해야 하는 비효율
- 필드명이 유사하지만 다른 경우(usr_nm ↔ userName) **모호한 매핑으로 인한 실수** 가능성
- 중첩 객체, 배열, 타입 변환 등 **복잡한 구조 변환 시 버그** 발생
- API 문서와 실제 응답이 다를 때 디버깅의 어려움
- 다양한 언어/프레임워크에서 **동일한 매핑 작업 반복**

### 1.4 대상 사용자
- Claude Code를 사용하는 개발자
- 외부 API 연동 작업이 빈번한 백엔드/풀스택 개발자
- 레거시 시스템 마이그레이션 작업자

### 1.5 양쪽 구조 파악 방법

**소스 (외부 API) 구조 파악:**
| 방법 | 예시 |
|------|------|
| Swagger/OpenAPI 스펙 | API 명세서에서 응답 스키마 추출 |
| 샘플 Response JSON | 실제 응답 예시에서 구조 분석 |
| curl 직접 실행 | 실제 API 호출로 응답 캡처 |
| API 가이드 문서 | PDF/MD 등에서 Claude가 구조 추출 |
| Git 저장소 | API 서버 코드에서 인터페이스 추출 |

**타겟 (비즈니스 모델) 구조 파악:**
| 방법 | 예시 |
|------|------|
| 기존 DTO/Model 파일 | `LocationDto.php`, `Location.ts` 등 직접 참조 |
| 기존 코드베이스 스캔 | 프로젝트에서 `location.name`으로 사용 중인 코드 탐지 |
| 규격 문서 | 내부 데이터 규격 정의서 참조 |
| Git 저장소 | 비즈니스 모델 정의 코드 참조 |
| 사용자 직접 지정 | "shop.name은 location.name으로 매핑해줘" |

---

## 2. 핵심 설계 원칙

> **최우선 원칙: 유연함(Flexibility)**
>
> 이 플러그인의 모든 설계 결정에서 유연함이 최우선이다.
> 외부 API 문서, 비즈니스 모델 규격, 매핑 규칙 — 어떤 것이든 언제든 바뀔 수 있다.
> 변경이 발생했을 때 자연스럽게 대응하지 못하는 구조는 잘못된 설계다.

### 2.1 최초 확인: 사용 목적 파악

매핑 작업을 시작하기 전에 **사용자의 목적**을 정확히 파악해야 한다. 같은 "외부 API 매핑"이라도 목적에 따라 구현 방향이 완전히 달라진다.

#### 2.1.1 사용 목적 유형

| 유형 | 설명 | 구현 방향 |
|------|------|-----------|
| **직접 소비** | 외부 API를 내부 비즈니스에서 바로 사용 | Mapper 함수/클래스 생성 → 비즈니스 로직에서 직접 호출 |
| **API 허브** | 외부 API를 가공하여 다른 서비스에 제공 | Mapper + API 엔드포인트 설계 → 중간 레이어 역할 |
| **데이터 통합** | 여러 외부 API를 하나의 모델로 통합 | N:1 Mapper → 통합 비즈니스 모델 |
| **마이그레이션** | 기존 API 연동을 새 구조로 교체 | 기존 매퍼 분석 → 새 매퍼로 교체 |

**왜 중요한가:**
- 사용자가 원하는 건 단순히 Mapper 함수 하나인데, 플러그인이 API 엔드포인트까지 만들어버리면 안 된다
- 반대로, API 허브를 만들려는데 Mapper 함수만 생성하면 부족하다
- **목적이 불분명한 상태에서 구현을 시작하지 않는다**

#### 2.1.2 목적 파악 방법

```
플러그인 최초 실행 시:
    │
    ├─ 기존 코드 분석으로 목적 추론 가능?
    │   ├─ YES: 기존 매퍼/서비스 코드 패턴 분석
    │   │   "기존 코드를 보니 외부 API를 직접 호출해서 사용하고 계시네요.
    │   │    이번에도 동일한 패턴으로 매핑하면 될까요?"
    │   │
    │   └─ NO: 사용자에게 직접 확인
    │       "이 매핑은 어떤 목적인가요?"
    │       - 외부 API를 우리 서비스에서 직접 사용
    │       - 외부 API를 가공해서 다른 서비스에 제공 (API 허브)
    │       - 여러 외부 API를 하나로 통합
    │       - 기타 (사용자 설명)
    │
    └─ 목적에 따라 후속 워크플로우 결정
        ├─ 직접 소비 → 단일 Mapper 생성 흐름
        ├─ API 허브 → Mapper + 제공 API 설계 흐름
        ├─ 데이터 통합 → 다중 소스 분석 + 통합 Mapper 흐름
        └─ 마이그레이션 → 기존 코드 분석 + 교체 흐름
```

#### 2.1.3 기존 코드 분석의 중요성

사용자의 목적은 **기존 코드**에 가장 잘 드러난다:

```
기존 코드에서 파악 가능한 것들:
├─ API 호출 패턴: 직접 호출? 중간 레이어?
├─ 매핑 코드 위치: 서비스 내부? 별도 매퍼 클래스?
├─ 매핑 결과 사용처: 내부 로직? 다른 API로 전달?
├─ 프로젝트 구조: 모놀리식? MSA?
└─ 기존 컨벤션: 네이밍, 패턴, 아키텍처 스타일
```

기존 코드 분석은 목적 파악뿐 아니라 **생성할 코드의 스타일과 위치**를 결정하는 데도 핵심적이다.

### 2.2 비즈니스 맥락: 필요할 때 정확하게

매핑의 복잡도에 따라 **비즈니스 맥락이 필요한 경우와 불필요한 경우**가 있다. 모든 매핑에 비즈니스 맥락이 필수라고 단정하지 않는다.

```
단순 매핑 (비즈니스 맥락 불필요):
   shop.name → location.name          필드명만 바꾸면 끝, 비즈니스 의미 동일
   shop.addr → location.address       단순 리네이밍
   → 사용자에게 비즈니스 맥락을 요구할 필요 없음

복잡한 매핑 (비즈니스 맥락 필수):
   shop.status = "01"  →  location.status = "ACTIVE"
   → "01"이 무슨 의미인지 알아야 매핑 가능
   → 이때는 비즈니스 맥락이 반드시 필요
```

**비즈니스 맥락이 중요해지는 상황:**
- `shop.amount`와 `order.amount`가 같은 "금액"이지만 하나는 **세전**, 하나는 **세후**
- `status: "01"`이 API에서는 "성공"인데 비즈니스에서는 "대기"를 의미
- 외부 API의 `price`가 **원 단위**인데 비즈니스는 **천원 단위**를 기대
- 날짜가 API에서는 **KST**인데 비즈니스는 **UTC**로 저장

**비즈니스 맥락이 불필요한 상황:**
- 필드명만 바꾸면 되는 단순 리네이밍
- 타입 변환만 필요한 경우 (string → number)
- 사용자가 이미 정확한 매핑 지시를 한 경우 ("A는 B로 매핑해")

**원칙: 상황에 맞게 유연하게**
- 단순 매핑은 빠르게 처리하고, 복잡한 매핑에서만 비즈니스 맥락을 확인
- 비즈니스 맥락이 불확실한 **복잡한 변환**에서는 추측하지 않고 사용자에게 확인
- **반드시 필요한 것**: 외부 API 정보 + 비즈니스 모델(타겟 구조). 이것 없이는 매핑 자체가 불가능
- **상황에 따라 필요한 것**: 비즈니스 맥락, 코드 매핑 테이블, 변환 규칙 등

#### 2.2.1 비즈니스 정보 수집 경로

비즈니스 맥락도 다양한 형태로 제공받을 수 있다:

| 제공 형태 | 예시 |
|-----------|------|
| 사용자 직접 설명 | "이 amount는 세후 금액이야" |
| 비즈니스 규격 문서 | 내부 데이터 정의서, 필드 명세서 |
| 기획 문서 | PRD, 기능 명세서, 요구사항 정의서 |
| 기존 코드의 주석/문서 | DTO의 JSDoc, PHPDoc 등 |
| 기존 비즈니스 로직 | 이미 작성된 서비스 레이어 코드 |
| 위키/Confluence 등 | 팀 내부 지식 문서 |
| 사용자와의 대화 | 매핑 중 질문에 대한 답변 |

**비즈니스 정보도 프로파일로 저장:**
- 수집된 비즈니스 맥락은 타겟 프로파일에 함께 기록
- 각 필드의 **비즈니스 의미, 제약 조건, 주의사항**을 구조화하여 보존
- 이후 매핑 시 참조하여 비즈니스 정합성 유지

```json
// 타겟 프로파일에 비즈니스 맥락 포함 예시
{
  "fields": {
    "amount": {
      "type": "int",
      "required": true,
      "businessContext": {
        "meaning": "세후 결제 금액 (원 단위)",
        "constraints": "0 이상, 음수 불가",
        "source": "사용자 설명 (2026-03-06)",
        "caution": "외부 API의 amount는 세전이므로 변환 필요"
      }
    },
    "status": {
      "type": "OrderStatus",
      "required": true,
      "businessContext": {
        "meaning": "주문 상태",
        "codeMapping": {
          "API 01": "비즈니스 COMPLETED (완료)",
          "API 02": "비즈니스 PENDING (대기중)",
          "API 99": "비즈니스 FAILED (실패)"
        },
        "source": "비즈니스 규격 문서 v2.1, p.15"
      }
    }
  }
}
```

### 2.3 선행 조건: 최소한 양쪽 구조는 알아야 한다

매핑이 가능하려면 **최소한 소스(외부 API)와 타겟(비즈니스 모델)의 구조**는 파악되어야 한다. 이 두 가지 없이는 매핑 자체가 불가능하다.

```
┌─────────────────┐                      ┌─────────────────────┐
│   소스 (외부 API) │                      │  타겟 (비즈니스 모델)  │
│                   │                      │                       │
│  구조 파악됨?     │                      │  구조 파악됨?          │
│  ┌─ YES          │                      │  ┌─ YES               │
│  └─ NO → 필수!   │                      │  └─ NO → 필수!        │
│    정보 요청      │                      │    정보 요청           │
└─────────────────┘                      └─────────────────────┘
         │                                        │
         └──────────── 양쪽 모두 YES ─────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  비즈니스 맥락 필요?    │
                │  (매핑 복잡도에 따라)   │
                │  ├─ 단순 → 바로 진행   │
                │  └─ 복잡 → 맥락 확인   │
                └───────────┬───────────┘
                            ▼
                    매핑 규칙 도출 시작
```

**필수**: 소스 구조 + 타겟 구조 (이것 없으면 매핑 불가능)
**상황에 따라**: 비즈니스 맥락 (복잡한 변환이 필요한 경우에만)

**정보 수집 단계에서의 원칙:**
- 소스/타겟 구조 없이 매핑을 시도하지 않는다
- 문서, 코드, 스펙 등 제공된 자료를 **최우선으로 참고**한다
- 자료가 충분하지 않으면 **부족한 부분을 명확히 짚어** 추가 자료를 요청한다
- 단, 불필요한 정보까지 과도하게 요구하지 않는다 — **매핑에 실제로 필요한 것만 요청**

### 2.4 유연성 원칙: 모든 것은 변할 수 있다

#### 2.4.1 타겟(비즈니스 형태)은 고정이 아니다

비즈니스 모델은 작업 중에도 변경될 수 있다. 플러그인은 이를 자연스럽게 수용해야 한다.

```
시나리오: 작업 중 타겟 구조 변경

[초기]  shop.name → location.name
[변경]  사용자: "location 말고 store로 바꿀게"
[대응]  shop.name → store.name  (기존 매핑 규칙을 새 타겟에 맞게 즉시 갱신)
[대응]  변경 이력 기록, 이전 버전 롤백 가능
```

- 타겟 구조 변경 시 **기존 매핑 규칙을 자동으로 업데이트**
- 변경 이력을 추적하여 **언제든 이전 상태로 롤백** 가능
- 매핑 규칙과 생성 코드를 **독립적으로 관리**하여 한쪽 변경이 다른 쪽에 즉시 반영

#### 2.4.2 소스(외부 API)도 다양하게 대응

외부 API는 제공처마다 포맷, 인증, 문서 형태가 모두 다르다. 어떤 형태든 유연하게 수용한다.

- Swagger가 있는 API도 있고, curl 예시만 있는 API도 있다
- 인증 방식이 Bearer일 수도, API Key일 수도, OAuth일 수도 있다
- 응답이 JSON일 수도, XML일 수도 있다
- **어떤 형태든 정규화하여 동일한 매핑 파이프라인으로 처리**

#### 2.4.3 1:N 매핑 지원 (API 허브 패턴)

하나의 외부 API가 **여러 비즈니스 형태로 각각 매핑**될 수 있다.

```
예: API 허브 - 하나의 외부 배송 API를 여러 비즈니스에 제공

외부 배송 API (소스)
  │
  ├─→ 비즈니스 A용: delivery.status → order.deliveryStatus (이커머스)
  ├─→ 비즈니스 B용: delivery.status → shipment.state       (물류 시스템)
  └─→ 비즈니스 C용: delivery.status → tracking.phase       (고객 앱)
```

```
외부 결제 API (소스)
  │
  ├─→ 서비스 X용: payment.amt → billing.amount        (정산 시스템)
  ├─→ 서비스 Y용: payment.amt → transaction.price     (거래 내역)
  └─→ 서비스 Z용: payment.amt → receipt.totalAmount   (영수증)
```

**지원 구조:**
- 하나의 API 프로파일(소스)에 **여러 매핑 규칙(타겟)**을 연결
- 각 매핑 규칙은 독립적으로 관리, 수정, 버전 관리
- 매핑 규칙 간 **복사/파생** 가능 (유사한 타겟 구조를 기반으로 새 매핑 빠르게 생성)

#### 2.4.4 N:1 매핑도 지원

여러 외부 API의 응답을 **하나의 비즈니스 모델로 통합**하는 경우도 지원한다.

```
외부 배송 API  ─→ delivery.status ─┐
외부 결제 API  ─→ payment.status  ─┼─→ order.fulfillmentStatus (통합)
외부 재고 API  ─→ stock.available ─┘
```

**N:1 매핑 시 필드 충돌 해소:**

여러 소스가 같은 타겟 필드에 매핑될 때 충돌이 발생할 수 있다.

```
충돌 예시:
  배송 API  → delivery.updatedAt  ─┐
  결제 API  → payment.updatedAt   ─┼─→ order.lastUpdatedAt (어느 걸 쓸까?)
  재고 API  → stock.checkedAt     ─┘

해소 전략:
  1. 우선순위 규칙: 사용자가 소스별 우선순위 지정
     → "결제 API 값 우선, 없으면 배송 API 값 사용"
  2. 최신값 선택: 타임스탬프 비교하여 가장 최근 값 채택
  3. 사용자 지정 로직: 사용자가 직접 병합 규칙 작성
     → "가장 늦은 시간을 사용" 또는 "모든 시간을 배열로"
  4. 충돌 감지 시 확인: 자동 해소 불가 시 사용자에게 질문
```

```typescript
// N:1 매핑에서 충돌 해소 설정
interface ConflictResolution {
  targetField: string;                    // 충돌 대상 타겟 필드
  sources: {
    apiProfileId: string;                 // 소스 API
    sourceField: string;                  // 소스 필드
    priority: number;                     // 우선순위 (낮을수록 높음)
  }[];
  strategy: 'priority' | 'latest' | 'custom' | 'ask_user';
  customLogic?: string;                   // strategy가 custom일 때
}
```

### 2.5 변경 대응 메커니즘: 자료가 바뀌면 연쇄적으로 대응

외부 API 문서가 업데이트되거나, 비즈니스 DTO가 수정되거나, 사용자가 중간에 규격을 바꿀 수 있다. **어떤 자료가 바뀌든** 플러그인은 자연스럽게 대응해야 한다.

#### 2.5.1 변경 시나리오별 대응

```
시나리오 1: 외부 API 문서가 업데이트됨
─────────────────────────────────────
사용자: "PG사에서 API v2.1 문서 보내왔어, 필드 몇 개 바뀜"
    │
    ▼
변경된 문서 재분석 (변경 부분만 또는 전체)
    │
    ▼
기존 프로파일과 diff 비교
    │
    ├─ 변경된 필드 식별 (추가/삭제/타입변경)
    ├─ 영향받는 매핑 규칙 자동 식별
    └─ 사용자에게 보고:
       "pay_amt 필드가 string → number로 변경되었습니다.
        이 필드를 사용하는 매핑 2건이 영향받습니다.
        매핑을 업데이트할까요?"
```

```
시나리오 2: 비즈니스 DTO가 수정됨
────────────────────────────────
사용자: "OrderDto에 discountAmount 필드 추가했어"
    │
    ▼
타겟 프로파일 재분석
    │
    ▼
기존 매핑에 반영:
    ├─ 새 필드에 매핑 가능한 소스 필드 탐색
    ├─ 후보 있으면 제안: "discount_amt → discountAmount 매핑 추가할까요?"
    └─ 없으면 알림: "discountAmount에 대응하는 소스 필드가 없습니다"
```

```
시나리오 3: 사용자가 중간에 방향을 바꿈
──────────────────────────────────────
사용자: "아 location 말고 전부 store로 바꿀게. 그리고 필드도 좀 다르게 할래"
    │
    ▼
기존 매핑 규칙 보존 (히스토리에 기록)
    │
    ▼
새 타겟 구조에 맞게 매핑 재생성
    │
    ├─ 기존 매핑에서 재활용 가능한 부분은 유지
    ├─ 변경된 부분만 새로 도출
    └─ 변경 전/후 비교 표시
```

#### 2.5.2 연쇄 업데이트 흐름

```
자료 변경 감지
    │
    ▼
프로파일 갱신 (소스 또는 타겟)
    │
    ▼
영향받는 매핑 규칙 식별
    │
    ├─ 변경 영향 없음 → 그대로 유지
    ├─ 변경 영향 있음 → 사용자에게 보고 & 업데이트 제안
    └─ 매핑 불가능해짐 → 사용자에게 경고 & 대안 제시
         │
         ▼ (사용자 승인 후)
    매핑 규칙 업데이트
         │
         ▼
    생성 코드 재생성
```

**원칙:**
- 변경이 감지되면 **영향 범위를 먼저 파악**하고 사용자에게 보고
- 자동 수정하지 않음 — **항상 사용자 확인 후** 업데이트
- 변경 전 상태는 히스토리에 보존 — **언제든 롤백 가능**
- 부분 변경 시 **전체를 다시 만들지 않고 변경된 부분만 갱신**

### 2.6 토큰 효율 원칙: 한 번 분석, 이후 요약본 참조

#### 2.6.1 문제

외부 API 문서가 50만 자, 비즈니스 규격 문서가 10만 자라고 하면, 매핑 작업을 할 때마다 원본 전체를 읽는 것은 **토큰 낭비이자 비현실적**이다.

#### 2.6.2 원칙: Analyze Once, Reference Summary

```
┌───────────────────────────────────────────────────────────────┐
│                                                                │
│  원본 자료 (최초 1회)         분석 결과물 (이후 참조)           │
│                                                                │
│  API 문서 (50만 자)     ──분석──→  API 프로파일 JSON (~500줄)  │
│  Swagger 스펙 (3만 줄)  ──분석──→  엔드포인트 요약 JSON        │
│  샘플 RQ/RS             ──분석──→  필드 스키마 JSON             │
│  비즈니스 DTO 파일들    ──분석──→  타겟 스키마 JSON             │
│  규격 문서 (10만 자)    ──분석──→  구조화된 필드 정의 JSON      │
│                                                                │
│  원본: 세션에서 1회 읽고 분석                                    │
│  요약본: 이후 모든 작업에서 이것만 참조 (토큰 절약)              │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

#### 2.6.3 분석 → 저장 흐름

```
사용자가 자료 제공 (문서, 스펙, 샘플 등)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  1단계: 원본 분석 (최초 1회만 수행)               │
│                                                  │
│  - 문서 전체를 읽고 구조화된 정보 추출            │
│  - 엔드포인트, 필드, 타입, 인증, 예시값 등 추출   │
│  - 원본에서만 알 수 있는 컨텍스트(설명, 주의사항) │
│    도 함께 추출                                   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  2단계: 압축된 프로파일로 저장                     │
│                                                  │
│  .api-convert/profiles/payment-api.profile.json  │
│  .api-convert/targets/order-dto.target.json      │
│                                                  │
│  → 원본 대비 1/100 ~ 1/1000 수준으로 압축         │
│  → 매핑에 필요한 정보만 구조화하여 보존            │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  3단계: 이후 작업에서는 프로파일만 참조            │
│                                                  │
│  매핑 규칙 도출 시  → profile.json 읽기 (~수백 줄)│
│  코드 생성 시       → profile.json + mapping.json │
│  검증 시            → mapping.json + dry-run 결과 │
│                                                  │
│  → 기본적으로 프로파일만 참조 (토큰 절약)          │
│  → 필요 시 원본의 특정 부분만 선택적 재참조         │
└─────────────────────────────────────────────────┘
```

#### 2.6.4 프로파일 저장 형식

**소스 프로파일 (외부 API 분석 결과):**

```json
{
  "id": "payment-api",
  "name": "PG사 결제 API",
  "version": "2.1",
  "analyzedFrom": {
    "sourceType": "document",
    "originalPath": "docs/pg-api-guide.pdf",
    "originalSize": "512,000 chars",
    "analyzedAt": "2026-03-06T12:00:00Z"
  },
  "baseUrl": "https://api.pg-provider.com/v2",
  "authentication": {
    "type": "bearer",
    "tokenSource": "사용자 제공 필요",
    "notes": "테스트 환경과 운영 환경 키가 다름"
  },
  "endpoints": [
    {
      "method": "POST",
      "path": "/payments",
      "description": "결제 요청",
      "request": {
        "body": {
          "merchant_id": { "type": "string", "required": true, "description": "가맹점 ID" },
          "amount": { "type": "number", "required": true },
          "order_no": { "type": "string", "required": true }
        }
      },
      "response": {
        "200": {
          "pay_id": { "type": "string", "description": "결제 고유 ID" },
          "pay_amt": { "type": "string", "description": "결제 금액 (문자열 주의)" },
          "pay_dt": { "type": "string", "format": "yyyyMMddHHmmss" },
          "status_cd": { "type": "string", "enum": ["00", "01", "99"], "description": "00=성공, 01=대기, 99=실패" },
          "card_info": {
            "type": "object",
            "children": {
              "card_nm": { "type": "string" },
              "card_no": { "type": "string", "description": "마스킹된 카드번호" }
            }
          }
        }
      }
    }
  ],
  "notes": [
    "금액 필드(pay_amt)가 문자열로 내려옴 - 숫자 변환 필요",
    "날짜 포맷이 yyyyMMddHHmmss - ISO 8601 변환 필요",
    "status_cd가 문자열 코드 - enum 매핑 필요"
  ]
}
```

**타겟 프로파일 (비즈니스 모델 분석 결과):**

```json
{
  "id": "order-payment-dto",
  "name": "OrderPaymentDto",
  "analyzedFrom": {
    "sourceType": "dto_file",
    "originalPath": "src/dto/OrderPaymentDto.php",
    "analyzedAt": "2026-03-06T12:00:00Z"
  },
  "language": "php",
  "fields": {
    "paymentId": { "type": "string", "required": true },
    "amount": { "type": "int", "required": true, "description": "원 단위 정수" },
    "paidAt": { "type": "DateTimeImmutable", "required": true },
    "status": { "type": "PaymentStatus", "enum": ["SUCCESS", "PENDING", "FAILED"] },
    "card": {
      "type": "CardInfo",
      "children": {
        "name": { "type": "string" },
        "maskedNumber": { "type": "string" }
      }
    }
  }
}
```

→ 원본 50만 자 문서가 **수십~수백 줄의 JSON**으로 압축되어, 이후 매핑 작업 시 이것만 참조하면 된다.

#### 2.6.5 원본 재참조: 필요하면 유연하게

프로파일이 기본 참조 대상이지만, **원본을 다시 봐야 할 상황은 당연히 존재한다.** "무조건 안 본다"가 아니라, 상황에 맞게 유연하게 판단한다.

**프로파일만으로 충분한 경우 (대부분):**
- 필드 매핑 규칙 도출
- 코드 생성
- Dry-run 검증

**원본 재참조가 필요한 경우:**
- 프로파일에 담기지 않은 세부 맥락이 필요할 때
  → 원본의 **해당 섹션만** 선택적으로 읽기
- 사용자가 "이 필드 설명 좀 더 자세히 봐줘" 요청 시
  → 원본에서 해당 필드 관련 부분 참조
- 매핑 중 모호성 해소에 추가 컨텍스트가 필요할 때
  → 원본에서 해당 필드의 비즈니스 설명 확인
- API 문서가 업데이트되었을 때
  → 변경된 부분만 재분석하여 프로파일 갱신
- 프로파일 분석이 부정확했다고 판단될 때
  → 해당 부분 원본 재확인 후 프로파일 수정

**기본 방침:**
- 매번 원본 전체를 처음부터 읽지 않는다 (비효율)
- 하지만 필요하면 원본의 특정 부분을 언제든 다시 참조한다 (유연함)
- 무조건적인 규칙은 없다 — **상황에 맞게 판단**

### 2.7 작업 흐름의 유연성

모든 단계는 **되돌아가거나 건너뛸 수 있어야** 한다:

```
정보 수집 ←→ 매핑 규칙 도출 ←→ 코드 생성 ←→ 검증
   ↑              ↑                ↑            ↑
   └──────────────┴────────────────┴────────────┘
          어느 단계에서든 수정/재시작 가능
```

- 코드 생성 후에도 매핑 규칙 수정 가능 → 코드 재생성
- 검증 중 문제 발견 시 → 정보 수집 단계로 돌아가 추가 자료 요청
- 타겟 구조 변경 시 → 매핑 규칙만 업데이트하고 코드 재생성
- **사용자가 원하는 시점에 원하는 단계로 자유롭게 이동**

---

## 3. 플러그인 아키텍처

### 3.1 플러그인 형태: MCP 서버 + Skill 하이브리드

```
┌─────────────────────────────────────────────────────┐
│                  Claude Code                         │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │  Skill Layer  │────▶│  /api-convert (워크플로우) │  │
│  │  (진입점)     │     │  /api-map (빠른 매핑)     │  │
│  └──────────────┘     │  /api-test (테스트 실행)   │  │
│                        └──────────┬───────────────┘  │
│                                   │                   │
│  ┌──────────────┐     ┌──────────▼───────────────┐  │
│  │  MCP Server   │────▶│  Core Tools               │  │
│  │  (핵심 엔진)  │     │  - analyze_api_response   │  │
│  └──────────────┘     │  - generate_mapping       │  │
│                        │  - execute_api_call       │  │
│                        │  - validate_mapping       │  │
│                        │  - manage_history         │  │
│                        └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**선택 근거:**
- **MCP 서버**: 핵심 변환 엔진을 독립적인 도구(tool)로 제공 → Claude가 자유롭게 조합 호출 가능
- **Skill**: 복잡한 워크플로우를 가이드하는 진입점 제공 → 사용자 경험 향상
- **하이브리드 이점**: MCP tool을 직접 호출하거나, Skill을 통해 가이드된 플로우를 따를 수 있어 유연성 극대화

### 3.2 기술 스택

| 구분 | 기술 | 선택 근거 |
|------|------|-----------|
| 플러그인 런타임 | **TypeScript + Node.js** | Claude Code MCP 서버 표준, 타입 안전성, npm 생태계 |
| MCP SDK | `@modelcontextprotocol/sdk` | 공식 MCP 서버 구현 SDK |
| API 호출 | `undici` (Node.js 내장) | 별도 의존성 없이 고성능 HTTP 클라이언트 |
| 스키마 파싱 | `@apidevtools/swagger-parser` | OpenAPI/Swagger 파싱 |
| 코드 생성 | `ts-morph` (선택적) | AST 기반 코드 생성 시 활용 |
| 설정 포맷 | JSON, YAML | 매핑 규칙 저장 |

### 3.3 디렉토리 구조

```
api-convert-plugin/
├── src/
│   ├── mcp/                    # MCP 서버 구현
│   │   ├── server.ts           # MCP 서버 엔트리포인트
│   │   ├── tools/              # MCP Tool 정의
│   │   │   ├── analyze.ts      # API 응답 분석 도구
│   │   │   ├── mapping.ts      # 매핑 생성 도구
│   │   │   ├── execute.ts      # API 호출 실행 도구
│   │   │   ├── validate.ts     # 매핑 검증 도구
│   │   │   └── history.ts      # 히스토리 관리 도구
│   │   └── resources/          # MCP Resource 정의
│   │       ├── mappings.ts     # 저장된 매핑 규칙 리소스
│   │       └── templates.ts    # 코드 생성 템플릿 리소스
│   │
│   ├── skill/                  # Skill(슬래시 커맨드) 정의
│   │   ├── api-convert.md      # /api-convert 메인 워크플로우
│   │   ├── api-map.md          # /api-map 빠른 매핑
│   │   └── api-test.md         # /api-test 테스트 실행
│   │
│   ├── core/                   # 핵심 비즈니스 로직
│   │   ├── analyzer/           # API 응답 분석 엔진
│   │   │   ├── response-parser.ts    # 응답 구조 파싱
│   │   │   ├── schema-detector.ts    # 스키마 자동 감지
│   │   │   ├── swagger-parser.ts     # Swagger/OpenAPI 파싱
│   │   │   └── doc-parser.ts         # API 문서 파싱
│   │   │
│   │   ├── mapper/             # 매핑 엔진
│   │   │   ├── field-mapper.ts       # 필드 매핑 로직
│   │   │   ├── type-converter.ts     # 타입 변환 로직
│   │   │   ├── nested-handler.ts     # 중첩 객체 처리
│   │   │   ├── array-handler.ts      # 배열 변환 처리
│   │   │   ├── conditional-mapper.ts # 조건부 매핑
│   │   │   └── ambiguity-detector.ts # 모호성 감지 & 사용자 확인
│   │   │
│   │   ├── generator/          # 코드 생성 엔진
│   │   │   ├── code-generator.ts     # 코드 생성 인터페이스
│   │   │   ├── templates/            # 언어별 템플릿
│   │   │   │   ├── typescript.ts
│   │   │   │   ├── php.ts
│   │   │   │   ├── java.ts
│   │   │   │   ├── python.ts
│   │   │   │   ├── kotlin.ts
│   │   │   │   └── go.ts
│   │   │   └── format/               # 출력 포맷별
│   │   │       ├── json-output.ts
│   │   │       ├── xml-output.ts
│   │   │       └── yaml-output.ts
│   │   │
│   │   ├── executor/           # API 실행 엔진
│   │   │   ├── api-caller.ts         # HTTP 요청 실행
│   │   │   ├── auth-handler.ts       # 인증 처리
│   │   │   └── response-capture.ts   # 응답 캡처 & 저장
│   │   │
│   │   ├── validator/          # 검증 엔진
│   │   │   ├── dry-run.ts            # Dry-run 시뮬레이션
│   │   │   ├── test-generator.ts     # 테스트 코드 생성
│   │   │   └── diff-checker.ts       # 매핑 전후 비교
│   │   │
│   │   └── history/            # 히스토리 관리
│   │       ├── version-manager.ts    # 버전 관리
│   │       ├── change-logger.ts      # 변경 로그
│   │       └── storage.ts            # 파일 저장/로드
│   │
│   ├── reference/              # 참조 소스 분석
│   │   ├── codebase-scanner.ts       # 기존 코드베이스 스캔
│   │   ├── dto-detector.ts           # DTO/Model 자동 감지
│   │   └── pattern-analyzer.ts       # 기존 매핑 패턴 분석
│   │
│   └── utils/                  # 유틸리티
│       ├── config.ts           # 설정 관리
│       ├── env-reader.ts       # .env 파일 읽기 (보안)
│       └── types.ts            # 공통 타입 정의
│
├── templates/                  # 테스트 페이지 템플릿
│   ├── test-page.html          # HTML 테스트 페이지 템플릿
│   └── cli-test.ts             # CLI 테스트 스크립트 템플릿
│
├── .api-convert/               # 프로젝트별 저장 디렉토리 (사용처)
│   ├── config.json             # 플러그인 전역 설정
│   ├── profiles/               # 소스 분석 결과 (API → 압축 프로파일)
│   │   └── {api-name}.profile.json
│   ├── targets/                # 타겟 분석 결과 (DTO/Model → 압축 요약)
│   │   └── {target-name}.target.json
│   ├── mappings/               # 매핑 규칙 저장 (1:N 관계)
│   │   └── {api-name}/
│   │       └── {target-name}.mapping.json
│   ├── history/                # 변경 히스토리
│   │   └── {api-name}/
│   │       └── {target-name}.history.json
│   └── editors/                # 비주얼 매핑 에디터 HTML
│       └── {mapping-name}.editor.html
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. 핵심 기능 상세

### 4.1 Phase 1: API 정보 수집 & 응답 분석

#### 4.1.1 지원 입력 소스

| 입력 방식 | 설명 | 처리 방법 |
|-----------|------|-----------|
| **Swagger/OpenAPI Spec** | JSON/YAML 형식의 API 명세서 | `swagger-parser`로 파싱 → 엔드포인트별 요청/응답 스키마 추출 |
| **API 가이드 문서** | PDF, MD, HTML 등 비정형 문서 | Claude가 문서를 읽고 구조화된 정보 추출 |
| **샘플 Request/Response** | JSON 형식의 예시 데이터 | JSON 구조 분석 → 필드 타입 추론 |
| **curl 명령어** | 직접 API 호출 | curl 파싱 → 실행 → 실제 응답 캡처 |
| **API URL 직접 입력** | endpoint URL 제공 | 직접 호출 → 응답 분석 |
| **Git 저장소** | API 관련 소스코드 | 코드 분석 → API 인터페이스 추출 |
| **XML/SOAP 응답** | XML 형식 API 응답 | XML 파싱 → JSON 정규화 → 동일 파이프라인 처리 |

#### 4.1.2 응답 분석 프로세스

```
입력 소스 수집
    │
    ▼
┌─────────────────────────┐
│  1. 입력 소스 정규화     │  다양한 입력을 통일된 내부 포맷으로 변환
│     (Source Normalizer)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  2. 스키마 추출          │  필드명, 타입, 중첩구조, 필수/선택 등 추출
│     (Schema Extractor)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  3. 실제 데이터 검증     │  curl/URL 호출로 실제 응답과 스키마 비교
│     (Live Validation)    │  (선택적 - 인증 필요 시 사용자 확인)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  4. API 프로파일 생성    │  통합된 API 정보 프로파일 문서 생성
│     (Profile Generator)  │
└─────────────────────────┘
```

#### 4.1.3 API 프로파일 데이터 구조

```typescript
interface ApiProfile {
  id: string;                            // 고유 식별자 (예: "payment-api")
  name: string;                          // API 표시명 (예: "PG사 결제 API")
  version?: string;                      // API 버전 (예: "2.1")
  baseUrl: string;                       // 기본 URL
  endpoints: ApiEndpoint[];              // 엔드포인트 목록
  authentication: AuthConfig;            // 인증 설정
  analyzedFrom: {
    sourceType: InputSourceType;         // 입력 소스 유형
    originalPath?: string;               // 원본 문서 경로
    originalSize?: string;               // 원본 크기 정보
    analyzedAt: string;                  // 분석 시점
  };
  metadata: {
    confidence: number;                  // 분석 신뢰도 (0-1)
    documentUrl?: string;                // 원본 문서 URL (있을 경우)
  };
  notes?: string[];                      // 분석 시 발견한 주의사항
}

interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description?: string;
  request: {
    headers?: Record<string, FieldSchema>;
    queryParams?: Record<string, FieldSchema>;
    body?: ObjectSchema;
  };
  response: {
    statusCodes: Record<number, ObjectSchema>;  // 상태코드별 응답 스키마
  };
}

interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';
  nullable: boolean;
  required: boolean;
  description?: string;
  example?: any;
  children?: Record<string, FieldSchema>;  // object인 경우
  items?: FieldSchema;                      // array인 경우
  enum?: any[];                             // 가능한 값 목록
  format?: string;                          // date, email, uuid 등
}
```

### 4.2 Phase 2: 매핑 참조 소스 분석

#### 4.2.1 참조 소스 우선순위

```
1순위: 사용자가 직접 지정한 DTO/Model 파일
    ↓ (없으면)
2순위: 프로젝트 코드베이스에서 자동 감지된 관련 DTO/Model
    ↓ (없으면)
3순위: 기존 매핑 코드 패턴 분석 (프로젝트 내 유사한 매핑이 있는지)
    ↓ (없으면)
4순위: 사용자에게 목표 구조를 질문하여 새로 정의
```

#### 4.2.2 코드베이스 스캔 전략

```typescript
interface CodebaseScanConfig {
  // DTO/Model 탐지 패턴
  dtoPatterns: {
    // 파일명 패턴: *Dto.ts, *Model.php, *Response.java 등
    filePatterns: string[];
    // 코드 패턴: interface, class, @Entity, dataclass 등
    codePatterns: RegExp[];
    // 디렉토리 패턴: dto/, models/, entities/ 등
    directoryPatterns: string[];
  };

  // 기존 매핑 코드 탐지
  mapperPatterns: {
    filePatterns: string[];      // *Mapper.ts, *Converter.php 등
    codePatterns: RegExp[];      // .map(), transform(), convert() 등
  };

  // 언어별 설정
  languageConfig: {
    language: SupportedLanguage;
    typeSystem: 'static' | 'dynamic';
    dtoConventions: string[];
  };
}
```

#### 4.2.3 지원 언어별 DTO 감지

| 언어 | 감지 대상 | 패턴 |
|------|-----------|------|
| TypeScript | interface, type, class | `interface *Dto`, `type *Response` |
| PHP | class (with typed properties) | `class *Dto`, `class *Model` |
| Java | class, record | `class *Dto`, `record *Response` |
| Kotlin | data class | `data class *Dto` |
| Python | dataclass, Pydantic BaseModel | `@dataclass`, `class *(BaseModel)` |
| Go | struct | `type * struct` |

### 4.3 Phase 3: 매핑 규칙 생성

#### 4.3.1 매핑 규칙 데이터 구조

**핵심 관계: 1개의 API 프로파일(소스)에 N개의 매핑 규칙(타겟)이 연결**

```
ApiProfile (소스)          MappingRule (타겟별)
┌─────────────────┐       ┌──────────────────────┐
│ 배송 API         │──1:N──│ 이커머스용 매핑        │
│                  │       │ 물류시스템용 매핑       │
│                  │       │ 고객앱용 매핑          │
└─────────────────┘       └──────────────────────┘
```

```typescript
interface MappingRule {
  id: string;                        // 고유 ID
  version: number;                   // 버전
  name: string;                      // 매핑명 (예: "배송API→이커머스 주문")
  description?: string;

  source: {
    apiProfileId: string;            // API 프로파일 참조 (1:N에서 1)
    endpoint: string;                // 대상 엔드포인트
    responseCode: number;            // 대상 응답 코드
  };

  target: {
    businessContext: string;         // 비즈니스 컨텍스트 (예: "이커머스", "물류")
    language: SupportedLanguage;     // 대상 언어
    filePath?: string;               // 대상 파일 경로
    typeName: string;                // 대상 타입/클래스명
    targetProfileId?: string;        // 타겟 프로파일 참조
  };

  fieldMappings: FieldMapping[];     // 필드별 매핑 규칙

  metadata: {
    createdAt: string;
    updatedAt: string;
    confidence: number;              // 자동 매핑 신뢰도
    userVerified: boolean;           // 사용자 검증 여부
    ambiguousFields: string[];       // 모호한 필드 목록
    derivedFrom?: string;            // 다른 매핑에서 파생된 경우 원본 ID
  };
}

interface FieldMapping {
  sourceField: string | string[] | null;  // 원본 필드 경로 (dot notation: "data.user.name")
                                          // string[]: 여러 필드 조합 (주소 합성 등)
                                          // null: 소스에 없는 필드 (하드코딩/기본값)
  targetField: string;               // 대상 필드 경로

  transformation: {
    type: TransformationType;
    config?: TransformConfig;
  };

  confidence: number;                // 이 매핑의 신뢰도
  isAmbiguous: boolean;              // 모호성 플래그
  userNote?: string;                 // 사용자 메모
}

type TransformationType =
  | 'direct'                         // 직접 매핑 (타입 동일)
  | 'type_cast'                      // 타입 변환 (string → number)
  | 'rename'                         // 필드명만 변경
  | 'nested_extract'                 // 중첩 객체에서 추출
  | 'array_map'                      // 배열 내 각 요소 변환
  | 'array_flatten'                  // 배열 평탄화
  | 'array_to_object'               // 배열 → 객체 구조 변환
  | 'object_merge'                   // 여러 필드를 하나로 합침
  | 'conditional'                    // 조건부 변환
  | 'computed'                       // 계산된 값 (여러 필드 조합)
  | 'constant'                       // 상수값 할당 (하드코딩)
  | 'default_value'                  // 소스에 없을 때 기본값
  | 'format'                         // 포맷 변환 (날짜, 통화 등)
  | 'restructure'                    // 구조 자체를 재조합
  | 'custom';                        // 사용자 정의 변환 로직

// --- 보조 타입 정의 ---

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

type SupportedLanguage = 'typescript' | 'php' | 'java' | 'kotlin' | 'python' | 'go';

type InputSourceType = 'swagger' | 'json_sample' | 'curl' | 'url' | 'document' | 'git';

interface ObjectSchema {
  type: 'object';
  children: Record<string, FieldSchema>;
  description?: string;
}

interface AuthConfig {
  type: 'bearer' | 'api_key' | 'basic' | 'oauth' | 'custom';
  tokenSource?: string;              // 토큰 출처 (env, user_input 등)
  notes?: string;                    // 인증 관련 참고사항
}

interface TransformConfig {
  // 타입별 설정
  value?: any;                       // constant, default_value 용
  fallback?: any;                    // default_value 용
  expression?: string;               // computed 용
  mapping?: Record<string, any>;     // conditional 용 (코드 매핑 테이블)
  strategy?: string;                 // restructure 용
  pattern?: string;                  // restructure 용
  unmatchedStrategy?: 'throw' | 'null' | 'passthrough';  // conditional 용
  [key: string]: any;                // 확장 가능
}

// --- 타겟 프로파일 ---

interface TargetProfile {
  id: string;                            // 고유 식별자 (예: "order-payment-dto")
  name: string;                          // 표시명 (예: "OrderPaymentDto")
  analyzedFrom: {
    sourceType: 'dto_file' | 'code_scan' | 'user_defined' | 'document';
    originalPath?: string;               // 원본 파일 경로
    analyzedAt: string;
  };
  language: SupportedLanguage;
  fields: Record<string, TargetFieldSchema>;
}

interface TargetFieldSchema extends FieldSchema {
  businessContext?: {                     // 비즈니스 맥락 (필요한 경우만)
    meaning?: string;                    // 비즈니스 의미
    constraints?: string;                // 제약 조건
    source?: string;                     // 정보 출처
    caution?: string;                    // 주의사항
    codeMapping?: Record<string, string>; // 코드 매핑 테이블
  };
}

// --- 기타 참조 타입 ---

interface VersionDiff {
  version1: number;
  version2: number;
  changes: {
    field: string;
    type: 'add' | 'modify' | 'remove';
    before?: any;
    after?: any;
  }[];
}

type GeneratedTest = {
  framework: string;                     // jest, phpunit 등
  code: string;                          // 생성된 테스트 코드
  filePath: string;                      // 저장 경로
};

type TestPagePath = string;              // 생성된 HTML 테스트 페이지 경로
```

#### 4.3.2 소스에 없는 필드 처리 (필수값/기본값/하드코딩)

외부 API에 없는 정보인데 비즈니스 모델에서 필요한 경우가 반드시 존재한다. **분석 단계에서 이를 반드시 캐치**해야 한다.

**판단 흐름:**

```
타겟의 각 필드에 대해:
    │
    ├─ 소스에 대응 필드 존재함 → 정상 매핑
    │
    └─ 소스에 대응 필드 없음
        │
        ├─ 타겟에서 nullable? → YES → null 허용으로 처리 가능
        │                      → 사용자에게 확인: "null로 둬도 괜찮을까요?"
        │
        ├─ 기본값이 정의되어 있음? → YES → 기본값 사용
        │   (DTO, 문서, 코드에서 파악)
        │
        ├─ 비즈니스에서 필수값? → YES → 하드코딩 또는 사용자 지정 필요
        │   │
        │   └─ 사용자에게 요청:
        │       "target.regionCode는 필수값인데 소스 API에 없습니다.
        │        고정값을 지정하거나, 다른 필드에서 유도할 수 있을까요?"
        │
        └─ 판단 불가 → 사용자에게 질문:
            "target.priority 필드: 소스에 없습니다.
             어떻게 처리할까요? (null / 기본값 / 하드코딩 / 다른 필드에서 유도)"
```

**FieldMapping에서의 표현:**

```typescript
// 소스에 없는 필드의 매핑 예시들:

// 1) 하드코딩 - 고정값 할당
{
  sourceField: null,                    // 소스에 없음
  targetField: "order.regionCode",
  transformation: { type: "constant", config: { value: "KR" } },
  userNote: "국내 전용 서비스이므로 KR 고정"
}

// 2) 기본값 - 소스에 없을 때 fallback
{
  sourceField: "shop.priority",         // 소스에 있을 수도, 없을 수도
  targetField: "location.priority",
  transformation: { type: "default_value", config: { fallback: 0 } },
  userNote: "priority 없으면 0으로"
}

// 3) null 허용
{
  sourceField: null,
  targetField: "location.description",
  transformation: { type: "constant", config: { value: null } },
  userNote: "nullable 필드, 외부 API에 해당 정보 없음"
}

// 4) 다른 필드에서 유도
{
  sourceField: "shop.name",
  targetField: "location.slug",
  transformation: { type: "computed", config: { expression: "slugify(shop.name)" } },
  userNote: "name에서 slug 자동 생성"
}
```

**분석 단계에서의 필수 체크:**
- 타겟 프로파일 분석 시 각 필드의 **required/nullable/default** 속성을 반드시 추출
- 매핑 규칙 생성 시 **소스 미존재 + 타겟 필수** 조합을 자동 감지
- 해당 필드에 대해 사용자에게 처리 방법을 반드시 확인

#### 4.3.3 구조 불일치 처리 (복잡한 변환)

외부 API의 데이터 구조가 비즈니스 모델과 **근본적으로 다른 형태**인 경우가 흔하다. 단순 필드명 변경이 아닌, 데이터 구조 자체를 재조합해야 한다.

**예시: 영업시간 매핑**

```
외부 API (요일별 개별 필드):
{
  "operating_hours": {
    "mon_open": "08:00",
    "mon_close": "23:00",
    "tue_open": "10:00",
    "tue_close": "22:00",
    "wed_open": "09:00",
    "wed_close": "21:00",
    ...
  }
}

비즈니스 모델 (구조화된 배열):
{
  "businessHours": [
    { "day": "monday",    "open": "08:00", "close": "23:00" },
    { "day": "tuesday",   "open": "10:00", "close": "22:00" },
    { "day": "wednesday", "open": "09:00", "close": "21:00" },
    ...
  ]
}
```

→ 이건 단순 필드명 변경이 아님. **개별 필드들을 배열 구조로 재조합**해야 함.

**예시: 주소 합성**

```
외부 API (분리된 필드):
{
  "addr_sido": "서울특별시",
  "addr_sigungu": "강남구",
  "addr_dong": "역삼동",
  "addr_detail": "123-4"
}

비즈니스 모델 (단일 필드):
{
  "address": "서울특별시 강남구 역삼동 123-4"
}
```

→ 여러 필드를 **합쳐서 하나로** 만들어야 함.

**예시: 코드 → 의미값 변환**

```
외부 API:
{ "status_cd": "01" }

비즈니스 모델:
{ "status": "ACTIVE" }

매핑 규칙: "01"→"ACTIVE", "02"→"INACTIVE", "99"→"DELETED"
→ 이 매핑 테이블은 어디서 오는가? 문서에서? 사용자 지정?
```

**플러그인의 대응 전략:**

```
구조 불일치 감지
    │
    ├─ 자동 판단 가능한 경우
    │   ├─ 패턴 인식: mon_open/mon_close 같은 반복 패턴 감지
    │   ├─ 문서에 변환 규칙이 명시됨
    │   └─ 기존 코드에 유사한 변환 로직이 존재
    │       → 변환 로직 제안 → 사용자 확인
    │
    ├─ 부분적으로 판단 가능한 경우
    │   ├─ 구조는 파악했지만 세부 규칙이 불명확
    │   └─ "영업시간을 배열로 변환하는 것은 맞는데,
    │       요일 순서나 휴무일 처리는 어떻게 할까요?"
    │       → 사용자에게 세부 규칙 확인
    │
    └─ 판단 불가능한 경우
        ├─ 구조가 너무 달라서 자동 추론 불가
        └─ 사용자에게 변환 로직 설명 요청
            "이 필드들을 어떤 구조로 변환해야 하나요?"
            → 사용자 설명 기반으로 매핑 규칙 생성
            → 또는 사용자가 추후 직접 코드 수정하도록 TODO 마킹
```

**FieldMapping에서의 표현:**

```typescript
// 구조 재조합 매핑 예시:

// 영업시간 변환 (개별 필드 → 배열)
{
  sourceField: "operating_hours.*",          // 와일드카드: 하위 필드 전체
  targetField: "businessHours",
  transformation: {
    type: "restructure",
    config: {
      strategy: "fields_to_array",
      pattern: "{day}_open, {day}_close → { day, open, close }",
      dayMapping: { "mon": "monday", "tue": "tuesday", ... }
    }
  },
  confidence: 0.7,                           // 자동 추론 → 사용자 확인 필요
  isAmbiguous: true,
  userNote: "휴무일(값 없음) 처리 확인 필요"
}

// 주소 합성 (여러 필드 → 하나)
{
  sourceField: ["addr_sido", "addr_sigungu", "addr_dong", "addr_detail"],
  targetField: "address",
  transformation: {
    type: "computed",
    config: { expression: "join(' ', addr_sido, addr_sigungu, addr_dong, addr_detail)" }
  }
}

// 코드 → 의미값 매핑
{
  sourceField: "status_cd",
  targetField: "status",
  transformation: {
    type: "conditional",
    config: {
      mapping: { "01": "ACTIVE", "02": "INACTIVE", "99": "DELETED" },
      unmatchedStrategy: "throw"             // 또는 "null", "passthrough"
    }
  },
  userNote: "코드 매핑 테이블은 API 문서 p.23 참조"
}
```

**핵심 원칙:**
- 일차원적으로 생각하지 않는다 — 모든 경우의 수를 염두
- 자동 판단이 가능한 건 제안하되, **반드시 사용자 확인**
- 너무 복잡한 변환은 무리하게 자동화하지 않고 **사용자에게 설명을 요청**하거나 **추후 수정 가능하도록 TODO 마킹**
- 생성된 코드에 복잡한 변환 로직이 포함되면 **주석으로 의도를 명시**

#### 4.3.4 모호성 감지 & 해소 프로세스

```
자동 매핑 시도
    │
    ├─ 신뢰도 ≥ 90% → ✅ 자동 매핑 확정
    │
    ├─ 신뢰도 50~89% → ⚠️ 모호성 플래그
    │   │
    │   └─ 사용자에게 확인 요청
    │       "source.user_nm → target.userName 으로 매핑할까요?"
    │       "또는 target.fullName 이 더 적합할까요?"
    │
    └─ 신뢰도 < 50% → ❓ 수동 매핑 요청
        │
        └─ 사용자에게 직접 지정 요청
            "source.ext_cd 필드의 매핑 대상을 지정해주세요"
```

**모호성 판단 기준:**
- 필드명 유사도 (Levenshtein distance, semantic similarity)
- 타입 호환성
- 위치적 유사성 (같은 레벨의 구조)
- 기존 매핑 패턴과의 일관성

#### 4.3.5 사용자 인터랙션 플로우

```
┌────────────────────────────────────────────────────────────────┐
│  매핑 결과 프리뷰                                                │
│                                                                  │
│  ✅ 확정 매핑 (12개)                                             │
│  ├─ response.data.id        → OrderDto.id           (직접)     │
│  ├─ response.data.amount    → OrderDto.totalPrice   (타입변환) │
│  └─ ...                                                         │
│                                                                  │
│  ⚠️ 확인 필요 (3개)                                              │
│  ├─ response.data.usr_nm    → ? (userName / fullName)           │
│  ├─ operating_hours.*       → businessHours[] (구조 재조합)     │
│  └─ response.data.status_cd → status (코드→의미값 변환)         │
│                                                                  │
│  🔧 소스 없음 - 처리 필요 (2개)                                  │
│  ├─ (없음) → OrderDto.regionCode  [필수] → 하드코딩? 기본값?    │
│  └─ (없음) → OrderDto.priority    [선택] → null? 기본값 0?      │
│                                                                  │
│  ❌ 매핑 불가 (1개)                                               │
│  └─ response.data.legacy_cd → 대상 필드 없음                    │
│                                                                  │
│  [수정하기] [확인하고 진행] [전체 다시 매핑]                      │
└────────────────────────────────────────────────────────────────┘
```

### 4.4 Phase 4: 코드/결과물 생성

#### 4.4.1 코드 생성 원칙

**1. 과도한 메소드 분리 금지**

생성되는 매핑 코드는 목적에 알맞은 단위로 구성한다. 불필요하게 메소드를 쪼개지 않는다.

```
❌ 안 좋은 예 (과도한 분리):
mapShopToLocation(res)
  → extractShopName(res)        // 불필요한 분리
  → convertShopAddress(res)     // 한 줄짜리를 함수로 뺌
  → transformOpenDate(res)      // 과도한 추상화
  → mapBranches(res)            // 단순 배열 매핑을 별도 함수로

✅ 좋은 예 (목적에 맞는 단위):
mapShopToLocation(res)          // 하나의 매핑 단위에 변환 로직이 응집
  → 내부에서 직접 필드 매핑 수행
  → 복잡한 변환이 있을 때만 별도 헬퍼 (예: 복잡한 enum 변환, 재귀 구조)
```

**메소드 분리 기준:**
- 단순 필드명 변경, 타입 캐스팅 → **매핑 함수 내부에서 인라인 처리**
- 반복 사용되는 복잡한 변환 로직 → **별도 유틸리티로 분리 허용**
- 중첩 객체 내 배열의 각 요소가 독립적인 매핑 대상일 때 → **별도 매핑 함수 허용**

**2. 사용자의 기존 규격/패턴 우선**

생성 코드의 구조, 네이밍, 패턴은 플러그인이 결정하는 것이 아니라 **사용자의 기존 코드/DTO/문서가 결정**한다.

```
참조 우선순위:
1순위: 사용자가 제공한 DTO/Model 파일의 구조를 그대로 따름
2순위: 사용자가 제공한 규격 문서의 정의를 따름
3순위: 프로젝트의 기존 매핑 코드 패턴을 분석하여 동일한 스타일로 생성
4순위: 위 참조가 없을 때만 플러그인의 기본 템플릿 사용
```

**구체적 준수 사항:**
- 사용자 DTO에 정의된 필드명/타입 → 그대로 사용 (임의 변경 금지)
- 사용자 프로젝트의 네이밍 컨벤션 → 감지하여 동일하게 적용
- 사용자 프로젝트의 코드 패턴 → 함수형/OOP/빌더 등 기존 패턴 따름
- 사용자 문서에 명시된 변환 규칙 → 문서 내용을 정확히 반영

```
예: 사용자의 기존 프로젝트가 이런 패턴이면

// 기존 프로젝트의 매퍼 패턴
class PaymentMapper {
    public static function fromApi(array $data): PaymentDto {
        return new PaymentDto(
            amount: (int) $data['pay_amt'],
            method: $data['pay_method'],
        );
    }
}

// 생성되는 코드도 동일한 패턴을 따라야 함 ✅
class ShopMapper {
    public static function fromApi(array $data): LocationDto {
        return new LocationDto(
            name: $data['shop']['name'],
            address: $data['shop']['addr'],
        );
    }
}
```

#### 4.4.2 주요 결과물: 변환 코드 생성

**핵심 결과물은 변환 함수/클래스 코드**이며, 필요에 따라 보조 결과물도 생성:

| 결과물 유형 | 우선순위 | 설명 | 예시 |
|-------------|----------|------|------|
| **Mapper 함수** | **핵심** | 외부 응답 → 내부 모델 변환 함수 | `mapShopToLocation(shop) → Location` |
| **Mapper 클래스** | **핵심** | OOP 패턴의 변환 클래스 | `ShopMapper::toLocation($shop)` |
| **DTO/Type 정의** | 보조 | 타겟 타입이 없을 때 새로 생성 | `interface Location { ... }` |
| **변환 유틸리티** | 보조 | 재사용 가능한 타입/포맷 변환 헬퍼 | `convertDate()`, `parseEnum()` |

#### 4.4.3 언어별 코드 생성 예시 (shop → location 매핑)

**TypeScript:**
```typescript
// generated: shop-to-location.mapper.ts
import { Location } from './models/Location';

interface ShopApiResponse {
  shop: {
    name: string;
    addr: string;
    tel: string;
    open_dt: string;
    branches: { branch_nm: string; branch_cd: string }[];
  };
}

export function mapShopToLocation(response: ShopApiResponse): Location {
  return {
    name: response.shop.name,                           // 직접 매핑
    address: response.shop.addr,                         // 필드명 변경
    phone: response.shop.tel,                            // 필드명 변경
    openedAt: new Date(response.shop.open_dt),           // 필드명 변경 + 타입 변환
    branches: response.shop.branches.map(b => ({         // 배열 매핑
      name: b.branch_nm,
      code: b.branch_cd,
    })),
  };
}
```

**PHP:**
```php
// generated: ShopMapper.php
class ShopMapper {
    public static function toLocation(array $response): LocationDto {
        $shop = $response['shop'];
        return new LocationDto(
            name: $shop['name'],                                      // 직접 매핑
            address: $shop['addr'],                                   // 필드명 변경
            phone: $shop['tel'],                                      // 필드명 변경
            openedAt: new \DateTimeImmutable($shop['open_dt']),       // 타입 변환
            branches: array_map(                                      // 배열 매핑
                fn($b) => new BranchDto(name: $b['branch_nm'], code: $b['branch_cd']),
                $shop['branches']
            ),
        );
    }
}
```

**Java:**
```java
// generated: ShopMapper.java
public class ShopMapper {
    public static Location toLocation(ShopApiResponse response) {
        var shop = response.getShop();
        return Location.builder()
            .name(shop.getName())                                     // 직접 매핑
            .address(shop.getAddr())                                  // 필드명 변경
            .phone(shop.getTel())                                     // 필드명 변경
            .openedAt(LocalDate.parse(shop.getOpenDt()))              // 타입 변환
            .branches(shop.getBranches().stream()                     // 배열 매핑
                .map(b -> Branch.of(b.getBranchNm(), b.getBranchCd()))
                .toList())
            .build();
    }
}
```

**Python:**
```python
# generated: shop_mapper.py
from models import Location, Branch
from datetime import date

def map_shop_to_location(response: dict) -> Location:
    shop = response["shop"]
    return Location(
        name=shop["name"],                                           # 직접 매핑
        address=shop["addr"],                                        # 필드명 변경
        phone=shop["tel"],                                           # 필드명 변경
        opened_at=date.fromisoformat(shop["open_dt"]),               # 타입 변환
        branches=[                                                   # 배열 매핑
            Branch(name=b["branch_nm"], code=b["branch_cd"])
            for b in shop["branches"]
        ],
    )
```

#### 4.4.4 출력 포맷 지원

| 포맷 | 용도 | 생성 방식 |
|------|------|-----------|
| JSON | API 간 데이터 교환, 설정 파일 | JSON 직렬화 |
| XML | 레거시 시스템 연동, SOAP | XML 빌더 |
| YAML | 설정 파일, 문서화 | YAML 직렬화 |
| 소스코드 | 프로젝트에 직접 적용 | 언어별 코드 생성기 |

### 4.5 Phase 5: 사용자 수정 & 검증

사용자의 매핑 수정은 **어떤 경로든** 유연하게 가능해야 한다. 특정 방법만 강제하지 않는다.

```
┌─────────────────────────────────────────────────────────────┐
│  매핑 수정 경로 (어떤 것이든 가능, 조합도 가능)                  │
│                                                              │
│  경로 A: 대화형 수정                                          │
│  └─ Claude Code 대화에서 "shop.tel은 location.contact로 바꿔" │
│                                                              │
│  경로 B: 비주얼 매핑 에디터 (HTML)                            │
│  └─ 브라우저에서 시각적으로 확인/수정 → JSON 내보내기           │
│                                                              │
│  경로 C: JSON 직접 수정                                       │
│  └─ .mapping.json 파일을 사용자가 직접 편집                   │
│                                                              │
│  경로 D: 코드 수정 후 역반영                                   │
│  └─ 생성된 매퍼 코드를 직접 수정 → 매핑 규칙에 반영 요청       │
│                                                              │
│  → 어떤 경로든 변경사항은 동일하게 추적됨                       │
│  → 수정 후 코드 재생성 여부는 사용자가 결정                     │
└─────────────────────────────────────────────────────────────┘
```

#### 4.5.1 비주얼 매핑 에디터

플러그인이 생성하는 **정적 HTML 파일**로, 브라우저에서 매핑 현황을 시각적으로 확인하고 수정할 수 있다.

**구현 방식: 정적 HTML + JS (서버 불필요)**

```
기본 흐름:
1. 플러그인이 현재 매핑 상태를 JSON으로 HTML에 임베드
2. 사용자가 브라우저에서 .html 파일을 열어 확인/수정
3. 수정 완료 후 "내보내기" → 수정된 JSON 저장/다운로드
4. 플러그인에 수정 반영 요청

적용 방법 (사용자가 자유롭게 선택):
- 대화에서 "수정 파일 적용해줘" → 파일 읽어서 반영
- 대화에서 "에디터에서 A를 B로 바꿨어" → 대화 기반으로 반영
- 직접 .mapping.json에 복사 → 다음 작업 시 자동 반영
- 에디터는 사용하지 않고 대화로만 수정 → 에디터 없이도 완전히 동작
```

**에디터는 보조 수단이지 필수가 아니다.** 사용하지 않아도 모든 기능이 대화로 가능하다.

**UI 구성:**

```
┌─────────────────────────────────────────────────────────────┐
│  API Convert - 매핑 에디터           [내보내기] [되돌리기]    │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                       │
│  소스 (외부 API)      │  타겟 (비즈니스 모델)                 │
│                      │                                       │
│  shop                │  location                             │
│  ├─ name ──────────────────→ name           ✅              │
│  ├─ addr ──────────────────→ address        ✅              │
│  ├─ tel  ─ ─ ─ ─ ─ ─ ─ ─ → phone          ⚠️ (수정 가능)  │
│  ├─ open_dt ───────────────→ openedAt       ✅ (타입변환)   │
│  └─ ext_cd                  ╳ (매핑 없음)   ❌              │
│                      │                                       │
│                      │  contact  (미매핑)                     │
│                      │  region   (미매핑)                     │
│                      │                                       │
├──────────────────────┴──────────────────────────────────────┤
│  조작 방법:                                                   │
│  • 연결선 드래그: 소스 필드에서 타겟 필드로 드래그하여 매핑    │
│  • 연결선 삭제: 기존 연결선 클릭 후 Delete                    │
│  • 변환 규칙: 연결선 클릭 시 변환 옵션 팝업 (타입변환 등)     │
│  • 필드 상세: 필드 클릭 시 타입, 예시값, 설명 표시            │
├─────────────────────────────────────────────────────────────┤
│  Dry-run 프리뷰                                              │
│  ┌─ 입력 (샘플)─────────┐  ┌─ 출력 (변환 결과)────────────┐ │
│  │ { "shop": {          │  │ { "location": {              │ │
│  │   "name": "a지점",   │  │   "name": "a지점",           │ │
│  │   "addr": "강남구",  │→→│   "address": "강남구",       │ │
│  │   "tel": "02-1234",  │  │   "phone": "02-1234",       │ │
│  │   "open_dt": "..."   │  │   "openedAt": "..."         │ │
│  │ }}                    │  │ }}                           │ │
│  └──────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**안정성 확보 전략:**
- **서버 불필요**: 순수 정적 HTML + 바닐라 JS (또는 경량 라이브러리)
- **데이터 임베드**: 매핑 데이터를 HTML 내 `<script>` 태그에 JSON으로 삽입
- **파일 기반 통신**: 브라우저 ↔ 플러그인 간 실시간 연동 없음, JSON 파일로만 교환
- **원본 보존**: 수정 전 원본 매핑은 항상 보존, 내보내기한 파일만 변경사항 포함
- **오프라인 동작**: 네트워크 불필요, 로컬에서 완전히 동작

**내보내기 형식:**

```json
{
  "exportedAt": "2026-03-06T12:00:00Z",
  "baseMappingId": "shop-to-location-v3",
  "modifications": [
    {
      "action": "reconnect",
      "sourceField": "shop.tel",
      "oldTargetField": "location.phone",
      "newTargetField": "location.contact"
    },
    {
      "action": "add",
      "sourceField": "shop.ext_cd",
      "newTargetField": "location.externalCode",
      "transformation": { "type": "direct" }
    },
    {
      "action": "remove",
      "sourceField": "shop.legacy_field"
    }
  ]
}
```

#### 4.5.2 검증 체계

```
┌──────────────────────────────────────────────────────────┐
│                  검증 파이프라인                            │
│                                                           │
│  ┌──────────┐   ┌───────────────┐   ┌─────────────────┐ │
│  │ 1. Dry-run│──▶│ 2. 사용자 수정 │──▶│ 3. 테스트 실행   │ │
│  │ 시뮬레이션│   │ (대화 or UI)  │   │                  │ │
│  └──────────┘   └───────────────┘   └─────────────────┘ │
│                        │                                  │
│                  ┌─────┴─────┐                            │
│                  │ 대화형     │  비주얼 에디터             │
│                  │ 수정 요청  │  에서 수정 후              │
│                  │           │  JSON 내보내기             │
│                  └───────────┘                            │
└──────────────────────────────────────────────────────────┘
```

#### 4.5.3 Dry-run 시뮬레이션

```typescript
interface DryRunResult {
  input: any;                    // 원본 API 응답 (샘플)
  output: any;                   // 변환된 결과
  fieldResults: {
    field: string;
    sourceValue: any;
    transformedValue: any;
    expectedType: string;
    actualType: string;
    isValid: boolean;
    warning?: string;            // 타입 불일치, null 등 경고
  }[];
  summary: {
    totalFields: number;
    successFields: number;
    warningFields: number;
    errorFields: number;
  };
}
```

Dry-run 결과는 비주얼 매핑 에디터의 하단 프리뷰 영역에도 동일하게 표시된다.

#### 4.5.4 테스트 생성

**a) 프로젝트 테스트 프레임워크 연동:**
- 프로젝트의 테스트 프레임워크 자동 감지 (Jest, PHPUnit, JUnit, pytest 등)
- 해당 프레임워크에 맞는 테스트 코드 자동 생성

**b) CLI 테스트:**
- 커맨드라인에서 실행 가능한 테스트 스크립트 생성
- `npx api-convert-test order-mapping` 형태로 실행

**c) HTML 테스트 페이지:**
- 비주얼 매핑 에디터와 별도로, 순수 변환 결과 검증용 페이지도 생성 가능
- API 호출 → 변환 → 결과 시각화를 한 화면에서 확인
- 필드별 변환 결과를 테이블로 표시

### 4.6 Phase 6: 히스토리 & 버전 관리

#### 4.6.1 저장 구조 (1:N 관계 + 분석 결과물 포함)

```
프로젝트/
└── .api-convert/
    ├── config.json                              # 플러그인 전역 설정
    │
    ├── profiles/                                # 소스 분석 결과 (원본 → 압축 요약)
    │   ├── delivery-api.profile.json            # 배송 API 프로파일
    │   └── payment-api.profile.json             # 결제 API 프로파일
    │
    ├── targets/                                 # 타겟 분석 결과 (DTO/Model → 압축 요약)
    │   ├── order-dto.target.json                # OrderDto 구조 요약
    │   ├── location-dto.target.json             # LocationDto 구조 요약
    │   └── shipment-dto.target.json             # ShipmentDto 구조 요약
    │
    ├── mappings/                                # 매핑 규칙 (소스 1 : 타겟 N)
    │   ├── delivery-api/
    │   │   ├── ecommerce-order.mapping.json     # 이커머스 주문용
    │   │   ├── logistics-shipment.mapping.json  # 물류 시스템용
    │   │   └── customer-tracking.mapping.json   # 고객 앱용
    │   └── payment-api/
    │       ├── billing-amount.mapping.json      # 정산용
    │       └── receipt-total.mapping.json        # 영수증용
    │
    ├── history/                                 # 변경 이력
    │   ├── delivery-api/
    │   │   ├── ecommerce-order.history.json
    │   │   └── logistics-shipment.history.json
    │   └── payment-api/
    │       └── billing-amount.history.json
    │
    ├── editors/                                 # 비주얼 매핑 에디터 HTML
    │   └── {mapping-name}.editor.html
    │
    └── logs/                                    # 작업 로그
        └── {date}.log.json
```

**토큰 효율 참고:**
- `profiles/` + `targets/`: 원본 자료를 최초 분석한 압축 결과. 이후 매핑 시 이것만 참조
- `mappings/`: 매핑 규칙은 profiles + targets를 참조하여 생성. 원본 재참조 불필요
- 원본 문서가 50만 자여도, profile.json은 수백 줄 수준

#### 4.6.2 히스토리 관리 전략

**변경 추적도 유연하게:**
- **어디서 수정했든** 동일하게 추적: 대화, 에디터, JSON 직접 수정, 코드 역반영 — 모든 경로의 변경이 히스토리에 기록
- **연쇄 수정 지원**: 수정은 한 번에 끝나지 않을 수 있다. A를 수정하면 B도 바꿔야 하고, B를 바꾸면 C에도 영향이 있는 연쇄 수정이 자연스럽게 추적되어야 한다
- **Git 추적 가능**: `.api-convert/` 디렉토리를 커밋하면 팀 공유 가능
- **gitignore 대응**: 사용자가 `.gitignore`에 추가한 경우 로컬에서만 관리
- **롤백**: 이전 버전의 매핑 규칙으로 되돌리기 가능 (연쇄 수정 중간 지점으로도 롤백 가능)

**연쇄 수정 시나리오:**

```
수정 1: "shop.tel → location.phone 을 location.contact로 바꿔"
    → 매핑 규칙 변경 → 히스토리 기록 (v3)
    │
    ├─ 영향 감지: 이 필드를 사용하는 생성 코드가 2군데
    │   "phone → contact 변경으로 코드 2곳이 영향받습니다. 재생성할까요?"
    │
수정 2: 코드 재생성 → 히스토리 기록 (v4)
    │
    ├─ 사용자: "아 그리고 contact에 포맷 변환도 추가해줘"
    │
수정 3: 변환 규칙 추가 → 히스토리 기록 (v5)
    │
    └─ 모든 연쇄 수정이 개별 버전으로 기록
       → v3, v4, v5 각각으로 롤백 가능
       → 또는 v2 (수정 전)로 한 번에 롤백 가능
```

```typescript
interface MappingHistory {
  mappingId: string;
  versions: {
    version: number;
    timestamp: string;
    source: ChangeSource;              // 변경이 어디서 발생했는지
    changes: {
      type: 'add' | 'modify' | 'remove';
      field: string;
      before?: any;
      after?: any;
      reason?: string;                 // 변경 사유
    }[];
    relatedVersions?: number[];        // 연쇄 수정 시 관련 버전들
    snapshot: MappingRule;             // 해당 버전의 전체 스냅샷
  }[];
}

type ChangeSource =
  | 'conversation'                     // 대화에서 수정
  | 'visual_editor'                    // 비주얼 에디터에서 수정
  | 'json_direct'                      // JSON 직접 수정
  | 'code_sync'                        // 코드 역반영
  | 'cascade'                          // 소스/타겟 변경에 의한 연쇄 수정
  | 'auto_regenerate';                 // 자동 코드 재생성
```

---

## 5. 인증 & 보안

### 5.1 외부 API 인증 처리

```
인증 정보 확인 플로우
    │
    ├─ API 문서에서 인증 방식 파악
    │   (Bearer Token, API Key, OAuth, Basic Auth 등)
    │
    ├─ 인증 정보 소스 확인
    │   │
    │   ├─ .env 파일에 존재?
    │   │   └─ 사용자에게 사용 허가 요청
    │   │       "API_KEY를 .env에서 읽어도 될까요?"
    │   │       [허용] [거부 - 직접 입력]
    │   │
    │   └─ 없으면 사용자에게 직접 요청
    │       "결제 API 인증에 필요한 API Key를 입력해주세요"
    │
    └─ 인증 정보는 메모리에서만 사용, 매핑 파일에 저장하지 않음
```

### 5.2 보안 원칙

1. **인증 정보 비저장**: API 키, 토큰 등은 매핑 파일에 절대 저장하지 않음
2. **사용자 동의 필수**: .env 접근 시 반드시 사용자 확인
3. **민감정보 마스킹**: 로그/히스토리에 인증 정보 노출 방지
4. **사용자 제어권**: 모든 외부 호출은 사용자가 거부 가능

---

## 6. MCP Tool 상세 정의

### 6.1 `analyze_api_response`

**목적**: 외부 API 정보를 수집하고 응답 구조를 분석

```typescript
// 입력
{
  source: {
    type: 'swagger' | 'json_sample' | 'curl' | 'url' | 'document' | 'git';
    content: string;     // 소스 내용 또는 경로
  };
  options?: {
    followRedirects: boolean;
    timeout: number;
    auth?: {
      type: 'bearer' | 'api_key' | 'basic' | 'oauth' | 'custom';
      credentials: string;    // 사용자가 제공한 인증 정보
    };
  };
}

// 출력
{
  profile: ApiProfile;         // 분석된 API 프로파일
  confidence: number;          // 분석 신뢰도
  warnings: string[];          // 경고 사항
  suggestions: string[];       // 추가 정보 요청 제안
}
```

### 6.2 `generate_mapping`

**목적**: API 응답과 대상 모델 간의 매핑 규칙 생성

```typescript
// 입력
{
  apiProfile: string;          // API 프로파일 ID 또는 경로
  endpoint: string;            // 대상 엔드포인트
  target: {
    type: 'existing_dto' | 'existing_code' | 'user_defined' | 'auto_generate';
    reference?: string;        // 참조 파일 경로 또는 코드
    language: SupportedLanguage;
  };
  options?: {
    strictMode: boolean;       // 엄격 모드 (모호한 매핑 전부 확인)
    includeNullHandling: boolean;
    namingConvention: 'camelCase' | 'snake_case' | 'PascalCase';
  };
}

// 출력
{
  mappingRule: MappingRule;
  preview: {
    confirmedMappings: FieldMapping[];     // 확정된 매핑
    ambiguousMappings: FieldMapping[];     // 확인 필요한 매핑
    unmappedFields: string[];              // 매핑 불가 필드
  };
  generatedCode?: string;                  // 생성된 코드 프리뷰
}
```

### 6.3 `execute_api_call`

**목적**: 실제 API를 호출하고 응답을 캡처

```typescript
// 입력
{
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  auth?: AuthConfig;
  options?: {
    timeout: number;
    followRedirects: boolean;
    captureFullResponse: boolean;  // 헤더 포함 전체 응답 캡처
  };
}

// 출력
{
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  timing: {
    total: number;
    dns: number;
    connect: number;
    response: number;
  };
  rawResponse: string;           // 원본 응답
}
```

### 6.4 `validate_mapping`

**목적**: 매핑 결과를 검증하고 테스트 생성

```typescript
// 입력
{
  mappingId: string;             // 매핑 규칙 ID
  mode: 'dry_run' | 'generate_test' | 'generate_test_page';
  testConfig?: {
    framework?: string;          // jest, phpunit, junit 등 (자동 감지)
    sampleData?: any;            // 테스트용 샘플 데이터
    outputPath?: string;         // 테스트 파일 저장 경로
  };
}

// 출력
{
  result: DryRunResult | GeneratedTest | TestPagePath;
  summary: {
    status: 'pass' | 'warn' | 'fail';
    message: string;
    details: string[];
  };
}
```

### 6.5 `manage_history`

**목적**: 매핑 히스토리 조회/롤백/비교

```typescript
// 입력
{
  action: 'list' | 'get_version' | 'rollback' | 'compare' | 'export';
  mappingId: string;
  version?: number;              // 특정 버전 지정
  compareVersions?: [number, number];  // 비교할 두 버전
}

// 출력
{
  history?: MappingHistory;
  comparison?: VersionDiff;
  exported?: string;             // 내보내기 결과
}
```

### 6.6 MCP Resources

**목적**: Claude가 현재 프로젝트의 매핑 상태를 참조할 수 있도록 리소스 제공

| Resource URI | 설명 | 반환 데이터 |
|-------------|------|-------------|
| `api-convert://mappings` | 현재 프로젝트의 전체 매핑 규칙 목록 | 매핑 ID, 이름, 소스/타겟, 최종 수정일 |
| `api-convert://profiles` | 분석된 API 프로파일 목록 | 프로파일 ID, 이름, 엔드포인트 수, 분석일 |
| `api-convert://targets` | 분석된 타겟 프로파일 목록 | 타겟 ID, 이름, 필드 수, 언어 |
| `api-convert://mapping/{id}` | 특정 매핑 규칙 상세 | MappingRule 전체 데이터 |
| `api-convert://config` | 플러그인 설정 | 현재 설정값 |

**용도:**
- Claude가 "현재 어떤 매핑이 있어?"라는 질문에 리소스를 참조하여 답변
- Skill 워크플로우에서 기존 매핑 목록을 자동으로 로드
- 매핑 간 의존관계 파악에 활용

---

## 7. Skill 워크플로우

### 7.1 `/api-convert` (메인 워크플로우)

**전체 프로세스를 가이드하는 대화형 워크플로우:**

```
Step 0: "사용 목적을 확인합니다"
    → 기존 코드 분석으로 목적 추론 시도
    → 불분명하면 사용자에게 직접 확인 (직접 소비 / API 허브 / 데이터 통합 / 기타)
    → 목적에 따라 후속 워크플로우 방향 결정

Step 1: "변환할 외부 API 정보를 제공해주세요"
    → Swagger URL, 문서, 샘플 JSON, curl 등 수집
    → analyze_api_response 실행

Step 2: "API 분석 결과를 확인해주세요"
    → 분석된 API 프로파일 표시
    → 누락/오류 있으면 추가 정보 요청

Step 3: "매핑 대상을 지정해주세요"
    → 기존 DTO 자동 감지 결과 표시
    → 사용자가 선택 또는 새로 정의

Step 4: "매핑 결과를 확인해주세요"
    → 자동 매핑 결과 표시
    → 모호한 필드 확인 요청
    → 사용자 수정 반영

Step 5: "코드를 생성합니다"
    → 매핑 코드/설정 파일 생성
    → Dry-run 결과 표시
    → 테스트 생성 여부 확인

Step 6: "파일에 적용합니다"
    → 생성된 코드를 프로젝트에 저장
    → 히스토리 기록
```

### 7.2 `/api-map` (빠른 매핑)

```
이미 분석된 API가 있을 때 빠르게 새 매핑 생성
→ API 프로파일 선택
→ 엔드포인트 선택
→ 대상 DTO 선택/생성
→ 매핑 생성 & 코드 출력
```

### 7.3 `/api-test` (테스트)

```
기존 매핑의 테스트/검증
→ 매핑 선택
→ 테스트 유형 선택 (dry-run / 테스트코드 / HTML 페이지)
→ 실행 & 결과 표시
```

---

## 8. 개발 로드맵

### 8.1 MVP (v0.1) - 핵심 변환 엔진

| 순서 | 기능 | 상세 | 예상 복잡도 |
|------|------|------|------------|
| 1 | MCP 서버 기본 구조 | 서버 설정, tool/resource 등록, 프로젝트 스캐폴딩 | 중 |
| 2 | 사용 목적 파악 | 기존 코드 분석 + 사용자 확인으로 목적 식별 | 중 |
| 3 | API 응답 분석기 | JSON 샘플 파싱, 스키마 추출, 타입 추론 | 중 |
| 4 | Swagger/OpenAPI 파서 | OpenAPI 스펙 파싱, 엔드포인트/스키마 추출 | 중 |
| 5 | 프로파일 저장 시스템 | 분석 결과를 압축 프로파일 JSON으로 저장 (토큰 효율) | 중 |
| 6 | MCP Resource 구현 | 매핑/프로파일/타겟 목록 조회 리소스 | 낮음 |
| 7 | 기본 필드 매퍼 | 필드명 기반 자동 매핑, 타입 변환 | 높음 |
| 8 | 단일 언어 코드 생성기 | TypeScript 매핑 코드 자동 생성 | 중 |
| 9 | 모호성 감지 | 불확실한 매핑 감지 & 사용자 확인 요청 | 높음 |

### 8.2 v0.2 - 다양한 입력 & 출력

| 순서 | 기능 | 상세 | 예상 복잡도 |
|------|------|------|------------|
| 10 | curl 실행 엔진 | curl 명령 파싱, HTTP 호출, 응답 캡처 | 중 |
| 11 | API 문서 파싱 | 비정형 문서에서 API 정보 추출 (Claude 활용) | 높음 |
| 12 | Git 저장소 코드 분석 | API 서버/클라이언트 코드에서 인터페이스 추출 | 중 |
| 13 | 비즈니스 맥락 수집기 | 비즈니스 정보를 타겟 프로파일에 구조화 저장 | 중 |
| 14 | 멀티 언어 코드 생성기 | PHP, Java, Python, Kotlin, Go 템플릿 추가 | 중 |
| 15 | 멀티 포맷 입출력 | JSON, XML/SOAP, YAML 입력 파싱 + 출력 생성 | 낮음 |
| 16 | 코드베이스 스캐너 | 기존 DTO/Model 자동 감지, 패턴 분석 | 높음 |

### 8.3 v0.3 - 사용자 경험 & 검증

| 순서 | 기능 | 상세 | 예상 복잡도 |
|------|------|------|------------|
| 17 | Dry-run 시뮬레이션 | 샘플 데이터로 변환 시뮬레이션 | 중 |
| 18 | 테스트 코드 생성기 | 프로젝트 프레임워크별 테스트 자동 생성 | 중 |
| 19 | HTML 테스트 페이지 | 인터랙티브 브라우저 테스트 페이지 생성 | 중 |
| 20 | 비주얼 매핑 에디터 | 정적 HTML+JS로 매핑 시각화/수정/내보내기 | 높음 |
| 21 | Skill 워크플로우 | /api-convert, /api-map, /api-test 구현 | 중 |
| 22 | 인증 관리 | .env 읽기, 사용자 동의, 보안 처리 | 중 |

### 8.4 v0.4 - 히스토리 & 고급 기능

| 순서 | 기능 | 상세 | 예상 복잡도 |
|------|------|------|------------|
| 23 | 히스토리/버전 관리 | 매핑 규칙 버전 관리, 롤백, 비교 | 중 |
| 24 | 1:N / N:1 매핑 | 하나의 API → 여러 타겟, 여러 API → 하나의 타겟 (충돌 해소 포함) | 높음 |
| 25 | 변경 감지 & 연쇄 업데이트 | 소스/타겟 변경 시 영향 분석 + 자동 제안 | 높음 |
| 26 | 중첩/배열/조건부 변환 | 복잡한 변환 로직 완전 지원 | 높음 |
| 27 | 매핑 규칙 내보내기/가져오기 | 팀 공유를 위한 규칙 교환 | 낮음 |
| 28 | 성능 최적화 | 대량 필드 처리, 페이지네이션 API 대응 | 중 |

---

## 9. 비기능 요구사항

### 9.1 성능
- API 응답 분석: 100개 필드 기준 2초 이내
- 매핑 코드 생성: 1초 이내
- MCP 서버 시작: 3초 이내
- **대용량 API 대응** (1000+ 필드):
  - 필드를 논리적 그룹으로 분할하여 단계적 매핑
  - 프로파일 분석 시 핵심 필드 우선, 하위 필드 점진적 분석
  - 사용자에게 "전체 매핑 / 주요 필드만 / 특정 엔드포인트만" 선택지 제공

### 9.2 확장성
- 새로운 언어 템플릿 추가가 용이한 플러그인 구조
- 새로운 입력 소스 타입 추가 가능
- 커스텀 변환 로직 정의 가능

### 9.3 안정성
- 잘못된 입력에 대한 명확한 에러 메시지
- 부분 실패 시 성공한 부분까지 결과 제공
- 네트워크 오류 시 재시도 + 폴백

### 9.4 API 호출 안전장치
- **Rate Limiting 준수**: 외부 API의 호출 제한을 감지/준수 (429 응답 대응)
- **타임아웃 설정**: 기본 30초, 사용자 조정 가능
- **재시도 전략**: 지수 백오프(exponential backoff) + 최대 3회
- **페이지네이션 대응**: 분석용 호출 시 자동 페이지 순회 (제한 설정 가능)
- **요청 승인**: 실제 API 호출 전 사용자 확인 (비용/부작용 방지)

### 9.5 에러 처리 & 로깅
- **구조화된 에러**: 에러 유형별 명확한 코드/메시지 (파싱 실패, 인증 오류, 네트워크 오류 등)
- **부분 성공 처리**: 100개 필드 중 3개 매핑 실패 시 → 97개 결과 제공 + 실패 3개 보고
- **디버그 로그**: `.api-convert/logs/` 에 작업 로그 저장 (프로파일 분석, 매핑 결정 근거 등)
- **사용자 친화적 메시지**: 기술적 에러를 사용자가 이해할 수 있는 형태로 번역

### 9.6 사용성
- 최소 입력으로 최대 결과 (합리적 기본값 제공)
- 모든 자동 결정에 대해 사용자 오버라이드 가능
- 명확한 진행 상태 표시

### 9.7 설치 & 설정
- **설치**: `npm install -g api-convert-plugin` 또는 Claude Code MCP 설정에 직접 추가
- **MCP 설정 예시**:
  ```json
  {
    "mcpServers": {
      "api-convert": {
        "command": "npx",
        "args": ["-y", "api-convert-plugin"]
      }
    }
  }
  ```
- **Skill 설치**: `npx api-convert-plugin --install-skills` 실행 시 `.claude/commands/` 에 Skill 파일 복사. 또는 사용자가 직접 `src/skill/*.md` 파일을 `.claude/commands/` 에 복사.
- **초기 설정**: 첫 MCP tool 호출 시 `.api-convert/` 디렉토리 구조 자동 생성 (`config.json`, `profiles/`, `targets/`, `mappings/`, `history/`, `editors/`, `logs/`)
- **기존 프로젝트 대응**: 이미 `.api-convert/` 가 존재하면 기존 설정/프로파일 로드, 신규 하위 디렉토리만 보완 생성

### 9.8 비정상 API 응답 대처
- **200 OK인데 에러 body** (`{ "error": true }`): 응답 구조 분석 시 에러 패턴 감지 → 사용자에게 경고
- **빈 응답 body**: "응답이 비어 있습니다. 인증이나 파라미터를 확인해주세요" 안내
- **HTML 응답** (로그인 페이지 리다이렉트 등): Content-Type 확인 → "JSON이 아닌 HTML 응답입니다. 인증 만료일 수 있습니다" 안내
- **타임아웃/네트워크 오류**: 재시도 여부 확인 → 실패 시 마지막 성공 응답(캐시) 사용 제안

---

## 10. 리스크 & 대응방안

| 리스크 | 영향도 | 발생 가능성 | 대응방안 |
|--------|--------|------------|----------|
| 모호한 필드 매핑으로 잘못된 코드 생성 | 높음 | 높음 | 모호성 감지 강화, 사용자 확인 필수화, Dry-run 검증 |
| 비정형 API 문서 파싱 실패 | 중간 | 중간 | Claude의 자연어 이해 활용, 부분 파싱 지원, 수동 보완 |
| 다양한 언어/프레임워크 대응 복잡도 | 중간 | 높음 | 템플릿 기반 설계, 언어별 점진적 추가, 커뮤니티 기여 |
| 외부 API 인증 복잡성 | 중간 | 중간 | 다양한 인증 방식 지원, 사용자 가이드 제공 |
| MCP 서버 안정성 | 높음 | 낮음 | 에러 핸들링 강화, 그레이스풀 재시작 |
| 사용 목적 오판 | 높음 | 중간 | 기존 코드 분석 + 사용자 확인 이중 검증, 목적 변경 시 재설계 |
| 토큰 한계로 대용량 문서 분석 불가 | 중간 | 중간 | 프로파일 압축 저장, 문서 분할 분석, 점진적 처리 |
| 외부 API Rate Limit 초과 | 중간 | 중간 | 호출 전 사용자 승인, 지수 백오프, 캐싱 |
| N:1 매핑 시 소스 간 충돌 | 높음 | 낮음 | 충돌 필드 감지 → 우선순위 규칙 정의 → 사용자 확인 |

---

## 11. 성공 지표

| 지표 | 목표 |
|------|------|
| 자동 매핑 정확도 | ≥ 85% (사용자 수정 없이 올바른 매핑) |
| 모호성 감지율 | ≥ 95% (잘못된 매핑이 사용자 확인 없이 적용되지 않음) |
| 지원 언어 | MVP: 1개(TS), v0.4: 6개(TS, PHP, Java, Python, Kotlin, Go) |
| 입력 소스 | MVP: 2개(JSON, Swagger), v0.4: 6개(전체) |
| 사용자 만족도 | 수동 대비 작업 시간 70% 이상 절감 |
