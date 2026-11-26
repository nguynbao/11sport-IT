import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { staffRepo } from '../src/repositories';

const app = createApp();

describe('Exchange Upgrade-Only Rule (Listed Price + CEO/ADMIN Exception)', () => {
  let categoryId = '';
  let lowProdId = '';
  let midProdId = '';
  let highProdId = '';
  let orderForSalesId = '';
  let orderForAdminId = '';
  let salesUserId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const salesStaff = await staffRepo.create({
      code: 'NV_SALES_TEST',
      username: 'sales_test_ex',
      passwordHash: 'hash',
      fullName: 'Sales Test',
      role: 'SALES',
      department: 'SALES',
      status: 'ACTIVE',
    });
    salesUserId = String(salesStaff._id);

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'EX_TEST', name: 'Exchange Test', status: 'ACTIVE' });
    categoryId = catRes.body.data._id;

    const pLow = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Vợt Tập Cơ Bản Test',
        categoryId,
        unit: 'Cái',
        costPrice: 200000,
        sellingPrice: 500000,
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
      });
    lowProdId = pLow.body.data._id;

    const pMid = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Vợt Trung Cấp Test',
        categoryId,
        unit: 'Cái',
        costPrice: 500000,
        sellingPrice: 1000000,
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
      });
    midProdId = pMid.body.data._id;

    const pHigh = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Vợt Cao Cấp Test',
        categoryId,
        unit: 'Cái',
        costPrice: 800000,
        sellingPrice: 1500000,
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
      });
    highProdId = pHigh.body.data._id;

    const o1 = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', salesUserId)
      .send({
        customerName: 'Khách Test 1',
        customerPhone: '0901111111',
        paymentMethod: 'CASH',
        items: [{ productId: midProdId, quantity: 2 }],
      });
    orderForSalesId = o1.body.data._id;

    const o2 = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', salesUserId)
      .send({
        customerName: 'Khách Test 2',
        customerPhone: '0902222222',
        paymentMethod: 'CASH',
        items: [{ productId: midProdId, quantity: 1 }],
      });
    orderForAdminId = o2.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('calculate returns isDowngrade=true and canOverrideDowngrade=false for SALES when exchange < return listed price', async () => {
    const res = await request(app)
      .post('/api/v1/returns/calculate')
      .set('x-user-id', salesUserId)
      .send({
        orderId: orderForSalesId,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: midProdId, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: lowProdId, quantity: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.returnListedTotal).toBe(1000000);
    expect(res.body.data.exchangeListedTotal).toBe(500000);
    expect(res.body.data.listedShortfall).toBe(500000);
    expect(res.body.data.isDowngrade).toBe(true);
    expect(res.body.data.canOverrideDowngrade).toBe(false);
  });

  it('blocks SALES from creating downgrade exchange (400 EXCHANGE_DOWNGRADE_NOT_ALLOWED)', async () => {
    const res = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', salesUserId)
      .send({
        orderId: orderForSalesId,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: midProdId, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: lowProdId, quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EXCHANGE_DOWNGRADE_NOT_ALLOWED');
  });

  it('allows SALES to exchange equal or higher listed price', async () => {
    // Equal listed price (1.000.000 -> 1.000.000)
    const eqRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', salesUserId)
      .send({
        orderId: orderForSalesId,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: midProdId, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: midProdId, quantity: 1 }],
      });
    expect(eqRes.status).toBe(201);

    // Higher listed price (1.000.000 -> 1.500.000)
    const upRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', salesUserId)
      .send({
        orderId: orderForSalesId,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: midProdId, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: highProdId, quantity: 1 }],
      });
    expect(upRes.status).toBe(201);
  });

  it('allows ADMIN/CEO exception to exchange to lower listed price', async () => {
    const calcRes = await request(app)
      .post('/api/v1/returns/calculate')
      .set('x-user-id', 'admin')
      .send({
        orderId: orderForAdminId,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: midProdId, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: lowProdId, quantity: 1 }],
      });
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.data.isDowngrade).toBe(true);
    expect(calcRes.body.data.canOverrideDowngrade).toBe(true);

    const res = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'admin')
      .send({
        orderId: orderForAdminId,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: midProdId, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: lowProdId, quantity: 1 }],
      });
    expect(res.status).toBe(201);
  });
});
