import type { MappingRule } from '../types/mapping.js';

/**
 * Visual Mapping Editor HTML 생성
 * 매핑 데이터를 임베드한 인터랙티브 에디터 HTML을 생성
 */
export function generateEditorHtml(mapping: MappingRule): string {
  const mappingJson = JSON.stringify(mapping, null, 2);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Mapping Editor - ${escapeHtml(mapping.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    .header { background: #1a1a2e; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 18px; font-weight: 600; }
    .container { display: grid; grid-template-columns: 1fr 100px 1fr; gap: 16px; padding: 24px; max-width: 1400px; margin: 0 auto; }
    .panel { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .panel h2 { font-size: 14px; color: #666; margin-bottom: 12px; text-transform: uppercase; }
    .field-item { padding: 8px 12px; margin: 4px 0; border: 1px solid #e0e0e0; border-radius: 4px; cursor: grab; font-size: 13px; }
    .field-item:hover { border-color: #4a90d9; background: #f0f7ff; }
    .field-item .type { color: #888; font-size: 11px; }
    .connector { display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .connector svg { width: 60px; }
    .actions { padding: 16px 24px; text-align: right; }
    .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; }
    .btn-primary { background: #4a90d9; color: white; }
    .btn-export { background: #28a745; color: white; }
    #mappingData { display: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Mapping Editor: ${escapeHtml(mapping.name)}</h1>
    <div>
      <button class="btn btn-export" onclick="exportMapping()">Export Changes</button>
    </div>
  </div>
  <div class="container">
    <div class="panel" id="sourcePanel">
      <h2>Source Fields</h2>
      <div id="sourceFields"></div>
    </div>
    <div class="connector">
      <svg viewBox="0 0 60 40"><path d="M10 20 H50" stroke="#ccc" stroke-width="2" fill="none" marker-end="url(#arrow)"/><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ccc"/></marker></defs></svg>
    </div>
    <div class="panel" id="targetPanel">
      <h2>Target Fields</h2>
      <div id="targetFields"></div>
    </div>
  </div>
  <div id="mappingData">${escapeHtml(mappingJson)}</div>
  <script>
    const mapping = JSON.parse(document.getElementById('mappingData').textContent);
    const modifications = [];

    function init() {
      const sourceSet = new Set();
      const targetDiv = document.getElementById('targetFields');
      const sourceDiv = document.getElementById('sourceFields');

      mapping.fieldMappings.forEach(fm => {
        const sources = Array.isArray(fm.sourceField) ? fm.sourceField : [fm.sourceField];
        sources.forEach(s => { if (s) sourceSet.add(s); });

        const el = document.createElement('div');
        el.className = 'field-item';
        el.innerHTML = fm.targetField + ' <span class="type">&larr; ' + (fm.sourceField || 'constant') + ' (' + fm.transformation.type + ')</span>';
        el.draggable = true;
        targetDiv.appendChild(el);
      });

      sourceSet.forEach(field => {
        const el = document.createElement('div');
        el.className = 'field-item';
        el.textContent = field;
        el.draggable = true;
        sourceDiv.appendChild(el);
      });
    }

    function exportMapping() {
      const exportData = {
        mappingId: mapping.id,
        modifications: modifications,
        exportedAt: new Date().toISOString(),
        editorVersion: '1.0.0',
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mapping.id + '-editor-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    init();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
