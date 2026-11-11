import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('Service Types & Service Orders API Tests', () => {
  let adminToken = '';
  let salesToken = '';
  let warehouseToken = '';
  let serviceTypeId = '';
  let serviceOrderId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.data.token;

    const salesLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales1', password: '123456' });
    salesToken = salesLogin.body.data.token;

    const warehouseLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'warehouse1', password: '123456' });
    warehouseToken = warehouseLogin.body.data.token;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('should reject unauthenticated requests and unauthorized roles on service endpoints', async () => {
    // 1. Không gửi thông tin xác thực -> 401 UNAUTHORIZED
    const unauthOrders = await request(app).get('/api/v1/service-orders');
    expect(unauthOrders.status).toBe(401);
    expect(unauthOrders.body.code).toBe('UNAUTHORIZED');

    const unauthCreateOrder = await request(app)
      .post('/api/v1/service-orders')
      .send({ customerName: 'A', customerPhone: '0909111222', dueAt: '2026-11-12', items: [] });
    expect(unauthCreateOrder.status).toBe(401);

    // 2. Role SALES không được tạo loại dịch vụ (chỉ ADMIN / ACCOUNTANT) -> 403 FORBIDDEN
    const salesCreateType = await request(app)
      .post('/api/v1/service-types')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Đan vợt', defaultPrice: 40000 });
    expect(salesCreateType.status).toBe(403);
    expect(salesCreateType.body.code).toBe('FORBIDDEN');

    // 3. Role WAREHOUSE không được xem hay tạo đơn dịch vụ -> 403 FORBIDDEN
    const warehouseGetOrders = await request(app)
      .get('/api/v1/service-orders')
      .set('Authorization', `Bearer ${warehouseToken}`);
    expect(warehouseGetOrders.status).toBe(403);
    expect(warehouseGetOrders.body.code).toBe('FORBIDDEN');
  });

  it('should create and list service types from CMS', async () => {
    const createRes = await request(app)
      .post('/api/v1/service-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'DV_DAN_VOT',
        name: 'Đan vợt cầu lông tiêu chuẩn',
        defaultPrice: 40000,
        unit: 'Cây',
        description: 'Công đan vợt 2 nút / 4 nút',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.code).toBe('DV_DAN_VOT');
    expect(createRes.body.data.defaultPrice).toBe(40000);
    serviceTypeId = createRes.body.data._id;

    const listRes = await request(app)
      .get('/api/v1/service-types?status=ACTIVE')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should create a service order from POS with custom price and due date', async () => {
    const createOrderRes = await request(app)
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerName: 'Trần Văn Khách',
        customerPhone: '0912345678',
        receivedAt: '2026-11-11',
        dueAt: '2026-11-12',
        items: [
          {
            serviceTypeId,
            serviceCode: 'DV_DAN_VOT',
            serviceName: 'Đan vợt cầu lông tiêu chuẩn',
            unit: 'Cây',
            defaultPrice: 40000,
            unitPrice: 55000, // sửa lại giá thực tế trên POS
            quantity: 2,
            itemNote: '2 cây Astrox 88D căng 11kg',
          },
        ],
        paidAmount: 60000, // khách đặt cọc trước 60k
        paymentMethod: 'CASH',
        note: 'Khách hẹn chiều mai lấy',
      });

    expect(createOrderRes.status).toBe(201);
    const ord = createOrderRes.body.data;
    expect(ord.orderCode).toBe('DV-0001');
    expect(ord.totalAmount).toBe(110000);
    expect(ord.paidAmount).toBe(60000);
    expect(ord.remainingAmount).toBe(50000);
    expect(ord.paymentStatus).toBe('PARTIAL');
    expect(ord.status).toBe('RECEIVED');
    serviceOrderId = ord._id;
  });

  it('should block reducing order total below already paid amount', async () => {
    // Đơn đã thu 60.000đ, thử sửa giảm xuống còn 1 cây x 40.000đ = 40.000đ (< 60.000đ) -> phải chặn 400 TOTAL_BELOW_PAID_AMOUNT
    const badPatchRes = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            serviceTypeId,
            serviceCode: 'DV_DAN_VOT',
            serviceName: 'Đan vợt cầu lông tiêu chuẩn',
            unit: 'Cây',
            defaultPrice: 40000,
            unitPrice: 40000,
            quantity: 1,
          },
        ],
      });

    expect(badPatchRes.status).toBe(400);
    expect(badPatchRes.body.code).toBe('TOTAL_BELOW_PAID_AMOUNT');
  });

  it('should transition status RECEIVED -> IN_PROGRESS -> READY -> RETURNED and collect remaining amount', async () => {
    const step1 = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect(step1.status).toBe(200);
    expect(step1.body.data.status).toBe('IN_PROGRESS');

    const step2 = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'READY' });
    expect(step2.status).toBe(200);
    expect(step2.body.data.status).toBe('READY');

    const step3 = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        status: 'RETURNED',
        collectAmount: 50000,
        paymentMethod: 'BANKING',
        paymentNote: 'Thu nốt khi trả vợt cho khách',
      });
    expect(step3.status).toBe(200);
    expect(step3.body.data.status).toBe('RETURNED');
    expect(step3.body.data.paidAmount).toBe(110000);
    expect(step3.body.data.remainingAmount).toBe(0);
    expect(step3.body.data.paymentStatus).toBe('PAID');
    expect(step3.body.data.returnedAt).toBeTruthy();
  });

  it('should block deleting a service type that has existing service orders', async () => {
    const delRes = await request(app)
      .delete(`/api/v1/service-types/${serviceTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(400);
    expect(delRes.body.code).toBe('SERVICE_TYPE_IN_USE');
  });
});
