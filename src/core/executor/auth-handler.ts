import type { AuthConfig } from '../types/profile.js';

export interface ResolvedAuth {
  headers: Record<string, string>;
}

export function resolveAuth(auth: AuthConfig, credentials?: Record<string, string>): ResolvedAuth {
  const headers: Record<string, string> = {};

  switch (auth.type) {
    case 'bearer':
      if (credentials?.token) {
        headers['Authorization'] = `Bearer ${credentials.token}`;
      }
      break;
    case 'basic':
      if (credentials?.username && credentials?.password) {
        const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
    case 'api_key':
      if (credentials?.header && credentials?.value) {
        headers[credentials.header] = credentials.value;
      }
      break;
    case 'oauth':
      if (credentials?.token) {
        headers['Authorization'] = `Bearer ${credentials.token}`;
      }
      break;
    default:
      break;
  }

  return { headers };
}
