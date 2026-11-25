import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '../src');

function walkSource(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkSource(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function getLayer(relPath) {
  const parts = relPath.split(path.sep);
  return parts.length > 1 ? parts[0] : 'root';
}

function getFeatureName(relPath) {
  const parts = relPath.split(path.sep);
  if (parts[0] === 'features' && parts.length >= 3) {
    return parts[1];
  }
  return null;
}

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) {
    base = path.resolve(SRC_ROOT, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null;
  }

  for (const cand of [
    base,
    base + '.ts',
    base + '.tsx',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

const FORBIDDEN = {
  shared: new Set(['features', 'config', 'app', 'components']),
  config: new Set(['app']),
};

const files = walkSource(SRC_ROOT);
const graph = new Map();
const violations = [];

const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

for (const f of files) {
  const relFrom = path.relative(SRC_ROOT, f);
  const fromLayer = getLayer(relFrom);
  const fromFeature = getFeatureName(relFrom);
  const content = fs.readFileSync(f, 'utf8');
  const deps = [];

  for (const m of content.matchAll(importRe)) {
    const spec = m[1];
    const target = resolveImport(f, spec);
    if (!target) continue;
    const relTo = path.relative(SRC_ROOT, target);
    const toLayer = getLayer(relTo);
    const toFeature = getFeatureName(relTo);
    deps.push(relTo);

    const isTypeOnly = m[0].startsWith('import type');
    if (isTypeOnly) continue;

    if (FORBIDDEN[fromLayer]?.has(toLayer)) {
      violations.push(`[LAYER] ${relFrom} (${fromLayer}) -> ${relTo} (${toLayer})`);
    }

    if (fromLayer === 'features' && toLayer === 'features' && toFeature && fromFeature !== toFeature) {
      const targetBase = path.basename(relTo);
      if (targetBase !== 'index.ts' && targetBase !== 'index.tsx') {
        violations.push(`[BARREL] ${relFrom} -> ${relTo} (must import @/features/${toFeature})`);
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
  stack.push(node);

  for (const dep of graph.get(node) || []) {
    if (!visited.has(dep)) {
      dfs(dep, stack);
    } else if (inStack.has(dep)) {
      const idx = stack.indexOf(dep);
      cycles.push(stack.slice(idx).concat(dep).join(' -> '));
    }
  }

  stack.pop();
  inStack.delete(node);
}

for (const node of graph.keys()) {
  if (!visited.has(node)) dfs(node, []);
}

if (violations.length > 0 || cycles.length > 0) {
  console.error('[arch-check] FAILED');
  for (const v of violations) console.error('  VIOLATION:', v);
  for (const c of cycles) console.error('  CYCLE:', c);
  process.exit(1);
}

console.log(`[arch-check] OK (${files.length} files checked, 0 violations, 0 cycles)`);
