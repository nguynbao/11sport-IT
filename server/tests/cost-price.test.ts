import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('v1.1: Giá gốc khi nhập kho & phân quyền giá bán', () => {
  let categoryId = '';
  const productName = 'Quần Short Chạy Bộ (Quần Short Chạy Bộ QSCB01 Đen size M)';
  const productCode = 'QUAN_SHORT_CHAY_BO_QSCB01_DEN_SIZE_M';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'QUAN', name: 'Quần thể thao' });
    categoryId = catRes.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Từ chối giá gốc âm (400 INVALID_COST_PRICE)', async () => {
    const res = await request(app)
      .post('/api/v1/imports')
      .set('x-user-id', 'warehouse1')
      .send({ items: [{ productName, expectedQuantity: 5, costPrice: -1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COST_PRICE');
  });

  it('Hoàn thành nhập kho: tạo SP mới với costPrice theo phiếu, sellingPrice = 0; lần nhập sau cập nhật giá gốc', async () => {
    const runImport = async (qty: number, costPrice: number) => {
      const created = await request(app)
        .post('/api/v1/imports')
        .set('x-user-id', 'warehouse1')
        .send({
          defaultCategoryId: categoryId,
          items: [{ productName, expectedQuantity: qty, actualQuantity: qty, costPrice, isConfirmed: true }],
        });
      expect(created.status).toBe(201);
      expect(created.body.data.items[0].costPrice).toBe(costPrice);
      const done = await request(app)
        .post(`/api/v1/imports/${created.body.data._id}/complete`)
        .set('x-user-id', 'warehouse1')
        .send({});
      expect(done.status).toBe(200);
    };

    await runImport(10, 150000);
    let list = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    let prod = list.body.data.find((p: any) => p.code === productCode);
    expect(prod.costPrice).toBe(150000);
    expect(prod.sellingPrice).toBe(0);
    expect(prod.stock).toBe(10);

    await runImport(5, 160000);
    list = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    prod = list.body.data.find((p: any) => p.code === productCode);
    expect(prod.costPrice).toBe(160000);
    expect(prod.stock).toBe(15);
  });

  it('Chỉ ADMIN được đặt giá bán / sửa giá gốc; SALES không thấy giá gốc', async () => {
    const list = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prod = list.body.data.find((p: any) => p.code === productCode);

    const whPrice = await request(app)
      .patch(`/api/v1/products/${prod._id}`)
      .set('x-user-id', 'warehouse1')
      .send({ sellingPrice: 300000 });
    expect(whPrice.status).toBe(403);
    expect(whPrice.body.code).toBe('SELLING_PRICE_FORBIDDEN');

    const whCost = await request(app)
      .patch(`/api/v1/products/${prod._id}`)
      .set('x-user-id', 'warehouse1')
      .send({ costPrice: 1 });
    expect(whCost.status).toBe(403);
    expect(whCost.body.code).toBe('COST_PRICE_FORBIDDEN');

    const whCreate = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'sales1')
      .send({ name: 'Tất (Tất TT01 Trắng)', categoryId, sellingPrice: 50000 });
    expect(whCreate.status).toBe(403);

    const salesList = await request(app).get('/api/v1/products').set('x-user-id', 'sales1');
    const salesView = salesList.body.data.find((p: any) => p._id === prod._id);
    expect(salesView.costPrice).toBeUndefined();

    const admin = await request(app)
      .patch(`/api/v1/products/${prod._id}`)
      .set('x-user-id', 'admin')
      .send({ sellingPrice: 299000 });
    expect(admin.status).toBe(200);
    expect(admin.body.data.sellingPrice).toBe(299000);
    expect(admin.body.data.costPrice).toBe(160000);
  });
});
