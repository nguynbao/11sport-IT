import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  brandRepo,
  categoryRepo,
  clearDatabase,
  connectDatabase,
  customerRepo,
  disconnectDatabase,
  orderRepo,
  productRepo,
  promotionRepo,
  staffRepo,
  stockMovementRepo,
  webSiteSettingRepo,
} from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { releaseExpiredQrOrders } from '../src/services/webStockAndPricing';

const app = createApp();

function signPayosPayload(data: Record<string, unknown>, checksumKey: string): string {
  const sortedKeys = Object.keys(data).sort();
  const queryStr = sortedKeys.map((k) => `${k}=${data[k]}`).join('&');
  return crypto.createHmac('sha256', checksumKey).update(queryStr).digest('hex');
}

describe('WEB-06..WEB-10: Storefront Public API, Atomic Checkout, PayOS Webhook, OTP & CMS RBAC', () => {
  let adminId = '';
  let ceoId = '';
  let salesId = '';
  let categoryId = '';
  let brandId = '';
  let productId = '';
  let productLastOneId = '';
  let promoCouponId = '';
  const checksumKey = 'test-payos-checksum-key-11sport';

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const admin = await staffRepo.findOne({ username: 'admin' });
    const sales = await staffRepo.findOne({ username: 'sales1' });
    adminId = String(admin!._id);
    salesId = String(sales!._id);

    const ceo = await staffRepo.create({
      code: 'NV-CEO-01',
      username: 'ceo1',
      passwordHash: admin!.passwordHash,
      fullName: 'Giám Đốc Điều Hành',
      phone: '0909000999',
      role: 'CEO',
      department: 'OFFICE',
      status: 'ACTIVE',
    });
    ceoId = String(ceo._id);

    await webSiteSettingRepo.create({
      key: 'DEFAULT',
      siteName: '11 Sport',
      defaultShippingFee: 30000,
      freeShipThreshold: 500000,
      onlineStockMode: 'FLOOR_1',
      payosChecksumKey: checksumKey,
    });

    const cat = await categoryRepo.create({
      code: 'VOT',
      name: 'Vợt Pickleball',
      slug: 'vot-pickleball',
      status: 'ACTIVE',
      isPublishedOnline: true,
      sortOrder: 1,
    });
    categoryId = String(cat._id);

    const brand = await brandRepo.create({
      code: 'JLA',
      name: 'Joola',
      slug: 'joola',
      status: 'ACTIVE',
      isPublishedOnline: true,
      categoryIds: [categoryId],
    });
    brandId = String(brand._id);

    const prod = await productRepo.create({
      code: 'VPBJLA01',
      name: 'Vợt Pickleball Joola Perseus 16mm',
      slug: 'vot-joola-perseus-16mm',
      categoryId,
      categoryName: 'Vợt Pickleball',
      brandId,
      brandName: 'Joola',
      unit: 'Cây',
      sellingPrice: 4000000,
      costPrice: 2500000,
      compareAtPrice: 4800000,
      isPublishedOnline: true,
      isFeatured: true,
      images: [{ url: 'https://cdn.11sport.vn/perseus.jpg', isPrimary: true, sortOrder: 0 }],
      variants: [
        {
          variantKey: 'DEN_16MM',
          variantCode: 'VPBJLA01DEN16MM',
          color: 'Đen',
          colorHexes: ['#111827'],
          size: '16mm',
          stockFloor1: 10,
          stockFloor2: 5,
          stock: 15,
        },
      ],
      stockFloor1: 10,
      stockFloor2: 5,
      stock: 15,
      note: 'Ghi chú nội bộ không được lộ ra public',
      status: 'ACTIVE',
    });
    productId = String(prod._id);

    const prodLastOne = await productRepo.create({
      code: 'VPBJLA02',
      name: 'Vợt Joola Bản Giới Hạn',
      slug: 'vot-joola-ban-gioi-han',
      categoryId,
      brandId,
      unit: 'Cây',
      sellingPrice: 3000000,
      costPrice: 1800000,
      isPublishedOnline: true,
      variants: [
        {
          variantKey: 'DO_14MM',
          variantCode: 'VPBJLA02DO14MM',
          color: 'Đỏ',
          size: '14mm',
          stockFloor1: 1,
          stockFloor2: 0,
          stock: 1,
        },
      ],
      stockFloor1: 1,
      stockFloor2: 0,
      stock: 1,
      status: 'ACTIVE',
    });
    productLastOneId = String(prodLastOne._id);

    const coupon = await promotionRepo.create({
      code: 'ONLINE100K',
      name: 'Giảm 100k đơn online',
      status: 'ACTIVE',
      isPermanent: true,
      applyChannels: ['ONLINE'],
      isCouponRequired: true,
      couponCode: 'SALE11',
      minOrderAmount: 1000000,
      billDiscountType: 'AMOUNT',
      billDiscountValue: 100000,
    });
    promoCouponId = String(coupon._id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('AC-07: Public API trả dữ liệu chuẩn SEO và tuyệt đối không lộ costPrice, note nội bộ hay secret keys', async () => {
    const [homeRes, listRes, detailRes, settingsRes] = await Promise.all([
      request(app).get('/api/v1/public/home'),
      request(app).get('/api/v1/public/products?category=vot-pickleball&sort=featured'),
      request(app).get('/api/v1/public/products/vot-joola-perseus-16mm'),
      request(app).get('/api/v1/public/settings'),
    ]);

    expect(homeRes.status).toBe(200);
    expect(listRes.status).toBe(200);
    expect(detailRes.status).toBe(200);
    expect(settingsRes.status).toBe(200);

    const detailJson = JSON.stringify(detailRes.body.data);
    expect(detailJson).not.toContain('costPrice');
    expect(detailJson).not.toContain('2500000');
    expect(detailJson).not.toContain('Ghi chú nội bộ');

    const settingsJson = JSON.stringify(settingsRes.body.data);
    expect(settingsJson).not.toContain('payosChecksumKey');
    expect(settingsJson).not.toContain(checksumKey);
  });

  it('BR-03: POST /api/v1/public/cart/price tính giá, coupon SALE11 và freeship từ DB', async () => {
    const res = await request(app)
      .post('/api/v1/public/cart/price')
      .send({
        items: [{ productId, variantKey: 'DEN_16MM', quantity: 1 }],
        couponCode: 'sale11',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.rawSubtotal).toBe(4000000);
    expect(res.body.data.couponDiscount).toBe(100000);
    expect(res.body.data.shippingFee).toBe(0);
    expect(res.body.data.totalAmount).toBe(3900000);
    expect(promoCouponId).toBeTruthy();
  });

  it('AC-03: 2 request đặt hàng đồng thời cho sản phẩm còn 1 cái -> 1 thành công (201), 1 thất bại (409), không âm kho', async () => {
    const payload = {
      items: [{ productId: productLastOneId, variantKey: 'DO_14MM', quantity: 1 }],
      shippingAddress: {
        fullName: 'Khách Tranh Mua',
        phone: '0901112233',
        addressLine: '123 Nguyễn Trãi, Q1',
      },
      paymentGateway: 'COD',
    };

    const [r1, r2] = await Promise.all([
      request(app).post('/api/v1/public/orders').send(payload),
      request(app).post('/api/v1/public/orders').send(payload),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const updatedProd = await productRepo.findById(productLastOneId);
    expect(updatedProd!.variants![0].stockFloor1).toBe(0);
    expect(updatedProd!.stockFloor1).toBe(0);
  });

  it('AC-04: Thanh toán QR PayOS + Webhook xác thực chữ ký & Idempotency không cộng trùng', async () => {
    const orderRes = await request(app)
      .post('/api/v1/public/orders')
      .send({
        items: [{ productId, variantKey: 'DEN_16MM', quantity: 1 }],
        shippingAddress: {
          fullName: 'Khách PayOS',
          phone: '0908887776',
          addressLine: '456 Lê Lợi, Q1',
        },
        paymentGateway: 'PAYOS',
      });

    expect(orderRes.status).toBe(201);
    const { orderCode, totalAmount, paymentUrl } = orderRes.body.data;
    expect(orderCode).toMatch(/^ONL-/);
    expect(paymentUrl).toBeTruthy();

    // Sai chữ ký -> 401
    const badWebhook = await request(app)
      .post('/api/v1/public/payments/payos/webhook')
      .send({ data: { orderCode, amount: totalAmount, reference: 'TX-001' }, signature: 'invalid' });
    expect(badWebhook.status).toBe(401);

    // Đúng chữ ký lần 1 & lần 2 (idempotency)
    const webhookData = { orderCode, amount: totalAmount, reference: 'TX-PAYOS-999' };
    const sig = signPayosPayload(webhookData, checksumKey);

    const w1 = await request(app)
      .post('/api/v1/public/payments/payos/webhook')
      .send({ data: webhookData, signature: sig });
    expect(w1.status).toBe(200);
    expect(w1.body.success).toBe(true);

    const w2 = await request(app)
      .post('/api/v1/public/payments/payos/webhook')
      .send({ data: webhookData, signature: sig });
    expect(w2.status).toBe(200);
    expect(w2.body.alreadyProcessed).toBe(true);

    const order = await orderRepo.findOne({ orderCode });
    expect(order!.paymentStatus).toBe('PAID');
    expect(order!.fulfillmentStatus).toBe('CONFIRMED');

    const movements = await stockMovementRepo.find({ referenceCode: orderCode });
    expect(movements.length).toBe(1);

    const cust = await customerRepo.findOne({ phone: '0908887776' });
    expect(cust!.totalOrders).toBe(1);
  });

  it('AC-05: Giải phóng giữ chỗ đơn QR quá hạn 15 phút hoàn lại stockFloor1', async () => {
    const beforeProd = await productRepo.findById(productId);
    const stockBefore = beforeProd!.variants![0].stockFloor1;

    const qrRes = await request(app)
      .post('/api/v1/public/orders')
      .send({
        items: [{ productId, variantKey: 'DEN_16MM', quantity: 2 }],
        shippingAddress: {
          fullName: 'Khách Quá Hạn',
          phone: '0905554443',
          addressLine: '789 Hai Bà Trưng',
        },
        paymentGateway: 'VIETQR',
      });

    expect(qrRes.status).toBe(201);
    const { orderCode } = qrRes.body.data;

    const afterReserve = await productRepo.findById(productId);
    expect(afterReserve!.variants![0].stockFloor1).toBe(stockBefore - 2);

    // Ép reservedUntil về quá khứ
    const order = await orderRepo.findOne({ orderCode });
    await orderRepo.updateById(String(order!._id), {
      reservedUntil: new Date(Date.now() - 60 * 1000),
    });

    const released = await releaseExpiredQrOrders(new Date());
    expect(released).toBeGreaterThanOrEqual(1);

    const expiredOrder = await orderRepo.findOne({ orderCode });
    expect(expiredOrder!.paymentStatus).toBe('EXPIRED');
    expect(expiredOrder!.fulfillmentStatus).toBe('CANCELLED');

    const afterRelease = await productRepo.findById(productId);
    expect(afterRelease!.variants![0].stockFloor1).toBe(stockBefore);
  });

  it('AC-06: RBAC CMS Web (SALES bị chặn 403, CEO duyệt nội dung nhưng bị chặn cấu hình kỹ thuật, ADMIN toàn quyền + AuditLog)', async () => {
    // SALES bị chặn 403
    const salesRes = await request(app)
      .get('/api/v1/cms/web/banners')
      .set('x-user-id', salesId);
    expect(salesRes.status).toBe(403);

    // CEO xem được dashboard và xuất bản bài viết
    const ceoDash = await request(app)
      .get('/api/v1/cms/web/dashboard')
      .set('x-user-id', ceoId);
    expect(ceoDash.status).toBe(200);

    const ceoArticle = await request(app)
      .post('/api/v1/cms/web/articles')
      .set('x-user-id', ceoId)
      .send({
        title: 'Hướng dẫn chọn vợt Pickleball',
        slug: 'huong-dan-chon-vot-pickleball',
        contentHtml: '<p>Nội dung chuẩn SEO</p>',
        status: 'PUBLISHED',
      });
    expect(ceoArticle.status).toBe(201);

    // CEO bị chặn tạo 301 Redirect & sửa cấu hình kỹ thuật
    const ceoRedirect = await request(app)
      .post('/api/v1/cms/web/redirects')
      .set('x-user-id', ceoId)
      .send({ fromPath: '/cu', toPath: '/moi' });
    expect(ceoRedirect.status).toBe(403);

    const ceoTechSetting = await request(app)
      .put('/api/v1/cms/web/settings')
      .set('x-user-id', ceoId)
      .send({ payosApiKey: 'hack-key' });
    expect(ceoTechSetting.status).toBe(403);

    // ADMIN tạo được Redirect & sửa cấu hình kỹ thuật
    const adminRedirect = await request(app)
      .post('/api/v1/cms/web/redirects')
      .set('x-user-id', adminId)
      .send({ fromPath: '/sp-cu', toPath: '/san-pham/vot-joola-perseus-16mm' });
    expect(adminRedirect.status).toBe(201);

    const auditRes = await request(app)
      .get('/api/v1/cms/web/audit-logs')
      .set('x-user-id', ceoId);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('WEB-09 & BR-07: Customer OTP Auth & gửi đánh giá sản phẩm', async () => {
    const otpReq = await request(app)
      .post('/api/v1/public/customers/request-otp')
      .send({ identifier: 'vip@11sport.vn', channel: 'EMAIL' });
    expect(otpReq.status).toBe(200);
    expect(otpReq.body.devOtp).toHaveLength(6);

    const verifyRes = await request(app)
      .post('/api/v1/public/customers/verify-otp')
      .send({ identifier: 'vip@11sport.vn', otp: otpReq.body.devOtp });
    expect(verifyRes.status).toBe(200);
    const customerToken = verifyRes.body.data.token;
    expect(customerToken).toBeTruthy();

    const meRes = await request(app)
      .get('/api/v1/public/customers/me')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe('vip@11sport.vn');

    const reviewRes = await request(app)
      .post('/api/v1/public/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, rating: 5, comment: 'Rất hài lòng!' });
    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.data.status).toBe('PENDING');

    // ADMIN duyệt review -> cập nhật ratingAvg & ratingCount
    const modRes = await request(app)
      .patch(`/api/v1/cms/web/reviews/${reviewRes.body.data._id}/moderate`)
      .set('x-user-id', adminId)
      .send({ status: 'APPROVED' });
    expect(modRes.status).toBe(200);

    const prodAfterReview = await productRepo.findById(productId);
    expect(prodAfterReview!.ratingAvg).toBe(5);
    expect(prodAfterReview!.ratingCount).toBe(1);
  });
});
