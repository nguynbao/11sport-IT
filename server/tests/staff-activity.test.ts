import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();
const NAME = 'Áo Thun Chạy Bộ (Áo Thun Chạy Bộ ATCB01 Xanh size M)';

describe('v1.4: Báo cáo hoạt động nhân viên (bán hàng / kiểm kho)', () => {
  let importId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
    const cat = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'AO', name: 'Áo' });

    // Thủ kho lập phiếu, quét kiểm 2 chiếc, hoàn thành
    const created = await request(app)
      .post('/api/v1/imports')
      .set('x-user-id', 'warehouse1')
      .send({ defaultCategoryId: cat.body.data._id, items: [{ productName: NAME, expectedQuantity: 2, costPrice: 100000 }] });
    importId = created.body.data._id;
    await request(app).post(`/api/v1/imports/${importId}/finish-listing`).set('x-user-id', 'warehouse1');
    await request(app).post(`/api/v1/imports/${importId}/scan-check`).set('x-user-id', 'warehouse1').send({ productName: NAME });
    await request(app).post(`/api/v1/imports/${importId}/scan-check`).set('x-user-id', 'admin').send({ productName: NAME });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('ghi nhận người quét kiểm trên dòng phiếu và giữ nguyên khi client PUT lại items (không tin dữ liệu client)', async () => {
    const detail = await request(app).get(`/api/v1/imports/${importId}`).set('x-user-id', 'warehouse1');
    const item = detail.body.data.items[0];
    expect(item.scannedQuantity).toBe(2);
    expect(item.checkedByName).toBeTruthy();
    expect(item.scanCounts.length).toBe(2);

    const forged = { ...item, scanCounts: [{ userId: 'x', name: 'Giả mạo', quantity: 99 }] };
    const put = await request(app)
      .put(`/api/v1/imports/${importId}`)
      .set('x-user-id', 'warehouse1')
      .send({ items: [forged] });
    expect(put.body.data.items[0].scanCounts.map((s: any) => s.quantity).sort()).toEqual([1, 1]);

    const done = await request(app)
      .post(`/api/v1/imports/${importId}/complete`)
      .set('x-user-id', 'warehouse1')
      .send({});
    expect(done.status).toBe(200);
  });

  it('bán hàng bởi sales1 rồi xem báo cáo bằng admin', async () => {
    const products = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prod = products.body.data[0];
    await request(app).patch(`/api/v1/products/${prod._id}`).set('x-user-id', 'admin').send({ sellingPrice: 200000 });

    const order = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách A',
        customerPhone: '0900000001',
        paymentMethod: 'CASH',
        items: [{ productId: prod._id, quantity: 1 }],
      });
    expect(order.status).toBe(201);

    const report = await request(app).get('/api/v1/reports/staff-activity').set('x-user-id', 'admin');
    expect(report.status).toBe(200);
    const byUser = (u: string) => report.body.data.staff.find((s: any) => s.username === u);

    const sales1 = byUser('sales1');
    expect(sales1.sales.orders).toBe(1);
    expect(sales1.sales.revenue).toBe(200000);
    expect(sales1.warehouse.unitsScanned).toBe(0);

    const wh = byUser('warehouse1');
    expect(wh.warehouse.importsCreated).toBe(1);
    expect(wh.warehouse.importsCompleted).toBe(1);
    expect(wh.warehouse.unitsScanned).toBe(1);
    expect(wh.warehouse.unitsImported).toBe(2);
    expect(wh.sales.orders).toBe(0);

    expect(byUser('admin').warehouse.unitsScanned).toBe(1);

    expect(report.body.data.sales[0].staffName).toBeTruthy();
    expect(report.body.data.warehouse.some((a: any) => a.type === 'IMPORT_CHECKED')).toBe(true);

    // Lọc theo 1 nhân viên
    const one = await request(app)
      .get(`/api/v1/reports/staff-activity?staffId=${sales1.staffId}`)
      .set('x-user-id', 'admin');
    expect(one.body.data.staff.length).toBe(1);
    expect(one.body.data.warehouse.length).toBe(0);
    expect(one.body.data.sales.length).toBe(1);
  });

  it('chỉ ADMIN được xem', async () => {
    const r = await request(app).get('/api/v1/reports/staff-activity').set('x-user-id', 'sales1');
    expect(r.status).toBe(403);
  });
});
