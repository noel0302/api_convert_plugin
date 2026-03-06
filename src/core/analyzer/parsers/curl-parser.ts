import type { HttpMethod } from '../../types/profile.js';

/**
 * curl 명령어를 파싱하여 HTTP 요청 정보를 추출.
 * curl 실행은 별도로 ExecutorModule에서 수행.
 */

export interface ParsedCurl {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  auth?: { type: 'bearer'; token: string } | { type: 'basic'; credentials: string };
}

export function parseCurlCommand(curlStr: string): ParsedCurl {
  const normalized = curlStr
    .replace(/\\\n/g, ' ')   // 줄바꿈 이스케이프 제거
    .replace(/\s+/g, ' ')    // 연속 공백 정리
    .trim();

  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: {},
  };

  // URL 추출
  const urlMatch = normalized.match(/curl\s+(?:--[a-z-]+\s+\S+\s+)*['"]?(https?:\/\/[^\s'"]+)['"]?/i)
    || normalized.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/);
  if (urlMatch) {
    result.url = urlMatch[1].replace(/['"]/g, '');
  }

  // Method 추출
  const methodMatch = normalized.match(/-X\s+(['"]?)(\w+)\1/i);
  if (methodMatch) {
    result.method = methodMatch[2].toUpperCase() as HttpMethod;
  } else if (normalized.includes('-d ') || normalized.includes('--data')) {
    result.method = 'POST';
  }

  // Headers 추출
  const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const [key, ...valueParts] = headerMatch[1].split(':');
    if (key && valueParts.length > 0) {
      const headerKey = key.trim();
      const headerValue = valueParts.join(':').trim();
      result.headers[headerKey] = headerValue;

      // Authorization 헤더에서 인증 추출
      if (headerKey.toLowerCase() === 'authorization') {
        if (headerValue.toLowerCase().startsWith('bearer ')) {
          result.auth = { type: 'bearer', token: headerValue.slice(7) };
        } else if (headerValue.toLowerCase().startsWith('basic ')) {
          result.auth = { type: 'basic', credentials: headerValue.slice(6) };
        }
      }
    }
  }

  // Body 추출 (같은 종류의 따옴표로 매칭)
  const bodyMatch = normalized.match(/(?:-d|--data|--data-raw)\s+'([^']+)'/)
    || normalized.match(/(?:-d|--data|--data-raw)\s+"([^"]+)"/)
    || normalized.match(/(?:-d|--data|--data-raw)\s+(\S+)/);
  if (bodyMatch) {
    result.body = bodyMatch[1];
  }

  return result;
}
