import type { Db, ClientSession } from 'mongodb';

/**
 * Ngữ cảnh truyền vào mỗi migration.
 * - db: driver MongoDB gốc (KHÔNG dùng Mongoose model để migration không phụ thuộc schema hiện tại).
 * - dryRun: true => chỉ được đọc + log, KHÔNG ghi. Migration phải tự tôn trọng cờ này
 *   (khuyến nghị dùng ctx.write(...) để tự động bỏ qua khi dry-run).
 */
export interface MigrationContext {
  db: Db;
  dryRun: boolean;
  session?: ClientSession;
  log: (...args: unknown[]) => void;
  /** Bọc mọi thao tác ghi: dry-run thì chỉ log mô tả, không thực thi. */
  write: <T>(description: string, fn: () => Promise<T>) => Promise<T | undefined>;
}

export interface Migration {
  /** Mô tả ngắn, hiển thị ở `migrate:status`. */
  description: string;
  up: (ctx: MigrationContext) => Promise<void>;
  /** Hoàn tác. Nếu không thể hoàn tác an toàn thì throw lỗi rõ ràng. */
  down: (ctx: MigrationContext) => Promise<void>;
}
