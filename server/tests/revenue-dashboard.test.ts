import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  connectDatabase,
  clearDatabase,
  disconnectDatabase,
  orderRepo,
  productRepo,
  returnExchangeRepo,
  stockMovementRepo,
} from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

const app = createApp();

describe('v2.3: Đổi mật khẩu CMS & Dashboard Doanh thu chi tiết / Sản phẩm bán chạy / Cần đẩy mạnh', () => {
  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('POST /api/v1/auth/change-password: Đổi mật khẩu thành công khi đúng mật khẩu cũ và chặn khi sai mật khẩu cũ', async () => {
    // Sai mật khẩu hiện tại -> 400 INVALID_CURRENT_PASSWORD
    const wrongRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('x-user-id', 'admin')
      .send({ currentPassword: 'wrong_password', newPassword: 'newpassword123' });
    expect(wrongRes.status).toBe(400);
    expect(wrongRes.body.code).toBe('INVALID_CURRENT_PASSWORD');

    // Đúng mật khẩu hiện tại -> 200
    const okRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('x-user-id', 'admin')
      .send({ currentPassword: 'admin123', newPassword: 'newpassword123' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.changed).toBe(true);

    // Đăng nhập bằng mật khẩu mới
    const loginNew = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'newpassword123' });
    expect(loginNew.status).toBe(200);

    // Đổi lại về admin123
    await request(app)
      .post('/api/v1/auth/change-password')
      .set('x-user-id', 'admin')
      .send({ currentPassword: 'newpassword123', newPassword: 'admin123' });
  });

  it('GET /api/v1/reports/revenue-dashboard: Trả về doanh thu thuần, lãi gộp, top SP bán chạy và SP cần đẩy mạnh', async () => {
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'VOT', name: 'Vợt Pickleball' });
    const catId = catRes.body.data._id;

    // SP 1: Bán chạy
    const p1Res = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Vợt Joola Perseus (Vợt Joola Perseus JP01)',
        categoryId: catId,
        unit: 'Cái',
        quantity: 5,
        targetWarehouse: 'FLOOR_1',
        costPrice: 3000000,
        sellingPrice: 4500000,
      });
    const p1 = p1Res.body.data;

    // SP 2: Tồn cao nhưng chưa bán được chiếc nào (cần đẩy mạnh)
    const p2Res = await request(app)
      .post('/api/v1/products')
      .set('x-user-id', 'admin')
      .send({
        name: 'Giày Mizuno Tồn Cao (Giày Mizuno MZ99)',
        categoryId: catId,
        unit: 'Đôi',
        quantity: 12,
        targetWarehouse: 'FLOOR_2',
        costPrice: 1500000,
        sellingPrice: 2400000,
      });
    const p2 = p2Res.body.data;

    // Tạo 1 đơn hàng bán 3 chiếc SP 1
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách VIP',
        customerPhone: '0912345678',
        paymentMethod: 'BANKING',
        items: [{ productId: p1._id, quantity: 3 }],
      });
    expect(orderRes.status).toBe(201);

    // Chặn role SALES xem dashboard doanh thu
    const forbidden = await request(app)
      .get('/api/v1/reports/revenue-dashboard')
      .set('x-user-id', 'sales1');
    expect(forbidden.status).toBe(403);

    // ADMIN xem dashboard doanh thu
    const dashRes = await request(app)
      .get('/api/v1/reports/revenue-dashboard')
      .set('x-user-id', 'admin');
    expect(dashRes.status).toBe(200);

    const d = dashRes.body.data;
    expect(d.summary.netRevenue).toBe(3 * 4500000);
    expect(d.summary.estimatedCogs).toBe(3 * 3000000);
    expect(d.summary.grossProfit).toBe(3 * 1500000);
    expect(d.summary.totalOrders).toBe(1);
    expect(d.summary.totalUnitsSold).toBe(3);

    expect(d.topSellingProducts.length).toBe(1);
    expect(d.topSellingProducts[0].productCode).toBe(p1.code);
    expect(d.topSellingProducts[0].netSoldQty).toBe(3);

    expect(d.needsPushProducts.length).toBeGreaterThanOrEqual(1);
    const pushP2 = d.needsPushProducts.find((r: any) => r.productCode === p2.code);
    expect(pushP2).toBeDefined();
    expect(pushP2.stockFloor2).toBe(12);
    expect(pushP2.pushReasons.length).toBeGreaterThan(0);

    // MARKETING được phép truy cập GET /api/v1/reports/push-products để quan sát Các Sản Phẩm Đang Cần Đẩy Mạnh
    const mktLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'marketing1', password: '123456' });
    const mktToken = mktLogin.body.data.token;

    const mktPushRes = await request(app)
      .get('/api/v1/reports/push-products')
      .set('Authorization', `Bearer ${mktToken}`);
    expect(mktPushRes.status).toBe(200);
    expect(mktPushRes.body.data.summary.totalPushProducts).toBeGreaterThanOrEqual(1);
    const mktPushP2 = mktPushRes.body.data.needsPushProducts.find((r: any) => r.productCode === p2.code);
    expect(mktPushP2).toBeDefined();
    expect(mktPushP2.stockFloor2).toBe(12);
    expect(mktPushP2.pushReasons.length).toBeGreaterThan(0);
  });
});

