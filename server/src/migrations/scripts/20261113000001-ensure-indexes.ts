import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import type { Migration } from '../types';

/**
 * Đồng bộ index khai báo trong TẤT CẢ Mongoose schema xuống DB.
 * - Chỉ TẠO index còn thiếu, KHÔNG xóa index nào (an toàn cho prod).
 * - Index unique tạo lỗi (do dữ liệu trùng) => cảnh báo và tiếp tục, cần xử lý tay.
 * Có thể chạy lại nhiều lần: tạo một migration mới gọi lại logic này khi thêm index.
 */
function loadAllModels() {
  const modelsDir = path.resolve(__dirname, '../../models');
  for (const f of fs.readdirSync(modelsDir)) {
    if (/\.(ts|js)$/.test(f) && !f.endsWith('.d.ts')) require(path.join(modelsDir, f));
  }
}

const migration: Migration = {
  description: 'Đồng bộ index của tất cả model (chỉ tạo mới, không xóa)',

  async up({ db, log, write }) {
    loadAllModels();
    for (const name of mongoose.modelNames()) {
      const model = mongoose.model(name);
      const colName = model.collection.collectionName;
      const indexes = model.schema.indexes();
      for (const [fields, options] of indexes) {
        const opts = { ...(options || {}) } as Record<string, unknown>;
        delete opts.background;
        const label = `${colName} ${JSON.stringify(fields)}${opts.unique ? ' UNIQUE' : ''}`;
        try {
          await write(`createIndex ${label}`, () => db.collection(colName).createIndex(fields as any, opts));
        } catch (e: any) {
          // 85/86: index đã tồn tại với tên/tùy chọn khác; 11000: dữ liệu trùng khi tạo unique
          log(`⚠ Bỏ qua index ${label}: ${e?.codeName || ''} ${e?.message || e}`);
        }
      }
    }
  },

  async down({ log }) {
    log('Không xóa index khi hoàn tác (an toàn). Không có thay đổi.');
  },
};

export default migration;
