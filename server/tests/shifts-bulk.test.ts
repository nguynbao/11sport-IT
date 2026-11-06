import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, clearDatabase } from '../src/config/db';
import { seedDatabaseIfNeeded } from '../src/config/seed';

describe('Xếp ca tuần: Sửa & Lưu hàng loạt (PUT /shifts/assign/bulk)', () => {
  const app = createApp();
  let hrToken: string;
  let salesToken: string;
  let salesId: string;
  const weekStart = '2026-11-09';

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

  it('Sales không có quyền lưu lịch ca', async () => {
    const res = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ weekStart, changes: [{ staffId: salesId, date: '2026-11-10', shiftCode: 'SHIFT_1' }] });
    expect(res.status).toBe(403);
  });

  it('Tạo mới -> sửa sang ca khác -> chuyển OFF -> xoá phân ca', async () => {
    // Tạo mới Ca 1 (T3) và Ca 2 (T4)
    const create = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        changes: [
          { staffId: salesId, date: '2026-11-10', dayOfWeek: 2, shiftCode: 'SHIFT_1' },
          { staffId: salesId, date: '2026-11-11', dayOfWeek: 3, shiftCode: 'SHIFT_2' },
        ],
      });
    expect(create.status).toBe(200);
    expect(create.body.data.created).toBe(2);
    let week = await getWeek();
    expect(week.find((a) => a.date === '2026-11-10')?.shiftCode).toBe('SHIFT_1');

    // Sửa: T3 chuyển sang Ca 2, T4 chuyển sang Nghỉ (OFF)
    const edit = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        changes: [
          { staffId: salesId, date: '2026-11-10', dayOfWeek: 2, shiftCode: 'SHIFT_2' },
          { staffId: salesId, date: '2026-11-11', dayOfWeek: 3, shiftCode: 'OFF' },
        ],
      });
    expect(edit.body.data.updated).toBe(2);
    week = await getWeek();
    expect(week.filter((a) => a.date === '2026-11-10')).toHaveLength(1);
    expect(week.find((a) => a.date === '2026-11-10')?.shiftCode).toBe('SHIFT_2');
    expect(week.find((a) => a.date === '2026-11-11')?.shiftCode).toBe('OFF');

    // Xoá phân ca T3 (shiftCode = null)
    const del = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ weekStart, changes: [{ staffId: salesId, date: '2026-11-10', shiftCode: null }] });
    expect(del.body.data.deleted).toBe(1);
    week = await getWeek();
    expect(week.find((a) => a.date === '2026-11-10')).toBeUndefined();
  });

  it('Chặn mã ca sai và danh sách thay đổi rỗng', async () => {
    const bad = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ weekStart, changes: [{ staffId: salesId, date: '2026-11-12', shiftCode: 'SHIFT_9' }] });
    expect(bad.status).toBe(400);

    const empty = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ weekStart, changes: [] });
    expect(empty.status).toBe(400);
  });
});