describe('GĐ1: Dashboard doanh thu — trả hàng trừ đúng phân bổ giảm giá bill, lọc theo đơn gốc, giá vốn không clamp', () => {
  let catId = '';
  let pA = '';
  let pB = '';
  const get = (qs = '') =>
    request(app).get(`/api/v1/reports/revenue-dashboard${qs}`).set('x-user-id', 'admin');

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const cat = await request(app).post('/api/v1/categories').set('x-user-id', 'admin')
      .send({ code: 'GD1', name: 'Danh mục GĐ1' });
    catId = cat.body.data._id;
    const mk = async (name: string, cost: number, price: number) =>
      (await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name, categoryId: catId, unit: 'Cái', quantity: 20, targetWarehouse: 'FLOOR_1',
        costPrice: cost, sellingPrice: price,
      })).body.data._id as string;
    pA = await mk('SP A GD1', 600000, 1000000);
    pB = await mk('SP B GD1', 300000, 500000);

    const sell = async (body: any) => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({ customerName: 'Khách GĐ1', customerPhone: '0909111222', ...body });
      if (res.status !== 201) console.log(JSON.stringify(res.body));
      expect(res.status).toBe(201);
      const id = res.body.data._id || res.body.data.order?._id;
      // Lùi ngày bán về 2 ngày trước để ngày hôm nay chỉ có phiếu trả
      await orderRepo.updateById(id, { createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) } as any);
      return id as string;
    };
    const ret = async (orderId: string, productId: string) => {
      const res = await request(app).post('/api/v1/returns').set('x-user-id', 'sales1').send({
        orderId, type: 'RETURN', refundMethod: 'CASH',
        returnItems: [{ productId, quantity: 1, condition: 'GOOD' }],
      });
      expect(res.status).toBe(201);
    };

    // Đơn 1 (CASH): A×2 + B×2 = 3.000.000, giảm bill 300.000 → thu 2.700.000
    const o1 = await sell({
      paymentMethod: 'CASH', billDiscountType: 'AMOUNT', billDiscountValue: 300000,
      items: [{ productId: pA, quantity: 2 }, { productId: pB, quantity: 2 }],
    });
    // Đơn 2 (BANKING): A×1 = 1.000.000
    const o2 = await sell({ paymentMethod: 'BANKING', items: [{ productId: pA, quantity: 1 }] });
    // Đơn 3 (OTHER + công nợ toàn phần): B×2 = 1.000.000
    const o3 = await sell({
      paymentMethod: 'OTHER', paymentMethodDetail: 'Công nợ', debtAmount: 1000000,
      items: [{ productId: pB, quantity: 2 }],
    });

    await ret(o1, pA); // trả A×1: lineTotal 1.000.000
    await ret(o2, pA); // trả A×1: 1.000.000 (refundMethod CASH, nhưng đơn gốc BANKING)
    await ret(o3, pB); // trả B×1: 500.000 (refundMethod CASH, đơn gốc công nợ)
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('(a) Đơn giảm giá bill + trả một phần: byCategory = doanh thu đã bán − (lineTotal − giảm giá bill phân bổ) của hàng trả', async () => {
    const d = (await get('?paymentMethod=CASH')).body.data;
    // A: 2.000.000−200.000 = 1.800.000, trả: 1.000.000−round(1/3×300.000)=900.000 → 900.000
    // B: 1.000.000−100.000 = 900.000
    const cat = d.byCategory.find((c: any) => c.categoryId === catId);
    expect(cat.revenue).toBe(1800000);
    const a = d.topSellingProducts.find((p: any) => p.productId === pA);
    expect(a.revenue).toBe(900000);
    // Toàn bộ: bán 4.700.000 − trả (900.000 + 1.000.000 + 500.000) = 2.300.000
    const all = (await get()).body.data;
    expect(all.byCategory.find((c: any) => c.categoryId === catId).revenue).toBe(2300000);
  });

  it('(b) Lọc DEBT: chỉ tính phiếu trả của đơn gốc có công nợ', async () => {
    const d = (await get('?paymentMethod=DEBT')).body.data;
    expect(d.summary.totalOrders).toBe(1);
    expect(d.summary.orderRevenue).toBe(1000000);
    expect(d.summary.netReturnRefund ?? d.summary.netRevenue - d.summary.orderRevenue).toBe(-500000);
    expect(d.summary.netRevenue).toBe(500000);
  });

  it('(c) Lọc paymentMethod theo đơn gốc, không theo refundMethod', async () => {
    const bank = (await get('?paymentMethod=BANKING')).body.data;
    expect(bank.summary.orderRevenue).toBe(1000000);
    expect(bank.summary.netRevenue).toBe(0); // chỉ phiếu trả của đơn 2 (−1.000.000)
    const cash = (await get('?paymentMethod=CASH')).body.data;
    expect(cash.summary.orderRevenue).toBe(2700000);
    expect(cash.summary.netRevenue).toBe(1800000); // chỉ phiếu trả của đơn 1 (−900.000 sau phân bổ giảm bill)
  });

  it('(d) Tổng dailyTrend khớp tổng kỳ khi có ngày chỉ có phiếu trả (giá vốn âm không bị clamp)', async () => {
    const d = (await get()).body.data;
    expect(d.summary.netRevenue).toBe(4700000 - 2400000);
    expect(d.summary.estimatedCogs).toBe(3000000 - 1500000);
    const sum = (k: string, arr: any[]) => arr.reduce((s, x) => s + x[k], 0);
    expect(sum('netRevenue', d.dailyTrend)).toBe(d.summary.netRevenue);
    expect(sum('cogs', d.dailyTrend)).toBe(d.summary.estimatedCogs);
    expect(sum('netRevenue', d.hourlyTrend)).toBe(d.summary.netRevenue);
    expect(sum('cogs', d.hourlyTrend)).toBe(d.summary.estimatedCogs);
    expect(d.dailyTrend.some((x: any) => x.orders === 0 && x.cogs < 0)).toBe(true);
    expect(d.summary.returnedOrders).toBe(3);
  });
});

