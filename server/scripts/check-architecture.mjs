import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '../src');

function walkTs(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function getLayer(relPath) {
  const parts = relPath.split(path.sep);
  return parts.length > 1 ? parts[0] : 'root';
}

function getServiceSubdir(relPath) {
  const parts = relPath.split(path.sep);
  if (parts[0] === 'services' && parts.length >= 3) {
    return parts[1];
  }
  return null;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const cand of [base + '.ts', path.join(base, 'index.ts')]) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

const FORBIDDEN = {
  routes: new Set(['services', 'repositories', 'models', 'routes']),
  controllers: new Set(['repositories', 'models', 'routes']),
  services: new Set(['controllers', 'routes']),
  shared: new Set(['services', 'controllers', 'routes', 'repositories']),
  infra: new Set(['services', 'controllers', 'routes', 'repositories', 'models']),
  repositories: new Set(['services', 'controllers', 'routes', 'infra']),
  models: new Set(['services', 'controllers', 'routes', 'repositories', 'infra']),
};

const files = walkTs(SRC_ROOT);
const graph = new Map();
const violations = [];

const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

for (const f of files) {
  const relFrom = path.relative(SRC_ROOT, f);
  const fromLayer = getLayer(relFrom);
  const fromSvcDir = getServiceSubdir(relFrom);
  const isRulesFile = relFrom.endsWith('.rules.ts');
  const content = fs.readFileSync(f, 'utf8');
  const deps = [];

  for (const m of content.matchAll(importRe)) {
    const spec = m[1];
    const target = resolveImport(f, spec);
    if (!target) continue;
    const relTo = path.relative(SRC_ROOT, target);
    const toLayer = getLayer(relTo);
    const toSvcDir = getServiceSubdir(relTo);
    deps.push(relTo);

    if (relFrom === 'routes/index.ts' && toLayer === 'routes') continue;
    const isTypeOnly = m[0].startsWith('import type');
    if (isTypeOnly) continue;

    if (FORBIDDEN[fromLayer]?.has(toLayer)) {
      violations.push(`[LAYER] ${relFrom} (${fromLayer}) -> ${relTo} (${toLayer})`);
    }

    // *.rules.ts must be pure: no repositories or models
    if (isRulesFile && (toLayer === 'repositories' || toLayer === 'models')) {
      violations.push(`[PURE-RULES] ${relFrom} -> ${relTo} (rules files must not import DB/models)`);
    }

    // Cross-domain service imports must go through <domain>/index.ts
    if (fromLayer === 'services' && toLayer === 'services' && toSvcDir && fromSvcDir !== toSvcDir) {
      const targetBase = path.basename(relTo);
      if (targetBase !== 'index.ts') {
        violations.push(`[BARREL] ${relFrom} -> ${relTo} (must import services/${toSvcDir}/index.ts)`);
      }
    }
  }
  graph.set(relFrom, deps);
}

const visited = new Set();
const inStack = new Set();
const cycles = [];

function dfs(node, stack) {
  visited.add(node);
  inStack.add(node);
  for (const next of graph.get(node) || []) {
    if (!visited.has(next)) {
      dfs(next, [...stack, next]);
    } else if (inStack.has(next)) {
      const idx = stack.indexOf(next);
      cycles.push(stack.slice(idx).concat(next).join(' -> '));
    }
  }
  inStack.delete(node);
}

for (const node of graph.keys()) {
  if (!visited.has(node)) dfs(node, [node]);
}

if (violations.length > 0 || cycles.length > 0) {
  if (violations.length > 0) {
    console.error('Architecture violations found:');
    for (const v of violations) console.error('  ' + v);
  }
  if (cycles.length > 0) {
    console.error('Circular dependencies found:');
    for (const c of cycles) console.error('  ' + c);
  }
  process.exit(1);
}

console.log(`[arch-check] OK (${files.length} files checked, 0 violations, 0 cycles)`);
