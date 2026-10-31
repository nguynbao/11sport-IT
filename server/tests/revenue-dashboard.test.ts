import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('v2.3: Đổi mật khẩu CMS & Dashboard Doanh thu chi tiết / Sản phẩm bán chạy / Cần đẩy mạnh', () => {
  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('POST /api/v1/auth/change-password: Đổi mật khẩu thành công khi đúng mật khẩu cũ và chặn khi sai mật khẩu cũ', async () => {
    // Sai mật khẩu hiện tại -> 400 INVALID_CURRENT_PASSWORD
    const wrongRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('x-user-id', 'admin')
      .send({ currentPassword: 'wrong_password', newPassword: 'newpassword123' });
    expect(wrongRes.status).toBe(400);
    expect(wrongRes.body.code).toBe('INVALID_CURRENT_PASSWORD');

    // Đúng mật khẩu hiện tại -> 200
    const okRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('x-user-id', 'admin')
      .send({ currentPassword: 'admin123', newPassword: 'newpassword123' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.changed).toBe(true);

    // Đăng nhập bằng mật khẩu mới
    const loginNew = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'newpassword123' });
    expect(loginNew.status).toBe(200);

    // Đổi lại về admin123
    await request(app)
      .post('/api/v1/auth/change-password')
      .set('x-user-id', 'admin')
      .send({ currentPassword: 'newpassword123', newPassword: 'admin123' });
  });

  it('GET /api/v1/reports/revenue-dashboard: Trả về doanh thu thuần, lãi gộp, top SP bán chạy và SP cần đẩy mạnh', async () => {
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'VOT', name: 'Vợt Pickleball' });
    const catId = catRes.body.data._id;

    // SP 1: Bán chạy
    const p1Res = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Vợt Joola Perseus (Vợt Joola Perseus JP01)',
        categoryId: catId,
        unit: 'Cái',
        quantity: 5,
        targetWarehouse: 'FLOOR_1',
        costPrice: 3000000,
        sellingPrice: 4500000,
      });
    const p1 = p1Res.body.data;

    // SP 2: Tồn cao nhưng chưa bán được chiếc nào (cần đẩy mạnh)
    const p2Res = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Giày Mizuno Tồn Cao (Giày Mizuno MZ99)',
        categoryId: catId,
        unit: 'Đôi',
        quantity: 12,
        targetWarehouse: 'FLOOR_2',
        costPrice: 1500000,
        sellingPrice: 2400000,
      });
    const p2 = p2Res.body.data;

    // Tạo 1 đơn hàng bán 3 chiếc SP 1
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách VIP',
        customerPhone: '0912345678',
        paymentMethod: 'BANKING',
        items: [{ productId: p1._id, quantity: 3 }],
      });
    expect(orderRes.status).toBe(201);

    // Chặn role SALES xem dashboard doanh thu
    const forbidden = await request(app)
      .get('/api/v1/reports/revenue-dashboard')
      .set('x-user-id', 'sales1');
    expect(forbidden.status).toBe(403);

    // ADMIN xem dashboard doanh thu
    const dashRes = await request(app)
      .get('/api/v1/reports/revenue-dashboard')
      .set('x-user-id', 'admin');
    expect(dashRes.status).toBe(200);

    const d = dashRes.body.data;
    expect(d.summary.netRevenue).toBe(3 * 4500000);
    expect(d.summary.estimatedCogs).toBe(3 * 3000000);
    expect(d.summary.grossProfit).toBe(3 * 1500000);
    expect(d.summary.totalOrders).toBe(1);
    expect(d.summary.totalUnitsSold).toBe(3);

    expect(d.topSellingProducts.length).toBe(1);
    expect(d.topSellingProducts[0].productCode).toBe(p1.code);
    expect(d.topSellingProducts[0].netSoldQty).toBe(3);

    expect(d.needsPushProducts.length).toBeGreaterThanOrEqual(1);
    const pushP2 = d.needsPushProducts.find((r: any) => r.productCode === p2.code);
    expect(pushP2).toBeDefined();
    expect(pushP2.stockFloor2).toBe(12);
    expect(pushP2.pushReasons.length).toBeGreaterThan(0);
  });
});
