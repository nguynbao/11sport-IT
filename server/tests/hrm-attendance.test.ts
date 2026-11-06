import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase } from '../src/config/db';
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

  it('2. Chấm công GPS: chặn khi cách chi nhánh > 50m; thành công khi trong bán kính 50m', async () => {
    // Tọa độ giả định cách xa (Hà Nội / HCM)
    const outOfRangeRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        latitude: 21.0285, // Hà Nội
        longitude: 105.8542,
        shiftCode: 'SHIFT_1',
      });
    expect(outOfRangeRes.status).toBe(400);
    expect(outOfRangeRes.body.code).toBe('LOCATION_OUT_OF_RANGE');

    // Tọa độ hợp lệ tại Showroom 11Sport (24 Tố Hữu, Đà Nẵng)
    const validCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
        shiftCode: 'SHIFT_1',
      });
    expect(validCheckIn.status).toBe(201);
    expect(validCheckIn.body.data.attendance.status).toBeDefined();
    expect(validCheckIn.body.data.attendance.checkInType).toBe('STANDARD');
  });

  it('3. Đơn WFH: Sales bị chặn nộp; Khối Office nộp được và được HR duyệt thì chấm công mọi nơi', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Sales nộp WFH -> Bị từ chối 400
    const salesWfh = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        type: 'WFH',
        date: today,
        reason: 'Xin làm việc tại nhà',
      });
    expect(salesWfh.status).toBe(400);
    expect(salesWfh.body.code).toBe('WFH_NOT_ALLOWED');

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

  it('4. Khối Sales: Bàn giao Kho Tầng 1 giữa Ca 1 và Ca 2; mở khóa nút Check-out', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Ca 1 (sales1) thử check-out khi chưa có bàn giao ca -> Bị chặn 400
    const prematureCheckout = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ forceEarly: false });
    expect(prematureCheckout.status).toBe(400);
    expect(prematureCheckout.body.code).toBe('HANDOVER_REQUIRED');

    // Ca 1 tạo biên bản bàn giao Kho Tầng 1
    const handoverRes = await request(app)
      .post('/api/v1/shifts/handover')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        date: today,
        shiftCode: 'SHIFT_1',
        cashBalance: 15420000,
        discrepancies: [{ productCode: 'GASIA221401DO38', expected: 10, actual: 10, note: 'Khớp' }],
      });
    expect(handoverRes.status).toBe(201);
    expect(handoverRes.body.data.status).toBe('PENDING');
    const handoverId = handoverRes.body.data._id;

    // Ca 2 (tạo nhanh một tài khoản sales2 để nhận ca)
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

    // Ca 2 bấm xác nhận nhận bàn giao Kho Tầng 1
    const confirmRes = await request(app)
      .post(`/api/v1/shifts/handover/${handoverId}/confirm`)
      .set('Authorization', `Bearer ${sales2Token}`)
      .send({ accept: true, note: 'Đã kiểm khớp đủ tiền và hàng' });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe('ACCEPTED');

    // Giờ Ca 1 bấm Check-out (với forceEarly để bỏ qua giờ kết thúc ca nếu test chạy ban ngày)
    const checkoutSuccess = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ forceEarly: true, earlyReason: 'Đã bàn giao xong cho ca 2' });
    expect(checkoutSuccess.status).toBe(200);
    expect(checkoutSuccess.body.data.attendance.checkOutTime).toBeDefined();
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

  it('6. Cấu hình Vị trí GPS & IP Wi-Fi qua .env: chặn HR sửa qua API, chặn Admin chấm công, và kiểm tra IP từ .env', async () => {
    const getCfg = await request(app)
      .get('/api/v1/attendance/config')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(getCfg.status).toBe(200);
    expect(getCfg.body.data.config.officeLat).toBeDefined();

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
      .send({ latitude: 16.0352, longitude: 108.2185 });
    expect(adminCheckIn.status).toBe(400);
    expect(adminCheckIn.body.code).toBe('ADMIN_NO_ATTENDANCE');

    // Thiết lập biến môi trường .env cho IP Wi-Fi
    process.env.ATTENDANCE_REQUIRE_IP = 'true';
    process.env.ATTENDANCE_ALLOWED_IPS = '113.160.22.10,192.168.1.';

    // Accountant check-in đúng GPS nhưng sai IP (10.0.0.5) -> bị chặn 400 WIFI_IP_NOT_ALLOWED
    const wrongIpRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
        clientIp: '10.0.0.5',
      });
    expect(wrongIpRes.status).toBe(400);
    expect(wrongIpRes.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // Accountant check-in đúng GPS và đúng dải IP LAN (192.168.1.55) -> thành công 201
    const rightIpRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
        clientIp: '192.168.1.55',
      });
    expect(rightIpRes.status).toBe(201);

    process.env.ATTENDANCE_REQUIRE_IP = 'false';
  });

  it('7. Logic 2 Cơ sở: Location 1 đi với Mạng 1, Location 2 đi với Mạng 2 (cả Check-in & Check-out)', async () => {
    // Cấu hình 2 cơ sở trong .env
    process.env.ATTENDANCE_REQUIRE_GPS = 'true';
    process.env.ATTENDANCE_REQUIRE_IP = 'true';
    // Cơ sở 1 (Đà Nẵng) + Mạng 1 (192.168.1.)
    process.env.ATTENDANCE_OFFICE_LAT = '16.0352';
    process.env.ATTENDANCE_OFFICE_LNG = '108.2185';
    process.env.ATTENDANCE_ALLOWED_IPS = '192.168.1.';
    // Cơ sở 2 (Hải Châu) + Mạng 2 (192.168.2.)
    process.env.ATTENDANCE_OFFICE_2_LAT = '16.0678';
    process.env.ATTENDANCE_OFFICE_2_LNG = '108.2208';
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

    // 7.1 Đứng ở Location 1 (16.0352, 108.2185) nhưng dùng Mạng 2 (192.168.2.50) -> BỊ CHẶN 400 WIFI_IP_NOT_ALLOWED
    const loc1Net2 = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        latitude: 16.0352,
        longitude: 108.2185,
        clientIp: '192.168.2.50',
      });
    expect(loc1Net2.status).toBe(400);
    expect(loc1Net2.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // 7.2 Đứng ở Location 2 (16.0678, 108.2208) nhưng dùng Mạng 1 (192.168.1.50) -> BỊ CHẶN 400 WIFI_IP_NOT_ALLOWED
    const loc2Net1 = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        latitude: 16.0678,
        longitude: 108.2208,
        clientIp: '192.168.1.50',
      });
    expect(loc2Net1.status).toBe(400);
    expect(loc2Net1.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // 7.3 Đứng ở Location 2 (16.0678, 108.2208) và dùng đúng Mạng 2 (192.168.2.50) -> CHECK-IN THÀNH CÔNG 201
    const loc2Net2CheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        latitude: 16.0678,
        longitude: 108.2208,
        clientIp: '192.168.2.50',
      });
    expect(loc2Net2CheckIn.status).toBe(201);

    // 7.4 Khi Check-out: Đứng ở Location 2 nhưng dùng Mạng 1 -> BỊ CHẶN 400 WIFI_IP_NOT_ALLOWED
    const checkoutMismatch = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        forceEarly: true,
        earlyReason: 'Test checkout',
        latitude: 16.0678,
        longitude: 108.2208,
        clientIp: '192.168.1.50',
      });
    expect(checkoutMismatch.status).toBe(400);
    expect(checkoutMismatch.body.code).toBe('WIFI_IP_NOT_ALLOWED');

    // 7.5 Khi Check-out: Đứng ở Location 1 và dùng đúng Mạng 1 -> CHECK-OUT THÀNH CÔNG 200
    const checkoutMatchBranch1 = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Authorization', `Bearer ${branch2Token}`)
      .send({
        forceEarly: true,
        earlyReason: 'Test checkout tại Cơ sở 1',
        latitude: 16.0352,
        longitude: 108.2185,
        clientIp: '192.168.1.88',
      });
    expect(checkoutMatchBranch1.status).toBe(200);
    expect(checkoutMatchBranch1.body.data.attendance.checkOutTime).toBeDefined();

    process.env.ATTENDANCE_REQUIRE_IP = 'false';
  });
});
