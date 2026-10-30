const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const raw = path.join(root, 'src', request.slice(2));
    if (fs.existsSync(raw + '.ts')) request = raw + '.ts';
    else if (fs.existsSync(raw + '.tsx')) request = raw + '.tsx';
    else if (fs.existsSync(raw + '/index.ts')) request = raw + '/index.ts';
    else if (fs.existsSync(raw + '/index.tsx')) request = raw + '/index.tsx';
    else request = raw + '.ts';
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const compileTypeScript = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

require.extensions['.ts'] = compileTypeScript;
require.extensions['.tsx'] = compileTypeScript;
