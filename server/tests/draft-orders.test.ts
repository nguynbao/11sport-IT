import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, disconnectDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('Draft Orders (status = DRAFT) & Item Discount Pricing Tests', () => {
  let adminToken = '';
  let productId = '';
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

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'VOT', name: 'Vợt Pickleball', status: 'ACTIVE' });
    categoryId = catRes.body.data._id;

    // Tạo sản phẩm giá 120.000 VND (giống trên ảnh bill của user: Facolos F Eco)
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Facolos F Eco (FACOLOS_F_ECO)',
        categoryId,
        unit: 'Cây',
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
        sellingPrice: 120000,
        costPrice: 80000,
      });
    productId = prodRes.body.data._id;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('Lưu bản nháp hóa đơn (status = DRAFT): không trừ tồn kho, tính đúng Thành tiền đã trừ Giảm SP, không cộng vào doanh thu', async () => {
    // 1. Tạo hóa đơn nháp: giá gốc 120.000 VND, giảm SP 10.000 VND -> Thành tiền = 110.000 VND
    const draftRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'DRAFT',
        isDraft: true,
        customerName: 'Khách Nháp',
        customerPhone: '0911222333',
        paymentMethod: 'CASH',
        items: [
          {
            productId,
            quantity: 1,
            discountType: 'AMOUNT',
            discountValue: 10000,
          },
        ],
      });

    expect(draftRes.status).toBe(201);
    const draftOrder = draftRes.body.data;
    expect(draftOrder.status).toBe('DRAFT');
    expect(draftOrder.items[0].originalUnitPrice).toBe(120000);
    expect(draftOrder.items[0].discountAmount).toBe(10000);
    expect(draftOrder.items[0].unitPrice).toBe(110000);
    expect(draftOrder.items[0].lineTotal).toBe(110000);
    expect(draftOrder.rawSubtotal).toBe(120000);
    expect(draftOrder.itemDiscountTotal).toBe(10000);
    expect(draftOrder.subtotal).toBe(110000);
    expect(draftOrder.totalAmount).toBe(110000);

    // 2. Kiểm tra tồn kho Tầng 1 KHÔNG bị trừ (vẫn còn nguyên 10)
    const prodRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const prod = prodRes.body.data.find((p: any) => p._id === productId);
    expect(prod.stockFloor1).toBe(10);
    expect(prod.stock).toBe(10);

    // 3. Không cho phép trả/đổi hàng trên đơn nháp
    const retRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: draftOrder._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [{ productId, quantity: 1, condition: 'GOOD' }],
      });
    expect(retRes.status).toBe(400);
    expect(retRes.body.code).toBe('ORDER_IS_DRAFT');

    // 4. Báo cáo doanh thu không tính đơn DRAFT
    const revRes = await request(app)
      .get('/api/v1/reports/revenue-dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revRes.status).toBe(200);
    expect(revRes.body.data.summary.totalOrders).toBe(0);
    expect(revRes.body.data.summary.netRevenue).toBe(0);

    // 5. Cập nhật bản nháp (PUT /orders/:id): đổi số lượng lên 2 -> Thành tiền = 220.000,
    const updateRes = await request(app)
      .put(`/api/v1/orders/${draftOrder._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerName: 'Khách Nháp Đã Sửa',
        customerPhone: '0911222333',
        paymentMethod: 'BANKING',
        items: [
          {
            productId,
            quantity: 2,
            discountType: 'AMOUNT',
            discountValue: 10000,
          },
        ],
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('DRAFT');
    expect(updateRes.body.data.items[0].originalUnitPrice).toBe(120000);
    expect(updateRes.body.data.items[0].discountAmount).toBe(20000);
    expect(updateRes.body.data.items[0].lineTotal).toBe(220000);
    expect(updateRes.body.data.totalAmount).toBe(220000);

    const prodAfterUpdateRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const prodAfterUpdate = prodAfterUpdateRes.body.data.find(
      (p: any) => p._id === productId
    );
    expect(prodAfterUpdate.stockFloor1).toBe(10);
    expect(prodAfterUpdate.stock).toBe(10);

    // 6. Chốt thanh toán đơn nháp (POST /orders/:id/confirm) -> chuyển sang PAID & TRỪ KHO TẦNG 1 (10 - 2 = 8)
    const confirmRes = await request(app)
      .post(`/api/v1/orders/${draftOrder._id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('PAID');

    const prodAfterConfirmRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const prodAfterConfirm = prodAfterConfirmRes.body.data.find(
      (p: any) => p._id === productId
    );
    expect(prodAfterConfirm.stockFloor1).toBe(8);
    expect(prodAfterConfirm.stock).toBe(8);

    // 7. Chặn lưu bản nháp nếu thiếu thông tin khách hàng (SĐT hoặc Tên khách)
    const missingCustomerDraftRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'DRAFT',
        items: [{ productId, quantity: 1 }],
      });
    expect(missingCustomerDraftRes.status).toBe(400);
    expect(missingCustomerDraftRes.body.code).toBe('VALIDATION_ERROR');

    // 8. Tạo bản nháp mới (có đủ thông tin khách hàng) rồi xóa (DELETE /orders/:id)
    const draft2Res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'DRAFT',
        customerName: 'Khách Nháp 2',
        customerPhone: '0988777666',
        items: [{ productId, quantity: 1 }],
      });
    expect(draft2Res.status).toBe(201);

    const delRes = await request(app)
      .delete(`/api/v1/orders/${draft2Res.body.data._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);

    // Không cho xóa đơn đã PAID
    const delPaidRes = await request(app)
      .delete(`/api/v1/orders/${draftOrder._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delPaidRes.status).toBe(400);
    expect(delPaidRes.body.code).toBe('ORDER_ALREADY_PAID');
  });

  it('Mọi nhân viên đều thấy bill nháp, lưu rõ Người tạo nháp & Người chốt TT, và chặn chốt nếu lúc thanh toán kho đã hết hàng', async () => {
    const salesLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales1', password: '123456' });
    const salesToken = salesLogin.body.data.token;

    // 1. Nhân viên Sales 1 tạo bản nháp mua 3 cây vợt (hiện Kho Tầng 1 đang còn 8 cây)
    const draftBySalesRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        status: 'DRAFT',
        customerName: 'Khách Chờ Chốt',
        customerPhone: '0933444555',
        paymentMethod: 'CASH',
        items: [{ productId, quantity: 3 }],
      });
    expect(draftBySalesRes.status).toBe(201);
    const sharedDraft = draftBySalesRes.body.data;
    expect(sharedDraft.status).toBe('DRAFT');
    expect(sharedDraft.createdByName).toBeTruthy();
    expect(sharedDraft.confirmedByName).toBe('');

    // 2. Nhân viên khác / Quản trị viên gọi GET /orders?status=DRAFT -> thấy ngay bản nháp của Sales 1
    const listDraftsRes = await request(app)
      .get('/api/v1/orders?status=DRAFT')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listDraftsRes.status).toBe(200);
    expect(
      listDraftsRes.body.data.some((o: any) => o._id === sharedDraft._id)
    ).toBe(true);

    // 3. Giả sử trong lúc bản nháp chưa thanh toán, có khách khác mua 6 cây -> Kho Tầng 1 chỉ còn 2 cây (8 - 6 = 2)
    const otherPaidRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        customerName: 'Khách Mua Trước',
        customerPhone: '0944555666',
        paymentMethod: 'CASH',
        items: [{ productId, quantity: 6 }],
      });
    expect(otherPaidRes.status).toBe(201);

    // 4. Đến lúc thanh toán bản nháp (cần 3 cây nhưng Kho Tầng 1 chỉ còn 2 cây) -> chặn 400 INSUFFICIENT_STOCK, giữ nguyên DRAFT & không trừ kho
    const confirmFailRes = await request(app)
      .post(`/api/v1/orders/${sharedDraft._id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(confirmFailRes.status).toBe(400);
    expect(confirmFailRes.body.code).toBe('INSUFFICIENT_STOCK');

    // Kiểm tra kho vẫn còn 2 cây và đơn vẫn là DRAFT
    const prodCheckRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const prodNow = prodCheckRes.body.data.find((p: any) => p._id === productId);
    expect(prodNow.stockFloor1).toBe(2);

    // 5. Điều chỉnh số lượng về 2 cây (bằng tồn kho còn lại) và Admin bấm chốt thanh toán
    const confirmOkRes = await request(app)
      .post(`/api/v1/orders/${sharedDraft._id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ productId, quantity: 2 }],
      });
    expect(confirmOkRes.status).toBe(200);
    const confirmedOrder = confirmOkRes.body.data;
    expect(confirmedOrder.status).toBe('PAID');
    // Lưu rõ cả Người tạo nháp (Sales 1) và Người chốt thanh toán (Admin)
    expect(confirmedOrder.createdByName).toBe(sharedDraft.createdByName);
    expect(confirmedOrder.confirmedByName).toBeTruthy();
    expect(confirmedOrder.confirmedByName).not.toBe(confirmedOrder.createdByName);
    expect(confirmedOrder.confirmedAt).toBeTruthy();
  });
});
