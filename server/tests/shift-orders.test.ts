import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  connectDatabase,
  clearDatabase,
  disconnectDatabase,
  orderRepo,
  shiftAssignmentRepo,
  staffRepo,
} from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { toLocalDateStr } from '../src/routes/ordersCustomers';

const app = createApp();

describe('Shift Bills (Xem Bill trong ca) & Phân quyền xem đơn theo Ca / Ngày cho Sales', () => {
  let adminToken = '';
  let sales1Token = '';
  let sales2Token = '';
  let sales1Id = '';
  let sales2Id = '';
  let productId = '';
  const todayStr = toLocalDateStr(new Date());

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.data.token;

    const sales1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales1', password: '123456' });
    sales1Token = sales1Login.body.data.token;
    sales1Id = sales1Login.body.data.user._id;

    // Tạo thêm nhân viên sales2 cho Ca 2
    const createSales2 = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'NV_SALES2',
        username: 'sales2_shift',
        password: '123456',
        fullName: 'Nhân Viên Sales Ca 2',
        role: 'SALES',
        department: 'SALES',
        status: 'ACTIVE',
      });
    sales2Id = createSales2.body.data._id;

    const sales2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales2_shift', password: '123456' });
    sales2Token = sales2Login.body.data.token;

    // Phân ca hôm nay: sales1 làm SHIFT_1 (Ca 1), sales2 làm SHIFT_2 (Ca 2)
    await shiftAssignmentRepo.create({
      weekStart: todayStr,
      date: todayStr,
      dayOfWeek: 1,
      staffId: String(sales1Id),
      staffCode: 'NV002',
      staffName: 'Nhân Viên Bán Hàng',
      shiftCode: 'SHIFT_1',
      assignedBy: 'HR',
    });

    await shiftAssignmentRepo.create({
      weekStart: todayStr,
      date: todayStr,
      dayOfWeek: 1,
      staffId: String(sales2Id),
      staffCode: 'NV_SALES2',
      staffName: 'Nhân Viên Sales Ca 2',
      shiftCode: 'SHIFT_2',
      assignedBy: 'HR',
    });

    // Tạo danh mục & sản phẩm mẫu tại Kho Tầng 1
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'VOT', name: 'Vợt Pickleball', status: 'ACTIVE' });

    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Vợt Sypik Triton 5 (VOTSYPIKTRITON5)',
        categoryId: catRes.body.data._id,
        unit: 'Cây',
        quantity: 30,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 500000,
        costPrice: 300000,
      });
    productId = prodRes.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('1. Tự động gắn shiftDate & shiftCode theo ca của Sales và cho phép tra cứu Bill mọi ca trong ngày', async () => {
    // Sales 1 (Ca 1) tạo đơn bán hàng
    const orderShift1Res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sales1Token}`)
      .send({
        customerName: 'Khách Mua Ca 1',
        customerPhone: '0909111222',
        paymentMethod: 'CASH',
        items: [{ productId, quantity: 1 }],
      });
    expect(orderShift1Res.status).toBe(201);
    const orderShift1 = orderShift1Res.body.data;
    expect(orderShift1.shiftDate).toBe(todayStr);
    expect(orderShift1.shiftCode).toBe('SHIFT_1');

    // Sales 2 (Ca 2) tạo đơn bán hàng (cùng SĐT khách để kiểm tra cả /customers/lookup)
    const orderShift2Res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({
        customerName: 'Khách Mua Ca 1',
        customerPhone: '0909111222',
        paymentMethod: 'BANKING',
        items: [{ productId, quantity: 2 }],
      });
    expect(orderShift2Res.status).toBe(201);
    const orderShift2 = orderShift2Res.body.data;
    expect(orderShift2.shiftDate).toBe(todayStr);
    expect(orderShift2.shiftCode).toBe('SHIFT_2');

    // Kiểm tra GET /api/v1/orders/current-shift cho Sales 1: xem được bill mọi ca trong ngày (BOTH)
    const currentShift1Res = await request(app)
      .get('/api/v1/orders/current-shift')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(currentShift1Res.status).toBe(200);
    expect(currentShift1Res.body.meta.shiftCode).toBe('BOTH');
    expect(currentShift1Res.body.meta.summary.paidOrdersCount).toBe(2);
    expect(currentShift1Res.body.meta.summary.totalRevenue).toBe(1500000);
    expect(currentShift1Res.body.data.map((o: any) => o._id)).toEqual([
      orderShift2._id,
      orderShift1._id,
    ]);

    // Lọc riêng Ca 2 qua query shiftCode=SHIFT_2 vẫn hoạt động chuẩn xác
    const filterShift2Res = await request(app)
      .get('/api/v1/orders/current-shift?shiftCode=SHIFT_2')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(filterShift2Res.status).toBe(200);
    expect(filterShift2Res.body.meta.shiftCode).toBe('SHIFT_2');
    expect(filterShift2Res.body.data.map((o: any) => o._id)).toEqual([orderShift2._id]);

    // Sales 1 gọi GET /api/v1/orders/:id của đơn Ca 2 -> được phép xem chi tiết
    const detailRes = await request(app)
      .get(`/api/v1/orders/${orderShift2._id}`)
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data._id).toBe(orderShift2._id);

    // Kiểm tra GET /api/v1/customers/lookup cho Sales 1: trả về toàn bộ đơn hàng của khách
    const lookupSales1 = await request(app)
      .get('/api/v1/customers/lookup?phone=0909111222')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(lookupSales1.status).toBe(200);
    expect(lookupSales1.body.data.orders.map((o: any) => o._id)).toEqual([
      orderShift2._id,
      orderShift1._id,
    ]);
  });

  it('2. Bỏ ràng buộc 3 ngày: Sales tra cứu được lịch sử bill & khách hàng mọi ngày cũ', async () => {
    // Tạo 1 đơn hàng của Ca 1 nhưng thuộc ngày hôm qua (2026-11-15)
    const oldOrder = await orderRepo.create({
      orderCode: 'HD-OLD01',
      customerId: '',
      customerName: 'Khách Ngày Cũ',
      customerPhone: '0909111222',
      items: [
        {
          productId,
          productCode: 'VOTSYPIKTRITON5',
          productName: 'Vợt Sypik Triton 5',
          color: '',
          size: '',
          unit: 'Cây',
          originalUnitPrice: 500000,
          unitCost: 300000,
          isGift: false,
          discountType: 'NONE',
          discountValue: 0,
          discountAmount: 0,
          unitPrice: 500000,
          quantity: 1,
          returnedQuantity: 0,
          lineTotal: 500000,
        },
      ],
      rawSubtotal: 500000,
      itemDiscountTotal: 0,
      subtotal: 500000,
      billDiscountType: 'NONE',
      billDiscountValue: 0,
      billDiscountAmount: 0,
      paymentMethod: 'CASH',
      paymentMethodDetail: '',
      splitPayments: [],
      hasCardFee: false,
      cardFeePercent: 0,
      cardFee: 0,
      totalAmount: 500000,
      paidAmount: 500000,
      debtAmount: 0,
      initialDebtAmount: 0,
      debtStatus: 'NONE',
      debtDueDate: null,
      debtPayments: [],
      debtAdjustments: [],
      note: 'Đơn ngày cũ',
      status: 'PAID',
      shiftDate: '2026-01-01',
      shiftCode: 'SHIFT_1',
      createdBy: sales1Id,
      createdByName: 'Nhân Viên Bán Hàng',
      confirmedBy: sales1Id,
      confirmedByName: 'Nhân Viên Bán Hàng',
      confirmedAt: new Date('2026-01-01T10:00:00.000Z'),
    });

    // Sales 1 gọi /orders/current-shift?date=ALL, ?date=2026-01-01 và /orders -> ĐỀU thấy đơn ngày cũ (không còn bị chặn 3 ngày)
    const shiftAllRes = await request(app)
      .get('/api/v1/orders/current-shift?date=ALL')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(shiftAllRes.status).toBe(200);
    expect(shiftAllRes.body.data.some((o: any) => o._id === oldOrder._id)).toBe(true);

    const shiftOldDateRes = await request(app)
      .get('/api/v1/orders/current-shift?date=2026-01-01')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(shiftOldDateRes.status).toBe(200);
    expect(shiftOldDateRes.body.data.some((o: any) => o._id === oldOrder._id)).toBe(true);

    const ordersRes = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(ordersRes.status).toBe(200);
    expect(ordersRes.body.data.some((o: any) => o._id === oldOrder._id)).toBe(true);

    // Sales 1 gọi /customers/lookup?phone=0909111222 -> thấy đầy đủ cả đơn ngày cũ
    const lookupRes = await request(app)
      .get('/api/v1/customers/lookup?phone=0909111222')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.orders.some((o: any) => o._id === oldOrder._id)).toBe(true);

    // Sales 1 gọi trực tiếp GET /orders/:id cho đơn ngày cũ -> được phép xem chi tiết (200)
    const oldDetailRes = await request(app)
      .get(`/api/v1/orders/${oldOrder._id}`)
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(oldDetailRes.status).toBe(200);
    expect(oldDetailRes.body.data.orderCode).toBe('HD-OLD01');

    // Ngoại lệ ở mục 4. Trả / Đổi hàng: Sales tra theo mã đơn (by-code hoặc forReturn=true) để đổi trả cho khách thì được phép
    const returnLookupByCode = await request(app)
      .get('/api/v1/orders/by-code/HD-OLD01')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(returnLookupByCode.status).toBe(200);
    expect(returnLookupByCode.body.data.orderCode).toBe('HD-OLD01');

    const returnSearchRes = await request(app)
      .get('/api/v1/orders?search=HD-OLD01&forReturn=true')
      .set('Authorization', `Bearer ${sales1Token}`);
    expect(returnSearchRes.status).toBe(200);
    expect(returnSearchRes.body.data.some((o: any) => o.orderCode === 'HD-OLD01')).toBe(true);

    // Admin vẫn xem được toàn bộ đơn của mọi ngày và mọi ca
    const adminListRes = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminListRes.status).toBe(200);
    expect(adminListRes.body.data.length).toBe(3);
  });
});
