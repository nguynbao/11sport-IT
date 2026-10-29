import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('v1.1: Giá gốc khi nhập kho & phân quyền giá bán', () => {
  let categoryId = '';
  const productName = 'Quần Short Chạy Bộ (Quần Short Chạy Bộ QSCB01 Đen size M)';
  const productCode = 'QUAN_SHORT_CHAY_BO_QSCB01_DEN_SIZE_M';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'QUAN', name: 'Quần thể thao' });
    categoryId = catRes.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Từ chối giá gốc âm (400 INVALID_COST_PRICE)', async () => {
    const res = await request(app)
      .post('/api/v1/imports')
      .set('x-user-id', 'warehouse1')
      .send({ items: [{ productName, expectedQuantity: 5, costPrice: -1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COST_PRICE');
  });

  it('Hoàn thành nhập kho: tạo SP mới với costPrice theo phiếu, sellingPrice = 0; lần nhập sau cập nhật giá gốc', async () => {
    const runImport = async (qty: number, costPrice: number) => {
      const created = await request(app)
        .post('/api/v1/imports')
        .set('x-user-id', 'warehouse1')
        .send({
          defaultCategoryId: categoryId,
          items: [{ productName, expectedQuantity: qty, actualQuantity: qty, costPrice, isConfirmed: true }],
        });
      expect(created.status).toBe(201);
      expect(created.body.data.items[0].costPrice).toBe(costPrice);
      const done = await request(app)
        .post(`/api/v1/imports/${created.body.data._id}/complete`)
        .set('x-user-id', 'warehouse1')
        .send({});
      expect(done.status).toBe(200);
    };

    await runImport(10, 150000);
    let list = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    let prod = list.body.data.find((p: any) => p.code === productCode);
    expect(prod.costPrice).toBe(150000);
    expect(prod.sellingPrice).toBe(0);
    expect(prod.stock).toBe(10);

    await runImport(5, 160000);
    list = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    prod = list.body.data.find((p: any) => p.code === productCode);
    expect(prod.costPrice).toBe(160000);
    expect(prod.stock).toBe(15);
  });

  it('Chỉ ADMIN được đặt giá bán / sửa giá gốc; SALES không thấy giá gốc', async () => {
    const list = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prod = list.body.data.find((p: any) => p.code === productCode);

    const whPrice = await request(app)
      .patch(`/api/v1/products/${prod._id}`)
      .set('x-user-id', 'warehouse1')
      .send({ sellingPrice: 300000 });
    expect(whPrice.status).toBe(403);
    expect(whPrice.body.code).toBe('SELLING_PRICE_FORBIDDEN');

    const whCost = await request(app)
      .patch(`/api/v1/products/${prod._id}`)
      .set('x-user-id', 'warehouse1')
      .send({ costPrice: 1 });
    expect(whCost.status).toBe(403);
    expect(whCost.body.code).toBe('COST_PRICE_FORBIDDEN');

    const whCreate = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'sales1')
      .send({ name: 'Tất (Tất TT01 Trắng)', categoryId, sellingPrice: 50000 });
    expect(whCreate.status).toBe(403);

    const salesList = await request(app).get('/api/v1/products').set('x-user-id', 'sales1');
    const salesView = salesList.body.data.find((p: any) => p._id === prod._id);
    expect(salesView.costPrice).toBeUndefined();

    const admin = await request(app)
      .patch(`/api/v1/products/${prod._id}`)
      .set('x-user-id', 'admin')
      .send({ sellingPrice: 299000 });
    expect(admin.status).toBe(200);
    expect(admin.body.data.sellingPrice).toBe(299000);
    expect(admin.body.data.costPrice).toBe(160000);

    // Kiểm tra /inventory/report và /inventory/movements: ADMIN thấy cả costPrice + sellingPrice, SALES chỉ thấy sellingPrice
    const adminReport = await request(app).get('/api/v1/inventory/report').set('x-user-id', 'admin');
    const repRowAdmin = adminReport.body.data.find((r: any) => r.productCode === productCode);
    expect(repRowAdmin.costPrice).toBe(160000);
    expect(repRowAdmin.sellingPrice).toBe(299000);

    const salesReport = await request(app).get('/api/v1/inventory/report').set('x-user-id', 'sales1');
    const repRowSales = salesReport.body.data.find((r: any) => r.productCode === productCode);
    expect(repRowSales.costPrice).toBeUndefined();
    expect(repRowSales.sellingPrice).toBe(299000);

    const adminMov = await request(app).get('/api/v1/inventory/movements').set('x-user-id', 'admin');
    const movAdmin = adminMov.body.data.find((m: any) => m.productCode === productCode);
    expect(movAdmin.costPrice).toBe(160000);
    expect(movAdmin.sellingPrice).toBe(299000);

    const salesMov = await request(app).get('/api/v1/inventory/movements').set('x-user-id', 'sales1');
    const movSales = salesMov.body.data.find((m: any) => m.productCode === productCode);
    expect(movSales.costPrice).toBeUndefined();
    expect(movSales.sellingPrice).toBe(299000);
  });

  it('CMS Admin nhập thẳng sản phẩm vào kho (quantity, upsertIfExists) & sửa số lượng tồn (allowDirectStock)', async () => {
    const directName = 'Áo Ba Lỗ Gym (Áo Ba Lỗ Gym ABL09 Đen size L)';
    const directCode = 'AO_BA_LO_GYM_ABL09_DEN_SIZE_L';

    // 1. Tạo mới kèm số lượng nhập thẳng = 12
    const createRes = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: directName,
        categoryId,
        unit: 'Cái',
        quantity: 12,
        costPrice: 120000,
        sellingPrice: 220000,
        upsertIfExists: true,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.stock).toBe(12);
    expect(createRes.body.data.costPrice).toBe(120000);
    expect(createRes.body.data.sellingPrice).toBe(220000);

    // 2. Nhập thẳng thêm 8 cái cho mã đã có (upsertIfExists = true) -> tồn kho = 20
    const upsertRes = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: directName,
        categoryId,
        unit: 'Cái',
        quantity: 8,
        costPrice: 125000,
        sellingPrice: 230000,
        upsertIfExists: true,
      });
    expect(upsertRes.status).toBe(200);
    expect(upsertRes.body.meta.upserted).toBe(true);
    expect(upsertRes.body.data.stock).toBe(20);
    expect(upsertRes.body.data.costPrice).toBe(125000);

    // 3. Admin sửa trực tiếp cột Số lượng tồn trên bảng CMS (allowDirectStock = true) -> tồn kho = 25
    const patchRes = await request(app)
      .patch(`/api/v1/products/${createRes.body.data._id}`)
      .set('x-user-id', 'admin')
      .send({ stock: 25, allowDirectStock: true, costPrice: 125000, sellingPrice: 235000 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.stock).toBe(25);
    expect(patchRes.body.data.sellingPrice).toBe(235000);

    // 4. Báo cáo tồn kho kế toán vẫn cân bằng tuyệt đối (closingStock === currentStock === 25)
    const reportRes = await request(app).get('/api/v1/inventory/report').set('x-user-id', 'admin');
    const row = reportRes.body.data.find((r: any) => r.productCode === directCode);
    expect(row.importedQty).toBe(25);
    expect(row.closingStock).toBe(25);
    expect(row.currentStock).toBe(25);

    // 5. Xóa sản phẩm trên CMS (DELETE /api/v1/products/:id) & Xóa phiếu nhập (DELETE /api/v1/imports/:id)
    const nonAdminDel = await request(app)
      .delete(`/api/v1/products/${createRes.body.data._id}`)
      .set('x-user-id', 'warehouse1');
    expect(nonAdminDel.status).toBe(403);

    const adminDel = await request(app)
      .delete(`/api/v1/products/${createRes.body.data._id}`)
      .set('x-user-id', 'admin');
    expect(adminDel.status).toBe(200);
    expect(adminDel.body.data.deleted).toBe(true);

    const draftImport = await request(app)
      .post('/api/v1/imports')
      .set('x-user-id', 'warehouse1')
      .send({
        defaultCategoryId: categoryId,
        items: [{ productName, expectedQuantity: 3, actualQuantity: 3, costPrice: 150000 }],
      });
    expect(draftImport.status).toBe(201);

    const delImport = await request(app)
      .delete(`/api/v1/imports/${draftImport.body.data._id}`)
      .set('x-user-id', 'warehouse1');
    expect(delImport.status).toBe(200);
    expect(delImport.body.data.deleted).toBe(true);
  });

  it('Kiểm tra bán hàng (POST /orders): trừ tồn kho chuẩn, ghi Sổ kho SALE, cân bằng Báo cáo tồn kho & chặn bán vượt tồn lũy kế', async () => {
    const prodList = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prod = prodList.body.data.find((p: any) => p.code === productCode);
    expect(prod).toBeDefined();
    const stockBefore = prod.stock; // 15

    // 1. Chặn nếu tổng số lượng trùng mã trong cùng 1 đơn vượt tồn kho (10 + 10 = 20 > 15)
    const overOrder = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Test Vượt Tồn',
        customerPhone: '0901112233',
        paymentMethod: 'CASH',
        items: [
          { productId: prod._id, quantity: 10 },
          { productId: prod._id, quantity: 10 },
        ],
      });
    expect(overOrder.status).toBe(400);
    expect(overOrder.body.code).toBe('INSUFFICIENT_STOCK');

    // 2. Bán 4 chiếc hợp lệ -> tồn kho phải giảm từ 15 xuống 11
    const validOrder = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Mua Thật',
        customerPhone: '0909888777',
        paymentMethod: 'BANKING',
        items: [{ productId: prod._id, quantity: 4 }],
      });
    expect(validOrder.status).toBe(201);

    const prodAfterRes = await request(app).get('/api/v1/products').set('x-user-id', 'admin');
    const prodAfter = prodAfterRes.body.data.find((p: any) => p._id === prod._id);
    expect(prodAfter.stock).toBe(stockBefore - 4); // 11

    // 3. Kiểm tra Sổ kho (StockMovement loại SALE)
    const movRes = await request(app)
      .get(`/api/v1/inventory/movements?productId=${prod._id}&type=SALE`)
      .set('x-user-id', 'admin');
    expect(movRes.status).toBe(200);
    expect(movRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(movRes.body.data[0].quantityChange).toBe(-4);
    expect(movRes.body.data[0].balanceBefore).toBe(stockBefore);
    expect(movRes.body.data[0].balanceAfter).toBe(stockBefore - 4);

    // 4. Kiểm tra Báo cáo tồn kho kế toán: closingStock = openingStock + importedQty - soldQty + adjustedAndReturnedQty = currentStock
    const reportRes = await request(app).get('/api/v1/inventory/report').set('x-user-id', 'admin');
    const repRow = reportRes.body.data.find((r: any) => r.productCode === productCode);
    expect(repRow.soldQty).toBe(4);
    expect(repRow.closingStock).toBe(stockBefore - 4);
    expect(repRow.currentStock).toBe(stockBefore - 4);
  });
});
