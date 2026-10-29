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

describe('POST /imports/:id/scan-check (v1.2)', () => {
  let importId = '';

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
        items: NAMES.map((n, i) => ({ productName: n, expectedQuantity: 10 + i })),
      });
    importId = created.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('chặn quét khi phiếu chưa chốt danh sách (DRAFT)', async () => {
    const r = await request(app).post(`/api/v1/imports/${importId}/scan-check`).send({ query: 'QSCB01' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('IMPORT_NOT_CHECKING');
  });

  it('quét khớp => tick xác nhận, KHÔNG đổi số lượng, KHÔNG thêm dòng', async () => {
    await request(app).post(`/api/v1/imports/${importId}/finish-listing`);

    const r = await request(app)
      .post(`/api/v1/imports/${importId}/scan-check`)
      .send({ productCode: 'QSCB01', productName: 'Quần Short QSCB01 Đen M' });
    expect(r.status).toBe(200);
    expect(r.body.data.matched).toBe(true);
    expect(r.body.data.matchedIndex).toBe(2);
    const row = r.body.data.receipt.items[2];
    expect(row.isChecked).toBe(true);
    expect(row.isConfirmed).toBe(true);
    expect(row.actualQuantity).toBe(12);
    expect(r.body.data.progress).toEqual({ checked: 1, total: 3 });

    // Quét lại cùng tag => alreadyChecked
    const again = await request(app)
      .post(`/api/v1/imports/${importId}/scan-check`)
      .send({ productCode: 'QSCB01', productName: 'Quần Short QSCB01 Đen M' });
    expect(again.body.data.alreadyChecked).toBe(true);
  });

  it('tag không có trong danh sách => cảnh báo, không thêm dòng', async () => {
    const r = await request(app)
      .post(`/api/v1/imports/${importId}/scan-check`)
      .send({ productCode: 'ZZZ12345', productName: 'Tất ZZZ12345' });
    expect(r.status).toBe(200);
    expect(r.body.data.matched).toBe(false);
    expect(r.body.data.warning).toBeTruthy();
    expect(r.body.data.receipt.items.length).toBe(3);
  });

  it('trùng nhiều dòng => trả candidates, chọn bằng rowIndex', async () => {
    const r = await request(app)
      .post(`/api/v1/imports/${importId}/scan-check`)
      .send({ productCode: 'KMAP262510' });
    expect(r.body.data.ambiguous).toBe(true);
    expect(r.body.data.candidates.length).toBe(2);

    const pick = await request(app)
      .post(`/api/v1/imports/${importId}/scan-check`)
      .send({ rowIndex: r.body.data.candidates[1].index });
    expect(pick.body.data.matched).toBe(true);
    expect(pick.body.data.progress.checked).toBe(2);
  });
});
