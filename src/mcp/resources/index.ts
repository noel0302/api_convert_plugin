import type { Modules } from '../tools/index.js';
import { PluginError } from '../../core/errors.js';

export const resourceDefinitions = [
  {
    uri: 'api-convert://profiles',
    name: 'API Profiles',
    description: '분석된 API 프로파일 목록',
    mimeType: 'application/json',
  },
  {
    uri: 'api-convert://targets',
    name: 'Target Profiles',
    description: '등록된 타겟 프로파일 목록',
    mimeType: 'application/json',
  },
  {
    uri: 'api-convert://mappings',
    name: 'Mapping Rules',
    description: '생성된 매핑 규칙 목록',
    mimeType: 'application/json',
  },
  {
    uri: 'api-convert://config',
    name: 'Plugin Configuration',
    description: '플러그인 설정',
    mimeType: 'application/json',
  },
  {
    uri: 'api-convert://status',
    name: 'Plugin Status',
    description: '플러그인 상태 요약',
    mimeType: 'application/json',
  },
];

export async function handleResourceRead(
  uri: string,
  modules: Modules,
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const parsedUri = uri.replace('api-convert://', '');

  // 개별 리소스 요청 처리 (api-convert://profiles/{id})
  const [resource, id] = parsedUri.split('/');

  let data: unknown;

  switch (resource) {
    case 'profiles':
      if (id) {
        data = await modules.storage.loadProfile(id);
      } else {
        const profiles = await modules.storage.listProfiles();
        data = profiles.map(p => ({
          id: p.id,
          name: p.name,
          version: p.version,
          endpointCount: p.endpoints.length,
          analyzedAt: p.analyzedFrom.analyzedAt,
          confidence: p.metadata.confidence,
        }));
      }
      break;

    case 'targets':
      if (id) {
        data = await modules.storage.loadTarget(id);
      } else {
        const targets = await modules.storage.listTargets();
        data = targets.map(t => ({
          id: t.id,
          name: t.name,
          language: t.language,
          fieldCount: Object.keys(t.fields).length,
          analyzedAt: t.analyzedFrom?.analyzedAt,
        }));
      }
      break;

    case 'mappings':
      if (id) {
        data = await modules.storage.loadMappingById(id);
      } else {
        const mappings = await modules.storage.listMappings();
        data = mappings.map(m => ({
          id: m.id,
          name: m.name,
          source: m.source,
          target: m.target,
          version: m.version,
          updatedAt: m.metadata.updatedAt,
          confidence: m.metadata.confidence,
          fieldCount: m.fieldMappings.length,
          ambiguousCount: m.metadata.ambiguousFields.length,
        }));
      }
      break;

    case 'config':
      data = modules.config.getAll();
      break;

    case 'status': {
      const profiles = await modules.storage.listProfiles();
      const targets = await modules.storage.listTargets();
      const mappings = await modules.storage.listMappings();
      data = {
        profiles: profiles.length,
        targets: targets.length,
        mappings: mappings.length,
        version: '1.0.0',
      };
      break;
    }

    default:
      throw new PluginError('RESOURCE_NOT_FOUND', uri);
  }

  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    }],
  };
}
