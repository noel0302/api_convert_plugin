import type { MappingRule } from '../types/mapping.js';

export function generateTestPageHtml(mapping: MappingRule): string {
  const mappingJson = JSON.stringify(mapping, null, 2);
  const fields = mapping.fieldMappings;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${mapping.name} - Mapping Test Page</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    h1 { margin-bottom: 20px; color: #333; }
    .container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1200px; margin: 0 auto; }
    .panel { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .panel h2 { margin-bottom: 15px; color: #555; font-size: 16px; }
    textarea { width: 100%; height: 300px; font-family: monospace; font-size: 13px; border: 1px solid #ddd; border-radius: 4px; padding: 10px; resize: vertical; }
    button { background: #0066cc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; margin: 10px 0; }
    button:hover { background: #0052a3; }
    .result { background: #f8f8f8; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 13px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
    .field-list { list-style: none; }
    .field-list li { padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
    .field-list .source { color: #0066cc; }
    .field-list .target { color: #009933; }
    .field-list .transform { color: #996600; font-style: italic; }
    .confidence { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
    .confidence.high { background: #d4edda; color: #155724; }
    .confidence.low { background: #fff3cd; color: #856404; }
    .full-width { grid-column: 1 / -1; }
    #status { padding: 10px; border-radius: 4px; margin-bottom: 10px; display: none; }
    #status.success { display: block; background: #d4edda; color: #155724; }
    #status.error { display: block; background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <h1>${mapping.name} - Mapping Test</h1>
  <div id="status"></div>
  <div class="container">
    <div class="panel">
      <h2>Source Input (JSON)</h2>
      <textarea id="sourceInput">{
${fields.filter(f => f.sourceField !== null).map(f => {
    const field = Array.isArray(f.sourceField) ? f.sourceField[0] : f.sourceField!;
    return `  "${field}": ""`;
  }).join(',\n')}
}</textarea>
      <button onclick="runTransform()">Run Transform</button>
    </div>
    <div class="panel">
      <h2>Transformed Output</h2>
      <div id="output" class="result">Click "Run Transform" to see results</div>
    </div>
    <div class="panel full-width">
      <h2>Field Mappings (${fields.length} fields)</h2>
      <ul class="field-list">
${fields.map(f => {
    const src = f.sourceField === null ? '(constant)' : (Array.isArray(f.sourceField) ? f.sourceField.join(', ') : f.sourceField);
    const conf = f.confidence >= 0.9 ? 'high' : 'low';
    return `        <li><span class="source">${src}</span> → <span class="target">${f.targetField}</span> <span class="transform">[${f.transformation.type}]</span> <span class="confidence ${conf}">${(f.confidence * 100).toFixed(0)}%</span></li>`;
  }).join('\n')}
      </ul>
    </div>
  </div>

  <script id="mapping-data" type="application/json">${mappingJson}</script>
  <script>
    const mapping = JSON.parse(document.getElementById('mapping-data').textContent);

    function runTransform() {
      const status = document.getElementById('status');
      try {
        const input = JSON.parse(document.getElementById('sourceInput').value);
        const output = {};

        for (const fm of mapping.fieldMappings) {
          if (fm.sourceField === null) {
            output[fm.targetField] = fm.transformation.config?.value ?? null;
            continue;
          }
          const field = Array.isArray(fm.sourceField) ? fm.sourceField[0] : fm.sourceField;
          const parts = field.split('.');
          let value = input;
          for (const part of parts) {
            if (value == null) break;
            value = value[part];
          }
          output[fm.targetField] = value ?? null;
        }

        document.getElementById('output').textContent = JSON.stringify(output, null, 2);
        status.className = 'success';
        status.textContent = 'Transform successful! ' + Object.keys(output).length + ' fields mapped.';
      } catch (err) {
        document.getElementById('output').textContent = 'Error: ' + err.message;
        status.className = 'error';
        status.textContent = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}
