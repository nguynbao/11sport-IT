import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, staffRepo } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

describe('Bảng công tháng (Timesheet), Điều chỉnh giờ công & Chấm công bù', () => {
  const app = createApp();
  let hrToken: string;
  let salesToken: string;
  let marketingId: string;

  // Ngày hôm qua (quá khứ) để chấm công bù
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const pastDate = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  const pastMonth = y.getMonth() + 1;
  const pastYear = y.getFullYear();

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const hrRes = await request(app).post('/api/v1/auth/login').send({ username: 'hr1', password: '123456' });
    hrToken = hrRes.body.data.token;

    const salesRes = await request(app).post('/api/v1/auth/login').send({ username: 'sales1', password: '123456' });
    salesToken = salesRes.body.data.token;

    const mktRes = await request(app).post('/api/v1/auth/login').send({ username: 'marketing1', password: '123456' });
    marketingId = mktRes.body.data.user._id;
  });

  it('1. Chỉ HR/ADMIN được xem bảng công; Sales bị chặn 403', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/timesheet')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });

  it('2. HR chấm công bù (đi trễ 15p, quên check-out) rồi điều chỉnh giờ ra -> tính lại công', async () => {
    // Chấm công bù: vào 08:45, chưa có giờ ra
    const manual = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ staffId: marketingId, date: pastDate, checkIn: '08:45', reason: 'Quên chấm công do mất mạng' });
    expect(manual.status).toBe(201);
    expect(manual.body.data.lateMinutes).toBe(15);
    expect(manual.body.data.status).toBe('LATE');
    expect(manual.body.data.adjustReason).toBe('Quên chấm công do mất mạng');
    const attId = manual.body.data._id;

    // Chấm bù trùng ngày -> 400
    const dup = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ staffId: marketingId, date: pastDate, checkIn: '08:30', reason: 'x' });
    expect(dup.status).toBe(400);
    expect(dup.body.code).toBe('ALREADY_CHECKED_IN');

    // Bảng công: ngày quá khứ chưa check-out -> MISSING_OUT
    const ts1 = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${pastMonth}&year=${pastYear}`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(ts1.status).toBe(200);
    const row1 = ts1.body.data.rows.find((r: any) => r.staffId === marketingId);
    expect(row1).toBeDefined();
    expect(row1.cells[pastDate].code).toBe('MISSING_OUT');
    expect(row1.summary.missingCheckout).toBe(1);
    expect(ts1.body.data.rows.some((r: any) => r.role === 'ADMIN')).toBe(false);

    // Công chuẩn Văn phòng = số ngày T2-T7 trong tháng trừ ngày nghỉ lễ chính thức (không phụ thuộc ngày tạo tài khoản)
    const expectedStandard = ts1.body.data.days.filter(
      (d: any) => d.weekday !== 0 && !(d.holiday && d.holiday.isOfficialDayOff)
    ).length;
    expect(row1.summary.standardDays).toBe(expectedStandard);

    // Điều chỉnh thiếu lý do -> 400
    const noReason = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ checkOut: '17:30' });
    expect(noReason.status).toBe(400);

    // Giờ ra trước giờ vào -> 400
    const badTime = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ checkOut: '08:00', reason: 'test' });
    expect(badTime.status).toBe(400);

    // Điều chỉnh giờ ra 17:30 -> 08:45..17:30 = 8.75h - 1h nghỉ trưa = 7.75h
    const patch = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ checkOut: '17:30', reason: 'Bổ sung giờ ra theo camera' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.totalWorkHours).toBe(7.75);
    expect(patch.body.data.earlyMinutes).toBe(0);
    expect(patch.body.data.status).toBe('COMPLETED');

    // Bảng công sau điều chỉnh -> LATE, công = 7.75 / 8
    const ts2 = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${pastMonth}&year=${pastYear}&department=OFFICE`)
      .set('Authorization', `Bearer ${hrToken}`);
    const row2 = ts2.body.data.rows.find((r: any) => r.staffId === marketingId);
    expect(row2.cells[pastDate].code).toBe('LATE');
    expect(row2.cells[pastDate].adjusted).toBe(true);
    expect(row2.summary.missingCheckout).toBe(0);
    expect(row2.summary.lateCount).toBe(1);
    expect(row2.summary.workUnits).toBeCloseTo(7.75 / 8, 2);
    expect(ts2.body.data.rows.every((r: any) => r.department === 'OFFICE')).toBe(true);
  });

  it('3. Lịch sử chấm công lọc đúng theo tháng/năm', async () => {
    const res = await request(app)
      .get(`/api/v1/attendance/history?month=${pastMonth}&year=${pastYear}`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: any) => r.date.startsWith(`${pastYear}-${pad(pastMonth)}-`))).toBe(true);
  });

  it('4. Ngày lễ CHÍNH THỨC: Văn phòng nghỉ nhưng vẫn tính 1 công; lễ SỰ KIỆN không tính công', async () => {
    // Đặt ngày vào làm của NV về quá khứ để được hưởng công lễ
    await staffRepo.updateById(marketingId, { createdAt: new Date(2020, 0, 1) } as any);

    // Chọn tháng trước, lấy 2 ngày T2-T7 chưa có lễ
    const ref = new Date();
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - 1);
    const m = ref.getMonth() + 1;
    const yr = ref.getFullYear();
    const before = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${m}&year=${yr}&department=OFFICE`)
      .set('Authorization', `Bearer ${hrToken}`);
    const freeDays = before.body.data.days.filter((d: any) => d.weekday !== 0 && !d.holiday);
    const officialDate = freeDays[0].date;
    const eventDate = freeDays[1].date;
    const rowBefore = before.body.data.rows.find((r: any) => r.staffId === marketingId);

    // HR thêm 1 lễ chính thức + 1 lễ sự kiện
    const o = await request(app)
      .post('/api/v1/holidays')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ date: officialDate, name: 'Nghỉ lễ chính thức (test)', isOfficialDayOff: true });
    expect(o.status).toBe(201);
    const e = await request(app)
      .post('/api/v1/holidays')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ date: eventDate, name: 'Sự kiện (test)', isOfficialDayOff: false });
    expect(e.status).toBe(201);

    const after = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${m}&year=${yr}&department=OFFICE`)
      .set('Authorization', `Bearer ${hrToken}`);
    const row = after.body.data.rows.find((r: any) => r.staffId === marketingId);

    // Lễ chính thức: ô HOLIDAY, hưởng lương, không tính vắng
    expect(row.cells[officialDate].code).toBe('HOLIDAY');
    expect(row.cells[officialDate].isPaidHoliday).toBe(true);
    expect(row.summary.holidayPaidDays).toBe(rowBefore.summary.holidayPaidDays + 1);
    expect(row.summary.paidUnits).toBe(Number((row.summary.workUnits + row.summary.holidayPaidDays).toFixed(2)));
    // Công chuẩn không đổi (ngày lễ chính thức vẫn nằm trong công chuẩn)
    expect(row.summary.standardDays).toBe(rowBefore.summary.standardDays);

    // Lễ sự kiện: vẫn là ngày làm việc bình thường -> không đi làm = Vắng, không được tính công
    expect(row.cells[eventDate].code).toBe('ABSENT');
    expect(row.cells[eventDate].isPaidHoliday).toBeFalsy();
  });

  it('5. Lịch công cá nhân (my-calendar): chỉ thấy dữ liệu của mình, có tăng ca & đơn từ', async () => {
    const mktLogin = await request(app).post('/api/v1/auth/login').send({ username: 'marketing1', password: '123456' });
    const mktToken = mktLogin.body.data.token;

    // Ngày 2 ngày trước: HR chấm bù 08:30 - 19:00 (tăng ca 90 phút sau 17:30)
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const otDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const manual = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ staffId: marketingId, date: otDate, checkIn: '08:30', checkOut: '19:00', reason: 'Tăng ca chạy chiến dịch' });
    expect(manual.status).toBe(201);

    // Nhân viên gửi đơn xin về sớm cho ngày mai (đang chờ duyệt)
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const tmr = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    const leave = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktToken}`)
      .send({ type: 'EARLY', date: tmr, reason: 'Đi khám bệnh' });
    expect(leave.status).toBe(201);

    const res = await request(app)
      .get(`/api/v1/attendance/my-calendar?month=${d.getMonth() + 1}&year=${d.getFullYear()}`)
      .set('Authorization', `Bearer ${mktToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.row.staffId).toBe(marketingId);
    expect(res.body.data.rules.holidayWorkPayMultiplier).toBe(4);
    const cell = res.body.data.row.cells[otDate];
    expect(cell.overtimeMinutes).toBe(90);
    expect(res.body.data.row.summary.overtimeMinutes).toBeGreaterThanOrEqual(90);

    // Đơn chờ duyệt hiển thị trên lịch (nếu ngày mai cùng tháng)
    if (t.getMonth() === d.getMonth()) {
      const tCell = res.body.data.row.cells[tmr];
      expect(tCell.leaveRequests.some((l: any) => l.type === 'EARLY' && l.status === 'PENDING')).toBe(true);
    }

    // Admin không có lịch công
    const adminLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'admin123' });
    const adminRes = await request(app)
      .get('/api/v1/attendance/my-calendar')
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`);
    expect(adminRes.status).toBe(400);
  });

  it('6. Khối BÁN HÀNG: ngày lễ là ngày làm bình thường (không nghỉ, không +1 công); đi làm ngày lễ -> x4', async () => {
    const salesLogin = await request(app).post('/api/v1/auth/login').send({ username: 'sales1', password: '123456' });
    const salesId = salesLogin.body.data.user._id;
    await staffRepo.updateById(salesId, { createdAt: new Date(2020, 0, 1) } as any);

    const ref = new Date();
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - 1);
    const m = ref.getMonth() + 1;
    const yr = ref.getFullYear();

    const before = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${m}&year=${yr}&department=SALES`)
      .set('Authorization', `Bearer ${hrToken}`);
    const free = before.body.data.days.filter((d: any) => d.weekday !== 0 && !d.holiday);
    const offHoliday = free[2].date; // lễ, Sales nghỉ
    const workHoliday = free[3].date; // lễ, Sales đi làm
    const rowBefore = before.body.data.rows.find((r: any) => r.staffId === salesId);

    for (const date of [offHoliday, workHoliday]) {
      const h = await request(app)
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ date, name: 'Lễ chính thức Sales (test)', isOfficialDayOff: true });
      expect(h.status).toBe(201);
    }
    const work = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ staffId: salesId, date: workHoliday, checkIn: '08:30', checkOut: '17:30', reason: 'Trực showroom ngày lễ' });
    expect(work.status).toBe(201);

    const after = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${m}&year=${yr}&department=SALES`)
      .set('Authorization', `Bearer ${hrToken}`);
    const row = after.body.data.rows.find((r: any) => r.staffId === salesId);

    // Không đi làm ngày lễ -> VẮNG (Sales không có ngày nghỉ mặc định, kể cả ngày lễ)
    expect(row.cells[offHoliday].code).toBe('ABSENT');
    expect(row.cells[offHoliday].isPaidHoliday).toBeFalsy();
    expect(row.summary.holidayPaidDays).toBe(0);
    // Ngày lễ vẫn nằm trong công chuẩn của Sales
    expect(row.summary.standardDays).toBe(rowBefore.summary.standardDays);
    // Đi làm ngày lễ: vẫn tính công + đánh dấu lương x4
    expect(row.cells[workHoliday].isHolidayWork).toBe(true);
    expect(row.summary.holidayWorkDays).toBe(1);
    expect(row.summary.holidayWorkHours).toBe(9);
    expect(row.summary.workUnits).toBeCloseTo(rowBefore.summary.workUnits + 1, 2);
  });

  it('7. Đơn từ: chặn đơn trùng, nhân viên hủy được đơn PENDING của mình', async () => {
    const mktLogin = await request(app).post('/api/v1/auth/login').send({ username: 'marketing1', password: '123456' });
    const mktToken = mktLogin.body.data.token;
    const salesLogin = await request(app).post('/api/v1/auth/login').send({ username: 'sales1', password: '123456' });

    const c1 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktToken}`)
      .send({ type: 'WFH', date: '2026-12-15', reason: 'Làm từ xa' });
    expect(c1.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktToken}`)
      .send({ type: 'WFH', date: '2026-12-15', reason: 'Trùng' });
    expect(dup.status).toBe(400);
    expect(dup.body.code).toBe('DUPLICATE_REQUEST');

    // Người khác không hủy được
    const other = await request(app)
      .delete(`/api/v1/leave-requests/${c1.body.data._id}`)
      .set('Authorization', `Bearer ${salesLogin.body.data.token}`);
    expect(other.status).toBe(403);

    const del = await request(app)
      .delete(`/api/v1/leave-requests/${c1.body.data._id}`)
      .set('Authorization', `Bearer ${mktToken}`);
    expect(del.status).toBe(200);

    const list = await request(app).get('/api/v1/leave-requests').set('Authorization', `Bearer ${mktToken}`);
    expect(list.body.data.some((l: any) => l._id === c1.body.data._id)).toBe(false);
  });

  it('8. Nghỉ phép có lương: chỉ HĐ Chính thức, 1 ngày/tháng, duyệt -> +1 công; tháng không dùng -> mất quyền lợi', async () => {
    const mktLogin = await request(app).post('/api/v1/auth/login').send({ username: 'marketing1', password: '123456' });
    const mktToken = mktLogin.body.data.token;
    await staffRepo.updateById(marketingId, { contractType: 'FULLTIME', createdAt: new Date(2020, 0, 1) } as any);

    // Tháng trước: chọn 2 ngày T2-T7 không lễ
    const ref = new Date();
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - 1);
    const m = ref.getMonth() + 1;
    const yr = ref.getFullYear();
    const ts0 = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${m}&year=${yr}&department=OFFICE`)
      .set('Authorization', `Bearer ${hrToken}`);
    const row0 = ts0.body.data.rows.find((r: any) => r.staffId === marketingId);
    // Tháng đã qua, chưa dùng phép -> mất quyền lợi
    expect(row0.summary.paidLeaveEntitled).toBe(1);
    expect(row0.summary.paidLeaveForfeited).toBe(1);

    const free = ts0.body.data.days.filter(
      (d: any) => d.weekday !== 0 && !d.holiday && row0.cells[d.date].code === 'ABSENT'
    );
    const d1 = free[0].date;
    const d2 = free[1].date;

    const r1 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktToken}`)
      .send({ type: 'PAID_LEAVE', date: d1, reason: 'Nghỉ phép tháng' });
    expect(r1.status).toBe(201);

    // Ngày thứ 2 trong cùng tháng -> vượt hạn mức
    const r2 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktToken}`)
      .send({ type: 'PAID_LEAVE', date: d2, reason: 'Nghỉ thêm' });
    expect(r2.status).toBe(400);
    expect(r2.body.code).toBe('PAID_LEAVE_QUOTA_EXCEEDED');

    // HR duyệt
    const approve = await request(app)
      .patch(`/api/v1/leave-requests/${r1.body.data._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'APPROVED' });
    expect(approve.status).toBe(200);

    const ts1 = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${m}&year=${yr}&department=OFFICE`)
      .set('Authorization', `Bearer ${hrToken}`);
    const row1 = ts1.body.data.rows.find((r: any) => r.staffId === marketingId);
    expect(row1.cells[d1].code).toBe('PAID_LEAVE');
    expect(row1.summary.paidLeaveUsed).toBe(1);
    expect(row1.summary.paidLeaveForfeited).toBe(0);
    expect(row1.summary.absentDays).toBe(row0.summary.absentDays - 1);
    expect(row1.summary.paidUnits).toBeCloseTo(row0.summary.paidUnits + 1, 2);

    // Hợp đồng Thử việc không được dùng
    await staffRepo.updateById(marketingId, { contractType: 'PROBATION' } as any);
    const r3 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktToken}`)
      .send({ type: 'PAID_LEAVE', date: '2026-12-10', reason: 'Thử' });
    expect(r3.status).toBe(400);
    expect(r3.body.code).toBe('PAID_LEAVE_NOT_ELIGIBLE');
    await staffRepo.updateById(marketingId, { contractType: 'FULLTIME' } as any);
  });

  it('9. Sales mặc định không có ngày off: Chủ nhật & ngày lễ đều là ngày làm (chỉ Văn phòng nghỉ CN/lễ)', async () => {
    const salesLogin = await request(app).post('/api/v1/auth/login').send({ username: 'sales1', password: '123456' });
    const salesId = salesLogin.body.data.user._id;
    const ref = new Date();
    ref.setDate(1);
    ref.setMonth(ref.getMonth() + 1); // tháng sau (chưa xếp ca)
    const m = ref.getMonth() + 1;
    const yr = ref.getFullYear();
    const ts = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${m}&year=${yr}`)
      .set('Authorization', `Bearer ${hrToken}`);
    const salesRow = ts.body.data.rows.find((r: any) => r.staffId === salesId);
    const officeRow = ts.body.data.rows.find((r: any) => r.staffId === marketingId);
    const sunday = ts.body.data.days.find((d: any) => d.weekday === 0 && !d.holiday);
    expect(salesRow.cells[sunday.date].code).toBe('FUTURE');
    expect(officeRow.cells[sunday.date].code).toBe('DAY_OFF');
    // Ngày lễ chính thức (nếu có trong tháng): Sales vẫn là ngày làm, Văn phòng nghỉ
    const official = ts.body.data.days.find((d: any) => d.holiday && d.holiday.isOfficialDayOff);
    if (official) {
      expect(salesRow.cells[official.date].code).not.toBe('HOLIDAY');
    }
  });

  it('10. Loại hợp đồng: mặc định Thử việc, hỗ trợ Thực tập, chặn giá trị sai', async () => {
    const def = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ username: 'nv_moi', password: '123456', fullName: 'Nhân viên mới', role: 'SALES', department: 'SALES' });
    expect(def.status).toBe(201);
    expect(def.body.data.contractType).toBe('PROBATION');

    const intern = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ username: 'nv_intern', password: '123456', fullName: 'Thực tập sinh', role: 'MARKETING', department: 'OFFICE', contractType: 'INTERN' });
    expect(intern.status).toBe(201);
    expect(intern.body.data.contractType).toBe('INTERN');

    const bad = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ username: 'nv_bad', password: '123456', role: 'SALES', contractType: 'ABC' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_CONTRACT_TYPE');

    // Thực tập sinh không được nghỉ phép có lương
    const login = await request(app).post('/api/v1/auth/login').send({ username: 'nv_intern', password: '123456' });
    const r = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ type: 'PAID_LEAVE', date: '2026-12-11', reason: 'Thử' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('PAID_LEAVE_NOT_ELIGIBLE');

    // HR nâng lên Chính thức -> được dùng
    const up = await request(app)
      .patch(`/api/v1/staff/${intern.body.data._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ contractType: 'FULLTIME' });
    expect(up.status).toBe(200);
    const r2 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ type: 'PAID_LEAVE', date: '2026-12-11', reason: 'Nghỉ phép' });
    expect(r2.status).toBe(201);
  });

  it('11. Lý do đơn từ tối đa 100 ký tự', async () => {
    const mktLogin = await request(app).post('/api/v1/auth/login').send({ username: 'marketing1', password: '123456' });
    const tooLong = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktLogin.body.data.token}`)
      .send({ type: 'LATE', date: '2026-12-20', reason: 'a'.repeat(101) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.code).toBe('REASON_TOO_LONG');
    const ok = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${mktLogin.body.data.token}`)
      .send({ type: 'LATE', date: '2026-12-20', reason: 'a'.repeat(100) });
    expect(ok.status).toBe(201);
  });
});