describe('GĐ2 & GĐ4: Chuẩn hóa chỉ số Dashboard Doanh thu (D1–D4) & Trả/Đổi hàng đơn công nợ (AC-01..AC-16)', () => {
  const getDash = (qs = '') =>
    request(app).get(`/api/v1/reports/revenue-dashboard${qs}`).set('x-user-id', 'admin');

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('AC-01..AC-06, AC-09, AC-11, AC-14: Kiểm chứng ví dụ số mục 3 của BA (Đơn D01 + Thu nợ + Phiếu đổi trả R01 + Đổi costPrice không ảnh hưởng kỳ cũ)', async () => {
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'BA_SEC3', name: 'Danh mục Ví dụ BA' });
    const catId = catRes.body.data._id;

    const mkProd = async (name: string, costPrice: number, sellingPrice: number) => {
      const r = await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name,
        categoryId: catId,
        unit: 'Cái',
        quantity: 20,
        targetWarehouse: 'FLOOR_1',
        costPrice,
        sellingPrice,
      });
      expect(r.status).toBe(201);
      return r.body.data._id as string;
    };

    const pA = await mkProd('SP A Mẫu BA (SPA01)', 250000, 500000);
    const pB = await mkProd('SP B Mẫu BA (SPB01)', 150000, 300000);
    const pC = await mkProd('SP C Mẫu BA (SPC01)', 120000, 200000);

    // Tạo Đơn D01: thanh toán thẻ, phí 1.8%, nợ 300.000đ
    // Dòng A: 500k giảm 10% -> unitPrice 450k x 2 = 900k (unitCost 250k)
    // Dòng B: 300k x 1 = 300k (unitCost 150k)
    // S = 1.200.000, giảm bill B = 100.000 -> afterBill = 1.100.000
    // F = round(1.100.000 * 1.8%) = 19.800 -> totalAmount = 1.119.800
    const d01Res = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách D01',
        customerPhone: '0911000111',
        paymentMethod: 'CARD',
        hasCardFee: true,
        cardFeePercent: 1.8,
        billDiscountType: 'AMOUNT',
        billDiscountValue: 100000,
        debtAmount: 300000,
        items: [
          { productId: pA, quantity: 2, discountType: 'PERCENT', discountValue: 10 },
          { productId: pB, quantity: 1 },
        ],
      });
    expect(d01Res.status).toBe(201);
    const d01 = d01Res.body.data;
    expect(d01.subtotal).toBe(1200000);
    expect(d01.billDiscountAmount).toBe(100000);
    expect(d01.cardFee).toBe(19800);
    expect(d01.totalAmount).toBe(1119800);
    expect(d01.initialDebtAmount).toBe(300000);
    expect(d01.debtAmount).toBe(300000);
    expect(d01.paidAmount).toBe(819800);
    expect(d01.items[0].unitCost).toBe(250000);
    expect(d01.items[1].unitCost).toBe(150000);

    // Cùng ngày khách trả nợ 100.000 -> debtAmount = 200.000
    const dpRes = await request(app)
      .post(`/api/v1/orders/${d01._id}/debt-payment`)
      .set('x-user-id', 'admin')
      .send({ amount: 100000, method: 'BANKING', note: 'Trả nợ đợt 1' });
    expect(dpRes.status).toBe(200);
    expect(dpRes.body.data.debtAmount).toBe(200000);
    expect(dpRes.body.data.paidAmount).toBe(919800);

    // Kiểm tra /returns/calculate trước khi xác nhận phiếu đổi trả R01
    const calcRes = await request(app)
      .post('/api/v1/returns/calculate')
      .set('x-user-id', 'sales1')
      .send({
        orderId: d01._id,
        type: 'EXCHANGE',
        returnItems: [{ productId: pA, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: pC, quantity: 1 }],
      });
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.data.returnSubtotal).toBe(412500); // AC-09
    expect(calcRes.body.data.refundedCardFee).toBe(7425);
    expect(calcRes.body.data.returnTotal).toBe(419925);
    expect(calcRes.body.data.exchangeTotal).toBe(200000);
    expect(calcRes.body.data.netDifference).toBe(-219925);
    expect(calcRes.body.data.refundAmount).toBe(219925);
    expect(calcRes.body.data.debtBefore).toBe(200000);
    expect(calcRes.body.data.debtReduction).toBe(200000);
    expect(calcRes.body.data.cashRefund).toBe(19925);
    expect(calcRes.body.data.debtAfter).toBe(0);
    expect(calcRes.body.data.debtStatusAfter).toBe('SETTLED');

    // Tạo phiếu đổi trả R01
    const r01Res = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: d01._id,
        type: 'EXCHANGE',
        refundMethod: 'CASH',
        returnItems: [{ productId: pA, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: pC, quantity: 1 }],
      });
    expect(r01Res.status).toBe(201);
    expect(r01Res.body.data.debtReduction).toBe(200000);
    expect(r01Res.body.data.cashRefund).toBe(19925);
    expect(r01Res.body.data.debtAfter).toBe(0);
    expect(r01Res.body.data.debtStatusAfter).toBe('SETTLED');
    expect(r01Res.body.data.order.debtAmount).toBe(0);
    expect(r01Res.body.data.order.debtStatus).toBe('SETTLED');
    expect(r01Res.body.data.order.paidAmount).toBe(899875); // 819.800 lúc mua + 100.000 thu nợ - 19.925 hoàn tiền mặt
    expect(r01Res.body.data.order.debtAdjustments.length).toBe(1);
    expect(r01Res.body.data.order.debtAdjustments[0].amount).toBe(200000);

    // AC-11: Đổi giá vốn sản phẩm A từ 250.000 lên 300.000 sau khi bán -> cogs báo cáo không đổi
    const patchCost = await request(app)
      .patch(`/api/v1/products/${pA}`)
      .set('x-user-id', 'admin')
      .send({ costPrice: 300000 });
    expect(patchCost.status).toBe(200);

    // Kiểm tra kết quả dashboard khớp tuyệt đối bảng mục 3 của BA (AC-01..AC-05, AC-11, AC-14)
    const dash = (await getDash()).body.data;
    const s = dash.summary;

    expect(s.grossRevenue).toBe(1300000);
    expect(s.itemDiscountTotal).toBe(100000);
    expect(s.billDiscountTotal).toBe(100000);
    expect(s.orderRevenue).toBe(1100000);
    expect(s.returnGoodsTotal).toBe(412500);
    expect(s.exchangeGoodsTotal).toBe(200000);
    expect(s.netRevenue).toBe(887500);
    expect(s.cardFeeCollected).toBe(19800);
    expect(s.cardFeeRefunded).toBe(7425);
    expect(s.cardFeeNet).toBe(12375);
    expect(s.salesCogs).toBe(520000);
    expect(s.giftCogs).toBe(0);
    expect(s.giftRetailValue).toBe(0);
    expect(s.estimatedCogs).toBe(520000);
    expect(s.cogsEstimated).toBe(false);
    expect(s.grossProfit).toBe(367500);
    expect(s.grossMarginPercent).toBe(41.4);
    // Phí quẹt thẻ thu hộ ngân hàng (cardFee) tách riêng, KHÔNG tính vào cashAtPurchase / cashRefunded / cashCollected
    expect(s.cashAtPurchase).toBe(800000);
    expect(s.debtCollectedInPeriod).toBe(100000);
    expect(s.cashRefunded).toBe(12500);
    expect(s.cashCollected).toBe(887500);
    expect(s.debtReducedByReturnInPeriod).toBe(200000);
    expect(s.outstandingDebtInPeriod).toBe(0);

    // AC-05: Đồng nhất thức cashCollected = netRevenue - outstandingDebt (phí thẻ thu hộ tách riêng)
    expect(s.cashCollected).toBe(s.netRevenue - s.outstandingDebtInPeriod);

    // AC-03: Tổng byCategory[].revenue = netRevenue
    const sumCatRev = dash.byCategory.reduce((acc: number, c: any) => acc + c.revenue, 0);
    expect(sumCatRev).toBe(s.netRevenue);

    // AC-04: Tổng dailyTrend & hourlyTrend = summary
    const sumTrend = (k: string, arr: any[]) => arr.reduce((acc, x) => acc + x[k], 0);
    expect(sumTrend('netRevenue', dash.dailyTrend)).toBe(s.netRevenue);
    expect(sumTrend('cogs', dash.dailyTrend)).toBe(s.estimatedCogs);
    expect(sumTrend('grossProfit', dash.dailyTrend)).toBe(s.grossProfit);
    expect(sumTrend('cashCollected', dash.dailyTrend)).toBe(s.cashCollected);
    expect(sumTrend('netRevenue', dash.hourlyTrend)).toBe(s.netRevenue);
    expect(sumTrend('cashCollected', dash.hourlyTrend)).toBe(s.cashCollected);

    // AC-14: Báo cáo công nợ: initialDebt = collected + reducedByReturn + outstanding
    const dmSum = dash.debtManagement.summary;
    expect(dmSum.totalInitialDebt).toBe(300000);
    expect(dmSum.totalCollectedDebt).toBe(100000);
    expect(dmSum.totalReducedByReturn).toBe(200000);
    expect(dmSum.totalOutstandingDebt).toBe(0);
    expect(dmSum.totalInitialDebt).toBe(
      dmSum.totalCollectedDebt + dmSum.totalReducedByReturn + dmSum.totalOutstandingDebt
    );
    expect(dash.debtManagement.orders[0].paidAmount).toBe(899875);
    expect(dash.debtManagement.customers[0].totalPaidAmount).toBe(899875);

    // Chặn thu nợ tiếp khi nợ đã giảm về 0 (Biên 12)
    const dpAfterSettled = await request(app)
      .post(`/api/v1/orders/${d01._id}/debt-payment`)
      .set('x-user-id', 'admin')
      .send({ amount: 50000, method: 'CASH' });
    expect(dpAfterSettled.status).toBe(400);
    expect(dpAfterSettled.body.code).toBe('ORDER_NO_DEBT');
  });

  it('AC-07, AC-08, AC-10, AC-12, AC-13 & Q3: Trả hàng nợ lớn hơn phần hoàn, trả hết đơn giảm bill lẻ, kỳ khác nhau & cogsEstimated cho đơn cũ', async () => {
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'BA_EDGE', name: 'Danh mục Biên' });
    const catId = catRes.body.data._id;

    const p1 = (
      await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name: 'SP 1 Biên (SPB1)',
        categoryId: catId,
        unit: 'Cái',
        quantity: 20,
        targetWarehouse: 'FLOOR_1',
        costPrice: 100000,
        sellingPrice: 300000,
      })
    ).body.data._id;

    const p2 = (
      await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name: 'SP 2 Biên (SPB2)',
        categoryId: catId,
        unit: 'Cái',
        quantity: 20,
        targetWarehouse: 'FLOOR_1',
        costPrice: 150000,
        sellingPrice: 300000,
      })
    ).body.data._id;

    // AC-07: Đơn nợ 500.000, trả 1 SP hoàn 200.000 -> debtReduction=200.000, debtAfter=300.000 (PARTIAL), cashRefund=0
    const ordDebtRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Nợ Lớn',
        customerPhone: '0922333444',
        paymentMethod: 'OTHER',
        paymentMethodDetail: 'Công nợ',
        debtAmount: 500000,
        items: [
          { productId: p1, quantity: 1 },
          { productId: p2, quantity: 1 },
        ],
      });
    expect(ordDebtRes.status).toBe(201);
    const ordDebtId = ordDebtRes.body.data._id;

    // Lùi đơn về ngày 2026-10-01
    await orderRepo.updateById(ordDebtId, {
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    } as any);

    // Phiếu trả làm ngày hôm nay (kỳ sau): trả 1 SP p1 (300.000) trên đơn nợ 500.000
    const retDebtRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: ordDebtId,
        type: 'RETURN',
        refundMethod: 'BANKING',
        returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
      });
    expect(retDebtRes.status).toBe(201);
    expect(retDebtRes.body.data.debtReduction).toBe(300000);
    expect(retDebtRes.body.data.cashRefund).toBe(0);
    expect(retDebtRes.body.data.debtAfter).toBe(200000);
    expect(retDebtRes.body.data.debtStatusAfter).toBe('PARTIAL');
    // BR-13: cashRefund = 0 thì refundMethod lưu CASH
    expect(retDebtRes.body.data.returnExchange.refundMethod).toBe('CASH');

    // AC-13: Thu nợ 50.000 hôm nay cho đơn ngày 2026-10-01
    const dpRes = await request(app)
      .post(`/api/v1/orders/${ordDebtId}/debt-payment`)
      .set('x-user-id', 'admin')
      .send({ amount: 50000, method: 'CASH' });
    expect(dpRes.status).toBe(200);
    expect(dpRes.body.data.debtAmount).toBe(150000);
    expect(dpRes.body.data.paidAmount).toBe(150000); // 100.000 lúc mua + 50.000 thu nợ (không bị cộng nhầm 300.000 giảm nợ trả hàng!)

    // AC-12 & AC-13: Xem báo cáo hôm nay (from = hôm nay)
    const todayStr = new Date().toISOString().slice(0, 10);
    const dashToday = (await getDash(`?from=${todayStr}&to=${todayStr}`)).body.data;
    expect(dashToday.summary.returnGoodsTotal).toBe(300000);
    expect(dashToday.summary.returnFromPriorPeriods).toBe(300000);
    expect(dashToday.summary.debtCollectedInPeriod).toBe(50000);
    expect(dashToday.summary.cashRefunded).toBe(0);
    expect(dashToday.summary.cashCollected).toBe(50000);

    // AC-10: Đơn có giảm bill lẻ (3 dòng x 300k = 900k, giảm bill 100k -> afterBill = 800k), trả hết 2 lần -> tổng returnSubtotal = 800k
    const oddOrd = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách Lẻ Bill',
          customerPhone: '0933444555',
          paymentMethod: 'CARD',
          hasCardFee: true,
          cardFeePercent: 1.8,
          billDiscountType: 'AMOUNT',
          billDiscountValue: 100000,
          items: [
            { productId: p1, quantity: 2 },
            { productId: p2, quantity: 1 },
          ],
        })
    ).body.data;
    expect(oddOrd.subtotal).toBe(900000);
    expect(oddOrd.billDiscountAmount).toBe(100000);

    const rPart1 = (
      await request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: oddOrd._id,
          type: 'RETURN',
          returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        })
    ).body.data.returnExchange;

    const rPart2 = (
      await request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: oddOrd._id,
          type: 'RETURN',
          returnItems: [
            { productId: p1, quantity: 1, condition: 'GOOD' },
            { productId: p2, quantity: 1, condition: 'GOOD' },
          ],
        })
    ).body.data.returnExchange;

    expect(rPart1.returnSubtotal + rPart2.returnSubtotal).toBe(800000);
    expect(rPart1.refundedCardFee + rPart2.refundedCardFee).toBe(oddOrd.cardFee);

    // Q3: Mô phỏng đơn cũ thiếu unitCost -> cogsEstimated = true
    await orderRepo.updateById(oddOrd._id, {
      items: oddOrd.items.map((it: any) => {
        const copy = { ...it };
        delete copy.unitCost;
        return copy;
      }),
    } as any);

    const dashAll = (await getDash()).body.data;
    expect(dashAll.summary.cogsEstimated).toBe(true);

    // AC-08: Đơn không nợ trả hàng -> cashRefund = refundAmount, debtReduction = 0, không sinh debtAdjustments
    const noDebtOrd = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách Không Nợ',
          customerPhone: '0944555666',
          paymentMethod: 'CASH',
          items: [{ productId: p1, quantity: 1 }],
        })
    ).body.data;

    const noDebtRet = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: noDebtOrd._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
      });
    expect(noDebtRet.status).toBe(201);
    expect(noDebtRet.body.data.debtReduction).toBe(0);
    expect(noDebtRet.body.data.cashRefund).toBe(300000);
    expect(noDebtRet.body.data.order.debtAdjustments || []).toHaveLength(0);

    // AC-15 & AC-16: Trả hàng nhiều lần không vượt SL / không làm debtAmount < 0, lỗi phiếu giữa chừng không đổi nợ/tồn kho
    const debtOrd2 = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách AC15 AC16',
          customerPhone: '0955666777',
          paymentMethod: 'OTHER',
          paymentMethodDetail: 'Công nợ',
          debtAmount: 150000,
          items: [{ productId: p2, quantity: 1 }],
        })
    ).body.data;

    // Lần 1: Trả hợp lệ 1 cái p2 (300k), nợ gốc 150k -> giảm nợ 150k về 0, hoàn tiền 150k
    const retOk = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: debtOrd2._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [{ productId: p2, quantity: 1, condition: 'GOOD' }],
      });
    expect(retOk.status).toBe(201);
    expect(retOk.body.data.order.debtAmount).toBe(0);
    expect(retOk.body.data.cashRefund).toBe(150000);

    // Lần 2: Cố tình gửi thêm POST /returns cho cùng dòng -> bị chặn 400 EXCEED_RETURNABLE_QUANTITY, debtAmount vẫn >= 0
    const retDup = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: debtOrd2._id,
        type: 'RETURN',
        refundMethod: 'CASH',
        returnItems: [{ productId: p2, quantity: 1, condition: 'GOOD' }],
      });
    expect(retDup.status).toBe(400);
    expect(retDup.body.code).toBe('EXCEED_RETURNABLE_QUANTITY');

    const ordAfterDup = await orderRepo.findById(debtOrd2._id);
    expect(ordAfterDup?.debtAmount).toBe(0);
    expect(ordAfterDup?.items[0].returnedQuantity).toBe(1);

    // AC-16: Khi tạo phiếu đổi hàng bị lỗi (ví dụ SP đổi vượt tồn kho), nợ và tồn kho của đơn gốc không bị thay đổi
    const debtOrd3 = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách AC16 Rollback',
          customerPhone: '0966777888',
          paymentMethod: 'OTHER',
          paymentMethodDetail: 'Công nợ',
          debtAmount: 200000,
          items: [{ productId: p1, quantity: 1 }],
        })
    ).body.data;

    const failedExchange = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: debtOrd3._id,
        type: 'EXCHANGE',
        refundMethod: 'CASH',
        returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: p2, quantity: 999 }], // vượt tồn kho
      });
    expect(failedExchange.status).toBe(400);
    expect(failedExchange.body.code).toBe('INSUFFICIENT_EXCHANGE_STOCK');

    const ordAfterFail = await orderRepo.findById(debtOrd3._id);
    expect(ordAfterFail?.debtAmount).toBe(200000);
    expect(ordAfterFail?.items[0].returnedQuantity).toBe(0);
  });

  it('Codex Review Fixes (1–4): (1) paidAmount trừ cashRefund, (2) trả 3 lần dòng 800k/3 chiếc khớp 800.000đ, (3) concurrent POST /returns tuần tự hóa không mất lịch sử nợ, (4) rollback nguyên tử khi lỗi giữa chừng', async () => {
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'CODEX_FIX', name: 'Danh mục Codex Fix' });
    const catId = catRes.body.data._id;

    const p1 = (
      await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name: 'SP 1 Codex (SPCX1)',
        categoryId: catId,
        unit: 'Cái',
        quantity: 20,
        targetWarehouse: 'FLOOR_1',
        costPrice: 150000,
        sellingPrice: 300000,
      })
    ).body.data._id;

    const p2 = (
      await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name: 'SP 2 Codex (SPCX2)',
        categoryId: catId,
        unit: 'Cái',
        quantity: 20,
        targetWarehouse: 'FLOOR_1',
        costPrice: 120000,
        sellingPrice: 300000,
      })
    ).body.data._id;

    // [Điểm 2]: Đơn có 1 dòng 3 chiếc x 300.000 = 900.000, giảm bill 100.000 -> thuần 800.000
    // Trả 3 lần mỗi lần 1 chiếc -> 266.667 + 266.667 + 266.666 = đúng 800.000 (không vượt 1đ)
    const threePieceOrder = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách Trả 3 Lần',
          customerPhone: '0977000111',
          paymentMethod: 'CASH',
          billDiscountType: 'AMOUNT',
          billDiscountValue: 100000,
          items: [{ productId: p1, quantity: 3 }],
        })
    ).body.data;
    expect(threePieceOrder.totalAmount).toBe(800000);

    const ret1 = (
      await request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: threePieceOrder._id,
          type: 'RETURN',
          returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        })
    ).body.data.returnExchange;
    expect(ret1.returnSubtotal).toBe(266667);

    const ret2 = (
      await request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: threePieceOrder._id,
          type: 'RETURN',
          returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        })
    ).body.data.returnExchange;
    expect(ret2.returnSubtotal).toBe(266667);

    const ret3 = (
      await request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: threePieceOrder._id,
          type: 'RETURN',
          returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        })
    ).body.data.returnExchange;
    expect(ret3.returnSubtotal).toBe(266666);
    expect(ret1.returnSubtotal + ret2.returnSubtotal + ret3.returnSubtotal).toBe(800000);

    // [Điểm 1 & Điểm 3]: Đơn công nợ 2 sản phẩm (p1=300k, p2=300k -> tổng 600k, trả trước 100k, nợ 500k)
    // Gửi 2 request POST /returns đồng thời (Promise.all):
    // - Request A trả p1 (300k)
    // - Request B trả p2 (300k)
    // Tổng hoàn 600k cấn hết nợ 500k (2 bản ghi debtAdjustments: 300k + 200k) và hoàn tiền mặt 100k -> paidAmount giảm từ 100k về 0!
    const concOrder = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách Đồng Thời',
          customerPhone: '0977000222',
          paymentMethod: 'OTHER',
          paymentMethodDetail: 'Công nợ',
          debtAmount: 500000,
          items: [
            { productId: p1, quantity: 1 },
            { productId: p2, quantity: 1 },
          ],
        })
    ).body.data;
    expect(concOrder.paidAmount).toBe(100000);
    expect(concOrder.debtAmount).toBe(500000);

    const [concResA, concResB] = await Promise.all([
      request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: concOrder._id,
          type: 'RETURN',
          refundMethod: 'CASH',
          returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        }),
      request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: concOrder._id,
          type: 'RETURN',
          refundMethod: 'CASH',
          returnItems: [{ productId: p2, quantity: 1, condition: 'GOOD' }],
        }),
    ]);
    expect(concResA.status).toBe(201);
    expect(concResB.status).toBe(201);

    const updatedConcOrder = await orderRepo.findById(concOrder._id);
    expect(updatedConcOrder?.debtAmount).toBe(0);
    expect(updatedConcOrder?.debtStatus).toBe('SETTLED');
    expect(updatedConcOrder?.paidAmount).toBe(0); // 100k lúc mua - 100k cashRefund = 0
    expect(updatedConcOrder?.debtAdjustments?.length).toBe(2);
    const totalAdj = (updatedConcOrder?.debtAdjustments || []).reduce(
      (s, a) => s + Number(a.amount || 0),
      0
    );
    expect(totalAdj).toBe(500000);

    const dashAfterConc = (await getDash()).body.data;
    const concDebtRow = dashAfterConc.debtManagement.orders.find(
      (o: any) => o._id === String(concOrder._id)
    );
    expect(concDebtRow.paidAmount).toBe(0);
    expect(concDebtRow.reducedByReturnAmount).toBe(500000);
    expect(concDebtRow.debtAmount).toBe(0);

    // [Điểm 3b]: Gửi 2 request POST /returns đồng thời cùng trả 1 sản phẩm chỉ có quantity = 1 -> 1 thành công (201), 1 bị chặn (400)
    const raceDupOrder = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách Race Trùng',
          customerPhone: '0977000333',
          paymentMethod: 'OTHER',
          paymentMethodDetail: 'Công nợ',
          debtAmount: 200000,
          items: [{ productId: p1, quantity: 1 }],
        })
    ).body.data;

    const [dupA, dupB] = await Promise.all([
      request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: raceDupOrder._id,
          type: 'RETURN',
          returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        }),
      request(app)
        .post('/api/v1/returns')
        .set('x-user-id', 'sales1')
        .send({
          orderId: raceDupOrder._id,
          type: 'RETURN',
          returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        }),
    ]);
    const statuses = [dupA.status, dupB.status].sort();
    expect(statuses).toEqual([201, 400]);

    // [Điểm 4]: Rollback nguyên tử toàn bộ (ReturnExchange, StockMovement, Product stock, Order) khi bước cuối cùng bị lỗi
    const txOrder = (
      await request(app)
        .post('/api/v1/orders')
        .set('x-user-id', 'sales1')
        .send({
          customerName: 'Khách Rollback Nguyên Tử',
          customerPhone: '0977000444',
          paymentMethod: 'OTHER',
          paymentMethodDetail: 'Công nợ',
          debtAmount: 250000,
          items: [{ productId: p1, quantity: 1 }],
        })
    ).body.data;

    const p1BeforeTx = await productRepo.findById(p1);
    const p2BeforeTx = await productRepo.findById(p2);
    const movementsBeforeTx = await stockMovementRepo.find({});

    const spyUpdateOrder = vi
      .spyOn(orderRepo, 'updateById')
      .mockRejectedValueOnce(new Error('Simulated DB crash on order update'));

    const failedTxRes = await request(app)
      .post('/api/v1/returns')
      .set('x-user-id', 'sales1')
      .send({
        orderId: txOrder._id,
        type: 'EXCHANGE',
        refundMethod: 'CASH',
        returnItems: [{ productId: p1, quantity: 1, condition: 'GOOD' }],
        exchangeItems: [{ productId: p2, quantity: 1 }],
      });
    expect(failedTxRes.status).toBe(500);
    spyUpdateOrder.mockRestore();

    // Kiểm tra phiếu trả/đổi, sổ kho, tồn kho SP và đơn hàng gốc được hoàn tác 100%
    const orphanReturns = await returnExchangeRepo.find({ orderId: txOrder._id });
    expect(orphanReturns.length).toBe(0);

    const movementsAfterTx = await stockMovementRepo.find({});
    expect(movementsAfterTx.length).toBe(movementsBeforeTx.length);

    const p1AfterTx = await productRepo.findById(p1);
    const p2AfterTx = await productRepo.findById(p2);
    expect(p1AfterTx?.stock).toBe(p1BeforeTx?.stock);
    expect(p1AfterTx?.stockFloor1).toBe(p1BeforeTx?.stockFloor1);
    expect(p2AfterTx?.stock).toBe(p2BeforeTx?.stock);
    expect(p2AfterTx?.stockFloor1).toBe(p2BeforeTx?.stockFloor1);

    const txOrderAfter = await orderRepo.findById(txOrder._id);
    expect(txOrderAfter?.status).toBe('PAID');
    expect(txOrderAfter?.debtAmount).toBe(250000);
    expect(txOrderAfter?.items[0].returnedQuantity).toBe(0);
    expect(txOrderAfter?.debtAdjustments || []).toHaveLength(0);
  });

  it('Tích hợp Doanh thu Dịch vụ (ServiceOrder): Ghi nhận doanh thu theo ngày tạo đơn (COGS = 0đ), Thực thu (cashCollected) chỉ tính sau khi hoàn thành (RETURNED)', async () => {
    await clearDatabase();
    await seedDatabaseIfNeeded();

    // 1. Tạo 2 đơn dịch vụ:
    // - Đơn DV 1: Căng vợt 200.000đ, khách đã trả trước lúc gửi 200.000đ nhưng đang xử lý (RECEIVED, chưa RETURNED)
    const dv1Res = await request(app)
      .post('/api/v1/service-orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Dịch Vụ 1',
        customerPhone: '0905111222',
        receivedAt: '2026-11-18',
        dueAt: '2026-11-19',
        paymentMethod: 'CASH',
        paidAmount: 200000,
        items: [
          {
            serviceCode: 'DV_CANG_VOT',
            serviceName: 'Căng vợt cầu lông',
            unit: 'Cây',
            defaultPrice: 200000,
            unitPrice: 200000,
            quantity: 1,
          },
        ],
      });
    expect(dv1Res.status).toBe(201);
    const dv1 = dv1Res.body.data;

    // - Đơn DV 2: Hàn vợt 300.000đ, giảm 50.000đ -> còn 250.000đ, khách chọn trả lúc nhận đồ (paidAmount = 0)
    const dv2Res = await request(app)
      .post('/api/v1/service-orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Dịch Vụ 2',
        customerPhone: '0905333444',
        receivedAt: '2026-11-18',
        dueAt: '2026-11-19',
        paymentMethod: 'BANKING',
        paidAmount: 0,
        billDiscountType: 'AMOUNT',
        billDiscountValue: 50000,
        items: [
          {
            serviceCode: 'DV_HAN_VOT',
            serviceName: 'Hàn vợt carbon',
            unit: 'Cây',
            defaultPrice: 300000,
            unitPrice: 300000,
            quantity: 1,
          },
        ],
      });
    expect(dv2Res.status).toBe(201);
    const dv2 = dv2Res.body.data;
    expect(dv2.totalAmount).toBe(250000);

    // 2. Khi cả 2 đơn dịch vụ đều chưa hoàn thành (chưa RETURNED):
    // - Doanh thu thuần (netRevenue) và Lãi gộp (grossProfit) ĐÃ GHI NHẬN ngay = 200.000 + 250.000 = 450.000đ (Giá vốn = 0đ)
    // - Thực thu (cashCollected / serviceCashCollected) = 0đ (chưa hoàn thành đơn nào), servicePendingCollection = 450.000đ
    const dashBeforeComplete = (await getDash()).body.data;
    expect(dashBeforeComplete.summary.serviceOrdersCount).toBe(2);
    expect(dashBeforeComplete.summary.activeServiceOrdersCount).toBe(2);
    expect(dashBeforeComplete.summary.completedServiceOrdersCount).toBe(0);
    expect(dashBeforeComplete.summary.serviceRevenue).toBe(450000);
    expect(dashBeforeComplete.summary.netRevenue).toBe(450000);
    expect(dashBeforeComplete.summary.estimatedCogs).toBe(0);
    expect(dashBeforeComplete.summary.grossProfit).toBe(450000);
    expect(dashBeforeComplete.summary.serviceCashCollected).toBe(0);
    expect(dashBeforeComplete.summary.cashCollected).toBe(0);
    expect(dashBeforeComplete.summary.servicePendingCollection).toBe(450000);

    // 3. Hoàn thành Đơn DV 1 (RETURNED) và Đơn DV 2 (READY -> Sales xác nhận thu tiền & trả đồ RETURNED):
    const completeDv1 = await request(app)
      .patch(`/api/v1/service-orders/${dv1._id}/status`)
      .set('x-user-id', 'admin')
      .send({ status: 'RETURNED' });
    expect(completeDv1.status).toBe(200);

    await request(app)
      .patch(`/api/v1/service-orders/${dv2._id}/status`)
      .set('x-user-id', 'admin')
      .send({ status: 'READY' });

    const completeDv2 = await request(app)
      .patch(`/api/v1/service-orders/${dv2._id}/status`)
      .set('x-user-id', 'sales1')
      .send({
        status: 'RETURNED',
        collectAmount: 250000,
        paymentMethod: 'BANKING',
      });
    expect(completeDv2.status).toBe(200);

    // 4. Kiểm tra lại Dashboard sau khi cả 2 đơn dịch vụ đã hoàn thành (RETURNED):
    // - Thực thu (serviceCashCollected & cashCollected) ghi nhận đủ 450.000đ, servicePendingCollection về 0đ
    const dashAfterComplete = (await getDash()).body.data;
    expect(dashAfterComplete.summary.completedServiceOrdersCount).toBe(2);
    expect(dashAfterComplete.summary.activeServiceOrdersCount).toBe(0);
    expect(dashAfterComplete.summary.serviceRevenue).toBe(450000);
    expect(dashAfterComplete.summary.netRevenue).toBe(450000);
    expect(dashAfterComplete.summary.grossProfit).toBe(450000);
    expect(dashAfterComplete.summary.serviceCashCollected).toBe(450000);
    expect(dashAfterComplete.summary.cashCollected).toBe(450000);
    expect(dashAfterComplete.summary.servicePendingCollection).toBe(0);
    expect(dashAfterComplete.serviceStats.byServiceType.length).toBe(2);

    // 5. Tạo thêm 1 đơn bán hàng có kèm Quà tặng 0đ (isGift = true) & quẹt thẻ (cardFee 1.8%):
    // - Tách rõ Giá vốn hàng bán (salesCogs) và Chi phí giá vốn quà tặng (giftCogs) + Trị giá niêm yết quà tặng (giftRetailValue)
    // - Phí thẻ thu hộ ngân hàng không tính vào netRevenue và không tính vào cashCollected
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('x-user-id', 'admin')
      .send({ code: 'GIFT_TEST', name: 'Danh mục Test Quà tặng' });
    const catId = catRes.body.data._id;

    const mainProdId = (
      await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name: 'Vợt Cầu Lông Chính (VCL01)',
        categoryId: catId,
        unit: 'Cây',
        quantity: 10,
        targetWarehouse: 'FLOOR_1',
        costPrice: 600000,
        sellingPrice: 1000000,
      })
    ).body.data._id;

    const giftProdId = (
      await request(app).post('/api/v1/products').set('x-user-id', 'admin').send({
        name: 'Quấn Cán Tặng Kèm (QC01)',
        categoryId: catId,
        unit: 'Cái',
        quantity: 20,
        targetWarehouse: 'FLOOR_1',
        costPrice: 15000,
        sellingPrice: 30000,
      })
    ).body.data._id;

    const ordGiftRes = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', 'sales1')
      .send({
        customerName: 'Khách Mua Kèm Quà Tặng',
        customerPhone: '0905777888',
        paymentMethod: 'CARD',
        hasCardFee: true,
        cardFeePercent: 1.8,
        items: [
          { productId: mainProdId, quantity: 1 },
          { productId: giftProdId, quantity: 2, isGift: true },
        ],
      });
    expect(ordGiftRes.status).toBe(201);

    const dashWithGift = (await getDash()).body.data;
    expect(dashWithGift.summary.salesCogs).toBe(600000);
    expect(dashWithGift.summary.giftCogs).toBe(30000); // 2 * 15.000đ
    expect(dashWithGift.summary.giftRetailValue).toBe(60000); // 2 * 30.000đ
    expect(dashWithGift.summary.estimatedCogs).toBe(630000); // 600.000 + 30.000
    expect(dashWithGift.summary.netRevenue).toBe(1450000); // 1.000.000 SP + 450.000 DV (không gồm 18.000 phí thẻ)
    expect(dashWithGift.summary.cashCollected).toBe(1450000); // Khớp tuyệt đối với netRevenue khi không nợ (không cộng 18.000 phí thẻ)
    expect(dashWithGift.summary.cardFeeCollected).toBe(18000);
    expect(dashWithGift.summary.grossProfit).toBe(1450000 - 630000);
  });
});
