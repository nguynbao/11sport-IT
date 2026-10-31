import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('Promotions API & POS Auto-Gift / Auto-Discount Tests', () => {
  let adminToken = '';
  let salesToken = '';
  let mainProductId = '';
  let accessoryProductId = '';
  let categoryId = '';

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
    salesToken = salesLogin.body.data?.token || '';

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'VOT', name: 'Vợt Pickleball', status: 'ACTIVE' });
    categoryId = catRes.body.data._id;

    // Tạo 1 sản phẩm chính (Vợt) và 1 phụ kiện tặng kèm (Quấn cán) tại Kho Tầng 1
    const mainRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Vợt Pickleball Joola Pro IV (VOT_JOOLA_PRO_IV_TEST)',
        categoryId,
        unit: 'Cây',
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 5500000,
        costPrice: 4200000,
      });
    mainProductId = mainRes.body.data._id;

    const accRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Quấn cán Vợt 11Sport (QUAN_CAN_11SPORT_TEST)',
        categoryId,
        unit: 'Cái',
        quantity: 20,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 50000,
        costPrice: 20000,
      });
    accessoryProductId = accRes.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Chặn role SALES tạo chương trình khuyến mãi (chỉ ADMIN được phép)', async () => {
    const res = await request(app)
      .post('/api/v1/promotions')
      .set('x-user-id', 'sales1')
      .send({
        name: 'KM Test Sales',
        isPermanent: true,
        conditionType: 'BUY_PRODUCTS',
        conditionProductIds: [mainProductId],
        giftItems: [{ productId: accessoryProductId, quantity: 1 }],
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROMOTION_FORBIDDEN');
  });

  it('ADMIN tạo chương trình chạy vĩnh viễn: Mua Vợt mặc định tặng kèm Quấn cán + Giảm 5% SP', async () => {
    const createRes = await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Mua Vợt Joola tặng kèm 2 Quấn cán + Giảm 5%',
        description: 'Tự động tặng kèm phụ kiện khi thêm vào giỏ POS',
        status: 'ACTIVE',
        isPermanent: true,
        conditionType: 'BUY_PRODUCTS',
        conditionProductIds: [mainProductId],
        minQuantity: 1,
        giftItems: [{ productId: accessoryProductId, quantity: 2 }],
        multiplyGiftByConditionQty: true,
        itemDiscountType: 'PERCENT',
        itemDiscountValue: 5,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.code).toMatch(/^KM-/);
    expect(createRes.body.data.isCurrentlyActive).toBe(true);
    expect(createRes.body.data.effectiveStatus).toBe('RUNNING_PERMANENT');
    expect(createRes.body.data.giftItems).toHaveLength(1);
    expect(createRes.body.data.giftItems[0].quantity).toBe(2);

    // Kiểm tra evaluate khi Sales thêm 2 cây vợt vào giỏ hàng
    const evalRes = await request(app)
      .post('/api/v1/promotions/evaluate')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        items: [{ productId: mainProductId, quantity: 2 }],
      });

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.data.appliedPromotions).toHaveLength(1);
    expect(evalRes.body.data.appliedPromotions[0].multiplier).toBe(2);
    // Mua 2 cây vợt -> tự động tặng 2 * 2 = 4 cái quấn cán
    expect(evalRes.body.data.autoGiftItems).toHaveLength(1);
    expect(evalRes.body.data.autoGiftItems[0].productId).toBe(accessoryProductId);
    expect(evalRes.body.data.autoGiftItems[0].quantity).toBe(4);
    // Tự động giảm 5% trên dòng Vợt
    expect(evalRes.body.data.itemDiscounts).toHaveLength(1);
    expect(evalRes.body.data.itemDiscounts[0].discountType).toBe('PERCENT');
    expect(evalRes.body.data.itemDiscounts[0].discountValue).toBe(5);
  });

  it('Kiểm tra chương trình có thời hạn (đã hết hạn sẽ không tự động kích hoạt khi activeOnly=true)', async () => {
    const expiredRes = await request(app)
      .post('/api/v1/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'KM Đã hết hạn năm 2020',
        status: 'ACTIVE',
        isPermanent: false,
        startDate: '2020-01-01T00:00:00.000Z',
        endDate: '2020-01-10T23:59:59.000Z',
        conditionType: 'ALL_PRODUCTS',
        minQuantity: 1,
        billDiscountType: 'AMOUNT',
        billDiscountValue: 100000,
      });

    expect(expiredRes.status).toBe(201);
    expect(expiredRes.body.data.isCurrentlyActive).toBe(false);
    expect(expiredRes.body.data.effectiveStatus).toBe('EXPIRED');

    const activeList = await request(app).get('/api/v1/promotions?activeOnly=true');
    expect(activeList.status).toBe(200);
    expect(
      activeList.body.data.some((p: any) => p._id === expiredRes.body.data._id)
    ).toBe(false);
  });
});
