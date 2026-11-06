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

    // Điều chỉnh giờ ra 17:30 -> 08:45..17:30 = 8.75h - 1.5h nghỉ trưa = 7.25h
    const patch = await request(app)
      .patch(`/api/v1/attendance/${attId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ checkOut: '17:30', reason: 'Bổ sung giờ ra theo camera' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.totalWorkHours).toBe(7.25);
    expect(patch.body.data.earlyMinutes).toBe(0);
    expect(patch.body.data.status).toBe('COMPLETED');

    // Bảng công sau điều chỉnh -> LATE, công = 7.25 / 7.5
    const ts2 = await request(app)
      .get(`/api/v1/attendance/timesheet?month=${pastMonth}&year=${pastYear}&department=OFFICE`)
      .set('Authorization', `Bearer ${hrToken}`);
    const row2 = ts2.body.data.rows.find((r: any) => r.staffId === marketingId);
    expect(row2.cells[pastDate].code).toBe('LATE');
    expect(row2.cells[pastDate].adjusted).toBe(true);
    expect(row2.summary.missingCheckout).toBe(0);
    expect(row2.summary.lateCount).toBe(1);
    expect(row2.summary.workUnits).toBeCloseTo(7.25 / 7.5, 2);
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
});
