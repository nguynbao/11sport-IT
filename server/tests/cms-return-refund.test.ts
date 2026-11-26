import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { productRepo, staffRepo } from '../src/repositories';

const app = createApp();

describe('CMS Return & Refund (CEO / ADMIN / ACCOUNTANT only)', () => {
  let categoryId = '';
  let prodId = '';
  let orderId = '';
  let salesUserId = '';
  let accountantUserId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const salesStaff = await staffRepo.create({
      code: 'NV_SALES_RET',
      username: 'sales_ret_test',
      passwordHash: 'hash',
      fullName: 'Sales Return Test',
      role: 'SALES',
      department: 'SALES',
      status: 'ACTIVE',
    });
    salesUserId = String(salesStaff._id);

    const accStaff = await staffRepo.create({
      code: 'NV_ACC_RET',
      username: 'acc_ret_test',
      passwordHash: 'hash',
      fullName: 'Accountant Return Test',
      role: 'ACCOUNTANT',
      department: 'OFFICE',
      status: 'ACTIVE',
    });
    accountantUserId = String(accStaff._id);

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'RET_TEST', name: 'Return Test', status: 'ACTIVE' });
    categoryId = catRes.body.data._id;

    const pRes = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Giày Pickleball Test Trả Hàng',
        categoryId,
        unit: 'Đôi',
        costPrice: 400000,
        sellingPrice: 1000000,
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
      });
    prodId = pRes.body.data._id;

    const ordRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', salesUserId)
      .send({
        customerName: 'Khách Trả Hàng',
        customerPhone: '0903333333',
        paymentMethod: 'CASH',
        billDiscountType: 'AMOUNT',
        billDiscountValue: 200000,
        items: [{ productId: prodId, quantity: 2 }],
      });
    orderId = ordRes.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('blocks SALES with 403 RETURN_ROLE_FORBIDDEN on calculate and create RETURN', async () => {
    const calcRes = await request(app)
      .post('/api/v1/returns/calculate')
      .set('x-user-id', salesUserId)
      .send({
        orderId,
        type: 'RETURN',
        returnItems: [{ lineIndex: 0, productId: prodId, quantity: 1, condition: 'GOOD' }],
      });
    expect(calcRes.status).toBe(403);
    expect(calcRes.body.code).toBe('RETURN_ROLE_FORBIDDEN');

    const createRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', salesUserId)
      .send({
        orderId,
        type: 'RETURN',
        refundMethod: 'CASH',
        note: 'Bán hàng tự trả',
        returnItems: [{ lineIndex: 0, productId: prodId, quantity: 1, condition: 'GOOD' }],
      });
    expect(createRes.status).toBe(403);
    expect(createRes.body.code).toBe('RETURN_ROLE_FORBIDDEN');
  });

  it('requires note when ACCOUNTANT creates RETURN', async () => {
    const res = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', accountantUserId)
      .send({
        orderId,
        type: 'RETURN',
        refundMethod: 'CASH',
        note: '   ',
        returnItems: [{ lineIndex: 0, productId: prodId, quantity: 1, condition: 'GOOD' }],
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RETURN_NOTE_REQUIRED');
  });

  it('allows ACCOUNTANT to return GOOD item (restocks Floor 1, refunds actual paid share) and ADMIN to return DAMAGED item (no restock)', async () => {
    // 1. ACCOUNTANT returns 1 GOOD item (order paid 1.800.000 for 2 items => 900.000/item)
    const ret1 = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', accountantUserId)
      .send({
        orderId,
        type: 'RETURN',
        refundMethod: 'BANKING',
        note: 'Khách đổi ý trả lại 1 đôi còn nguyên',
        returnItems: [{ lineIndex: 0, productId: prodId, quantity: 1, condition: 'GOOD' }],
      });
    expect(ret1.status).toBe(201);
    expect(ret1.body.data.returnExchange.type).toBe('RETURN');
    expect(ret1.body.data.returnExchange.returnTotal).toBe(900000);
    expect(ret1.body.data.returnExchange.refundAmount).toBe(900000);
    expect(ret1.body.data.order.status).toBe('PARTIALLY_RETURNED');

    const prodAfter1 = await productRepo.findById(prodId);
    expect(prodAfter1?.stockFloor1).toBe(9); // started 10 - 2 sold + 1 GOOD returned = 9

    // 2. ADMIN returns remaining 1 DAMAGED item (no restock)
    const ret2 = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'admin')
      .send({
        orderId,
        type: 'RETURN',
        refundMethod: 'CASH',
        note: 'Sản phẩm bị lỗi đế',
        returnItems: [{ lineIndex: 0, productId: prodId, quantity: 1, condition: 'DAMAGED' }],
      });
    expect(ret2.status).toBe(201);
    expect(ret2.body.data.returnExchange.returnTotal).toBe(900000);
    expect(ret2.body.data.order.status).toBe('FULLY_RETURNED');

    const prodAfter2 = await productRepo.findById(prodId);
    expect(prodAfter2?.stockFloor1).toBe(9); // DAMAGED does NOT restock
  });
});
