import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, staffRepo, shiftAssignmentRepo, attendanceRepo } from '../src/config/db';
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
    }
  });

  it('9. Bảo mật Địa điểm/Mạng: client gửi bypassNetwork: true không thể bỏ qua kiểm tra GPS & IP khi chưa có đơn WFH đã duyệt', async () => {
    process.env.ATTENDANCE_REQUIRE_GPS = 'true';
    process.env.ATTENDANCE_REQUIRE_IP = 'true';
    process.env.ATTENDANCE_OFFICE_LAT = '16.0352';
    process.env.ATTENDANCE_OFFICE_LNG = '108.2185';
    process.env.ATTENDANCE_ALLOWED_IPS = '192.168.1.';

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

      // Client cố tình gửi bypassNetwork: true khi đứng xa cơ sở -> vẫn bị chặn 400 LOCATION_OUT_OF_RANGE
      const fakeBypassCheckIn = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${token}`)
        .send({
          latitude: 10.7626,
          longitude: 106.6602,
          clientIp: '10.0.0.1',
          bypassNetwork: true,
        });
      expect(fakeBypassCheckIn.status).toBe(400);
      expect(fakeBypassCheckIn.body.code).toBe('LOCATION_OUT_OF_RANGE');

      // Check-in hợp lệ tại cơ sở, sau đó cố gửi bypassNetwork: true khi check-out ở vị trí/mạng ngoài -> vẫn bị chặn 400
      const validCheckIn = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${token}`)
        .send({
          latitude: 16.0352,
          longitude: 108.2185,
          clientIp: '192.168.1.99',
        });
      expect(validCheckIn.status).toBe(201);

      const fakeBypassCheckOut = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${token}`)
        .send({
          forceEarly: true,
          earlyReason: 'Test',
          latitude: 10.7626,
          longitude: 106.6602,
          clientIp: '10.0.0.1',
          bypassNetwork: true,
        });
      expect(fakeBypassCheckOut.status).toBe(400);
      expect(fakeBypassCheckOut.body.code).toBe('LOCATION_OUT_OF_RANGE');
    } finally {
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
        role: 'WAREHOUSE',
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
});
