import { describe, it, expect } from 'vitest';
import type { EditorExport, EditorModification, ConflictStrategy } from '../../src/core/types/conflict.js';
import { generateEditorHtml } from '../../src/core/validator/editor-generator.js';
import type { MappingRule } from '../../src/core/types/mapping.js';

describe('EditorExport Types', () => {
  it('EditorModification 구조 확인', () => {
    const mod: EditorModification = {
      targetField: 'userName',
      action: 'modify',
      before: { sourceField: 'user_name', transformation: 'rename' },
      after: { sourceField: 'display_name', transformation: 'rename' },
    };
    expect(mod.targetField).toBe('userName');
    expect(mod.action).toBe('modify');
    expect(mod.before?.sourceField).toBe('user_name');
  });

  it('EditorExport 구조 확인', () => {
    const exp: EditorExport = {
      mappingId: 'map-1',
      modifications: [
        { targetField: 'name', action: 'add', after: { sourceField: 'full_name', transformation: 'rename' } },
        { targetField: 'oldField', action: 'remove' },
      ],
      exportedAt: new Date().toISOString(),
      editorVersion: '1.0.0',
    };
    expect(exp.modifications.length).toBe(2);
    expect(exp.editorVersion).toBe('1.0.0');
  });

  it('ConflictStrategy 타입 모든 값 포함', () => {
    const strategies: ConflictStrategy[] = [
      'priority', 'latest', 'custom', 'ask_user',
      'highest_confidence', 'first_match', 'merge', 'user_choice',
    ];
    expect(strategies.length).toBe(8);
  });
});

describe('generateEditorHtml', () => {
  const mockMapping: MappingRule = {
    id: 'test-mapping-1',
    version: 1,
    name: 'UserMapping',
    source: { profileId: 'src-1', endpoint: 'GET /users' },
    target: { language: 'typescript', typeName: 'User' },
    fieldMappings: [
      {
        sourceField: 'user_name',
        targetField: 'userName',
        transformation: { type: 'rename' },
        confidence: 0.95,
        isAmbiguous: false,
        alternatives: [],
      },
    ],
    metadata: {
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      confidence: 0.9,
      ambiguousFields: [],
    },
  };

  it('HTML 에디터 생성', () => {
    const html = generateEditorHtml(mockMapping);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Mapping Editor');
    expect(html).toContain('UserMapping');
    expect(html).toContain('exportMapping');
    expect(html).toContain('Source Fields');
    expect(html).toContain('Target Fields');
  });

  it('매핑 데이터 임베드', () => {
    const html = generateEditorHtml(mockMapping);
    expect(html).toContain('mappingData');
    expect(html).toContain('user_name');
    expect(html).toContain('userName');
  });
});
