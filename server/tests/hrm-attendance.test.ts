import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, staffRepo, shiftAssignmentRepo, attendanceRepo, leaveRequestRepo } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

describe('HRM, Attendance, WFH & Shift Handover API Tests (v4.0)', () => {
  const app = createApp();

  let adminToken: string;
  let hrToken: string;
  let accountantToken: string;
  let marketingToken: string;
  let salesToken: string;
  let salesId: string;
  let marketingId: string;

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    // Login Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminRes.body.data.token;

    // Login HR
    const hrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'hr1', password: '123456' });
    hrToken = hrRes.body.data.token;

    // Login Accountant
    const accRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'accountant1', password: '123456' });
    accountantToken = accRes.body.data.token;

    // Login Marketing
    const mktRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'marketing1', password: '123456' });
    marketingToken = mktRes.body.data.token;
    marketingId = mktRes.body.data.user._id;

    // Login Sales
    const salesRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales1', password: '123456' });
    salesToken = salesRes.body.data.token;
    salesId = salesRes.body.data.user._id;
  });

  it('1. Phân quyền vai trò mới: Kế toán vào Dashboard doanh thu & Kho; Marketing bị chặn', async () => {
    // Kế toán truy cập dashboard doanh thu -> Thành công
    const accRev = await request(app)
      .get('/api/v1/reports/revenue-dashboard')
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(accRev.status).toBe(200);

    // Marketing truy cập dashboard doanh thu -> Bị chặn 403
    const mktRev = await request(app)
      .get('/api/v1/reports/revenue-dashboard')
      .set('Authorization', `Bearer ${marketingToken}`);
    expect(mktRev.status).toBe(403);
  });

  it('2. Chấm công theo IP mạng (không cần GPS): chặn khi IP ngoài mạng công ty; thành công khi đúng IP mạng', async () => {
    // IP ngoài mạng công ty (VD: dùng 4G / mạng lạ) -> bị chặn 400 WIFI_IP_NOT_ALLOWED
    const wrongIpRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        clientIp: '203.0.113.99',
        shiftCode: 'SHIFT_1',
      });
    expect(wrongIpRes.status).toBe(400);
    expect(wrongIpRes.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // Không cần truyền tọa độ GPS, chỉ cần IP thuộc mạng công ty (mặc định 127.0.0.1 / 192.168.1.) -> Thành công 201
    const validCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        shiftCode: 'SHIFT_1',
      });
    expect(validCheckIn.status).toBe(201);
    expect(validCheckIn.body.data.attendance.status).toBeDefined();
    expect(validCheckIn.body.data.attendance.checkInType).toBe('STANDARD');
  });

  it('3. Đơn WFH: cả Khối Bán hàng (Sales) và Khối Văn phòng (Office) đều nộp được và khi được HR duyệt thì chấm công mọi nơi', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Sales nộp WFH cho ngày mai -> Thành công (PENDING)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const salesWfh = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        type: 'WFH',
        date: tomorrow,
        reason: 'Trực tư vấn đơn hàng online tại nhà',
      });
    expect(salesWfh.status).toBe(201);
    expect(salesWfh.body.data.status).toBe('PENDING');

    // Marketing (Khối Office) nộp WFH -> Thành công (PENDING)
    const mktWfh = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        type: 'WFH',
        date: today,
        reason: 'Soạn nội dung chiến dịch tại nhà',
      });
    expect(mktWfh.status).toBe(201);
    expect(mktWfh.body.data.status).toBe('PENDING');
    const requestId = mktWfh.body.data._id;

    // HR duyệt đơn WFH
    const reviewRes = await request(app)
      .patch(`/api/v1/leave-requests/${requestId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        status: 'APPROVED',
        reviewNote: 'Đồng ý WFH hôm nay',
      });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status).toBe('APPROVED');

    // Marketing chấm công từ xa không cần GPS/LAN
    const mktCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({
        shiftCode: 'SHIFT_1',
      });
    expect(mktCheckIn.status).toBe(201);
    expect(mktCheckIn.body.data.isWfh).toBe(true);
    expect(mktCheckIn.body.data.attendance.checkInType).toBe('WFH');
  });

  it('4. Khối Sales: Bàn giao Kho Tầng 1 giữa Ca 1 và Ca 2 (random danh mục Vợt + ..., bắt buộc Ca 2 xác nhận trước khi kết ca)', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Kiểm tra API lấy danh mục kiểm hàng ngẫu nhiên theo ngày (luôn có Vợt + 1 nhóm khác)
    const dailyCheckRes = await request(app)
      .get(`/api/v1/shifts/handover/daily-check?date=${today}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(dailyCheckRes.status).toBe(200);
    expect(Array.isArray(dailyCheckRes.body.data.checkedCategories)).toBe(true);
    expect(dailyCheckRes.body.data.checkedCategories.length).toBeGreaterThanOrEqual(1);
    expect(dailyCheckRes.body.data.checkedCategories[0]).toMatch(/vợt/i);

    // Ca 2 (tạo tài khoản sales2 và check-in Ca 2 lúc 12:00 trưa khi Ca 1 vẫn đang làm)
    const sales2Create = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales2',
        password: 'password123',
        fullName: 'Trần Văn Ca Hai',
        role: 'SALES',
        department: 'SALES',
      });
    expect(sales2Create.status).toBe(201);

    const sales2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales2', password: 'password123' });
    const sales2Token = sales2Login.body.data.token;

    // Tạo phiếu PENDING tồn đọng từ 3 ngày trước -> Phải tự động hết hạn (STORE_CLOSED) và KHÔNG chặn checkout
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const staleHandover = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({
        date: threeDaysAgo,
        shiftCode: 'SHIFT_2',
        cashBalance: 9900000,
        discrepancies: [],
        notes: 'Phiếu cũ từ 3 ngày trước quên xác nhận',
      });
    expect(staleHandover.status).toBe(201);

    // Khi chưa có phiếu tối hôm qua, chỉ có phiếu từ 3 ngày trước -> Ca 1 (sales1) KHÔNG bị coi là có pendingIncomingHandover
    const checkStaleOnly = await request(app)
      .get('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(checkStaleOnly.status).toBe(200);
    expect(checkStaleOnly.body.meta.pendingIncomingHandover).toBeNull();

    // Giả lập tối hôm qua Ca 2 (sales2) đã lập phiếu bàn giao kết ca tối để giao cho Ca 1 sáng nay
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const prevNightHandover = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({
        date: yesterdayDate,
        shiftCode: 'SHIFT_2',
        cashBalance: 12000000,
        discrepancies: [],
        notes: 'Bàn giao cuối ca tối hôm qua cho Ca 1 sáng nay',
      });
    expect(prevNightHandover.status).toBe(201);
    expect(prevNightHandover.body.data.status).toBe('PENDING');
    const prevNightHandoverId = prevNightHandover.body.data._id;

    // Sáng nay Ca 1 (sales1) mở màn hình -> Nhận được thông báo popup phiếu bàn giao từ Ca tối hôm qua
    const morningCheckForSales1 = await request(app)
      .get('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(morningCheckForSales1.status).toBe(200);
    expect(morningCheckForSales1.body.meta.pendingIncomingHandover).toBeTruthy();
    expect(morningCheckForSales1.body.meta.pendingIncomingHandover._id).toBe(prevNightHandoverId);

    // Nếu Ca 1 (sales1) chưa xác nhận phiếu của Ca tối hôm qua mà bấm Check-out -> Bị chặn INCOMING_HANDOVER_CONFIRM_REQUIRED
    const sales1CheckoutBeforeConfirmPrevNight = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ forceEarly: true });
    expect(sales1CheckoutBeforeConfirmPrevNight.status).toBe(400);
    expect(sales1CheckoutBeforeConfirmPrevNight.body.code).toBe('INCOMING_HANDOVER_CONFIRM_REQUIRED');

    // Ca 1 (sales1) xác nhận phiếu bàn giao từ Ca tối hôm qua
    const confirmPrevNight = await request(app)
      .post(`/api/v1/shifts/handover/${prevNightHandoverId}/confirm`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ accept: true, note: 'Ca 1 sáng nay đã kiểm đủ tiền và hàng từ ca tối hôm qua' });
    expect(confirmPrevNight.status).toBe(200);
    expect(confirmPrevNight.body.data.status).toBe('ACCEPTED');

    const sales2CheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({ shiftCode: 'SHIFT_2' });
    expect(sales2CheckIn.status).toBe(201);

    // Ca 1 (sales1) thử check-out khi chưa lập phiếu bàn giao của ca mình -> Bị chặn 400 HANDOVER_REQUIRED
    const prematureCheckout = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ forceEarly: false });
    expect(prematureCheckout.status).toBe(400);
    expect(prematureCheckout.body.code).toBe('HANDOVER_REQUIRED');

    // Ca 1 lưu bản nháp kiểm hàng trong ca (status: DRAFT)
    const draftRes = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        date: today,
        shiftCode: 'SHIFT_1',
        cashBalance: 15000000,
        checkedCategories: dailyCheckRes.body.data.checkedCategories,
        totalCheckedProducts: dailyCheckRes.body.data.totalCheckedProducts,
        discrepancies: [],
        isDraft: true,
      });
    expect(draftRes.status).toBe(201);
    expect(draftRes.body.data.status).toBe('DRAFT');
    const draftHandoverId = draftRes.body.data._id;

    // Chặn xác nhận phiếu còn ở trạng thái DRAFT (400 HANDOVER_STILL_DRAFT) để không tự động check-out sớm
    const confirmDraftRes = await request(app)
      .post(`/api/v1/shifts/handover/${draftHandoverId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accept: true, note: 'Thử xác nhận phiếu nháp' });
    expect(confirmDraftRes.status).toBe(400);
    expect(confirmDraftRes.body.code).toBe('HANDOVER_STILL_DRAFT');

    // Ca 1 tạo biên bản bàn giao Kho Tầng 1 chính thức (chuyển sang PENDING)
    const handoverRes = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        date: today,
        shiftCode: 'SHIFT_1',
        cashBalance: 15420000,
        checkedCategories: dailyCheckRes.body.data.checkedCategories,
        totalCheckedProducts: dailyCheckRes.body.data.totalCheckedProducts,
        discrepancies: [{ productCode: 'GASIA221401DO38', expected: 10, actual: 10, note: 'Khớp' }],
        isDraft: false,
      });
    expect(handoverRes.status).toBe(201);
    expect(handoverRes.body.data.status).toBe('PENDING');
    const handoverId = handoverRes.body.data._id;

    // Chặn hạ phiếu PENDING xuống lại DRAFT (400 HANDOVER_ALREADY_SUBMITTED)
    const downgradeToDraftRes = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        date: today,
        shiftCode: 'SHIFT_1',
        cashBalance: 15420000,
        isDraft: true,
      });
    expect(downgradeToDraftRes.status).toBe(400);
    expect(downgradeToDraftRes.body.code).toBe('HANDOVER_ALREADY_SUBMITTED');

    // Ca 1 sau khi lập phiếu kết ca xong thì được phép Check-out ngay
    const checkoutSuccess = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ forceEarly: true, earlyReason: 'Đã lập phiếu bàn giao xong cho ca 2' });
    expect(checkoutSuccess.status).toBe(200);
    expect(checkoutSuccess.body.data.attendance.checkOutTime).toBeDefined();

    // Ca 2 nhận được thông báo phiếu bàn giao đang chờ xác nhận qua GET /shifts/handover
    const listForSales2 = await request(app)
      .get('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${sales2Token}`);
    expect(listForSales2.status).toBe(200);
    expect(Array.isArray(listForSales2.body.data)).toBe(true);
    expect(listForSales2.body.meta.pendingIncomingHandover).toBeTruthy();
    expect(listForSales2.body.meta.pendingIncomingHandover._id).toBe(handoverId);

    // Nếu Ca 2 tắt popup để kiểm hàng sau nhưng bấm Check-out khi CHƯA xác nhận bàn giao của Ca 1 -> Bị chặn 400 INCOMING_HANDOVER_CONFIRM_REQUIRED
    const sales2CheckoutBeforeConfirm = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({ forceEarly: true, earlyReason: 'Thử kết ca khi chưa xác nhận bàn giao Ca 1' });
    expect(sales2CheckoutBeforeConfirm.status).toBe(400);
    expect(sales2CheckoutBeforeConfirm.body.code).toBe('INCOMING_HANDOVER_CONFIRM_REQUIRED');

    // Ca 2 bấm xác nhận thông tin bàn giao Kho Tầng 1 từ Ca 1
    const confirmRes = await request(app)
      .post(`/api/v1/shifts/handover/${handoverId}/confirm`)
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({ accept: true, note: 'Đã kiểm khớp đủ tiền và hàng' });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('ACCEPTED');

    // Cuối ca tối, Ca 2 lập phiếu kết ca tối (PENDING để giao cho Ca 1 sáng mai) và Check-out thành công ngay tối đó
    const sales2Handover = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({
        date: today,
        shiftCode: 'SHIFT_2',
        cashBalance: 22500000,
        discrepancies: [],
        notes: 'Đóng cửa ca tối đủ hàng giao cho Ca 1 sáng mai',
      });
    expect(sales2Handover.status).toBe(201);
    expect(sales2Handover.body.data.status).toBe('PENDING');

    const sales2CheckoutAfterConfirm = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({ forceEarly: true, earlyReason: 'Đã xác nhận bàn giao Ca 1 và lập phiếu kết ca tối' });
    expect(sales2CheckoutAfterConfirm.status).toBe(200);
    expect(sales2CheckoutAfterConfirm.body.data.attendance.checkOutTime).toBeDefined();

    // Kiểm tra phân quyền & giới hạn dữ liệu GET /shifts/handover:
    // 1. Nhân viên MARKETING không được phép xem danh sách phiếu bàn giao ca (403 FORBIDDEN)
    const mktHandoverRes = await request(app)
      .get('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${marketingToken}`);
    expect(mktHandoverRes.status).toBe(403);

    // 2. Nhân viên SALES khác (sales3, làm SHIFT_2) không được xem số tiền bàn giao (cashBalance) của các phiếu giữa sales1 & sales2
    const sales3Create = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales3',
        password: 'password123',
        fullName: 'Lê Thị Ca Khác',
        role: 'SALES',
        department: 'SALES',
      });
    expect(sales3Create.status).toBe(201);
    const sales3Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales3', password: 'password123' });
    const sales3Token = sales3Login.body.data.token;

    const listForSales3 = await request(app)
      .get('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${sales3Token}`);
    expect(listForSales3.status).toBe(200);
    // sales3 chưa tạo hay nhận phiếu nào, và phiếu SHIFT_2 hôm nay là kết ca tối dành cho sáng mai nên sales3 không thấy phiếu nào của sales1/sales2
    expect(listForSales3.body.data.length).toBe(0);
    expect(listForSales3.body.meta.pendingIncomingHandover).toBeNull();

    // 3. Quản lý (ADMIN / HR) xem được toàn bộ danh sách phiếu bàn giao
    const listForAdmin = await request(app)
      .get('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listForAdmin.status).toBe(200);
    expect(listForAdmin.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('5. Cấu hình Ngày lễ: HR thêm ngày lễ, xem danh sách trên Calendar, và xóa ngày lễ', async () => {
    // HR thêm ngày lễ
    const createHol = await request(app)
      .post('/api/v1/holidays')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        date: '2026-04-30',
        name: 'Ngày Giải Phóng Miền Nam',
        note: 'Nghỉ lễ toàn quốc',
      });
    expect(createHol.status).toBe(201);
    const holidayId = createHol.body.data._id;

    // Lấy danh sách ngày lễ
    const listHol = await request(app).get('/api/v1/holidays');
    expect(listHol.status).toBe(200);
    expect(listHol.body.data.some((h: any) => h.name === 'Ngày Giải Phóng Miền Nam')).toBe(true);

    // HR xóa ngày lễ
    const delHol = await request(app)
      .delete(`/api/v1/holidays/${holidayId}`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(delHol.status).toBe(200);
    expect(delHol.body.data.success).toBe(true);
  });

  it('6. Cấu hình IP Wi-Fi qua .env: chặn HR sửa qua API, chặn Admin chấm công, và kiểm tra IP từ .env', async () => {
    const getCfg = await request(app)
      .get('/api/v1/attendance/config')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(getCfg.status).toBe(200);
    expect(getCfg.body.data.config.requireGps).toBe(false);
    expect(getCfg.body.data.config.requireIp).toBe(true);

    // HR hoặc Admin gọi PUT /attendance/config -> bị chặn 403 CONFIG_MANAGED_BY_ENV
    const updateCfg = await request(app)
      .put('/api/v1/attendance/config')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ officeName: 'Hack' });
    expect(updateCfg.status).toBe(403);
    expect(updateCfg.body.code).toBe('CONFIG_MANAGED_BY_ENV');

    // Admin không cần chấm công -> bị chặn 400 ADMIN_NO_ATTENDANCE
    const adminCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(adminCheckIn.status).toBe(400);
    expect(adminCheckIn.body.code).toBe('ADMIN_NO_ATTENDANCE');

    // Thiết lập biến môi trường .env cho IP Wi-Fi
    process.env.ATTENDANCE_REQUIRE_IP = 'true';
    process.env.ATTENDANCE_ALLOWED_IPS = '113.160.22.10,192.168.1.';
    process.env.ATTENDANCE_ALLOWED_IPS_2 = '116.110.151.140,192.168.2.';

    // Accountant check-in sai IP (10.0.0.5) -> bị chặn 400 WIFI_IP_NOT_ALLOWED
    const wrongIpRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        clientIp: '10.0.0.5',
      });
    expect(wrongIpRes.status).toBe(400);
    expect(wrongIpRes.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // Accountant check-in đúng dải IP LAN (192.168.1.55) không cần GPS -> thành công 201
    const rightIpRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        clientIp: '192.168.1.55',
      });
    expect(rightIpRes.status).toBe(201);

    process.env.ATTENDANCE_REQUIRE_IP = 'false';
  });

  it('7. Logic 2 Cơ sở theo IP mạng: Mạng Cơ sở 1 hoặc Mạng Cơ sở 2 đều chấm công hợp lệ (cả Check-in & Check-out)', async () => {
    process.env.ATTENDANCE_REQUIRE_IP = 'true';
    process.env.ATTENDANCE_ALLOWED_IPS = '192.168.1.';
    process.env.ATTENDANCE_OFFICE_2_NAME = 'Showroom 11Sport - Cơ sở 2';
    process.env.ATTENDANCE_ALLOWED_IPS_2 = '192.168.2.';

    // Tạo nhân viên Văn phòng để test Cơ sở 2
    const staffBranch2Create = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'office_branch2',
        password: 'password123',
        fullName: 'Nhân viên Cơ sở 2',
        role: 'MARKETING',
        department: 'OFFICE',
      });
    expect(staffBranch2Create.status).toBe(201);

    const loginB2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'office_branch2', password: 'password123' });
    const branch2Token = loginB2.body.data.token;

    // 7.1 Dùng mạng ngoài cả 2 cơ sở (10.10.10.50) -> BỊ CHẶN 400 WIFI_IP_NOT_ALLOWED
    const outsiderNet = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        clientIp: '10.10.10.50',
      });
    expect(outsiderNet.status).toBe(400);
    expect(outsiderNet.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // 7.2 Dùng đúng Mạng Cơ sở 2 (192.168.2.50) không cần GPS -> CHECK-IN THÀNH CÔNG 201
    const net2CheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        clientIp: '192.168.2.50',
      });
    expect(net2CheckIn.status).toBe(201);

    // 7.3 Khi Check-out: Dùng mạng ngoài công ty (10.10.10.50) -> BỊ CHẶN 400 WIFI_IP_NOT_ALLOWED
    const checkoutWrongIp = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        forceEarly: true,
        earlyReason: 'Test checkout',
        clientIp: '10.10.10.50',
      });
    expect(checkoutWrongIp.status).toBe(400);
    expect(checkoutWrongIp.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // 7.4 Khi Check-out: Dùng đúng Mạng Cơ sở 1 (192.168.1.88) -> CHECK-OUT THÀNH CÔNG 200
    const checkoutMatchBranch1 = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        forceEarly: true,
        earlyReason: 'Test checkout tại Cơ sở 1',
        clientIp: '192.168.1.88',
      });
    expect(checkoutMatchBranch1.status).toBe(200);
    expect(checkoutMatchBranch1.body.data.attendance.checkOutTime).toBeDefined();

    process.env.ATTENDANCE_REQUIRE_IP = 'false';
  });

  it('8. Bảo mật Seed: không tự động tạo tài khoản mẫu đặc quyền (hr, hr1, accountant1) trên môi trường production', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      // Xóa tài khoản mẫu hr1 và accountant1 rồi chạy lại seed ở chế độ production
      const hr1 = await staffRepo.findOne({ username: 'hr1' });
      const acc1 = await staffRepo.findOne({ username: 'accountant1' });
      if (hr1) await staffRepo.deleteById(hr1._id);
      if (acc1) await staffRepo.deleteById(acc1._id);

      process.env.NODE_ENV = 'production';
      await seedDatabaseIfNeeded();

      expect(await staffRepo.findOne({ username: 'hr1' })).toBeNull();
      expect(await staffRepo.findOne({ username: 'accountant1' })).toBeNull();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      await seedDatabaseIfNeeded();
      const hrReLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'hr1', password: '123456' });
      hrToken = hrReLogin.body.data.token;
      const accReLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'accountant1', password: '123456' });
      accountantToken = accReLogin.body.data.token;
    }
  });

  it('9. Bảo mật Mạng IP: client gửi bypassNetwork: true hoặc giả mạo body.clientIp trên production đều không thể bỏ qua kiểm tra IP', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.ATTENDANCE_REQUIRE_IP = 'true';
    process.env.ATTENDANCE_ALLOWED_IPS = '192.168.1.';
    process.env.ATTENDANCE_ALLOWED_IPS_2 = '192.168.2.';

    try {
      const staffNoWfh = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'office_no_wfh_bypass',
          password: 'password123',
          fullName: 'Nhân viên Test Bypass',
          role: 'MARKETING',
          department: 'OFFICE',
        });
      expect(staffNoWfh.status).toBe(201);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'office_no_wfh_bypass', password: 'password123' });
      const token = loginRes.body.data.token;

      // Client cố tình gửi bypassNetwork: true khi IP ngoài cơ sở -> bị chặn 400 WIFI_IP_NOT_ALLOWED
      const fakeBypassCheckIn = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientIp: '10.0.0.1',
          bypassNetwork: true,
        });
      expect(fakeBypassCheckIn.status).toBe(400);
      expect(fakeBypassCheckIn.body.code).toBe('WIFI_IP_NOT_ALLOWED');

      // Trên production: client cố tình giả mạo body.clientIp = 192.168.1.99 khi IP thật từ header là 203.0.113.5 -> bị chặn!
      process.env.NODE_ENV = 'production';
      const spoofedBodyIp = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '203.0.113.5')
        .send({
          clientIp: '192.168.1.99',
        });
      expect(spoofedBodyIp.status).toBe(400);
      expect(spoofedBodyIp.body.code).toBe('WIFI_IP_NOT_ALLOWED');
      process.env.NODE_ENV = prevNodeEnv;

      // Check-in hợp lệ qua IP công ty, sau đó cố gửi bypassNetwork: true khi check-out ở mạng ngoài -> vẫn bị chặn 400
      const validCheckIn = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientIp: '192.168.1.99',
        });
      expect(validCheckIn.status).toBe(201);

      const fakeBypassCheckOut = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${token}`)
        .send({
          forceEarly: true,
          earlyReason: 'Test',
          clientIp: '10.0.0.1',
          bypassNetwork: true,
        });
      expect(fakeBypassCheckOut.status).toBe(400);
      expect(fakeBypassCheckOut.body.code).toBe('WIFI_IP_NOT_ALLOWED');
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      process.env.ATTENDANCE_REQUIRE_IP = 'false';
    }
  });

  it('10. Đối chiếu lịch phân ca khi check-in: chặn ngày OFF, chặn sai ca, và tự động lấy đúng ca HR đã xếp', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Tạo nhân viên Sales mới để kiểm tra đối chiếu lịch phân ca
    const salesCreate = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales_shift_check',
        password: 'password123',
        fullName: 'Sales Kiểm Tra Ca',
        role: 'SALES',
        department: 'SALES',
      });
    expect(salesCreate.status).toBe(201);
    const staffId = salesCreate.body.data._id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales_shift_check', password: 'password123' });
    const token = loginRes.body.data.token;

    // 10.1 HR xếp lịch OFF cho hôm nay -> Check-in bị chặn 400 SCHEDULED_DAY_OFF
    const assignRecord = await shiftAssignmentRepo.create({
      weekStart: today,
      date: today,
      dayOfWeek: 1,
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Sales Kiểm Tra Ca',
      shiftCode: 'OFF',
      assignedBy: 'HR',
    });

    const offCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
      });
    expect(offCheckIn.status).toBe(400);
    expect(offCheckIn.body.code).toBe('SCHEDULED_DAY_OFF');

    // 10.2 HR đổi phân ca sang SHIFT_2 -> Cố gửi shiftCode: SHIFT_1 bị chặn 400 SHIFT_MISMATCH
    await shiftAssignmentRepo.updateById(assignRecord._id, { shiftCode: 'SHIFT_2' });

    const mismatchCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
        shiftCode: 'SHIFT_1',
      });
    expect(mismatchCheckIn.status).toBe(400);
    expect(mismatchCheckIn.body.code).toBe('SHIFT_MISMATCH');

    // 10.3 Check-in không truyền shiftCode -> tự động áp dụng SHIFT_2 theo lịch phân ca của HR
    const validShiftCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
      });
    expect(validShiftCheckIn.status).toBe(201);
    expect(validShiftCheckIn.body.data.attendance.shiftCode).toBe('SHIFT_2');
  });

  it('11. Áp dụng ca BOTH (08:30 - 21:00) vào check-in, check-out và bảng công tháng', async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const salesCreate = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales_both_shift',
        password: 'password123',
        fullName: 'Sales Ca Kép BOTH',
        role: 'SALES',
        department: 'SALES',
      });
    expect(salesCreate.status).toBe(201);
    const staffId = salesCreate.body.data._id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales_both_shift', password: 'password123' });
    const token = loginRes.body.data.token;

    // 11.1 Phân ca BOTH cho hôm nay
    await shiftAssignmentRepo.create({
      weekStart: today,
      date: today,
      dayOfWeek: 1,
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Sales Ca Kép BOTH',
      shiftCode: 'BOTH',
      assignedBy: 'HR',
    });

    // 11.2 Nếu cố tình truyền shiftCode = SHIFT_1 hoặc SHIFT_2 sẽ bị chặn SHIFT_MISMATCH
    const mismatch1 = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
        shiftCode: 'SHIFT_1',
      });
    expect(mismatch1.status).toBe(400);
    expect(mismatch1.body.code).toBe('SHIFT_MISMATCH');

    // 11.3 Check-in hợp lệ -> nhận đúng shiftCode = 'BOTH'
    const okIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
      });
    expect(okIn.status).toBe(201);
    expect(okIn.body.data.attendance.shiftCode).toBe('BOTH');
    const attId = okIn.body.data.attendance._id;

    // 11.4 HR điều chỉnh ra ca lúc 17:30 trên ca BOTH (08:30-21:00) -> bị tính về sớm 210 phút (21:00 - 17:30), không tính tăng ca
    const patch1730 = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        shiftCode: 'BOTH',
        checkIn: '08:30',
        checkOut: '17:30',
        reason: 'Kiểm tra ra ca lúc 17:30 khi làm 2 ca BOTH',
      });
    expect(patch1730.status).toBe(200);
    expect(patch1730.body.data.shiftCode).toBe('BOTH');
    expect(patch1730.body.data.earlyMinutes).toBe(210);
    expect(patch1730.body.data.status).toBe('EARLY_LEAVE');

    // 11.5 HR điều chỉnh ra ca lúc 21:35 trên ca BOTH (08:30-21:00) -> đủ giờ (earlyMinutes = 0, COMPLETED, 13.08h) nhưng làm 2 ca theo bảng xếp ca KHÔNG tính là tăng ca (overtimeMinutes = 0)
    const patch2135 = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        shiftCode: 'BOTH',
        checkIn: '08:30',
        checkOut: '21:35',
        overtimeStatus: 'APPROVED',
        overtimeApprovedMinutes: 35,
        reason: 'Hoàn thành cả 2 ca theo bảng xếp ca',
      });
    expect(patch2135.status).toBe(200);
    expect(patch2135.body.data.earlyMinutes).toBe(0);
    expect(patch2135.body.data.status).toBe('COMPLETED');
    expect(patch2135.body.data.totalWorkHours).toBe(13.08);
    expect(patch2135.body.data.overtimeStatus).toBe('NONE');
    expect(patch2135.body.data.overtimeApprovedMinutes).toBe(0);

    const calRes = await request(app)
      .get(`/api/v1/attendance/my-calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(calRes.status).toBe(200);
    const cellToday = calRes.body.data.row.cells[today];
    expect(cellToday.shiftCode).toBe('BOTH');
    expect(cellToday.overtimeMinutes).toBe(0);
  });

  it('12. Quy tắc tăng ca: Sales (1 ca) trễ > 5p phải ghi lý do & chờ HR duyệt; Văn phòng chỉ tính tăng ca khi được HR yêu cầu', async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // 12.1 Tạo nhân viên Sales 1 ca (SHIFT_1) và nhân viên Văn phòng (OFFICE)
    const sales1Res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales_late_checkout',
        password: 'password123',
        fullName: 'Sales 1 Ca Check-out Trễ',
        role: 'SALES',
        department: 'SALES',
      });
    expect(sales1Res.status).toBe(201);
    const sales1Id = sales1Res.body.data._id;

    const officeRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'office_overtime_hr',
        password: 'password123',
        fullName: 'Văn Phòng Tăng Ca Theo Yêu Cầu HR',
        role: 'ACCOUNTANT',
        department: 'OFFICE',
      });
    expect(officeRes.status).toBe(201);
    const officeId = officeRes.body.data._id;

    // 12.2 Chấm công thủ công cho Sales (Ca 1: 08:30 - 18:15, trễ 45p) nhưng HR chưa duyệt tăng ca -> overtimeMinutes = 0
    const manualSales = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        staffId: sales1Id,
        date: today,
        shiftCode: 'SHIFT_1',
        checkIn: '08:30',
        checkOut: '18:15',
        reason: 'Nhân viên ở lại hỗ trợ khách thử vợt đến 18:15',
      });
    expect(manualSales.status).toBe(201);
    const salesAttId = manualSales.body.data._id;

    // Giả lập nhân viên đã gửi lý do check-out trễ > 5p (45p, PENDING)
    await attendanceRepo.updateById(salesAttId, {
      lateCheckoutMinutes: 45,
      lateCheckoutReason: 'Khách thử giày và đan vợt lấy gấp lúc 17:30',
      overtimeStatus: 'PENDING',
      overtimeApprovedMinutes: 0,
    });

    const tsBeforeApprove = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(tsBeforeApprove.status).toBe(200);
    const salesRowBefore = tsBeforeApprove.body.data.rows.find((r: any) => r.staffId === String(sales1Id));
    expect(salesRowBefore.cells[today].overtimeStatus).toBe('PENDING');
    expect(salesRowBefore.cells[today].lateCheckoutMinutes).toBe(45);
    expect(salesRowBefore.cells[today].lateCheckoutReason).toContain('Khách thử giày');
    expect(salesRowBefore.cells[today].overtimeMinutes).toBe(0); // Chưa duyệt -> chưa tính tăng ca

    // 12.3 HR xem xét lý do và duyệt quy 45 phút check-out trễ thành tăng ca
    const approveSales = await request(app)
      .patch(`/api/v1/attendance/${salesAttId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        overtimeStatus: 'APPROVED',
        overtimeApprovedMinutes: 45,
        reason: 'HR xác nhận có khách đan vợt trễ, duyệt 45p tăng ca',
      });
    expect(approveSales.status).toBe(200);
    expect(approveSales.body.data.overtimeStatus).toBe('APPROVED');
    expect(approveSales.body.data.overtimeApprovedMinutes).toBe(45);

    const tsAfterApprove = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${hrToken}`);
    const salesRowAfter = tsAfterApprove.body.data.rows.find((r: any) => r.staffId === String(sales1Id));
    expect(salesRowAfter.cells[today].overtimeStatus).toBe('APPROVED');
    expect(salesRowAfter.cells[today].overtimeMinutes).toBe(45);

    // 12.4 Nhân viên Văn phòng ra ca lúc 19:00 (sau 17:30 là 90p) nhưng KHÔNG được HR yêu cầu -> overtimeMinutes = 0
    const manualOffice = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        staffId: officeId,
        date: today,
        checkIn: '08:30',
        checkOut: '19:00',
        overtimeStatus: 'NONE',
        reason: 'Nhân viên tự ở lại văn phòng, HR không yêu cầu tăng ca',
      });
    expect(manualOffice.status).toBe(201);
    const officeAttId = manualOffice.body.data._id;

    const tsOfficeNone = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${hrToken}`);
    const officeRowNone = tsOfficeNone.body.data.rows.find((r: any) => r.staffId === String(officeId));
    expect(officeRowNone.cells[today].overtimeMinutes).toBe(0);

    // 12.5 HR yêu cầu tăng ca cho nhân viên Văn phòng (overtimeStatus = APPROVED, 90 phút) -> overtimeMinutes = 90
    const approveOffice = await request(app)
      .patch(`/api/v1/attendance/${officeAttId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        overtimeStatus: 'APPROVED',
        overtimeApprovedMinutes: 90,
        reason: 'HR yêu cầu tăng ca chốt sổ kế toán cuối tháng 90p',
      });
    expect(approveOffice.status).toBe(200);

    const tsOfficeApproved = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${hrToken}`);
    const officeRowApproved = tsOfficeApproved.body.data.rows.find((r: any) => r.staffId === String(officeId));
    expect(officeRowApproved.cells[today].overtimeStatus).toBe('APPROVED');
    expect(officeRowApproved.cells[today].overtimeMinutes).toBe(90);
  });

  it('13. Lương cơ bản, trợ cấp, thưởng, bảo hiểm: chỉ HR được sửa, nhân viên được xem; hỗ trợ filter & sort danh sách nhân viên', async () => {
    // 13.1 HR tạo nhân viên mới kèm lương cơ bản, trợ cấp, thưởng, bảo hiểm
    const createdByHr = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        username: 'sales_salary_test',
        password: 'password123',
        fullName: 'Nhân Viên Lương Test',
        role: 'SALES',
        department: 'SALES',
        contractType: 'FULLTIME',
        baseSalary: 8500000,
        allowance: 1200000,
        bonus: 500000,
        insurance: 850000,
      });
    expect(createdByHr.status).toBe(201);
    expect(createdByHr.body.data.baseSalary).toBe(8500000);
    expect(createdByHr.body.data.allowance).toBe(1200000);
    expect(createdByHr.body.data.bonus).toBe(500000);
    expect(createdByHr.body.data.insurance).toBe(850000);
    const staffId = createdByHr.body.data._id;

    // 13.2 HR chỉnh sửa lương cơ bản, trợ cấp, thưởng, bảo hiểm -> Thành công (200)
    const hrUpdate = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        baseSalary: 9500000,
        allowance: 1500000,
        bonus: 800000,
        insurance: 950000,
      });
    expect(hrUpdate.status).toBe(200);
    expect(hrUpdate.body.data.baseSalary).toBe(9500000);
    expect(hrUpdate.body.data.allowance).toBe(1500000);
    expect(hrUpdate.body.data.bonus).toBe(800000);
    expect(hrUpdate.body.data.insurance).toBe(950000);

    // 13.3 Nhân viên tự đăng nhập: được xem thông tin lương của chính mình, nhưng bị chặn 403 nếu cố tự sửa lương
    const empLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales_salary_test', password: 'password123' });
    expect(empLogin.status).toBe(200);
    expect(empLogin.body.data.user.baseSalary).toBe(9500000);
    expect(empLogin.body.data.user.allowance).toBe(1500000);
    expect(empLogin.body.data.user.bonus).toBe(800000);
    expect(empLogin.body.data.user.insurance).toBe(950000);
    const empToken = empLogin.body.data.token;

    const empSelfEditSalary = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ baseSalary: 50000000 });
    expect(empSelfEditSalary.status).toBe(403);

    // Admin cũng không được sửa lương (chỉ HR được sửa)
    const adminEditSalary = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bonus: 2000000 });
    expect(adminEditSalary.status).toBe(403);

    // 13.4 Nhân viên gọi GET /api/v1/staff vẫn xem được lương của mình
    const empViewList = await request(app)
      .get('/api/v1/staff')
      .set('Authorization', `Bearer ${empToken}`);
    expect(empViewList.status).toBe(200);
    const selfRecord = empViewList.body.data.find((s: any) => s._id === staffId);
    expect(selfRecord.baseSalary).toBe(9500000);

    // 13.5 Filter & Sort trên GET /api/v1/staff
    const sortedRes = await request(app)
      .get('/api/v1/staff?department=SALES&contractType=FULLTIME&sortBy=baseSalary&sortOrder=desc')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(sortedRes.status).toBe(200);
    expect(sortedRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(sortedRes.body.data[0]._id).toBe(staffId);
  });

  it('14. Xin chuyển ngày off (CHANGE_OFF): đổi ngày off từ 20/11 sang 19/11 cần HR duyệt và tự động đồng bộ lịch nghỉ/phân ca', async () => {
    const salesCreate = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales_change_off',
        password: 'password123',
        fullName: 'Nhân Viên Đổi Ngày Off',
        role: 'SALES',
        department: 'SALES',
        contractType: 'FULLTIME',
        contractStartDate: '2026-01-01',
      });
    expect(salesCreate.status).toBe(201);
    const staffId = salesCreate.body.data._id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales_change_off', password: 'password123' });
    const empToken = loginRes.body.data.token;

    // 14.1 Nhân viên xin OFF vào ngày 2026-11-20 và được HR duyệt
    const createOff20 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        type: 'OFF',
        date: '2026-11-20',
        reason: 'Xin off ngày 20/11 việc cá nhân',
      });
    expect(createOff20.status).toBe(201);
    const off20Id = createOff20.body.data._id;

    const approveOff20 = await request(app)
      .patch(`/api/v1/leave-requests/${off20Id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'APPROVED', reviewNote: 'Đồng ý cho nghỉ 20/11' });
    expect(approveOff20.status).toBe(200);

    // Giả lập lịch phân ca tuần: ngày 19/11 làm SHIFT_2, ngày 20/11 nghỉ OFF
    await shiftAssignmentRepo.create({
      weekStart: '2026-11-16',
      date: '2026-11-19',
      dayOfWeek: 4,
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Nhân Viên Đổi Ngày Off',
      shiftCode: 'SHIFT_2',
      preferenceShift: 'SHIFT_2',
      isOffRequested: false,
      assignedBy: 'HR',
    });
    await shiftAssignmentRepo.create({
      weekStart: '2026-11-16',
      date: '2026-11-20',
      dayOfWeek: 5,
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Nhân Viên Đổi Ngày Off',
      shiftCode: 'OFF',
      preferenceShift: 'OFF',
      isOffRequested: true,
      assignedBy: 'HR',
    });

    // 14.2 Nếu xin đổi từ một ngày không phải ngày off (VD: 2026-11-18) -> bị chặn 400 SOURCE_OFF_NOT_FOUND
    const invalidChange = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        type: 'CHANGE_OFF',
        fromDate: '2026-11-18',
        date: '2026-11-19',
        reason: 'Đổi nhầm ngày chưa xin off',
      });
    expect(invalidChange.status).toBe(400);
    expect(invalidChange.body.code).toBe('SOURCE_OFF_NOT_FOUND');

    // 14.3 Nhân viên có chuyện đột xuất, xin chuyển ngày off từ 2026-11-20 sang 2026-11-19 -> PENDING
    const reqChange1 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        type: 'CHANGE_OFF',
        fromDate: '2026-11-20',
        date: '2026-11-19',
        sourceLeaveId: off20Id,
        reason: 'Có việc đột xuất gia đình ngày 19/11',
      });
    expect(reqChange1.status).toBe(201);
    expect(reqChange1.body.data.type).toBe('CHANGE_OFF');
    expect(reqChange1.body.data.fromDate).toBe('2026-11-20');
    expect(reqChange1.body.data.date).toBe('2026-11-19');
    expect(reqChange1.body.data.status).toBe('PENDING');
    const changeReq1Id = reqChange1.body.data._id;

    // Khi HR chưa duyệt (hoặc từ chối), ngày 20/11 vẫn là ngày nghỉ, ngày 19/11 vẫn đi làm
    const rejectChange1 = await request(app)
      .patch(`/api/v1/leave-requests/${changeReq1Id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'REJECTED', reviewNote: 'Chưa bố trí được người thay ngày 19/11' });
    expect(rejectChange1.status).toBe(200);

    const calAfterReject = await request(app)
      .get('/api/v1/attendance/my-calendar?month=11&year=2026')
      .set('Authorization', `Bearer ${empToken}`);
    expect(calAfterReject.body.data.row.cells['2026-11-20'].code).toBe('LEAVE');
    expect(calAfterReject.body.data.row.cells['2026-11-19'].code).not.toBe('LEAVE');

    // 14.4 Nhân viên gửi lại đơn xin chuyển ngày off từ 2026-11-20 sang 2026-11-19 và được HR DUYỆT (APPROVED)
    const reqChange2 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        type: 'CHANGE_OFF',
        fromDate: '2026-11-20',
        date: '2026-11-19',
        sourceLeaveId: off20Id,
        reason: 'Đã nhờ đồng nghiệp trực thay ngày 19/11, xin đổi off 20/11 sang 19/11',
      });
    expect(reqChange2.status).toBe(201);
    const changeReq2Id = reqChange2.body.data._id;

    const approveChange2 = await request(app)
      .patch(`/api/v1/leave-requests/${changeReq2Id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'APPROVED', reviewNote: 'HR duyệt đổi ngày off sang 19/11' });
    expect(approveChange2.status).toBe(200);
    expect(approveChange2.body.data.status).toBe('APPROVED');

    // Kiểm tra đơn nghỉ gốc đã được chuyển sang ngày 2026-11-19 (APPROVED)
    const updatedOriginalLeave: any = await leaveRequestRepo.findById(off20Id);
    expect(updatedOriginalLeave.date).toBe('2026-11-19');
    expect(updatedOriginalLeave.status).toBe('APPROVED');

    // Kiểm tra lịch phân ca đã tự động hoán đổi: 19/11 là OFF, 20/11 là SHIFT_2
    const shift19: any = await shiftAssignmentRepo.findOne({ staffId: String(staffId), date: '2026-11-19' });
    const shift20: any = await shiftAssignmentRepo.findOne({ staffId: String(staffId), date: '2026-11-20' });
    expect(shift19.shiftCode).toBe('OFF');
    expect(shift20.shiftCode).toBe('SHIFT_2');

    // Kiểm tra trên Lịch công cá nhân: ngày 19/11 là LEAVE, ngày 20/11 không còn là LEAVE/DAY_OFF
    const calAfterApprove = await request(app)
      .get('/api/v1/attendance/my-calendar?month=11&year=2026')
      .set('Authorization', `Bearer ${empToken}`);
    expect(calAfterApprove.body.data.row.cells['2026-11-19'].code).toBe('LEAVE');
    expect(calAfterApprove.body.data.row.cells['2026-11-20'].code).not.toBe('LEAVE');
    expect(calAfterApprove.body.data.row.cells['2026-11-20'].code).not.toBe('DAY_OFF');
    expect(calAfterApprove.body.data.row.cells['2026-11-20'].shiftCode).toBe('SHIFT_2');

    // 14.5 Nếu trong lúc đơn CHANGE_OFF đang chờ HR duyệt mà ngày đích phát sinh đơn nghỉ khác -> chặn 400 TARGET_DATE_ALREADY_OFF khi duyệt
    const reqChangeConflict = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        type: 'CHANGE_OFF',
        fromDate: '2026-11-19',
        date: '2026-11-21',
        sourceLeaveId: off20Id,
        reason: 'Xin đổi tiếp từ 19/11 sang 21/11',
      });
    expect(reqChangeConflict.status).toBe(201);
    const conflictChangeId = reqChangeConflict.body.data._id;

    // Giả lập phát sinh đơn nghỉ phép năm (PAID_LEAVE) ở ngày đích 2026-11-21 trước khi HR duyệt đơn CHANGE_OFF
    const otherLeaveOnTarget = await leaveRequestRepo.create({
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Nhân Viên Đổi Ngày Off',
      department: 'SALES',
      type: 'PAID_LEAVE',
      date: '2026-11-21',
      reason: 'Nghỉ phép năm ngày 21/11',
      status: 'APPROVED',
    });

    const approveConflictRes = await request(app)
      .patch(`/api/v1/leave-requests/${conflictChangeId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'APPROVED', reviewNote: 'Thử duyệt khi ngày đích đã có đơn nghỉ khác' });
    expect(approveConflictRes.status).toBe(400);
    expect(approveConflictRes.body.code).toBe('TARGET_DATE_ALREADY_OFF');

    // Đảm bảo đơn gốc vẫn giữ nguyên ở ngày 2026-11-19, không bị chuyển đè sang 2026-11-21
    const stillAt19: any = await leaveRequestRepo.findById(off20Id);
    expect(stillAt19.date).toBe('2026-11-19');
    await leaveRequestRepo.deleteById(String((otherLeaveOnTarget as any)._id));
    await leaveRequestRepo.deleteById(String(conflictChangeId));

    // 14.6 Áp dụng quy tắc báo trước 21 ngày khi chuyển ngày nghỉ sang tuần đã có 2 ngày nghỉ (hoặc 1 ngày phép)
    // Giả sử tuần 23/11 - 29/11 (cách hôm nay 12/11 < 21 ngày) đã có 2 ngày nghỉ (23/11 OFF và 24/11 PAID_LEAVE)
    const w2Off = await leaveRequestRepo.create({
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Nhân Viên Đổi Ngày Off',
      department: 'SALES',
      type: 'OFF',
      date: '2026-11-23',
      reason: 'Nghỉ tuần sau 1',
      status: 'APPROVED',
    });
    const w2Paid = await leaveRequestRepo.create({
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Nhân Viên Đổi Ngày Off',
      department: 'SALES',
      type: 'PAID_LEAVE',
      date: '2026-11-24',
      reason: 'Nghỉ phép tuần sau 2',
      status: 'APPROVED',
    });

    // Chuyển OFF từ 2026-11-19 sang 2026-11-25 (làm tuần 23/11-29/11 thành 3 ngày nghỉ mà báo trước < 21 ngày) -> chặn 400 ADVANCE_NOTICE_REQUIRED khi tạo
    const changeToFullWeek = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        type: 'CHANGE_OFF',
        fromDate: '2026-11-19',
        date: '2026-11-25',
        sourceLeaveId: off20Id,
        reason: 'Xin dồn ngày off sang tuần sau (thành 3 ngày nghỉ/tuần)',
      });
    expect(changeToFullWeek.status).toBe(400);
    expect(changeToFullWeek.body.code).toBe('ADVANCE_NOTICE_REQUIRED');

    // Tạm xóa đơn ngày 24/11 để tạo đơn CHANGE_OFF sang 25/11 hợp lệ (tuần đích lúc tạo chỉ có 2 ngày nghỉ),
    // sau đó phát sinh lại đơn ngày 24/11 trước khi HR duyệt -> HR duyệt sẽ bị chặn 400 ADVANCE_NOTICE_REQUIRED
    await leaveRequestRepo.deleteById(String((w2Paid as any)._id));
    const pendingChangeToW2 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({
        type: 'CHANGE_OFF',
        fromDate: '2026-11-19',
        date: '2026-11-25',
        sourceLeaveId: off20Id,
        reason: 'Xin đổi ngày off sang 25/11 khi tuần đó mới có 1 ngày nghỉ',
      });
    expect(pendingChangeToW2.status).toBe(201);

    const w2PaidAgain = await leaveRequestRepo.create({
      staffId: String(staffId),
      staffCode: salesCreate.body.data.code,
      staffName: 'Nhân Viên Đổi Ngày Off',
      department: 'SALES',
      type: 'PAID_LEAVE',
      date: '2026-11-24',
      reason: 'Phát sinh thêm ngày phép 24/11 trong tuần đích',
      status: 'APPROVED',
    });

    const approveExceedWeekRes = await request(app)
      .patch(`/api/v1/leave-requests/${pendingChangeToW2.body.data._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'APPROVED', reviewNote: 'Duyệt khi tuần đích đã lên 3 ngày nghỉ' });
    expect(approveExceedWeekRes.status).toBe(400);
    expect(approveExceedWeekRes.body.code).toBe('ADVANCE_NOTICE_REQUIRED');

    await leaveRequestRepo.deleteById(String((w2Off as any)._id));
    await leaveRequestRepo.deleteById(String((w2PaidAgain as any)._id));
    await leaveRequestRepo.deleteById(String(pendingChangeToW2.body.data._id));
  });

  it('15. Kiểm hàng tổng số lượng (DRAFT -> PENDING), lịch cố định theo Thứ và giữ đúng giờ bấm gửi cho Ca 1 khi Ca 2 xác nhận trễ', async () => {
    // 1. Quản lý (HR/Admin) cấu hình lịch kiểm hàng cố định theo Thứ trong tuần
    const putScheduleRes = await request(app)
      .put('/api/v1/shifts/handover/schedule-config')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weeklySchedule: {
          '1': ['Giày'],
          '2': ['Áo'],
          '3': ['Quần'],
          '4': ['Balo'],
          '5': ['Phụ kiện'],
          '6': ['Giày'],
          '0': ['Bóng'],
        },
      });
    expect(putScheduleRes.status).toBe(200);
    expect(putScheduleRes.body.data.weeklySchedule['5']).toEqual(['Phụ kiện']);

    // 2. Lấy daily-check phải trả về categorySummaries tổng số lượng tồn Tầng 1 theo từng danh mục
    const today = new Date().toISOString().slice(0, 10);
    const dailyCheck = await request(app)
      .get(`/api/v1/shifts/handover/daily-check?date=${today}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(dailyCheck.status).toBe(200);
    expect(Array.isArray(dailyCheck.body.data.categorySummaries)).toBe(true);
    expect(dailyCheck.body.data.categorySummaries.length).toBeGreaterThanOrEqual(1);
    expect(typeof dailyCheck.body.data.totalExpectedQty).toBe('number');

    // 3. Tạo 2 nhân viên Ca 1 và Ca 2 cho luồng kiểm hàng nháp -> chốt gửi -> xác nhận trễ
    const s1Create = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales_shift1_draft',
        password: 'password123',
        fullName: 'Nhân Viên Ca 1 Kiểm Nháp',
        role: 'SALES',
        department: 'SALES',
      });
    expect(s1Create.status).toBe(201);
    const s1Id = s1Create.body.data._id;

    const s2Create = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'sales_shift2_confirm',
        password: 'password123',
        fullName: 'Nhân Viên Ca 2 Xác Nhận Trễ',
        role: 'SALES',
        department: 'SALES',
      });
    expect(s2Create.status).toBe(201);

    const s1Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales_shift1_draft', password: 'password123' });
    const s1Token = s1Login.body.data.token;

    const s2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'sales_shift2_confirm', password: 'password123' });
    const s2Token = s2Login.body.data.token;

    // Cả 2 cùng check-in
    await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${s1Token}`)
      .send({ shiftCode: 'SHIFT_1' });
    await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${s2Token}`)
      .send({ shiftCode: 'SHIFT_2' });

    // 4. Trong ca làm việc, Ca 1 bấm lưu Bản nháp kiểm hàng (isDraft: true)
    const draftRes = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${s1Token}`)
      .send({
        date: today,
        shiftCode: 'SHIFT_1',
        cashBalance: 5000000,
        isDraft: true,
        categoryCounts: dailyCheck.body.data.categorySummaries.map((c: any) => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          expectedTotalQty: c.expectedTotalQty,
          actualTotalQty: c.expectedTotalQty,
        })),
        notes: 'Đang đếm dở trong ca',
      });
    expect(draftRes.status).toBe(201);
    expect(draftRes.body.data.status).toBe('DRAFT');

    // Khi mới lưu DRAFT thì Ca 1 chưa được tính là đã gửi bàn giao, bấm check-out sẽ báo HANDOVER_REQUIRED
    const checkoutWhileDraft = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${s1Token}`)
      .send({ forceEarly: true, earlyReason: 'Test' });
    expect(checkoutWhileDraft.status).toBe(400);
    expect(checkoutWhileDraft.body.code).toBe('HANDOVER_REQUIRED');

    // 5. Đến giờ tan ca (ví dụ 17:30), Ca 1 bấm xác nhận gửi bàn giao ca cho Ca 2 (isDraft: false)
    const submitRes = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${s1Token}`)
      .send({
        date: today,
        shiftCode: 'SHIFT_1',
        cashBalance: 5500000,
        isDraft: false,
        categoryCounts: dailyCheck.body.data.categorySummaries.map((c: any) => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          expectedTotalQty: c.expectedTotalQty,
          actualTotalQty: c.expectedTotalQty,
        })),
        notes: 'Chốt đủ số lượng tổng giao Ca 2',
      });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.data.status).toBe('PENDING');
    expect(submitRes.body.data.submittedAt).toBeDefined();
    const handoverId = submitRes.body.data._id;

    // Giả lập mốc thời gian Ca 1 bấm xác nhận gửi bàn giao là đúng 17:30 hôm nay
    const [y, m, d] = today.split('-').map(Number);
    const exact1730 = new Date(y, m - 1, d, 17, 30, 0, 0);
    const s1AttBefore = await attendanceRepo.findOne({ staffId: String(s1Id), date: today });
    expect(s1AttBefore).toBeTruthy();
    await attendanceRepo.updateById(String((s1AttBefore as any)._id), {
      workStartTime: new Date(y, m - 1, d, 8, 30, 0, 0),
      pendingCheckOutTime: exact1730,
    });

    // Khi Ca 2 chưa xác nhận và Web gọi check-out với requireConfirmation: true -> Ca 1 ở trạng thái chờ xác nhận, chưa ghi checkOutTime nhưng đã khóa pendingCheckOutTime = 17:30
    const waitConfirmRes = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${s1Token}`)
      .send({ requireConfirmation: true });
    expect(waitConfirmRes.status).toBe(200);
    expect(waitConfirmRes.body.data.waitingConfirmation).toBe(true);
    expect(waitConfirmRes.body.data.attendance.checkOutTime).toBeUndefined();

    // 6. Giả sử 15 phút sau (17:45) Ca 2 mới đếm lại xong và bấm Xác nhận nhận ca
    const s2ConfirmRes = await request(app)
      .post(`/api/v1/shifts/handover/${handoverId}/confirm`)
      .set('Authorization', `Bearer ${s2Token}`)
      .send({ accept: true, note: 'Ca 2 đếm lại lúc 17h45 khớp đủ' });
    expect(s2ConfirmRes.status).toBe(200);
    expect(s2ConfirmRes.body.data.status).toBe('ACCEPTED');

    // Kiểm tra bản ghi chấm công của Ca 1: đã tự động hoàn tất Check-out VÀ giờ checkOutTime vẫn tính đúng lúc 17:30 (9h công, 0 phút trễ)
    const s1AttAfter = await attendanceRepo.findOne({ staffId: String(s1Id), date: today });
    expect(s1AttAfter).toBeTruthy();
    expect(new Date((s1AttAfter as any).checkOutTime).getTime()).toBe(exact1730.getTime());
    expect((s1AttAfter as any).totalWorkHours).toBe(9);
    expect((s1AttAfter as any).lateCheckoutMinutes || 0).toBe(0);
  });

  it('21. Phân quyền CEO toàn quyền, tách biệt Kế toán (ACCOUNTANT) khỏi quyền HR, và Lịch chấm công cá nhân cho HR & Kế toán', async () => {
    // 1. Đăng nhập tài khoản CEO (được seed mặc định)
    const ceoLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ceo', password: '123456' });
    expect(ceoLogin.status).toBe(200);
    expect(ceoLogin.body.data.user.role).toBe('CEO');
    const ceoToken = ceoLogin.body.data.token;

    // CEO không cần chấm công cá nhân (giống ADMIN)
    const ceoCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({});
    expect(ceoCheckIn.status).toBe(400);
    expect(ceoCheckIn.body.code).toBe('ADMIN_NO_ATTENDANCE');

    // CEO có toàn quyền tạo tài khoản nhân sự kèm mức lương & phụ cấp, kể cả role ADMIN
    const ceoCreateStaff = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({
        username: 'hr_sub_by_ceo',
        password: 'password123',
        fullName: 'Nhân Sự Do CEO Tạo',
        role: 'HR',
        department: 'OFFICE',
        contractType: 'FULLTIME',
        baseSalary: 15000000,
        allowance: 2000000,
        bonus: 1000000,
        insurance: 1500000,
      });
    expect(ceoCreateStaff.status).toBe(201);
    expect(ceoCreateStaff.body.data.baseSalary).toBe(15000000);
    const createdStaffId = ceoCreateStaff.body.data._id;

    // CEO có toàn quyền chỉnh sửa lương, hồ sơ VÀ khóa/mở khóa tài khoản
    const ceoPatchStaff = await request(app)
      .patch(`/api/v1/staff/${createdStaffId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({
        baseSalary: 18000000,
        status: 'LOCKED',
      });
    expect(ceoPatchStaff.status).toBe(200);
    expect(ceoPatchStaff.body.data.baseSalary).toBe(18000000);
    expect(ceoPatchStaff.body.data.status).toBe('LOCKED');

    // CEO xem được toàn bộ bảng công công ty, lịch ca, báo cáo hoạt động nhân viên & SP cần đẩy mạnh
    const now = new Date();
    const ceoTimesheet = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(ceoTimesheet.status).toBe(200);
    // CEO và ADMIN không nằm trong danh sách chấm công nhân viên
    expect(
      ceoTimesheet.body.data.rows.some((r: any) => r.staffName?.includes('Giám Đốc') || r.role === 'CEO')
    ).toBe(false);

    const ceoActivity = await request(app)
      .get('/api/v1/reports/staff-activity')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(ceoActivity.status).toBe(200);

    const ceoPush = await request(app)
      .get('/api/v1/reports/push-products')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(ceoPush.status).toBe(200);

    // 2. Kế toán (ACCOUNTANT) và HR đều xem được Lịch chấm công cá nhân (/attendance/my-calendar) và Đơn từ của chính mình (/leave-requests?mine=true)
    const accMyCal = await request(app)
      .get(`/api/v1/attendance/my-calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(accMyCal.status).toBe(200);
    expect(accMyCal.body.data.row).toBeTruthy();

    const hrMyCal = await request(app)
      .get(`/api/v1/attendance/my-calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(hrMyCal.status).toBe(200);
    expect(hrMyCal.body.data.row).toBeTruthy();

    // HR gửi 1 đơn từ cá nhân -> gọi /leave-requests?mine=true chỉ trả về đơn của chính HR
    const hrLeaveCreate = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        type: 'LATE',
        date: '2026-11-20',
        reason: 'HR xin đi muộn 30p việc cá nhân',
      });
    expect(hrLeaveCreate.status).toBe(201);

    const hrMineLeaves = await request(app)
      .get('/api/v1/leave-requests?mine=true')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(hrMineLeaves.status).toBe(200);
    expect(hrMineLeaves.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      hrMineLeaves.body.data.every((r: any) => String(r.staffId) === String(hrLeaveCreate.body.data.staffId))
    ).toBe(true);

    // 3. Kế toán (ACCOUNTANT) bị chặn (403) khỏi toàn bộ các quyền quản trị nhân sự của HR
    const accTimesheet = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(accTimesheet.status).toBe(403);

    const accShiftSchedule = await request(app)
      .get('/api/v1/shifts/schedule?weekStart=2026-11-16')
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(accShiftSchedule.status).toBe(403);

    const accCreateStaff = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        username: 'acc_illegal_staff',
        password: 'password123',
        fullName: 'Không Được Tạo',
        role: 'SALES',
      });
    expect(accCreateStaff.status).toBe(403);

    const accReviewLeave = await request(app)
      .patch(`/api/v1/leave-requests/${hrLeaveCreate.body.data._id}`)
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ status: 'APPROVED' });
    expect(accReviewLeave.status).toBe(403);

    const accStaffActivity = await request(app)
      .get('/api/v1/reports/staff-activity')
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(accStaffActivity.status).toBe(403);

    // Kế toán gọi GET /api/v1/staff không được xem lương/hồ sơ nhạy cảm của nhân viên khác
    const accStaffList = await request(app)
      .get('/api/v1/staff')
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(accStaffList.status).toBe(200);
    const otherStaffInAccView = accStaffList.body.data.find(
      (s: any) => s.username === 'hr_sub_by_ceo'
    );
    expect(otherStaffInAccView).toBeTruthy();
    expect(otherStaffInAccView.baseSalary).toBe(0);
    expect(otherStaffInAccView.citizenId).toBeUndefined();
  });
});
