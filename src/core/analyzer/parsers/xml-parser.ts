import type { ApiProfile, FieldSchema, ObjectSchema } from '../../types/profile.js';
import { PluginError } from '../../errors.js';

/**
 * Basic XML parser that converts simple XML to ApiProfile.
 * For complex XML/SOAP, fast-xml-parser will be added in v0.2.
 */
export function parseXml(content: string, options?: { profileName?: string; baseUrl?: string }): ApiProfile {
  const trimmed = content.trim();
  if (!trimmed.startsWith('<')) {
    throw new PluginError('PARSE_FAILED', 'Invalid XML: content does not start with <');
  }

  const children = parseXmlToSchema(trimmed);
  const rootTag = extractRootTag(trimmed);

  const profileId = `xml-${Date.now()}`;
  return {
    id: profileId,
    name: options?.profileName || `XML API (${rootTag})`,
    baseUrl: options?.baseUrl || '',
    endpoints: [{
      method: 'GET',
      path: `/${rootTag}`,
      description: `Parsed from XML root element: <${rootTag}>`,
      request: {},
      response: {
        statusCodes: {
          200: {
            type: 'object',
            children,
          },
        },
      },
    }],
    authentication: { type: 'none' },
    analyzedFrom: {
      sourceType: 'xml',
      analyzedAt: new Date().toISOString(),
    },
    metadata: { confidence: 0.4 },
    notes: [
      'Basic XML parsing (태그 구조 기반 추론)',
      '복잡한 XML/SOAP은 v0.2에서 fast-xml-parser로 지원 예정',
    ],
  };
}

function extractRootTag(xml: string): string {
  const match = xml.match(/<([a-zA-Z][\w.-]*)/);
  return match ? match[1] : 'root';
}

function parseXmlToSchema(xml: string): Record<string, FieldSchema> {
  const children: Record<string, FieldSchema> = {};

  // Simple regex-based extraction of child elements
  // Only extracts direct children of root element
  const rootTag = extractRootTag(xml);
  const innerMatch = xml.match(new RegExp(`<${rootTag}[^>]*>([\\s\\S]*)</${rootTag}>`));
  if (!innerMatch) return children;

  const inner = innerMatch[1];

  // Extract simple elements: <tag>value</tag>
  const elementRegex = /<([a-zA-Z][\w.-]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
  let match;

  while ((match = elementRegex.exec(inner)) !== null) {
    const tagName = match[1];
    const value = match[2].trim();

    children[tagName] = {
      type: inferXmlType(value),
      nullable: value === '' || value === 'null',
      required: true,
      example: value || undefined,
    };
  }

  // Extract self-closing elements: <tag />
  const selfClosingRegex = /<([a-zA-Z][\w.-]*)\s*\/>/g;
  while ((match = selfClosingRegex.exec(inner)) !== null) {
    children[match[1]] = {
      type: 'string',
      nullable: true,
      required: false,
    };
  }

  // Extract elements with child elements (detect as object)
  const nestedRegex = /<([a-zA-Z][\w.-]*)(?:\s[^>]*)?>[\s]*<[a-zA-Z]/g;
  while ((match = nestedRegex.exec(inner)) !== null) {
    const tagName = match[1];
    if (!(tagName in children)) {
      children[tagName] = {
        type: 'object',
        nullable: false,
        required: true,
      };
    }
  }

  return children;
}

function inferXmlType(value: string): 'string' | 'number' | 'boolean' | 'object' | 'array' {
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  return 'string';
}
