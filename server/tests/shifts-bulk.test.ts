import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

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
});
