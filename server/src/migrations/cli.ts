/**
 * CLI migration DB 11 Sport.
 *
 *   npm run migrate -- status
 *   npm run migrate -- up --dry-run          # xem trước, không ghi
 *   npm run migrate -- up                    # chạy tất cả migration đang chờ
 *   npm run migrate -- up --to <tên>         # chạy tới migration chỉ định
 *   npm run migrate -- down [--steps 1]      # hoàn tác migration gần nhất
 *   npm run migrate -- create "ten migration"
 *   npm run migrate -- unlock                # gỡ khóa khi tiến trình trước bị chết
 *
 * An toàn:
 *  - DB không phải local (Atlas/prod) => bắt buộc thêm --yes cho up/down/unlock.
 *  - Có khóa phân tán (_migration_lock) chống 2 tiến trình chạy cùng lúc.
 *  - KHÔNG fallback in-memory: không kết nối được DB thật => dừng với lỗi.
 */
import dotenv from 'dotenv';
dotenv.config();

import { connect, create, down, forceUnlock, isLocalUri, maskUri, status, up } from './runner';

function getFlag(args: string[], name: string) {
  return args.includes(`--${name}`);
}
function getOpt(args: string[], name: string) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [cmd = 'status', ...args] = process.argv.slice(2);

  if (cmd === 'create') {
    const name = args.filter((a) => !a.startsWith('--')).join(' ');
    const file = create(name);
    console.log(`✔ Đã tạo ${file}`);
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Thiếu biến môi trường MONGODB_URI');

  const dryRun = getFlag(args, 'dry-run');
  const remote = !isLocalUri(uri);
  console.log(`[migrate] DB: ${maskUri(uri)} ${remote ? '(REMOTE)' : '(local)'}`);

  if (remote && !dryRun && ['up', 'down', 'unlock'].includes(cmd) && !getFlag(args, 'yes')) {
    throw new Error(
      'DB REMOTE (staging/production): cần thêm cờ --yes để xác nhận. ' +
        'Khuyến nghị: backup/snapshot trước, chạy --dry-run để xem trước.'
    );
  }

  const { client, db } = await connect(uri);
  try {
    switch (cmd) {
      case 'status': {
        const rows = await status(db);
        if (rows.length === 0) console.log('(chưa có migration nào)');
        console.table(rows);
        break;
      }
      case 'up':
        await up(db, { dryRun, to: getOpt(args, 'to') });
        break;
      case 'down':
        await down(db, { dryRun, steps: Number(getOpt(args, 'steps') || 1) });
        break;
      case 'unlock':
        await forceUnlock(db);
        console.log('✔ Đã gỡ khóa migration');
        break;
      default:
        throw new Error(`Lệnh không hợp lệ: ${cmd}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('✖ Migration lỗi:', err?.message || err);
  process.exit(1);
});
