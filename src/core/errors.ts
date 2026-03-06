export type ErrorCode =
  | 'PARSE_FAILED'
  | 'UNSUPPORTED_FORMAT'
  | 'SCHEMA_EXTRACTION_FAILED'
  | 'PROFILE_NOT_FOUND'
  | 'MAPPING_NOT_FOUND'
  | 'TARGET_NOT_FOUND'
  | 'ENDPOINT_NOT_FOUND'
  | 'CONFLICT_UNRESOLVED'
  | 'UNSUPPORTED_LANGUAGE'
  | 'CODE_GENERATION_FAILED'
  | 'GENERATION_FAILED'
  | 'TEMPLATE_ERROR'
  | 'API_CALL_FAILED'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'DRY_RUN_FAILED'
  | 'TYPE_MISMATCH'
  | 'VALIDATION_FAILED'
  | 'VERSION_NOT_FOUND'
  | 'ROLLBACK_FAILED'
  | 'FILE_READ_ERROR'
  | 'FILE_WRITE_ERROR'
  | 'CONFIG_INVALID'
  | 'INVALID_INPUT'
  | 'RESOURCE_NOT_FOUND'
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
  GENERATION_FAILED: '코드 생성에 실패했습니다',
  TEMPLATE_ERROR: '템플릿 렌더링 중 오류가 발생했습니다',
  API_CALL_FAILED: 'API 호출에 실패했습니다',
  AUTH_REQUIRED: '인증이 필요합니다',
  RATE_LIMITED: 'API 호출 제한에 도달했습니다',
  TIMEOUT: '요청 시간이 초과되었습니다',
  DRY_RUN_FAILED: 'Dry-run 시뮬레이션에 실패했습니다',
  TYPE_MISMATCH: '타입이 일치하지 않습니다',
  VALIDATION_FAILED: '검증에 실패했습니다',
  VERSION_NOT_FOUND: '해당 버전을 찾을 수 없습니다',
  ROLLBACK_FAILED: '롤백에 실패했습니다',
  FILE_READ_ERROR: '파일 읽기에 실패했습니다',
  FILE_WRITE_ERROR: '파일 쓰기에 실패했습니다',
  CONFIG_INVALID: '설정 파일이 올바르지 않습니다',
  INVALID_INPUT: '잘못된 입력입니다',
  RESOURCE_NOT_FOUND: '리소스를 찾을 수 없습니다',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다',
};

export class PluginError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly detail?: string,
    public readonly context?: unknown,
  ) {
    super(`[${code}] ${ERROR_MESSAGES[code]}${detail ? `: ${detail}` : ''}`);
    this.name = 'PluginError';
  }

  get userMessage(): string {
    return `${ERROR_MESSAGES[this.code]}${this.detail ? `: ${this.detail}` : ''}`;
  }

  static getMessage(code: ErrorCode): string {
    return ERROR_MESSAGES[code];
  }
}
