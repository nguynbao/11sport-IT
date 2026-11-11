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

    // Công chuẩn Văn phòng = tổng số ngày T2-T7 trong tháng (bao gồm cả ngày nghỉ lễ chính thức hưởng lương)
    const expectedStandard = ts1.body.data.days.filter((d: any) => d.weekday !== 0).length;
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

  it('8. Nghỉ phép có lương: chỉ HĐ Chính thức, để dành cộng dồn qua các tháng (không mất quyền lợi cuối tháng), duyệt -> +1 công', async () => {
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
    // Tháng đã qua, chưa dùng phép -> được để dành cộng dồn (paidLeaveForfeited = 0)
    expect(row0.summary.paidLeaveEntitled).toBe(1);
    expect(row0.summary.paidLeaveForfeited).toBe(0);
    expect(row0.summary.paidLeaveRemaining).toBe(1);

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

    // Ngày thứ 2 trong cùng tháng (khi chỉ có 1 ngày phép tích lũy) -> vượt hạn mức
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
    expect(row1.summary.paidLeaveRemaining).toBe(0);
    expect(row1.summary.absentDays).toBe(row0.summary.absentDays - 1);
    expect(row1.summary.paidUnits).toBeCloseTo(row0.summary.paidUnits + 1, 2);

    // Hợp đồng Thử việc không được dùng trực tiếp khi chưa lên Chính thức
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

  it('12. HR chấm công bù OFF (nghỉ không lương & phép có lương) và giới hạn Sales tối đa 4 ngày OFF không lương/tháng', async () => {
    const createdSales = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        username: 'sales_quota_test',
        password: '123456',
        fullName: 'Sales Quota Test',
        role: 'SALES',
        department: 'SALES',
        contractType: 'FULLTIME',
      });
    expect(createdSales.status).toBe(201);
    const sId = createdSales.body.data._id;

    // HR chấm OFF không lương cho 4 ngày trong cùng 1 tuần (tháng 10/2026)
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) {
      const mOff = await request(app)
        .post('/api/v1/attendance/manual')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ staffId: sId, date: d, shiftCode: 'OFF', offType: 'OFF', reason: 'HR chấm OFF tuần 1' });
      expect(mOff.status).toBe(201);
    }

    // Ngày thứ 5 nghỉ không lương trong cùng tháng 10/2026 -> bị chặn 400 SALES_OFF_QUOTA_EXCEEDED
    const fifthOff = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ staffId: sId, date: '2026-10-15', shiftCode: 'OFF', offType: 'OFF', reason: 'Vượt 4 ngày' });
    expect(fifthOff.status).toBe(400);
    expect(fifthOff.body.code).toBe('SALES_OFF_QUOTA_EXCEEDED');

    // Tuy nhiên nhân viên Chính thức (FULLTIME) vẫn được hưởng 1 ngày nghỉ phép có lương (PAID_LEAVE) trong tháng 10/2026!
    const paidLeaveRes = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ staffId: sId, date: '2026-10-16', shiftCode: 'OFF', offType: 'PAID_LEAVE', reason: 'Phép có lương tháng 10' });
    expect(paidLeaveRes.status).toBe(201);

    // Qua tháng mới (11/2026) -> lại được chấm OFF không lương bình thường
    const nextMonthOff = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ staffId: sId, date: '2026-11-02', shiftCode: 'OFF', offType: 'OFF', reason: 'Tháng mới' });
    expect(nextMonthOff.status).toBe(201);
  });

  it('13. Công chuẩn tháng (1 tuần 6 ngày) theo 28/29/30/31 ngày (nhuận/không nhuận) & cộng công nghỉ lễ Văn phòng vào cột Công', async () => {
    const cases = [
      // Tháng 31 ngày (4 CN -> 27 công; 5 CN -> 26 công)
      { month: 10, year: 2026, daysInMonth: 31, sundays: 4, expectedStandard: 27, isLeap: false },
      { month: 8, year: 2026, daysInMonth: 31, sundays: 5, expectedStandard: 26, isLeap: false },
      // Tháng 30 ngày (4 CN -> 26 công; 5 CN -> 25 công)
      { month: 9, year: 2026, daysInMonth: 30, sundays: 4, expectedStandard: 26, isLeap: false },
      { month: 11, year: 2026, daysInMonth: 30, sundays: 5, expectedStandard: 25, isLeap: false },
      // Tháng 2 không nhuận (28 ngày, 4 CN -> 24 công)
      { month: 2, year: 2026, daysInMonth: 28, sundays: 4, expectedStandard: 24, isLeap: false },
      // Tháng 2 năm nhuận (29 ngày, 4 CN -> 25 công; trường hợp đặc biệt 5 CN -> 24 công)
      { month: 2, year: 2028, daysInMonth: 29, sundays: 4, expectedStandard: 25, isLeap: true },
      { month: 2, year: 2032, daysInMonth: 29, sundays: 5, expectedStandard: 24, isLeap: true },
    ];

    for (const c of cases) {
      const res = await request(app)
        .get(`/api/v1/attendance/timesheet?month=${c.month}&year=${c.year}`)
        .set('Authorization', `Bearer ${hrToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.monthMeta.daysInMonth).toBe(c.daysInMonth);
      expect(res.body.data.monthMeta.sundaysCount).toBe(c.sundays);
      expect(res.body.data.monthMeta.standardDays).toBe(c.expectedStandard);
      expect(res.body.data.monthMeta.isLeapYear).toBe(c.isLeap);

      for (const r of res.body.data.rows) {
        expect(r.summary.standardDays).toBe(c.expectedStandard);
      }
    }

    // Kiểm tra Tháng 9/2026 (có 2 ngày nghỉ lễ Quốc khánh 01/09 và 02/09 rơi vào T3, T4):
    // Mọi nhân viên Khối Văn phòng (kể cả tài khoản mới tạo) đều được cộng +2 công lễ vào holidayPaidDays và paidUnits!
    const sepRes = await request(app)
      .get('/api/v1/attendance/timesheet?month=9&year=2026&department=OFFICE')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(sepRes.status).toBe(200);
    for (const r of sepRes.body.data.rows) {
      expect(r.cells['2026-09-01'].code).toBe('HOLIDAY');
      expect(r.cells['2026-09-02'].code).toBe('HOLIDAY');
      expect(r.summary.holidayPaidDays).toBeGreaterThanOrEqual(2);
      expect(r.summary.paidUnits).toBeGreaterThanOrEqual(2);
    }
  });

  it('14. Chấm công bù và điều chỉnh chấm công hỗ trợ hình thức Làm từ xa (WFH)', async () => {
    const wfhDate = '2026-09-05';
    const manualRes = await request(app)
      .post('/api/v1/attendance/manual')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        staffId: marketingId,
        date: wfhDate,
        shiftCode: 'SHIFT_1',
        checkInType: 'WFH',
        checkIn: '08:30',
        checkOut: '17:30',
        reason: 'Chấm công bù WFH cho nhân viên Marketing',
      });
    expect(manualRes.status).toBe(201);
    expect(manualRes.body.data.checkInType).toBe('WFH');

    const ts1 = await request(app)
      .get('/api/v1/attendance/timesheet?month=9&year=2026')
      .set('Authorization', `Bearer ${hrToken}`);
    const row1 = ts1.body.data.rows.find((r: any) => r.staffId === marketingId);
    expect(row1.cells[wfhDate].code).toBe('WFH');
    expect(row1.cells[wfhDate].checkInType).toBe('WFH');
    expect(row1.summary.wfhDays).toBeGreaterThanOrEqual(1);

    // Điều chỉnh từ WFH về STANDARD và ngược lại qua PATCH /api/v1/attendance/:id
    const attId = row1.cells[wfhDate].attendanceId;
    const patchStandard = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        checkIn: '08:30',
        checkOut: '17:30',
        checkInType: 'STANDARD',
        reason: 'Đổi lại thành làm trực tiếp tại VP',
      });
    expect(patchStandard.status).toBe(200);
    expect(patchStandard.body.data.checkInType).toBe('STANDARD');

    const patchWfh = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        checkIn: '08:30',
        checkOut: '17:30',
        checkInType: 'WFH',
        reason: 'Xác nhận lại làm từ xa (WFH)',
      });
    expect(patchWfh.status).toBe(200);
    expect(patchWfh.body.data.checkInType).toBe('WFH');
  });

  it('15. Đọc contractStartDate đã lưu khi tính công lễ và quyền nghỉ phép có lương (paidLeaveEntitled)', async () => {
    const createRes = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        username: 'office_future_start',
        password: '123456',
        fullName: 'Nhân Viên Bắt Đầu Tháng 10',
        role: 'MARKETING',
        department: 'OFFICE',
        contractType: 'FULLTIME',
        contractStartDate: '2026-10-01',
      });
    expect(createRes.status).toBe(201);
    const newStaffId = createRes.body.data._id;

    // Xem tháng 9/2026 (trước contractStartDate 2026-10-01): không được cộng công lễ 01-02/09 và không có paidLeaveEntitled
    const sepTs = await request(app)
      .get('/api/v1/attendance/timesheet?month=9&year=2026&department=OFFICE')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(sepTs.status).toBe(200);
    const sepRow = sepTs.body.data.rows.find((r: any) => r.staffId === newStaffId);
    expect(sepRow).toBeDefined();
    expect(sepRow.summary.holidayPaidDays).toBe(0);
    expect(sepRow.summary.paidUnits).toBe(0);
    expect(sepRow.summary.paidLeaveEntitled).toBe(0);
    expect(sepRow.cells['2026-09-01'].code).toBe('DAY_OFF');
    expect(sepRow.cells['2026-09-02'].code).toBe('DAY_OFF');

    // Xem tháng 10/2026 (từ tháng bắt đầu hợp đồng): được cấp paidLeaveEntitled = 1
    const octTs = await request(app)
      .get('/api/v1/attendance/timesheet?month=10&year=2026&department=OFFICE')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(octTs.status).toBe(200);
    const octRow = octTs.body.data.rows.find((r: any) => r.staffId === newStaffId);
    expect(octRow).toBeDefined();
    expect(octRow.summary.paidLeaveEntitled).toBe(1);
  });

  it('16. Thử việc lên Chính thức được cộng ngày phép thử việc + cộng dồn 1 ngày/tháng chính thức; dùng liên tiếp 1 tuần khi tạo đơn trước 3 tuần', async () => {
    // 1. Chặn tạo HĐ Thử việc quá 2 tháng (> 65 ngày)
    const exceedProb = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        username: 'prob_exceed',
        password: '123456',
        fullName: 'Thử việc 3 tháng',
        role: 'SALES',
        department: 'SALES',
        contractType: 'PROBATION',
        contractStartDate: '2026-06-01',
        contractEndDate: '2026-09-01',
      });
    expect(exceedProb.status).toBe(400);
    expect(exceedProb.body.code).toBe('PROBATION_MAX_2_MONTHS');

    // 2. Tạo nhân viên Thử việc 2 tháng (01/06/2026 -> 31/07/2026) rồi ký Chính thức từ 01/08/2026
    const probCreate = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        username: 'nv_prob_to_ft',
        password: '123456',
        fullName: 'Nhân Viên Thử Việc Lên Chính Thức',
        role: 'SALES',
        department: 'SALES',
        contractType: 'PROBATION',
        contractStartDate: '2026-06-01',
        contractEndDate: '2026-07-31',
      });
    expect(probCreate.status).toBe(201);
    const staffId = probCreate.body.data._id;

    // Lên Chính thức từ 01/08/2026 -> được cộng 2 ngày phép từ 2 tháng thử việc (tháng 6 & 7)
    const promoteRes = await request(app)
      .patch(`/api/v1/staff/${staffId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        contractType: 'FULLTIME',
        contractStartDate: '2026-08-01',
      });
    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.data.probationMonths).toBe(2);

    // Kiểm tra bảng công tháng 8/2026 (tháng chính thức thứ 1): 2 ngày phép thử việc + 1 ngày phép tháng 8 = 3 ngày phép
    const tsAug = await request(app)
      .get('/api/v1/attendance/timesheet?month=8&year=2026&department=SALES')
      .set('Authorization', `Bearer ${hrToken}`);
    const rowAug = tsAug.body.data.rows.find((r: any) => r.staffId === staffId);
    expect(rowAug.summary.paidLeaveFromProbation).toBe(2);
    expect(rowAug.summary.paidLeaveEntitled).toBe(3);

    // Kiểm tra bảng công tháng 12/2026 (5 tháng chính thức T8..T12 + 2 tháng thử việc = 7 ngày phép tích lũy)
    const tsDec = await request(app)
      .get('/api/v1/attendance/timesheet?month=12&year=2026&department=SALES')
      .set('Authorization', `Bearer ${hrToken}`);
    const rowDec = tsDec.body.data.rows.find((r: any) => r.staffId === staffId);
    expect(rowDec.summary.paidLeaveEntitled).toBe(7);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'nv_prob_to_ft', password: '123456' });
    const staffToken = loginRes.body.data.token;

    // 3. Thử dùng 2 ngày phép liên tiếp nhưng cách hôm nay < 21 ngày -> bị chặn ADVANCE_NOTICE_REQUIRED
    const near1 = new Date();
    near1.setDate(near1.getDate() + 5);
    const near2 = new Date();
    near2.setDate(near2.getDate() + 6);
    const nearStr1 = `${near1.getFullYear()}-${pad(near1.getMonth() + 1)}-${pad(near1.getDate())}`;
    const nearStr2 = `${near2.getFullYear()}-${pad(near2.getMonth() + 1)}-${pad(near2.getDate())}`;

    const leaveNear1 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ type: 'PAID_LEAVE', date: nearStr1, reason: 'Nghỉ 1 ngày phép' });
    expect(leaveNear1.status).toBe(201);

    // Ngày phép thứ 2 cách hôm nay < 3 tuần -> bị chặn ADVANCE_NOTICE_REQUIRED
    const leaveNear2 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ type: 'PAID_LEAVE', date: nearStr2, reason: 'Nghỉ ngày phép thứ 2' });
    expect(leaveNear2.status).toBe(400);
    expect(leaveNear2.body.code).toBe('ADVANCE_NOTICE_REQUIRED');

    // Hủy đơn near1 để test tiếp chuỗi 7 ngày phép liên tiếp tạo trước > 3 tuần
    await request(app)
      .delete(`/api/v1/leave-requests/${leaveNear1.body.data._id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    // 4. Tạo đơn nghỉ phép liên tiếp 1 tuần (7 ngày) trước > 3 tuần (30 ngày tới) -> hợp lệ!
    const baseFuture = new Date();
    baseFuture.setDate(baseFuture.getDate() + 30);
    // Đảm bảo cả 8 ngày liên tiếp dùng để test đều nằm trong cùng 1 tháng (dịch về ngày 10 của tháng kế tiếp nếu cần)
    const futureMonthStart = new Date(baseFuture.getFullYear(), baseFuture.getMonth() + 1, 10);
    const futureDates: string[] = [];
    for (let i = 0; i < 8; i++) {
      const dt = new Date(
        futureMonthStart.getFullYear(),
        futureMonthStart.getMonth(),
        futureMonthStart.getDate() + i
      );
      futureDates.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
    }

    for (let i = 0; i < 7; i++) {
      const res7 = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ type: 'PAID_LEAVE', date: futureDates[i], reason: 'Nghỉ phép 1 tuần cộng dồn' });
      expect(res7.status).toBe(201);
      await request(app)
        .patch(`/api/v1/leave-requests/${res7.body.data._id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ status: 'APPROVED' });
    }

    // Ngày thứ 8 liên tiếp -> bị chặn PAID_LEAVE_WEEK_LIMIT_EXCEEDED (tối đa 7 ngày liên tiếp)
    const res8 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ type: 'PAID_LEAVE', date: futureDates[7], reason: 'Vượt 1 tuần liên tiếp' });
    expect(res8.status).toBe(400);
    expect(res8.body.code).toBe('PAID_LEAVE_WEEK_LIMIT_EXCEEDED');

    // Kiểm tra bảng công tháng đó: cả 7 ngày phép được duyệt đều tính đủ +7 công vào paidUnits
    const fMonth = futureMonthStart.getMonth() + 1;
    const fYear = futureMonthStart.getFullYear();
    const tsFuture = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${fMonth}&year=${fYear}&department=SALES`)
      .set('Authorization', `Bearer ${hrToken}`);
    const rowFuture = tsFuture.body.data.rows.find((r: any) => r.staffId === staffId);
    expect(rowFuture.summary.paidLeaveUsed).toBe(7);
    expect(rowFuture.summary.paidUnits).toBe(7);
  });
});
