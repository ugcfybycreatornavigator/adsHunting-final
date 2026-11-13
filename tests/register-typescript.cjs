// Test-only loader for this repo's TypeScript path aliases and JSX.
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  };
} catch {}

const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, parent, ...rest) {
  if (id.startsWith('@/')) id = path.join(__dirname, '..', id.slice(2));
  return resolve.call(this, id, parent, ...rest);
};
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    module._compile(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }, fileName: filename }).outputText, filename);
  };
}
