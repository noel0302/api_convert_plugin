import { describe, it, expect } from 'vitest';
import { parseSwaggerSpec } from '../../src/core/analyzer/parsers/swagger-parser.js';

const minimalSwagger = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        summary: 'List users',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                  },
                  required: ['id', 'name'],
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create user',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
        },
      },
    },
  },
  servers: [{ url: 'https://api.test.com' }],
});

describe('parseSwaggerSpec', () => {
  it('OpenAPI 3.0 기본 파싱', async () => {
    const profile = await parseSwaggerSpec(minimalSwagger);
    expect(profile.name).toBe('Test API');
    expect(profile.baseUrl).toBe('https://api.test.com');
    expect(profile.endpoints).toHaveLength(2);
  });

  it('GET /users 엔드포인트 파싱', async () => {
    const profile = await parseSwaggerSpec(minimalSwagger);
    const getUsers = profile.endpoints.find(e => e.method === 'GET' && e.path === '/users');
    expect(getUsers).toBeDefined();
    expect(getUsers!.description).toBe('List users');
    expect(getUsers!.response.statusCodes['200']).toBeDefined();
    expect(getUsers!.response.statusCodes['200'].children).toHaveProperty('id');
    expect(getUsers!.response.statusCodes['200'].children).toHaveProperty('name');
    expect(getUsers!.response.statusCodes['200'].children).toHaveProperty('email');
  });

  it('POST /users 엔드포인트 + requestBody 파싱', async () => {
    const profile = await parseSwaggerSpec(minimalSwagger);
    const postUsers = profile.endpoints.find(e => e.method === 'POST' && e.path === '/users');
    expect(postUsers).toBeDefined();
    expect(postUsers!.request.body).toBeDefined();
    expect(postUsers!.request.body!.children).toHaveProperty('name');
  });

  it('커스텀 profileName 적용', async () => {
    const profile = await parseSwaggerSpec(minimalSwagger, { profileName: 'CustomName' });
    expect(profile.name).toBe('CustomName');
  });

  it('잘못된 JSON → PARSE_FAILED 에러', async () => {
    await expect(parseSwaggerSpec('not json')).rejects.toThrow('PARSE_FAILED');
  });

  it('Swagger 2.0 호환', async () => {
    const swagger2 = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Old API', version: '1.0.0' },
      host: 'old-api.test.com',
      basePath: '/v1',
      paths: {
        '/items': {
          get: {
            summary: 'List items',
            responses: {
              '200': {
                description: 'OK',
                schema: {
                  type: 'object',
                  properties: {
                    itemId: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    });
    const profile = await parseSwaggerSpec(swagger2);
    expect(profile.name).toBe('Old API');
    expect(profile.baseUrl).toBe('https://old-api.test.com/v1');
    expect(profile.endpoints).toHaveLength(1);
  });
});
