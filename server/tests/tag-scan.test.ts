import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { matchTagToItems } from '../src/utils/tagMatch';
import { generateProductCode } from '../src/utils/productCode';

const app = createApp();

const NAMES = [
  'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)',
  'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size M)',
  'Quần Short Chạy Bộ (Quần Short Chạy Bộ QSCB01 Đen size M)',
];
const items = NAMES.map((n) => ({ productName: n, productCode: generateProductCode(n), isChecked: false }));

describe('matchTagToItems', () => {
  it('khớp chính xác mã hàng', () => {
    expect(matchTagToItems(items, { productName: NAMES[2] }).index).toBe(2);
  });

  it('khớp theo SKU + màu/size trên tag', () => {
    expect(matchTagToItems(items, { productCode: 'KMAP262510', productName: 'Áo Polo KMAP262510 Đỏ L' }).index).toBe(0);
    expect(matchTagToItems(items, { productCode: 'KMAP262510', productName: 'KMAP262510 Đỏ size M' }).index).toBe(1);
  });

  it('SKU trùng nhiều dòng mà không rõ size => ambiguous', () => {
    const r = matchTagToItems(items, { productCode: 'KMAP262510' });
    expect(r.index).toBeNull();
    expect(r.ambiguous).toBe(true);
    expect(r.candidates.sort()).toEqual([0, 1]);
  });

  it('không có trong danh sách => null', () => {
    const r = matchTagToItems(items, { productCode: 'XYZ99999', productName: 'Giày chạy bộ XYZ99999' });
    expect(r.index).toBeNull();
    expect(r.ambiguous).toBe(false);
  });
});

describe('POST /imports/:id/scan-check (v1.3 — đếm từng chiếc)', () => {
  let importId = '';
  const scan = (body: Record<string, any>) =>
    request(app).post(`/api/v1/imports/${importId}/scan-check`).send(body);

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
    const cat = await request(app).post('/api/v1/categories').send({ code: 'AO', name: 'Áo' });
    const created = await request(app)
      .post('/api/v1/imports')
      .send({
        defaultCategoryId: cat.body.data._id,
        // dòng 0: SL 2, dòng 1: SL 1, dòng 2: SL 2
        items: NAMES.map((n, i) => ({ productName: n, expectedQuantity: i === 1 ? 1 : 2 })),
      });
    importId = created.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('chặn quét khi phiếu chưa chốt danh sách (DRAFT)', async () => {
    const r = await scan({ query: 'QSCB01' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('IMPORT_NOT_CHECKING');
  });

  it('cùng 1 mã SL 2: quét lần 1 = 1/2 (chưa tick), lần 2 = 2/2 (tick), lần 3 = đã đủ (không cộng)', async () => {
    await request(app).post(`/api/v1/imports/${importId}/finish-listing`);
    const tag = { productCode: 'QSCB01', productName: 'Quần Short QSCB01 Đen M' };

    const r1 = await scan(tag);
    expect(r1.body.data.matched).toBe(true);
    expect(r1.body.data.matchedIndex).toBe(2);
    expect(r1.body.data.scannedQuantity).toBe(1);
    expect(r1.body.data.isFull).toBe(false);
    expect(r1.body.data.receipt.items[2].isConfirmed).toBe(false);
    expect(r1.body.data.receipt.items[2].actualQuantity).toBe(1);

    const r2 = await scan(tag);
    expect(r2.body.data.alreadyFull).toBe(false);
    expect(r2.body.data.scannedQuantity).toBe(2);
    expect(r2.body.data.isFull).toBe(true);
    const row = r2.body.data.receipt.items[2];
    expect(row.isChecked).toBe(true);
    expect(row.isConfirmed).toBe(true);
    expect(row.actualQuantity).toBe(2);
    expect(r2.body.data.progress).toMatchObject({ checked: 1, total: 3, scannedUnits: 2, expectedUnits: 5 });

    const r3 = await scan(tag);
    expect(r3.body.data.alreadyFull).toBe(true);
    expect(r3.body.data.warning).toBeTruthy();
    expect(r3.body.data.receipt.items[2].scannedQuantity).toBe(2);
  });

  it('hoàn tác 1 lần quét (delta = -1) => bỏ tick khi chưa đủ', async () => {
    const r = await scan({ rowIndex: 2, delta: -1 });
    expect(r.body.data.scannedQuantity).toBe(1);
    expect(r.body.data.receipt.items[2].isConfirmed).toBe(false);
    // quét lại cho đủ
    const again = await scan({ rowIndex: 2 });
    expect(again.body.data.isFull).toBe(true);
  });

  it('tag không có trong danh sách => cảnh báo, không thêm dòng', async () => {
    const r = await scan({ productCode: 'ZZZ12345', productName: 'Tất ZZZ12345' });
    expect(r.status).toBe(200);
    expect(r.body.data.matched).toBe(false);
    expect(r.body.data.warning).toBeTruthy();
    expect(r.body.data.receipt.items.length).toBe(3);
  });

  it('SKU trùng 2 dòng: ambiguous; khi 1 dòng đã đủ thì tự chọn dòng còn thiếu', async () => {
    const r = await scan({ productCode: 'KMAP262510' });
    expect(r.body.data.ambiguous).toBe(true);
    expect(r.body.data.candidates.length).toBe(2);

    // dòng 1 (SL 1) -> chọn tay, đủ ngay
    const pick = await scan({ rowIndex: 1 });
    expect(pick.body.data.isFull).toBe(true);

    // Quét lại SKU chung => tự rơi vào dòng 0 (chưa đủ)
    const auto = await scan({ productCode: 'KMAP262510' });
    expect(auto.body.data.matched).toBe(true);
    expect(auto.body.data.matchedIndex).toBe(0);
    expect(auto.body.data.scannedQuantity).toBe(1);
  });

  it('PUT lưu nháp giữ nguyên scannedQuantity', async () => {
    const detail = await request(app).get(`/api/v1/imports/${importId}`);
    const put = await request(app)
      .put(`/api/v1/imports/${importId}`)
      .send({ items: detail.body.data.items });
    expect(put.body.data.items[0].scannedQuantity).toBe(1);
    expect(put.body.data.items[2].scannedQuantity).toBe(2);
  });
});
