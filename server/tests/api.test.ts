import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { generateProductCode } from '../src/utils/productCode';

const app = createApp();

describe('11Sport POS & Inventory API Integration Tests (AC-01 to AC-07)', () => {
  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Health check & Auth login (admin, warehouse1, sales1)', async () => {
    const healthRes = await request(app).get('/api/v1/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.data.status).toBe('ok');

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.role).toBe('ADMIN');
    expect(loginRes.body.data.token).toBeTruthy();

    const staffRes = await request(app).get('/api/v1/staff');
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('AC-01: Sinh mã sản phẩm từ dấu ngoặc đơn và chặn sửa mã sau khi tạo', async () => {
    const sampleName =
      'Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)';
    expect(generateProductCode(sampleName)).toBe(
      'AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L'
    );

    const genRes = await request(app)
      .post('/api/v1/products/generate-code')
      .send({ name: sampleName });
    expect(genRes.status).toBe(200);
    expect(genRes.body.data.code).toBe(
      'AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L'
    );

    // Lấy danh mục AO để tạo 1 sản phẩm mới
    const catRes = await request(app).get('/api/v1/categories');
    const aoCat = catRes.body.data.find((c: any) => c.code === 'AO');
    expect(aoCat).toBeDefined();

    const createProdRes = await request(app)
      .post('/api/v1/products')
      .send({
        name: 'Áo Khoác Gió 11Sport (Áo Khoác Gió 11Sport AKG99 Đen size XL)',
        categoryId: aoCat._id,
        unit: 'Cái',
        sellingPrice: 450000,
      });
    expect(createProdRes.status).toBe(201);
    expect(createProdRes.body.data.code).toBe(
      'AO_KHOAC_GIO_11SPORT_AKG99_DEN_SIZE_XL'
    );
    expect(createProdRes.body.data.stock).toBe(0);

    // Thử sửa mã sản phẩm -> phải bị chặn 400 PRODUCT_CODE_IMMUTABLE
    const patchCodeRes = await request(app)
      .patch(`/api/v1/products/${createProdRes.body.data._id}`)
      .send({ code: 'NEW_CODE_123' });
    expect(patchCodeRes.status).toBe(400);
    expect(patchCodeRes.body.code).toBe('PRODUCT_CODE_IMMUTABLE');
  });

  it('AC-02: Quản lý Category - Chặn xóa category đang có sản phẩm, chỉ cho phép INACTIVE', async () => {
    const catRes = await request(app).get('/api/v1/categories');
    const aoCat = catRes.body.data.find((c: any) => c.code === 'AO');
    expect(aoCat.productCount).toBeGreaterThan(0);

    // Thử xóa category đang có sản phẩm -> 400 CATEGORY_HAS_PRODUCTS
    const delRes = await request(app).delete(`/api/v1/categories/${aoCat._id}`);
    expect(delRes.status).toBe(400);
    expect(delRes.body.code).toBe('CATEGORY_HAS_PRODUCTS');

    // Chuyển trạng thái sang INACTIVE -> thành công
    const patchRes = await request(app)
      .patch(`/api/v1/categories/${aoCat._id}`)
      .send({ status: 'INACTIVE' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('INACTIVE');

    // Bật lại ACTIVE để dùng tiếp
    await request(app)
      .patch(`/api/v1/categories/${aoCat._id}`)
      .send({ status: 'ACTIVE' });
  });

  it('AC-03: Luồng Nhập kho 7 bước & Sổ kho (chỉ cộng dòng isConfirmed=true, tự tạo SP mới giá 0, khóa phiếu)', async () => {
    const catRes = await request(app).get('/api/v1/categories');
    const aoCat = catRes.body.data.find((c: any) => c.code === 'AO');

    // Bước 1 & 2: Tạo phiếu nháp với 2 dòng hàng (1 dòng sẽ xác nhận, 1 dòng không tick xác nhận)
    const newProdNameConfirmed =
      'Áo Thun Tập Gym 11Sport (Áo Thun Tập Gym 11Sport ATTG01 Xám size L)';
    const newProdNameUnconfirmed =
      'Áo Thun Tập Gym 11Sport (Áo Thun Tập Gym 11Sport ATTG01 Trắng size S)';

    const createImportRes = await request(app)
      .post('/api/v1/imports')
      .send({
        note: 'Test luồng nhập kho 7 bước',
        defaultCategoryId: aoCat._id,
        items: [
          {
            stt: 1,
            productName: newProdNameConfirmed,
            unit: 'Cái',
            expectedQuantity: 15,
            actualQuantity: 15,
            costPrice: 180000,
            note: 'Dòng 1',
          },
          {
            stt: 2,
            productName: newProdNameUnconfirmed,
            unit: 'Cái',
            expectedQuantity: 10,
            actualQuantity: 10,
            note: 'Dòng 2 chưa kiểm xong',
          },
        ],
      });
    expect(createImportRes.status).toBe(201);
    const importId = createImportRes.body.data._id;
    expect(createImportRes.body.data.status).toBe('DRAFT');

    // Bước 3: Bấm Hoàn tất danh sách dự kiến -> CHECKING
    const finishRes = await request(app).post(
      `/api/v1/imports/${importId}/finish-listing`
    );
    expect(finishRes.status).toBe(200);
    expect(finishRes.body.data.status).toBe('CHECKING');

    // Bước 4: Quét camera kiểm tra thực tế dòng 1 với số lượng thực nhận = 18 (thừa 3)
    const scanRes = await request(app)
      .post(`/api/v1/imports/${importId}/scan-check`)
      .send({
        query: 'ATTG01 Xám size L',
        actualQuantity: 18,
      });
    expect(scanRes.status).toBe(200);
    expect(scanRes.body.data.matched).toBe(true);
    expect(scanRes.body.data.discrepancy).toBe(3);

    // Bước 5 & 7: Tick xác nhận dòng 1 (isConfirmed = true), dòng 2 để isConfirmed = false rồi bấm Hoàn thành
    const updatedItems = scanRes.body.data.receipt.items.map(
      (item: any, idx: number) => ({
        ...item,
        isConfirmed: idx === 0,
      })
    );

    const completeRes = await request(app)
      .post(`/api/v1/imports/${importId}/complete`)
      .send({ items: updatedItems });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.receipt.status).toBe('COMPLETED');
    expect(completeRes.body.meta.confirmedCount).toBe(1);

    // Kiểm tra sản phẩm dòng 1 đã được tự động tạo mới với sellingPrice = 0 và stock = 18
    const productsRes = await request(app).get('/api/v1/products');
    const createdProd = productsRes.body.data.find(
      (p: any) => p.code === 'AO_THUN_TAP_GYM_11SPORT_ATTG01_XAM_SIZE_L'
    );
    expect(createdProd).toBeDefined();
    expect(createdProd.sellingPrice).toBe(0);
    expect(createdProd.costPrice).toBe(180000);
    expect(createdProd.stock).toBe(18);

    // Sản phẩm dòng 2 (isConfirmed = false) không được đẩy vào kho
    const unconfirmedProd = productsRes.body.data.find(
      (p: any) => p.code === 'AO_THUN_TAP_GYM_11SPORT_ATTG01_TRANG_SIZE_S'
    );
    expect(unconfirmedProd).toBeUndefined();

    // Kiểm tra khóa phiếu: thử PUT sửa phiếu đã COMPLETED -> 400 IMPORT_RECEIPT_LOCKED
    const editLockedRes = await request(app)
      .put(`/api/v1/imports/${importId}`)
      .send({ note: 'Cố tình sửa phiếu đã khóa' });
    expect(editLockedRes.status).toBe(400);
    expect(editLockedRes.body.code).toBe('IMPORT_RECEIPT_LOCKED');
  });

  it('AC-04 & AC-05: Bán hàng POS (chặn giá = 0, tính phí thẻ 3%, trừ kho) & Tra cứu SĐT khách hàng', async () => {
    const productsRes = await request(app).get('/api/v1/products');
    const zeroPriceProd = productsRes.body.data.find(
      (p: any) => p.sellingPrice === 0 && p.stock > 0
    );
    expect(zeroPriceProd).toBeDefined();

    // Chặn bán sản phẩm có sellingPrice = 0
    const blockedOrderRes = await request(app)
      .post('/api/v1/orders')
      .send({
        customerName: 'Khách Test Giá 0',
        customerPhone: '0911222333',
        paymentMethod: 'CASH',
        items: [{ productId: zeroPriceProd._id, quantity: 1 }],
      });
    expect(blockedOrderRes.status).toBe(400);
    expect(blockedOrderRes.body.code).toBe('PRODUCT_PRICE_NOT_SET');

    // Lấy sản phẩm Áo Polo Xanh (sellingPrice = 280000, stock = 25)
    const poloBlue = productsRes.body.data.find(
      (p: any) =>
        p.code === 'AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_XANH_SIZE_M'
    );
    expect(poloBlue).toBeDefined();
    const initialStock = poloBlue.stock;

    // Tạo đơn bán hàng thanh toán CARD + hasCardFee = true (phí 3%)
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .send({
        customerName: 'Lê Hoàng Nam',
        customerPhone: '0988777666',
        paymentMethod: 'CARD',
        hasCardFee: true,
        items: [{ productId: poloBlue._id, quantity: 3 }],
      });
    expect(orderRes.status).toBe(201);
    const createdOrder = orderRes.body.data;
    expect(createdOrder.subtotal).toBe(280000 * 3); // 840,000
    expect(createdOrder.cardFee).toBe(Math.round(840000 * 0.03)); // 25,200
    expect(createdOrder.totalAmount).toBe(865200);
    expect(createdOrder.note).toBe('Giá đã bao gồm thuế');

    // Kiểm tra tồn kho đã trừ 3
    const afterProdRes = await request(app).get('/api/v1/products');
    const poloBlueAfter = afterProdRes.body.data.find(
      (p: any) => p._id === poloBlue._id
    );
    expect(poloBlueAfter.stock).toBe(initialStock - 3);

    // AC-05: Tra cứu khách hàng theo SĐT 0988777666
    const lookupRes = await request(app).get(
      '/api/v1/customers/lookup?phone=0988777666'
    );
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.found).toBe(true);
    expect(lookupRes.body.data.customer.name).toBe('Lê Hoàng Nam');
    expect(lookupRes.body.data.orders.length).toBe(1);
    expect(lookupRes.body.data.orders[0].orderCode).toBe(createdOrder.orderCode);
  });

  it('AC-06: Trả/Đổi hàng - Cộng tồn nếu GOOD, không cộng nếu DAMAGED, trừ tồn hàng đổi, không hoàn phí thẻ 3%', async () => {
    // Lấy đơn hàng của khách 0988777666 vừa mua 3 Áo Polo Xanh (đơn giá 280,000)
    const ordersRes = await request(app).get('/api/v1/orders?phone=0988777666');
    const order = ordersRes.body.data[0];
    expect(order).toBeDefined();

    const productsRes = await request(app).get('/api/v1/products');
    const poloBlue = productsRes.body.data.find(
      (p: any) =>
        p.code === 'AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_XANH_SIZE_M'
    );
    const shoes = productsRes.body.data.find(
      (p: any) => p.code === 'GIAY_CHAY_BO_11SPORT_PRO_GCB2026_TRANG_SIZE_42'
    );

    const poloStockBefore = poloBlue.stock;
    const shoesStockBefore = shoes.stock;

    // Trả 1 áo tình trạng GOOD, 1 áo tình trạng DAMAGED (tổng trả = 2 * 280,000 = 560,000)
    // Đổi sang 1 đôi giày giá 850,000 -> khách trả thêm: 850,000 - 560,000 = 290,000
    const returnRes = await request(app)
      .post('/api/v1/returns')
      .send({
        orderId: order._id,
        type: 'EXCHANGE',
        refundMethod: 'CASH',
        note: 'Trả 1 áo tốt, 1 áo lỗi, đổi sang 1 đôi giày',
        returnItems: [
          { productId: poloBlue._id, quantity: 1, condition: 'GOOD' },
          { productId: poloBlue._id, quantity: 1, condition: 'DAMAGED' },
        ],
        exchangeItems: [{ productId: shoes._id, quantity: 1 }],
      });

    expect(returnRes.status).toBe(201);
    const retData = returnRes.body.data.returnExchange;
    expect(retData.returnTotal).toBe(560000);
    expect(retData.exchangeTotal).toBe(850000);
    expect(retData.netDifference).toBe(290000);
    expect(retData.additionalCharge).toBe(290000);
    expect(retData.refundAmount).toBe(0);
    expect(returnRes.body.data.order.status).toBe('PARTIALLY_RETURNED');

    // Kiểm tra tồn kho:
    // - Áo Polo Xanh chỉ cộng 1 (do 1 GOOD, 1 DAMAGED)
    // - Giày trừ 1
    const afterProds = await request(app).get('/api/v1/products');
    const poloAfter = afterProds.body.data.find(
      (p: any) => p._id === poloBlue._id
    );
    const shoesAfter = afterProds.body.data.find(
      (p: any) => p._id === shoes._id
    );
    expect(poloAfter.stock).toBe(poloStockBefore + 1);
    expect(shoesAfter.stock).toBe(shoesStockBefore - 1);
  });

  it('AC-07: Báo cáo Tồn đầu kỳ / Cuối kỳ & Phiếu điều chỉnh kho trên CMS', async () => {
    const productsRes = await request(app).get('/api/v1/products');
    const socks = productsRes.body.data.find(
      (p: any) => p.code === 'VO_THE_THAO_CO_CAO_VTT01_DEN_FREESIZE'
    );
    const stockBeforeAdj = socks.stock;

    // Tạo phiếu điều chỉnh giảm 2 đôi vớ
    const adjRes = await request(app)
      .post('/api/v1/inventory/adjustments')
      .send({
        productId: socks._id,
        quantityChange: -2,
        reason: 'Kiểm kê cuối ngày phát hiện lệch 2 đôi',
      });
    expect(adjRes.status).toBe(201);
    expect(adjRes.body.data.product.stock).toBe(stockBeforeAdj - 2);
    expect(adjRes.body.data.movement.type).toBe('ADJUSTMENT');

    // Kiểm tra báo cáo tồn kho kế toán: closingStock = openingStock + importedQty - soldQty + adjustedAndReturnedQty
    const reportRes = await request(app).get('/api/v1/inventory/report');
    expect(reportRes.status).toBe(200);
    for (const row of reportRes.body.data) {
      const expectedClosing =
        row.openingStock +
        row.importedQty -
        row.soldQty +
        row.adjustedAndReturnedQty;
      expect(row.closingStock).toBe(expectedClosing);
      expect(row.closingStock).toBe(row.currentStock);
    }
  });

  it('Edge Cases & Business Rules Validation (BR-03 fallback, BR-05 chặn sửa tay tồn kho, BR-12 không phí thẻ, BR-14 chặn trả vượt số lượng, BR-16 FULLY_RETURNED)', async () => {
    // 1. BR-03 Fallback: Tên hàng không có ngoặc đơn () -> chuẩn hóa toàn bộ chuỗi
    expect(generateProductCode('Bình Nước Thể Thao 11Sport 750ml')).toBe(
      'BINH_NUOC_THE_THAO_11SPORT_750ML'
    );

    // 2. BR-05: Chặn sửa tay tồn kho trực tiếp qua PATCH /api/v1/products/:id
    const prodsRes = await request(app).get('/api/v1/products');
    const anyProd = prodsRes.body.data[0];
    const patchStockRes = await request(app)
      .patch(`/api/v1/products/${anyProd._id}`)
      .send({ stock: 9999 });
    expect(patchStockRes.status).toBe(400);
    expect(patchStockRes.body.code).toBe('STOCK_DIRECT_EDIT_FORBIDDEN');

    // 3. BR-12: Thanh toán CARD nhưng chọn Không phí (hasCardFee = false) -> cardFee = 0
    const sellableProd = prodsRes.body.data.find(
      (p: any) => p.sellingPrice > 0 && p.stock >= 2
    );
    const noFeeOrderRes = await request(app)
      .post('/api/v1/orders')
      .send({
        customerName: 'Phạm Minh Không Phí',
        customerPhone: '0977888999',
        paymentMethod: 'CARD',
        hasCardFee: false,
        items: [{ productId: sellableProd._id, quantity: 1 }],
      });
    expect(noFeeOrderRes.status).toBe(201);
    expect(noFeeOrderRes.body.data.cardFee).toBe(0);
    expect(noFeeOrderRes.body.data.totalAmount).toBe(sellableProd.sellingPrice);

    // 4. BR-14: Chặn trả vượt số lượng đã mua
    const exceedReturnRes = await request(app)
      .post('/api/v1/returns')
      .send({
        orderId: noFeeOrderRes.body.data._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [
          { productId: sellableProd._id, quantity: 5, condition: 'GOOD' },
        ],
      });
    expect(exceedReturnRes.status).toBe(400);
    expect(exceedReturnRes.body.code).toBe('EXCEED_RETURNABLE_QUANTITY');

    // 5. BR-16: Trả toàn bộ số lượng đã mua -> trạng thái đơn gốc chuyển thành FULLY_RETURNED
    const fullReturnRes = await request(app)
      .post('/api/v1/returns')
      .send({
        orderId: noFeeOrderRes.body.data._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [
          { productId: sellableProd._id, quantity: 1, condition: 'GOOD' },
        ],
      });
    expect(fullReturnRes.status).toBe(201);
    expect(fullReturnRes.body.data.order.status).toBe('FULLY_RETURNED');
    expect(fullReturnRes.body.data.returnExchange.refundAmount).toBe(
      sellableProd.sellingPrice
    );
  });
});
