import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.resolve(__dirname, '../src/routes');
const BASELINE_FILE = path.resolve(__dirname, 'routes-baseline.json');

function collectRoutes() {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts').sort();
  const routes = [];
  const routeRe = /\b\w+Router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (const f of files) {
    const content = fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8');
    for (const m of content.matchAll(routeRe)) {
      routes.push(`${m[1].toUpperCase()} ${m[2]}`);
    }
  }
  return routes.sort();
}

const current = collectRoutes();
const args = process.argv.slice(2);

if (args.includes('--save')) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`[dump-routes] Saved ${current.length} routes to routes-baseline.json`);
} else if (args.includes('--check')) {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('[dump-routes] Missing routes-baseline.json. Run with --save first.');
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  const missing = baseline.filter((r) => !current.includes(r));
  const added = current.filter((r) => !baseline.includes(r));
  if (missing.length || added.length) {
    if (missing.length) console.error('Missing routes:', missing);
    if (added.length) console.error('Added routes:', added);
    process.exit(1);
  }
  console.log(`[dump-routes] OK (${current.length} routes match baseline)`);
} else {
  console.log(current.join('\n'));
}
