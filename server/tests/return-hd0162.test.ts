import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  connectDatabase,
  clearDatabase,
  disconnectDatabase,
  orderRepo,
  returnExchangeRepo,
} from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('Regression Test: Hoàn trả đơn HD-0162 (nhiều biến thể cùng productId + hàng tặng 0đ)', () => {
  let categoryId = '';
  let kamitoProdId = '';
  let selkirkProdId = '';
  let sypikProdId = '';
  let ligproProdId = '';
  let giftEdgeProdId = '';
  let giftCoverProdId = '';
  let hd0162OrderId = '';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'PICKLEBALL_HD0162', name: 'Pickleball HD-0162', status: 'ACTIVE' });
    categoryId = catRes.body.data._id;

    // 1. Kamito ALPHA 2
    const p1 = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'VKAMITO326088',
        name: 'Kamito ALPHA 2',
        categoryId,
        unit: 'Cái',
        sellingPrice: 2300000,
        costPrice: 1700000,
        variants: [
          { color: 'Đỏ tím 12', size: '', stockFloor1: 1, stockFloor2: 0 },
          { color: 'Tím hồng 82', size: '', stockFloor1: 1, stockFloor2: 0 },
        ],
      });
    kamitoProdId = p1.body.data._id;

    // 2. Selkirk SLK (2 màu trong cùng đơn HD-0162)
    const p2 = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'VSELKIRK780940',
        name: 'Selkirk SLK',
        categoryId,
        unit: 'Cái',
        sellingPrice: 3000000,
        costPrice: 2200000,
        variants: [
          { color: 'Era Power Widebody Volt', size: '', stockFloor1: 2, stockFloor2: 0 },
          { color: 'Dauntless Widebody Electric Sunset', size: '', stockFloor1: 1, stockFloor2: 0 },
        ],
      });
    selkirkProdId = p2.body.data._id;

    // 3. SYPIK Triton 5 (2 màu trong cùng đơn HD-0162)
    const p3 = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'VSYPIK627952',
        name: 'SYPIK Triton 5',
        categoryId,
        unit: 'Cái',
        sellingPrice: 4500000,
        costPrice: 3400000,
        variants: [
          { color: 'Hồng', size: '', stockFloor1: 2, stockFloor2: 0 },
          { color: 'Xanh Dương', size: '', stockFloor1: 1, stockFloor2: 0 },
        ],
      });
    sypikProdId = p3.body.data._id;

    // 4. Ligpro Pro Xtreme (không chia biến thể)
    const p4 = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'PLIGPRO337543',
        name: 'Ligpro Pro Xtreme',
        categoryId,
        unit: 'Chai',
        quantity: 7,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 140000,
        costPrice: 90000,
      });
    ligproProdId = p4.body.data._id;

    // 5. Quà tặng 1: Dán viền vợt
    const p5 = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'PNN642163',
        name: 'Dán viền vợt',
        categoryId,
        unit: 'Cái',
        quantity: 308,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 25000,
        costPrice: 10000,
      });
    giftEdgeProdId = p5.body.data._id;

    // 6. Quà tặng 2: Bảo vệ mặt vợt 11 SPORT
    const p6 = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'PNN972497',
        name: 'Bảo vệ mặt vợt 11 SPORT',
        categoryId,
        unit: 'Cái',
        quantity: 34,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 40000,
        costPrice: 15000,
      });
    giftCoverProdId = p6.body.data._id;

    // Tạo đơn mô phỏng chính xác cấu trúc đơn HD-0162
    const createOrd = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách lẻ',
        customerPhone: '0000',
        paymentMethod: 'CARD',
        hasCardFee: true,
        cardFeePercent: 4,
        billDiscountType: 'AMOUNT',
        billDiscountValue: 320000,
        items: [
          { productId: kamitoProdId, color: 'Tím hồng 82', quantity: 1 },
          { productId: selkirkProdId, color: 'Dauntless Widebody Electric Sunset', quantity: 1 },
          { productId: selkirkProdId, color: 'Era Power Widebody Volt', quantity: 1 },
          { productId: sypikProdId, color: 'Hồng', quantity: 1 },
          { productId: sypikProdId, color: 'Xanh Dương', quantity: 1 },
          { productId: ligproProdId, quantity: 3 },
          { productId: giftEdgeProdId, quantity: 5, isGift: true, discountType: 'GIFT' },
          { productId: giftCoverProdId, quantity: 5, isGift: true, discountType: 'GIFT' },
        ],
      });

    expect(createOrd.status).toBe(201);
    hd0162OrderId = createOrd.body.data._id;
    await orderRepo.updateById(hd0162OrderId, { orderCode: 'HD-0162' });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('1. Trả riêng biến thể thứ 2 (Selkirk SLK - Era Power Widebody Volt) với payload có lineIndex + color -> cộng đúng biến thể & đúng dòng', async () => {
    const res = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: hd0162OrderId,
        type: 'RETURN',
        refundMethod: 'CASH',
        note: 'Khách trả 1 cây Selkirk Volt',
        returnItems: [
          {
            lineIndex: 2,
            productId: selkirkProdId,
            color: 'Era Power Widebody Volt',
            size: '',
            quantity: 1,
            condition: 'GOOD',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.returnExchange.refundAmount).toBe(3000000);
    expect(res.body.data.order.status).toBe('PARTIALLY_RETURNED');
    // Dòng 1 (Dauntless) vẫn chưa trả, dòng 2 (Era Power) đã trả 1
    expect(res.body.data.order.items[1].returnedQuantity).toBe(0);
    expect(res.body.data.order.items[2].returnedQuantity).toBe(1);

    const prodsRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const selkirkAfter = prodsRes.body.data.find((p: any) => p._id === selkirkProdId);
    const vDauntless = selkirkAfter.variants.find(
      (v: any) => v.color === 'Dauntless Widebody Electric Sunset'
    );
    const vVolt = selkirkAfter.variants.find((v: any) => v.color === 'Era Power Widebody Volt');
    expect(vDauntless.stockFloor1).toBe(0); // ban đầu 1, bán 1 = 0
    expect(vVolt.stockFloor1).toBe(2); // ban đầu 2, bán 1 = 1, trả lại 1 = 2
  });

  it('2. Hoàn trả toàn bộ phần còn lại của HD-0162 (kể cả khi client cũ gửi thiếu color/size cho 2 dòng SYPIK Triton 5 + trả kèm hàng tặng 0đ) -> 201 FULLY_RETURNED', async () => {
    // Payload mô phỏng cả client cũ không gửi color/size/lineIndex cho nhiều dòng cùng productId
    const res = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderCode: 'HD-0162',
        type: 'RETURN',
        refundMethod: 'BANKING',
        note: 'Hoàn trả toàn bộ phần còn lại của đơn HD-0162',
        returnItems: [
          { productId: kamitoProdId, quantity: 1, condition: 'GOOD' },
          { productId: selkirkProdId, quantity: 1, condition: 'GOOD' }, // Tự động khớp dòng Dauntless còn lại!
          { productId: sypikProdId, quantity: 1, condition: 'GOOD' }, // Tự động khớp dòng Hồng
          { productId: sypikProdId, quantity: 1, condition: 'GOOD' }, // Tự động khớp sang dòng Xanh Dương (không lỗi EXCEED_RETURNABLE_QUANTITY!)
          { productId: ligproProdId, quantity: 3, condition: 'GOOD' },
          { productId: giftEdgeProdId, quantity: 5, condition: 'GOOD' },
          { productId: giftCoverProdId, quantity: 5, condition: 'GOOD' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe('FULLY_RETURNED');
    expect(res.body.data.returnExchange.refundAmount).toBe(
      2300000 + 3000000 + 4500000 + 4500000 + 420000
    );

    const prodsRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const selkirkAfter = prodsRes.body.data.find((p: any) => p._id === selkirkProdId);
    const vDauntless = selkirkAfter.variants.find(
      (v: any) => v.color === 'Dauntless Widebody Electric Sunset'
    );
    expect(vDauntless.stockFloor1).toBe(1);

    const sypikAfter = prodsRes.body.data.find((p: any) => p._id === sypikProdId);
    const vHong = sypikAfter.variants.find((v: any) => v.color === 'Hồng');
    const vXanh = sypikAfter.variants.find((v: any) => v.color === 'Xanh Dương');
    expect(vHong.stockFloor1).toBe(2);
    expect(vXanh.stockFloor1).toBe(1);
  });

  it('3. Đơn có 1 dòng mua + 1 dòng tặng cùng productId & cùng màu/size -> cập nhật đúng returnedQuantity theo lineIndex và sinh mã phiếu không trùng sau khi xóa', async () => {
    const ordRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Mua 1 Tặng 1 Cùng SP',
        customerPhone: '0911222333',
        paymentMethod: 'CASH',
        items: [
          { productId: ligproProdId, quantity: 2 },
          { productId: ligproProdId, quantity: 1, isGift: true, discountType: 'GIFT' },
        ],
      });
    expect(ordRes.status).toBe(201);

    // Xóa thử 1 bản ghi return cũ để kiểm tra chống trùng mã TH-xxxx
    const existingReturns = await returnExchangeRepo.find({});
    if (existingReturns.length > 0) {
      await returnExchangeRepo.deleteById(existingReturns[0]._id);
    }

    const retRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: ordRes.body.data._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [
          {
            lineIndex: 0,
            productId: ligproProdId,
            quantity: 1,
            condition: 'GOOD',
          },
        ],
      });

    expect(retRes.status).toBe(201);
    expect(retRes.body.data.returnExchange.refundAmount).toBe(140000);
    expect(retRes.body.data.order.items[0].returnedQuantity).toBe(1);
    expect(retRes.body.data.order.items[1].returnedQuantity).toBe(0);
    expect(retRes.body.data.order.status).toBe('PARTIALLY_RETURNED');
  });

  it('4. Đổi hàng (EXCHANGE) theo đúng biến thể Màu & chặn trả vượt số lượng trên từng dòng biến thể', async () => {
    const ordRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Đổi Vợt Khác Màu',
        customerPhone: '0988777666',
        paymentMethod: 'BANKING',
        items: [
          { productId: selkirkProdId, color: 'Dauntless Widebody Electric Sunset', quantity: 1 },
          { productId: selkirkProdId, color: 'Era Power Widebody Volt', quantity: 1 },
        ],
      });
    expect(ordRes.status).toBe(201);

    // Chặn trả vượt số lượng của riêng biến thể Era Power Widebody Volt (mua 1 nhưng đòi trả 2)
    const exceedVariantRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: ordRes.body.data._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [
          {
            lineIndex: 1,
            productId: selkirkProdId,
            color: 'Era Power Widebody Volt',
            quantity: 2,
            condition: 'GOOD',
          },
        ],
      });
    expect(exceedVariantRes.status).toBe(400);
    expect(exceedVariantRes.body.code).toBe('EXCEED_RETURNABLE_QUANTITY');

    // Đổi 1 cây Selkirk Volt (3.000.000) sang 1 cây SYPIK Triton 5 màu Hồng (4.500.000) -> thu thêm 1.500.000
    const exRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: ordRes.body.data._id,
        type: 'EXCHANGE',
        refundMethod: 'BANKING',
        returnItems: [
          {
            lineIndex: 1,
            productId: selkirkProdId,
            color: 'Era Power Widebody Volt',
            quantity: 1,
            condition: 'GOOD',
          },
        ],
        exchangeItems: [
          {
            productId: sypikProdId,
            color: 'Hồng',
            size: '',
            quantity: 1,
          },
        ],
      });
    expect(exRes.status).toBe(201);
    expect(exRes.body.data.returnExchange.code).toMatch(/^DH-/);
    expect(exRes.body.data.returnExchange.additionalCharge).toBe(1500000);
    expect(exRes.body.data.order.status).toBe('PARTIALLY_RETURNED');
  });
});
