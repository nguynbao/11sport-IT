import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('Service Types & Service Orders API Tests', () => {
  let adminToken = '';
  let salesToken = '';
  let accountantToken = '';
  let marketingToken = '';
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

    const accountantLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'accountant1', password: '123456' });
    accountantToken = accountantLogin.body.data.token;

    const marketingLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'marketing1', password: '123456' });
    marketingToken = marketingLogin.body.data.token;
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

    // 2. Role SALES và ACCOUNTANT không được tạo loại dịch vụ (chỉ CEO / ADMIN) -> 403 FORBIDDEN
    const salesCreateType = await request(app)
      .post('/api/v1/service-types')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Đan vợt', defaultPrice: 40000 });
    expect(salesCreateType.status).toBe(403);
    expect(salesCreateType.body.code).toBe('FORBIDDEN');

    const accountantCreateType = await request(app)
      .post('/api/v1/service-types')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ name: 'Đan vợt KT', defaultPrice: 40000 });
    expect(accountantCreateType.status).toBe(403);
    expect(accountantCreateType.body.code).toBe('FORBIDDEN');

    // 3. Role ACCOUNTANT được XEM đơn dịch vụ (200), nhưng KHÔNG được tạo đơn dịch vụ hay tạo danh mục (403)
    const accountantGetOrders = await request(app)
      .get('/api/v1/service-orders')
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(accountantGetOrders.status).toBe(200);

    const accountantCreateOrder = await request(app)
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ customerName: 'A', customerPhone: '0909111222', dueAt: '2026-11-12', items: [] });
    expect(accountantCreateOrder.status).toBe(403);

    const accountantCreateCategory = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ code: 'KT_CAT', name: 'Danh mục KT' });
    expect(accountantCreateCategory.status).toBe(403);

    // 4. Role MARKETING không được xem hay tạo đơn dịch vụ -> 403 FORBIDDEN
    const marketingGetOrders = await request(app)
      .get('/api/v1/service-orders')
      .set('Authorization', `Bearer ${marketingToken}`);
    expect(marketingGetOrders.status).toBe(403);
    expect(marketingGetOrders.body.code).toBe('FORBIDDEN');
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

  it('should block SALES from updating processing status, allow ADMIN to mark READY, and allow SALES to collect payment & mark RETURNED when READY', async () => {
    const salesTryStatus = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect(salesTryStatus.status).toBe(403);
    expect(salesTryStatus.body.code).toBe('FORBIDDEN');

    const step1 = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect(step1.status).toBe(200);
    expect(step1.body.data.status).toBe('IN_PROGRESS');

    // Khi đang IN_PROGRESS, SALES chưa được bấm RETURNED
    const salesTryReturnWhileInProgress = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'RETURNED', collectAmount: 50000 });
    expect(salesTryReturnWhileInProgress.status).toBe(403);

    const step2 = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'READY' });
    expect(step2.status).toBe(200);
    expect(step2.body.data.status).toBe('READY');

    // Khi đã READY (làm xong), SALES được phép xác nhận thu tiền & trả đồ cho khách
    const step3 = await request(app)
      .patch(`/api/v1/service-orders/${serviceOrderId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        status: 'RETURNED',
        collectAmount: 50000,
        paymentMethod: 'BANKING',
        paymentNote: 'Sales thu nốt tiền khi trả vợt cho khách',
      });
    expect(step3.status).toBe(200);
    expect(step3.body.data.status).toBe('RETURNED');
    expect(step3.body.data.paidAmount).toBe(110000);
    expect(step3.body.data.remainingAmount).toBe(0);
    expect(step3.body.data.paymentStatus).toBe('PAID');
    expect(step3.body.data.returnedAt).toBeTruthy();
  });

  it('should support item discount, bill discount, and card fee (1.8%) on service orders just like POS sales', async () => {
    const res = await request(app)
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerName: 'Lê Hoàng Thẻ',
        customerPhone: '0988777666',
        receivedAt: '2026-11-11',
        dueAt: '2026-11-12',
        items: [
          {
            serviceTypeId,
            serviceCode: 'DV_DAN_VOT',
            serviceName: 'Đan vợt cầu lông tiêu chuẩn',
            unit: 'Cây',
            defaultPrice: 40000,
            unitPrice: 100000,
            quantity: 2, // grossLine = 200.000
            discountType: 'PERCENT',
            discountValue: 10, // giảm 10% = 20.000 -> lineTotal = 180.000
          },
        ],
        billDiscountType: 'AMOUNT',
        billDiscountValue: 30000, // giảm thêm 30.000 -> afterBillDiscount = 150.000
        paymentMethod: 'CARD',
        hasCardFee: true,
        cardFeePercent: 1.8, // 1.8% của 150.000 = 2.700 -> totalAmount = 152.700
        paidAmount: 152700,
      });

    expect(res.status).toBe(201);
    const ord = res.body.data;
    expect(ord.rawSubtotal).toBe(200000);
    expect(ord.itemDiscountTotal).toBe(20000);
    expect(ord.subtotal).toBe(180000);
    expect(ord.billDiscountAmount).toBe(30000);
    expect(ord.hasCardFee).toBe(true);
    expect(ord.cardFeePercent).toBe(1.8);
    expect(ord.cardFee).toBe(2700);
    expect(ord.totalAmount).toBe(152700);
    expect(ord.paidAmount).toBe(152700);
    expect(ord.paymentStatus).toBe('PAID');
  });

  it('should block deleting a service type that has existing service orders', async () => {
    const delRes = await request(app)
      .delete(`/api/v1/service-types/${serviceTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(400);
    expect(delRes.body.code).toBe('SERVICE_TYPE_IN_USE');
  });
});
