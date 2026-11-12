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

    // BR-01: Phân bổ giảm giá bill 320.000 trên tổng 17.720.000 cho dòng Selkirk 3.000.000
    const selkirkBillShare = Math.round((3000000 / 17720000) * 320000); // 54.176 VND
    const expectedFirstSubtotal = 3000000 - selkirkBillShare; // 2.945.824 VND
    const expectedFirstFeeRefund = Math.round((expectedFirstSubtotal / 17400000) * 696000); // 117.833 VND
    expect(res.status).toBe(201);
    expect(res.body.data.returnExchange.returnSubtotal).toBe(expectedFirstSubtotal);
    expect(res.body.data.returnExchange.refundedCardFee).toBe(expectedFirstFeeRefund);
    expect(res.body.data.returnExchange.returnTotal).toBe(expectedFirstSubtotal + expectedFirstFeeRefund);
    expect(res.body.data.returnExchange.refundAmount).toBe(expectedFirstSubtotal + expectedFirstFeeRefund);
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

    const selkirkBillShare = Math.round((3000000 / 17720000) * 320000); // 54.176 VND
    const expectedFirstSubtotal = 3000000 - selkirkBillShare; // 2.945.824 VND
    const expectedFirstFeeRefund = Math.round((expectedFirstSubtotal / 17400000) * 696000); // 117.833 VND
    const expectedRemainingFeeRefund = 696000 - expectedFirstFeeRefund; // 578.167 VND (Tổng 2 lần = đúng 696.000 VND!)
    // Tổng tiền hàng thuần của đơn (S - B = 17.720.000 - 320.000 = 17.400.000) trừ lần trả đầu = 14.454.176 (khớp 100% AC-10!)
    const remainingItemsSubtotal = 17400000 - expectedFirstSubtotal;

    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe('FULLY_RETURNED');
    expect(res.body.data.returnExchange.returnSubtotal).toBe(remainingItemsSubtotal);
    expect(res.body.data.returnExchange.refundedCardFee).toBe(expectedRemainingFeeRefund);
    expect(res.body.data.returnExchange.refundAmount).toBe(
      remainingItemsSubtotal + expectedRemainingFeeRefund
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
    expect(exRes.body.data.returnExchange.refundedCardFee).toBe(0);
    expect(exRes.body.data.returnExchange.additionalCharge).toBe(1500000);
    expect(exRes.body.data.order.status).toBe('PARTIALLY_RETURNED');
  });

  it('5. Hoàn trả & Đổi hàng trên đơn quẹt thẻ tốn phí (1.8% / 4%) -> back lại đúng số phí thẻ cho khách hàng', async () => {
    // 5a. Đơn quẹt thẻ tốn phí 4%: mua 1 cây SYPIK Hồng (4.500.000 + phí 4% = 180.000 => Tổng 4.680.000)
    const cardOrderRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Thẻ Hoàn Phí',
        customerPhone: '0977111222',
        paymentMethod: 'CARD',
        hasCardFee: true,
        cardFeePercent: 4,
        items: [{ productId: sypikProdId, color: 'Hồng', quantity: 1 }],
      });
    expect(cardOrderRes.status).toBe(201);
    expect(cardOrderRes.body.data.cardFee).toBe(180000);
    expect(cardOrderRes.body.data.totalAmount).toBe(4680000);

    // Tính thử qua /returns/calculate
    const calcRes = await request(app)
      .post('/api/v1/returns/calculate')
      .set('x-user-id', 'sales1')
      .send({
        orderId: cardOrderRes.body.data._id,
        returnItems: [{ lineIndex: 0, productId: sypikProdId, color: 'Hồng', quantity: 1 }],
      });
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.data.returnSubtotal).toBe(4500000);
    expect(calcRes.body.data.refundedCardFee).toBe(180000);
    expect(calcRes.body.data.returnTotal).toBe(4680000);
    expect(calcRes.body.data.refundAmount).toBe(4680000);

    // Thực hiện hoàn trả -> khách nhận lại trọn vẹn 4.680.000 (gồm 180.000 phí thẻ)
    const retCardRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: cardOrderRes.body.data._id,
        type: 'RETURN',
        refundMethod: 'BANKING',
        returnItems: [
          { lineIndex: 0, productId: sypikProdId, color: 'Hồng', quantity: 1, condition: 'GOOD' },
        ],
      });
    expect(retCardRes.status).toBe(201);
    expect(retCardRes.body.data.returnExchange.refundedCardFee).toBe(180000);
    expect(retCardRes.body.data.returnExchange.refundAmount).toBe(4680000);
    expect(retCardRes.body.data.order.status).toBe('FULLY_RETURNED');
  });

  it('6. Đổi hàng nâng cao: khách lẻ không SĐT + phí thẻ khấu trừ vào chênh lệch + tra mã variantCode + tự động tách Bộ sang Lẻ khi xuất đổi', async () => {
    // Tạo sản phẩm Bộ (Hộp quấn cán 10 cái) và sản phẩm Lẻ (1 cái quấn cán, stockFloor1 = 0)
    const setRes = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'PYONEX881100',
        name: 'Hộp quấn cán Yonex 10 cái',
        categoryId,
        unit: 'Hộp',
        quantity: 2,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 300000,
        costPrice: 200000,
      });
    expect(setRes.status).toBe(201);
    const setProdId = setRes.body.data._id;

    const retailRes = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        code: 'PYONEX881101',
        name: 'Quấn cán Yonex lẻ',
        categoryId,
        unit: 'Cái',
        quantity: 0,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 35000,
        costPrice: 20000,
        parentSetProductId: setProdId,
        packSize: 10,
      });
    expect(retailRes.status).toBe(201);
    const retailProdId = retailRes.body.data._id;

    // Tạo đơn khách lẻ thanh toán thẻ 1.8%, sau đó mô phỏng bản ghi DB cũ có customerPhone rỗng ""
    const walkInOrd = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách lẻ',
        customerPhone: '0000',
        paymentMethod: 'CARD',
        hasCardFee: true,
        cardFeePercent: 1.8,
        items: [{ productId: kamitoProdId, color: 'Đỏ tím 12', quantity: 1 }],
      });
    expect(walkInOrd.status).toBe(201);
    await orderRepo.updateById(walkInOrd.body.data._id, { customerPhone: '' });
    const expectedFee = Math.round(2300000 * 0.018); // 41.400 VND
    expect(walkInOrd.body.data.cardFee).toBe(expectedFee);

    // Chặn type = EXCHANGE nhưng không chọn sản phẩm đổi mới
    const emptyExRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: walkInOrd.body.data._id,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: kamitoProdId, color: 'Đỏ tím 12', quantity: 1 }],
        exchangeItems: [],
      });
    expect(emptyExRes.status).toBe(400);
    expect(emptyExRes.body.code).toBe('EMPTY_EXCHANGE_ITEMS');

    // Chặn sản phẩm đổi có nhiều biến thể đang còn hàng nhưng không truyền color/size
    const missingVarRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: walkInOrd.body.data._id,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: kamitoProdId, color: 'Đỏ tím 12', quantity: 1 }],
        exchangeItems: [{ productId: sypikProdId, quantity: 1 }],
      });
    expect(missingVarRes.status).toBe(400);
    expect(missingVarRes.body.code).toBe('EXCHANGE_VARIANT_REQUIRED');

    // Chặn truyền phân loại không tồn tại
    const wrongVarRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: walkInOrd.body.data._id,
        type: 'EXCHANGE',
        returnItems: [{ lineIndex: 0, productId: kamitoProdId, color: 'Đỏ tím 12', quantity: 1 }],
        exchangeItems: [{ productId: sypikProdId, color: 'Vàng Neon Không Tồn Tại', quantity: 1 }],
      });
    expect(wrongVarRes.status).toBe(400);
    expect(wrongVarRes.body.code).toBe('EXCHANGE_VARIANT_NOT_FOUND');

    // Lấy variantCode của SYPIK Triton 5 màu Xanh Dương để test đổi bằng mã vạch con + kèm đổi sang sản phẩm lẻ tự tách hộp
    const prodsBefore = await request(app).get('/api/v1/products?onlySellable=true').set('x-user-id', 'sales1');
    const sypikProd = prodsBefore.body.data.find((p: any) => p._id === sypikProdId);
    const xanhVariant = sypikProd.variants.find((v: any) => v.color === 'Xanh Dương');
    expect(xanhVariant?.variantCode).toBeTruthy();

    // Đổi 1 Kamito (2.300.000 + phí thẻ 41.400 = 2.341.400) sang:
    //   1 SYPIK Xanh Dương (4.500.000, truyền bằng variantCode) + 2 Quấn cán Yonex lẻ (70.000, tự động tách 1 hộp)
    //   Tổng hàng đổi = 4.570.000 => Khách trả thêm: 4.570.000 - 2.341.400 = 2.228.600 VND
    const okExRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: walkInOrd.body.data._id,
        type: 'EXCHANGE',
        refundMethod: 'CASH',
        returnItems: [
          {
            lineIndex: 0,
            productId: kamitoProdId,
            color: 'Đỏ tím 12',
            quantity: 1,
            condition: 'GOOD',
          },
        ],
        exchangeItems: [
          { productId: xanhVariant.variantCode, quantity: 1 },
          { productId: retailProdId, quantity: 2 },
        ],
      });

    expect(okExRes.status).toBe(201);
    expect(okExRes.body.data.returnExchange.code).toMatch(/^DH-/);
    expect(okExRes.body.data.returnExchange.returnSubtotal).toBe(2300000);
    expect(okExRes.body.data.returnExchange.refundedCardFee).toBe(expectedFee);
    expect(okExRes.body.data.returnExchange.returnTotal).toBe(2300000 + expectedFee);
    expect(okExRes.body.data.returnExchange.exchangeTotal).toBe(4570000);
    expect(okExRes.body.data.returnExchange.additionalCharge).toBe(4570000 - (2300000 + expectedFee));

    // Kiểm tra tồn kho sau đổi: hộp quấn cán giảm từ 2 -> 1, quấn cán lẻ từ 0 tách +10 xuất -2 còn 8
    const prodsAfter = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const setAfter = prodsAfter.body.data.find((p: any) => p._id === setProdId);
    const retailAfter = prodsAfter.body.data.find((p: any) => p._id === retailProdId);
    expect(setAfter.stockFloor1).toBe(1);
    expect(retailAfter.stockFloor1).toBe(8);
  });
});
