import type { ApiProfile, ApiEndpoint, FieldSchema, HttpMethod, ObjectSchema } from '../../types/profile.js';
import { PluginError } from '../../errors.js';

export interface SwaggerSpec {
  openapi?: string;
  swagger?: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string }>;
  host?: string;
  basePath?: string;
  paths: Record<string, Record<string, SwaggerOperation>>;
  definitions?: Record<string, SwaggerSchema>;
  components?: { schemas?: Record<string, SwaggerSchema> };
}

interface SwaggerOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: SwaggerParameter[];
  requestBody?: { content?: Record<string, { schema: SwaggerSchema }> };
  responses: Record<string, { description?: string; schema?: SwaggerSchema; content?: Record<string, { schema: SwaggerSchema }> }>;
}

interface SwaggerParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'body';
  required?: boolean;
  schema?: SwaggerSchema;
  type?: string;
}

interface SwaggerSchema {
  type?: string;
  properties?: Record<string, SwaggerSchema>;
  items?: SwaggerSchema;
  required?: string[];
  $ref?: string;
  enum?: unknown[];
  format?: string;
  description?: string;
  nullable?: boolean;
}

export async function parseSwaggerSpec(content: string, options?: { baseUrl?: string; profileName?: string }): Promise<ApiProfile> {
  let spec: SwaggerSpec;
  try {
    spec = JSON.parse(content);
  } catch {
    throw new PluginError('PARSE_FAILED', 'Invalid JSON for Swagger spec');
  }

  if (!spec.paths) {
    throw new PluginError('PARSE_FAILED', 'No paths found in Swagger spec');
  }

  const baseUrl = options?.baseUrl
    || spec.servers?.[0]?.url
    || (spec.host ? `https://${spec.host}${spec.basePath || ''}` : '');

  const definitions = spec.definitions || spec.components?.schemas || {};
  const endpoints: ApiEndpoint[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
        endpoints.push(convertOperation(path, method.toUpperCase() as HttpMethod, operation, definitions));
      }
    }
  }

  return {
    id: `swagger-${Date.now()}`,
    name: options?.profileName || spec.info.title || 'Swagger API',
    version: spec.info.version,
    baseUrl,
    endpoints,
    authentication: { type: 'none' },
    analyzedFrom: {
      sourceType: 'swagger',
      analyzedAt: new Date().toISOString(),
    },
    metadata: { confidence: 0.95 },
    notes: [`Parsed from ${spec.openapi ? 'OpenAPI' : 'Swagger'} spec: ${spec.info.title} v${spec.info.version}`],
  };
}

function convertOperation(
  path: string,
  method: HttpMethod,
  op: SwaggerOperation,
  definitions: Record<string, SwaggerSchema>,
): ApiEndpoint {
  const statusCodes: Record<number, ObjectSchema> = {};

  for (const [code, response] of Object.entries(op.responses)) {
    const statusCode = parseInt(code, 10);
    if (isNaN(statusCode)) continue;

    const schema = response.schema
      || response.content?.['application/json']?.schema;

    if (schema) {
      statusCodes[statusCode] = convertSchemaToObjectSchema(schema, definitions);
    }
  }

  // requestBody 처리 (OpenAPI 3.0)
  let body: ObjectSchema | undefined;
  if (op.requestBody?.content) {
    const bodySchema = op.requestBody.content['application/json']?.schema;
    if (bodySchema) {
      body = convertSchemaToObjectSchema(bodySchema, definitions);
    }
  }
  // Swagger 2.0 body parameter
  const bodyParam = op.parameters?.find(p => p.in === 'body');
  if (!body && bodyParam?.schema) {
    body = convertSchemaToObjectSchema(bodyParam.schema, definitions);
  }

  return {
    method,
    path,
    description: op.summary || op.description,
    request: {
      pathParams: op.parameters?.filter(p => p.in === 'path').map(p => p.name),
      queryParams: convertParametersToSchema(op.parameters?.filter(p => p.in === 'query') || []),
      headers: convertParametersToSchema(op.parameters?.filter(p => p.in === 'header') || []),
      body,
    },
    response: { statusCodes },
  };
}

function convertSchemaToObjectSchema(
  schema: SwaggerSchema,
  definitions: Record<string, SwaggerSchema>,
): ObjectSchema {
  const resolved = resolveRef(schema, definitions);

  if (resolved.type === 'object' && resolved.properties) {
    const children: Record<string, FieldSchema> = {};
    const requiredFields = new Set(resolved.required || []);

    for (const [name, prop] of Object.entries(resolved.properties)) {
      children[name] = convertToFieldSchema(prop, definitions, requiredFields.has(name));
    }

    return { type: 'object', children };
  }

  if (resolved.type === 'array' && resolved.items) {
    return {
      type: 'object',
      children: {
        _root: {
          type: 'array',
          nullable: false,
          required: true,
          items: convertToFieldSchema(resolved.items, definitions, true),
        },
      },
    };
  }

  return { type: 'object', children: {} };
}

function convertToFieldSchema(
  schema: SwaggerSchema,
  definitions: Record<string, SwaggerSchema>,
  required: boolean,
): FieldSchema {
  const resolved = resolveRef(schema, definitions);
  const fieldType = mapSwaggerType(resolved.type || 'string');

  const result: FieldSchema = {
    type: fieldType,
    nullable: resolved.nullable ?? !required,
    required,
    description: resolved.description,
    format: resolved.format,
  };

  if (resolved.enum) {
    result.enum = resolved.enum;
  }

  if (fieldType === 'object' && resolved.properties) {
    result.children = {};
    const reqFields = new Set(resolved.required || []);
    for (const [name, prop] of Object.entries(resolved.properties)) {
      result.children[name] = convertToFieldSchema(prop, definitions, reqFields.has(name));
    }
  }

  if (fieldType === 'array' && resolved.items) {
    result.items = convertToFieldSchema(resolved.items, definitions, true);
  }

  return result;
}

function resolveRef(schema: SwaggerSchema, definitions: Record<string, SwaggerSchema>): SwaggerSchema {
  if (!schema.$ref) return schema;

  const refName = schema.$ref.replace('#/definitions/', '').replace('#/components/schemas/', '');
  return definitions[refName] || schema;
}

function mapSwaggerType(type: string): FieldSchema['type'] {
  switch (type) {
    case 'integer':
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'array': return 'array';
    case 'object': return 'object';
    default: return 'string';
  }
}

function convertParametersToSchema(params: SwaggerParameter[]): Record<string, FieldSchema> | undefined {
  if (params.length === 0) return undefined;

  const result: Record<string, FieldSchema> = {};
  for (const p of params) {
    result[p.name] = {
      type: mapSwaggerType(p.type || p.schema?.type || 'string'),
      nullable: !p.required,
      required: p.required ?? false,
    };
  }
  return result;
}
