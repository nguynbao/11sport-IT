import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase, staffRepo } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';
import { hashPassword } from '../src/utils/auth';

describe('Xếp ca tuần: Sửa & Lưu hàng loạt (PUT /shifts/assign/bulk) + quy định 6 ngày làm / 1 ngày nghỉ', () => {
  const app = createApp();
  let hrToken: string;
  let salesToken: string;
  let salesId: string;
  const weekStart = '2026-11-09'; // Thứ 2
  const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];

  /** Kế hoạch 7 ngày: `offIndex` là ngày nghỉ, còn lại `shift` */
  const fullWeek = (offIndex: number, shift: 'SHIFT_1' | 'SHIFT_2' = 'SHIFT_1') =>
    week.map((date, i) => ({ staffId: salesId, date, dayOfWeek: i + 1, shiftCode: i === offIndex ? 'OFF' : shift }));

  beforeAll(async () => {
    process.env.FORCE_MEMORY_DB = 'true';
    await connectDatabase();
    await clearDatabase();
    await seedDatabaseIfNeeded();

    const hrRes = await request(app).post('/api/v1/auth/login').send({ username: 'hr1', password: '123456' });
    hrToken = hrRes.body.data.token;
    const salesRes = await request(app).post('/api/v1/auth/login').send({ username: 'sales1', password: '123456' });
    salesToken = salesRes.body.data.token;
    salesId = salesRes.body.data.user._id;
  });

  const getWeek = async () => {
    const res = await request(app)
      .get(`/api/v1/shifts/schedule?weekStart=${weekStart}`)
      .set('Authorization', `Bearer ${hrToken}`);
    return res.body.data.assignments as any[];
  };

  const save = (changes: any[]) =>
    request(app).put('/api/v1/shifts/assign/bulk').set('Authorization', `Bearer ${hrToken}`).send({ weekStart, changes });

  it('Sales không có quyền lưu lịch ca', async () => {
    const res = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ weekStart, changes: fullWeek(2) });
    expect(res.status).toBe(403);
  });

  it('Chặn lưu khi Sales chưa đủ 7 ngày / không có ngày nghỉ / nghỉ 2 ngày', async () => {
    const partial = await save(fullWeek(2).slice(0, 2));
    expect(partial.status).toBe(400);
    expect(partial.body.code).toBe('WEEKLY_OFF_REQUIRED');

    const noOff = await save(week.map((date, i) => ({ staffId: salesId, date, dayOfWeek: i + 1, shiftCode: 'SHIFT_1' })));
    expect(noOff.status).toBe(400);
    expect(noOff.body.code).toBe('WEEKLY_OFF_REQUIRED');

    const twoOff = fullWeek(2);
    twoOff[5].shiftCode = 'OFF';
    expect((await save(twoOff)).status).toBe(400);

    // Lỗi thì không lưu gì
    expect(await getWeek()).toHaveLength(0);
  });

  it('Lưu hợp lệ (6 ca + 1 nghỉ) -> đổi ngày nghỉ -> xoá cả tuần', async () => {
    const ok = await save(fullWeek(2)); // nghỉ Thứ 4
    expect(ok.status).toBe(200);
    expect(ok.body.data.created).toBe(7);
    let list = await getWeek();
    expect(list.find((a) => a.date === '2026-11-11')?.shiftCode).toBe('OFF');

    // Đổi ngày nghỉ sang Chủ nhật
    const swap = await save([
      { staffId: salesId, date: '2026-11-11', dayOfWeek: 3, shiftCode: 'SHIFT_2' },
      { staffId: salesId, date: '2026-11-15', dayOfWeek: 7, shiftCode: 'OFF' },
    ]);
    expect(swap.status).toBe(200);
    expect(swap.body.data.updated).toBe(2);
    list = await getWeek();
    expect(list.find((a) => a.date === '2026-11-11')?.shiftCode).toBe('SHIFT_2');
    expect(list.filter((a) => a.shiftCode === 'OFF')).toHaveLength(1);

    // Bỏ 1 ngày -> thiếu ngày -> chặn
    expect((await save([{ staffId: salesId, date: '2026-11-10', shiftCode: null }])).status).toBe(400);

    // Xoá cả tuần -> hợp lệ
    const clear = await save(week.map((date) => ({ staffId: salesId, date, shiftCode: null })));
    expect(clear.status).toBe(200);
    expect(clear.body.data.deleted).toBe(7);
    expect(await getWeek()).toHaveLength(0);
  });

  it('Chặn mã ca sai và danh sách thay đổi rỗng', async () => {
    expect((await save([{ staffId: salesId, date: '2026-11-12', shiftCode: 'SHIFT_9' }])).status).toBe(400);
    expect((await save([])).status).toBe(400);
  });

  it('Luồng Sales đăng ký ca tuần sau -> HR chỉnh tay/xác nhận -> Sales nhận thông báo chấm đỏ & xem lịch', async () => {
    // 1. Sales gửi đăng ký ca sai quy định (0 ngày OFF) -> chặn 400
    const badPref = await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        weekStart,
        preferences: week.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: false,
          preferenceShift: 'SHIFT_1',
        })),
      });
    expect(badPref.status).toBe(400);
    expect(badPref.body.code).toBe('WEEKLY_OFF_REQUIRED');

    // 2. Sales gửi đăng ký hợp lệ (6 ngày làm + 1 ngày OFF vào Thứ 4)
    const okPref = await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        weekStart,
        preferences: week.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i === 2,
          preferenceShift: i === 2 ? 'OFF' : i % 2 === 0 ? 'SHIFT_1' : 'SHIFT_2',
        })),
      });
    expect(okPref.status).toBe(200);

    // 3. Kiểm tra trên bảng phân ca HR thấy lịch đăng ký (assignedBy = AUTO)
    const hrViewBefore = await getWeek();
    expect(hrViewBefore).toHaveLength(7);
    expect(hrViewBefore.every((a) => a.assignedBy === 'AUTO')).toBe(true);

    // Kiểm tra phía Sales lúc HR chưa xác nhận: isRegistered = true, isConfirmedByHr = false, hasUnseenConfirmedSchedule = false
    const salesBeforeConfirm = await request(app)
      .get(`/api/v1/shifts/my-schedule?weekStart=${weekStart}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesBeforeConfirm.status).toBe(200);
    expect(salesBeforeConfirm.body.data.isRegistered).toBe(true);
    expect(salesBeforeConfirm.body.data.isConfirmedByHr).toBe(false);
    expect(salesBeforeConfirm.body.data.hasUnseenConfirmedSchedule).toBe(false);

    // 4. HR chỉnh tay ngày OFF từ Thứ 4 sang Chủ Nhật (nếu bị trùng) và bấm Xác nhận hoàn tất (confirmWeek = true)
    const hrConfirm = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        confirmWeek: true,
        changes: [
          { staffId: salesId, date: '2026-11-11', dayOfWeek: 3, shiftCode: 'SHIFT_1' },
          { staffId: salesId, date: '2026-11-15', dayOfWeek: 7, shiftCode: 'OFF' },
        ],
      });
    expect(hrConfirm.status).toBe(200);
    expect(hrConfirm.body.data.confirmed).toBe(7);

    // 5. Phía Sales nhận được thông báo chấm đỏ (hasUnseenConfirmedSchedule = true, isConfirmedByHr = true)
    const salesAfterConfirm = await request(app)
      .get(`/api/v1/shifts/my-schedule?weekStart=${weekStart}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesAfterConfirm.status).toBe(200);
    expect(salesAfterConfirm.body.data.isConfirmedByHr).toBe(true);
    expect(salesAfterConfirm.body.data.hasUnseenConfirmedSchedule).toBe(true);
    expect(salesAfterConfirm.body.data.unseenConfirmedCount).toBe(7);

    // 6. Sales mở tab Chấm công -> gọi POST /shifts/my-schedule/seen -> tắt chấm đỏ
    const seenRes = await request(app)
      .post('/api/v1/shifts/my-schedule/seen')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ weekStart });
    expect(seenRes.status).toBe(200);
    expect(seenRes.body.data.markedCount).toBe(7);

    const salesAfterSeen = await request(app)
      .get(`/api/v1/shifts/my-schedule?weekStart=${weekStart}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesAfterSeen.body.data.hasUnseenConfirmedSchedule).toBe(false);
  });

  it('Đăng ký 2 ca/ngày (BOTH): ca trống thì làm cả 2 ca (BOTH), cả 2 ca đều có người thì random 1 trong 2 ca', async () => {
    const week2Start = '2026-11-16';
    const week2 = [
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ];

    // 1. Sales1 đăng ký tuần 16/11: Thứ 2 (2026-11-16) và Thứ 3 (2026-11-17) chọn cả 2 ca (BOTH)
    // Khi chưa có nhân viên khác đăng ký -> cả Ca 1 và Ca 2 đều trống -> được gán làm cả 2 ca (shiftCode = 'BOTH')
    const pref1 = await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        weekStart: week2Start,
        preferences: week2.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i === 6,
          preferenceShift: i === 6 ? 'OFF' : i <= 1 ? 'BOTH' : 'SHIFT_1',
        })),
      });
    expect(pref1.status).toBe(200);

    const schedule1 = await request(app)
      .get(`/api/v1/shifts/schedule?weekStart=${week2Start}`)
      .set('Authorization', `Bearer ${hrToken}`);
    const list1 = schedule1.body.data.assignments as any[];
    expect(list1.find((a) => a.staffId === salesId && a.date === '2026-11-16')?.shiftCode).toBe('BOTH');
    expect(list1.find((a) => a.staffId === salesId && a.date === '2026-11-17')?.shiftCode).toBe('BOTH');

    // 2. Tạo thêm 2 nhân viên Bán hàng (sales2 trực Ca 1, sales3 trực Ca 2 vào Thứ 2 2026-11-16; còn Thứ 3 2026-11-17 cả hai cùng trực Ca 1 để Ca 2 vẫn trống)
    const createSalesStaff = async (code: string, username: string, fullName: string, phone: string) => {
      const created = await staffRepo.create({
        code,
        username,
        passwordHash: hashPassword('123456'),
        fullName,
        phone,
        role: 'SALES',
        department: 'SALES',
        status: 'ACTIVE',
        contractType: 'FULLTIME',
      });
      const login = await request(app).post('/api/v1/auth/login').send({ username, password: '123456' });
      return { id: String(created._id), token: login.body.data.token };
    };

    const s2 = await createSalesStaff('NV092', 'sales2_test', 'Nhân Viên Sales 2', '0909888772');
    const s3 = await createSalesStaff('NV093', 'sales3_test', 'Nhân Viên Sales 3', '0909888773');

    await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${s2.token}`)
      .send({
        weekStart: week2Start,
        preferences: week2.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i === 5,
          preferenceShift: i === 5 ? 'OFF' : 'SHIFT_1',
        })),
      });

    await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${s3.token}`)
      .send({
        weekStart: week2Start,
        preferences: week2.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i === 4,
          // Thứ 2 (i=0) trực SHIFT_2 -> Thứ 2 đã có đủ s2 (SHIFT_1) và s3 (SHIFT_2)
          // Thứ 3 (i=1) trực SHIFT_1 -> Thứ 3 chỉ có SHIFT_1, Ca 2 vẫn trống!
          preferenceShift: i === 4 ? 'OFF' : i === 0 ? 'SHIFT_2' : 'SHIFT_1',
        })),
      });

    const scheduleAfter = await request(app)
      .get(`/api/v1/shifts/schedule?weekStart=${week2Start}`)
      .set('Authorization', `Bearer ${hrToken}`);
    const listAfter = scheduleAfter.body.data.assignments as any[];

    const sales1Mon = listAfter.find((a) => a.staffId === salesId && a.date === '2026-11-16');
    const sales1Tue = listAfter.find((a) => a.staffId === salesId && a.date === '2026-11-17');

    // Thứ 2 (2026-11-16): cả Ca 1 và Ca 2 đều đã có người (s2 & s3) -> sales1 đăng ký BOTH sẽ được random 1 trong 2 ca
    expect(sales1Mon?.preferenceShift).toBe('BOTH');
    expect(['SHIFT_1', 'SHIFT_2']).toContain(sales1Mon?.shiftCode);

    // Thứ 3 (2026-11-17): Ca 2 vẫn trống (s2 & s3 đều chọn Ca 1) -> sales1 đăng ký BOTH được giữ làm cả 2 ca (BOTH)
    expect(sales1Tue?.preferenceShift).toBe('BOTH');
    expect(sales1Tue?.shiftCode).toBe('BOTH');
  });
});
