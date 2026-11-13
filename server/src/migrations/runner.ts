import fs from 'fs';
import path from 'path';
import os from 'os';
import { MongoClient, Db } from 'mongodb';
import type { Migration, MigrationContext } from './types';

const MIGRATIONS_COLLECTION = '_migrations';
const LOCK_COLLECTION = '_migration_lock';
const LOCK_ID = 'migration-lock';
const LOCK_TTL_MS = 30 * 60 * 1000; // khóa tự hết hạn sau 30 phút nếu tiến trình chết giữa chừng

export const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const FILE_PATTERN = /^\d{14}-[a-z0-9-]+\.(ts|js)$/;

export interface MigrationFile {
  name: string; // tên không đuôi, vd 20261113000001-ensure-indexes
  file: string;
}

export interface AppliedRecord {
  _id: string;
  description: string;
  appliedAt: Date;
  durationMs: number;
  host: string;
}

export function listMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  const seen = new Set<string>();
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => FILE_PATTERN.test(f) && !f.endsWith('.d.ts'))
    .map((f) => ({ name: f.replace(/\.(ts|js)$/, ''), file: path.join(SCRIPTS_DIR, f) }))
    .filter((m) => (seen.has(m.name) ? false : (seen.add(m.name), true)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loadMigration(m: MigrationFile): Migration {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(m.file);
  const mig: Migration = mod.default || mod;
  if (typeof mig?.up !== 'function' || typeof mig?.down !== 'function') {
    throw new Error(`Migration ${m.name} phải export default { description, up, down }`);
  }
  return mig;
}

export function maskUri(uri: string) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

export function isLocalUri(uri: string) {
  return /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri);
}

export async function connect(uri: string): Promise<{ client: MongoClient; db: Db }> {
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return { client, db: client.db() };
}

async function acquireLock(db: Db) {
  const col = db.collection<{ _id: string; lockedAt: Date; host: string; pid: number }>(LOCK_COLLECTION);
  const now = new Date();
  try {
    await col.updateOne(
      // Chỉ khớp khi khóa cũ đã hết hạn; nếu khóa còn hiệu lực => upsert đụng _id => lỗi 11000
      { _id: LOCK_ID, lockedAt: { $lt: new Date(now.getTime() - LOCK_TTL_MS) } },
      { $set: { lockedAt: now, host: os.hostname(), pid: process.pid } },
      { upsert: true }
    );
  } catch (e: any) {
    if (e?.code === 11000) {
      const cur = await col.findOne({ _id: LOCK_ID });
      throw new Error(
        `Đang có tiến trình migration khác chạy (host=${cur?.host}, pid=${cur?.pid}, từ ${cur?.lockedAt?.toISOString()}). ` +
          `Nếu chắc chắn không còn tiến trình nào, chạy: npm run migrate -- unlock`
      );
    }
    throw e;
  }
}

async function releaseLock(db: Db) {
  await db.collection(LOCK_COLLECTION).deleteOne({ _id: LOCK_ID as any });
}

export async function forceUnlock(db: Db) {
  await releaseLock(db);
}

export async function getApplied(db: Db): Promise<AppliedRecord[]> {
  return db
    .collection<AppliedRecord>(MIGRATIONS_COLLECTION)
    .find({})
    .sort({ _id: 1 })
    .toArray();
}

function makeCtx(db: Db, dryRun: boolean, name: string): MigrationContext {
  const log = (...args: unknown[]) => console.log(`  [${name}]`, ...args);
  return {
    db,
    dryRun,
    log,
    write: async (description, fn) => {
      if (dryRun) {
        log(`(dry-run) BỎ QUA GHI: ${description}`);
        return undefined;
      }
      log(`GHI: ${description}`);
      return fn();
    },
  };
}

export async function status(db: Db) {
  const files = listMigrationFiles();
  const applied = new Map((await getApplied(db)).map((a) => [a._id, a]));
  const rows = files.map((f) => ({
    name: f.name,
    state: applied.has(f.name) ? 'APPLIED' : 'PENDING',
    appliedAt: applied.get(f.name)?.appliedAt?.toISOString() || '',
  }));
  // Migration đã chạy nhưng file đã bị xóa khỏi code -> cảnh báo
  for (const a of applied.values()) {
    if (!files.find((f) => f.name === a._id)) {
      rows.push({ name: a._id, state: 'APPLIED (THIẾU FILE!)', appliedAt: a.appliedAt.toISOString() });
    }
  }
  return rows;
}

export async function up(db: Db, opts: { dryRun: boolean; to?: string }) {
  const files = listMigrationFiles();
  const appliedIds = new Set((await getApplied(db)).map((a) => a._id));
  const pending = files.filter((f) => !appliedIds.has(f.name) && (!opts.to || f.name <= opts.to));

  if (pending.length === 0) {
    console.log('✔ Không có migration nào cần chạy.');
    return [];
  }

  if (!opts.dryRun) await acquireLock(db);
  const done: string[] = [];
  try {
    for (const f of pending) {
      const mig = loadMigration(f);
      console.log(`▶ UP ${f.name} — ${mig.description}${opts.dryRun ? ' (DRY-RUN)' : ''}`);
      const start = Date.now();
      await mig.up(makeCtx(db, opts.dryRun, f.name));
      const durationMs = Date.now() - start;
      if (!opts.dryRun) {
        await db.collection<AppliedRecord>(MIGRATIONS_COLLECTION).insertOne({
          _id: f.name,
          description: mig.description,
          appliedAt: new Date(),
          durationMs,
          host: os.hostname(),
        });
      }
      console.log(`✔ ${f.name} (${durationMs}ms)`);
      done.push(f.name);
    }
  } finally {
    if (!opts.dryRun) await releaseLock(db);
  }
  return done;
}

export async function down(db: Db, opts: { dryRun: boolean; steps: number }) {
  const files = new Map(listMigrationFiles().map((f) => [f.name, f]));
  const applied = (await getApplied(db)).reverse().slice(0, Math.max(1, opts.steps));
  if (applied.length === 0) {
    console.log('✔ Không có migration nào để hoàn tác.');
    return [];
  }

  if (!opts.dryRun) await acquireLock(db);
  const done: string[] = [];
  try {
    for (const a of applied) {
      const f = files.get(a._id);
      if (!f) throw new Error(`Không tìm thấy file cho migration ${a._id}, không thể hoàn tác.`);
      const mig = loadMigration(f);
      console.log(`◀ DOWN ${f.name} — ${mig.description}${opts.dryRun ? ' (DRY-RUN)' : ''}`);
      await mig.down(makeCtx(db, opts.dryRun, f.name));
      if (!opts.dryRun) {
        await db.collection<AppliedRecord>(MIGRATIONS_COLLECTION).deleteOne({ _id: f.name });
      }
      console.log(`✔ Đã hoàn tác ${f.name}`);
      done.push(f.name);
    }
  } finally {
    if (!opts.dryRun) await releaseLock(db);
  }
  return done;
}

export function create(rawName: string) {
  const slug = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new Error('Tên migration không hợp lệ');
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const srcDir = path.resolve(__dirname, '../../src/migrations/scripts');
  fs.mkdirSync(srcDir, { recursive: true });
  const file = path.join(srcDir, `${ts}-${slug}.ts`);
  fs.writeFileSync(
    file,
    `import type { Migration } from '../types';

const migration: Migration = {
  description: '${rawName.replace(/'/g, "\\'")}',

  async up({ db, log, write }) {
    // const col = db.collection('orders');
    // const count = await col.countDocuments({ newField: { $exists: false } });
    // log('Số document cần cập nhật:', count);
    // await write(\`set newField cho \${count} orders\`, () =>
    //   col.updateMany({ newField: { $exists: false } }, { $set: { newField: 0 } })
    // );
  },

  async down({ db, write }) {
    // await write('unset newField', () =>
    //   db.collection('orders').updateMany({}, { $unset: { newField: '' } })
    // );
  },
};

export default migration;
`
  );
  return file;
}
