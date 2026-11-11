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

  it('Chặn lưu khi Sales chưa đủ 7 ngày hoặc nghỉ quá 4 ngày/tháng; cho phép gộp tối đa 4 ngày OFF trong 1 tuần và các tuần sau nghỉ 0 ngày', async () => {
    const partial = await save(fullWeek(2).slice(0, 2));
    expect(partial.status).toBe(400);
    expect(partial.body.code).toBe('WEEKLY_OFF_REQUIRED');

    // Nghỉ 5 ngày trong 1 tuần -> vượt tối đa 4 ngày/tháng -> chặn 400
    const fiveOff = week.map((date, i) => ({
      staffId: salesId,
      date,
      dayOfWeek: i + 1,
      shiftCode: i < 5 ? 'OFF' : 'SHIFT_1',
    }));
    expect((await save(fiveOff)).status).toBe(400);

    // Lỗi thì không lưu gì
    expect(await getWeek()).toHaveLength(0);

    // Dùng hết cả 4 ngày OFF ngay trong 1 tuần (tuần 09/11..15/11) -> hợp lệ 200
    const fourOffInOneWeek = week.map((date, i) => ({
      staffId: salesId,
      date,
      dayOfWeek: i + 1,
      shiftCode: i < 4 ? 'OFF' : 'SHIFT_1',
    }));
    const okFour = await save(fourOffInOneWeek);
    expect(okFour.status).toBe(200);

    // Sang tuần tiếp theo trong cùng tháng 11 (23/11..29/11): vì đã dùng hết 4 ngày OFF trong tháng 11, nếu xin thêm 1 ngày OFF -> bị chặn 400!
    const week3Start = '2026-11-23';
    const week3 = [
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ];
    const exceedMonth = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart: week3Start,
        changes: week3.map((date, i) => ({
          staffId: salesId,
          date,
          dayOfWeek: i + 1,
          shiftCode: i === 0 ? 'OFF' : 'SHIFT_1',
        })),
      });
    expect(exceedMonth.status).toBe(400);

    // Tuần 23/11..29/11 đi làm cả 7 ngày (0 ngày OFF vì đã hết quota tháng) -> hợp lệ 200!
    const zeroOffWeek3 = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart: week3Start,
        changes: week3.map((date, i) => ({
          staffId: salesId,
          date,
          dayOfWeek: i + 1,
          shiftCode: 'SHIFT_1',
        })),
      });
    expect(zeroOffWeek3.status).toBe(200);

    // Dọn lại dữ liệu tuần 1 & tuần 3 cho các test sau
    await save(week.map((date) => ({ staffId: salesId, date, shiftCode: null })));
    await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart: week3Start,
        changes: week3.map((date) => ({ staffId: salesId, date, shiftCode: null })),
      });
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
    // 1. Sales gửi đăng ký ca sai quy định (5 ngày OFF > 4 ngày/tháng) -> chặn 400
    const badPref = await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        weekStart,
        preferences: week.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i < 5,
          preferenceShift: i < 5 ? 'OFF' : 'SHIFT_1',
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

    // 4. HR bấm "Lưu nháp" (confirmWeek = false): chỉ đổi ca nháp, giữ nguyên assignedBy = 'AUTO', chưa chốt lịch & chưa gửi thông báo
    const hrDraft = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        confirmWeek: false,
        changes: [
          { staffId: salesId, date: '2026-11-11', dayOfWeek: 3, shiftCode: 'SHIFT_2' },
          { staffId: salesId, date: '2026-11-14', dayOfWeek: 6, shiftCode: 'OFF' },
        ],
      });
    expect(hrDraft.status).toBe(200);
    expect(hrDraft.body.data.confirmed).toBe(0);

    const hrViewAfterDraft = await getWeek();
    expect(hrViewAfterDraft.every((a) => a.assignedBy === 'AUTO')).toBe(true);

    const salesAfterDraft = await request(app)
      .get(`/api/v1/shifts/my-schedule?weekStart=${weekStart}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(salesAfterDraft.status).toBe(200);
    expect(salesAfterDraft.body.data.isConfirmedByHr).toBe(false);
    expect(salesAfterDraft.body.data.hasUnseenConfirmedSchedule).toBe(false);

    // 5. HR chỉnh tay ngày OFF sang Chủ Nhật và bấm Xác nhận hoàn tất (confirmWeek = true)
    const hrConfirm = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        confirmWeek: true,
        changes: [
          { staffId: salesId, date: '2026-11-14', dayOfWeek: 6, shiftCode: 'SHIFT_1' },
          { staffId: salesId, date: '2026-11-15', dayOfWeek: 7, shiftCode: 'OFF' },
        ],
      });
    expect(hrConfirm.status).toBe(200);
    expect(hrConfirm.body.data.confirmed).toBe(7);

    // 6. Phía Sales nhận được thông báo chấm đỏ (hasUnseenConfirmedSchedule = true, isConfirmedByHr = true)
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

  it('Giữ đơn OFF (đã duyệt & đang chờ) trong tuần/tháng và ràng buộc Đăng ký ca tối đa 2 ngày nghỉ/tuần (1 OFF + 1 phép; từ 3 ngày phải tạo đơn trước 3 tuần)', async () => {
    const createSales = async (code: string, username: string) => {
      const created = await staffRepo.create({
        code,
        username,
        passwordHash: hashPassword('123456'),
        fullName: `Sales Quota ${code}`,
        phone: '0909888799',
        role: 'SALES',
        department: 'SALES',
        status: 'ACTIVE',
        contractType: 'FULLTIME',
        contractStartDate: '2026-10-01',
      } as any);
      const login = await request(app).post('/api/v1/auth/login').send({ username, password: '123456' });
      return { id: String(created._id), token: login.body.data.token };
    };

    // Case 1: Đơn OFF đã duyệt nằm TRONG tuần đang thay lịch, nhưng lịch mới đặt ngày đó là SHIFT_1 và chọn thêm 4 ngày OFF khác -> tổng thực tế 5 ngày -> phải chặn 400
    const sApproved = await createSales('NV094', 'sales_approved_in_week');
    const leave1 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${sApproved.token}`)
      .send({ type: 'OFF', date: '2026-11-09', reason: 'Xin nghỉ Thứ 2' });
    expect(leave1.status).toBe(201);
    const approve1 = await request(app)
      .patch(`/api/v1/leave-requests/${leave1.body.data._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'APPROVED' });
    expect(approve1.status).toBe(200);

    // Lịch tuần 09/11..15/11 đặt 2026-11-09 là SHIFT_1 nhưng đặt 4 ngày khác (10..13/11) là OFF -> vượt 4 ngày/tháng
    const bulkExceedApprovedInWeek = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        changes: week.map((date, i) => ({
          staffId: sApproved.id,
          date,
          dayOfWeek: i + 1,
          shiftCode: i >= 1 && i <= 4 ? 'OFF' : 'SHIFT_1',
        })),
      });
    expect(bulkExceedApprovedInWeek.status).toBe(400);

    // Với /shifts/preferences: đăng ký ca tuần không cho phép chọn quá 2 ngày nghỉ/tuần (kể cả khi mới dùng 1 đơn OFF) -> chặn 400
    const prefExceedTwoDaysInWeek = await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${sApproved.token}`)
      .send({
        weekStart,
        preferences: week.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i <= 2,
          preferenceShift: i <= 2 ? 'OFF' : 'SHIFT_1',
        })),
      });
    expect(prefExceedTwoDaysInWeek.status).toBe(400);
    expect(prefExceedTwoDaysInWeek.body.code).toBe('WEEKLY_OFF_REQUIRED');

    // Trong /shifts/preferences: nếu chọn 2 ngày đều là OFF không lương (leaveType: 'OFF') -> bị chặn 400 (mặc định chỉ được 1 OFF + 1 phép)
    const prefTwoUnpaidOff = await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${sApproved.token}`)
      .send({
        weekStart,
        preferences: week.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i >= 1 && i <= 2,
          leaveType: i >= 1 && i <= 2 ? 'OFF' : undefined,
          preferenceShift: i >= 1 && i <= 2 ? 'OFF' : 'SHIFT_1',
        })),
      });
    expect(prefTwoUnpaidOff.status).toBe(400);
    expect(prefTwoUnpaidOff.body.code).toBe('WEEKLY_OFF_REQUIRED');

    // Nhưng nếu chọn tối đa 2 ngày nghỉ gồm 1 ngày OFF (2026-11-09) + 1 ngày phép có lương (2026-11-10) -> hợp lệ 200!
    const prefOkOneOffOnePaidLeave = await request(app)
      .post('/api/v1/shifts/preferences')
      .set('Authorization', `Bearer ${sApproved.token}`)
      .send({
        weekStart,
        preferences: week.map((date, i) => ({
          date,
          dayOfWeek: i + 1,
          isOffRequested: i <= 1,
          leaveType: i === 0 ? 'OFF' : i === 1 ? 'PAID_LEAVE' : undefined,
          preferenceShift: i <= 1 ? 'OFF' : 'SHIFT_1',
        })),
      });
    expect(prefOkOneOffOnePaidLeave.status).toBe(200);

    // Case 2: Đơn OFF đang chờ duyệt (PENDING) trong tháng phải được tính khi kiểm tra hạn mức ở /shifts/preferences và /shifts/assign/bulk
    const sPending = await createSales('NV095', 'sales_pending_leave');
    // Tạo 3 đơn OFF ở các tuần khác trong tháng 11 (02/11, 17/11, 25/11 - mỗi tuần 1 ngày nên không vi phạm >= 3 ngày/tuần)
    for (const d of ['2026-11-02', '2026-11-17', '2026-11-25']) {
      const pLeave = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${sPending.token}`)
        .send({ type: 'OFF', date: d, reason: `Xin nghỉ ngày ${d}` });
      expect(pLeave.status).toBe(201);
    }

    // Đã có 3 đơn OFF PENDING ở tuần khác -> tuần 09/11..15/11 chỉ còn tối đa 1 ngày OFF không lương
    const bulkExceedPending = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        changes: week.map((date, i) => ({
          staffId: sPending.id,
          date,
          dayOfWeek: i + 1,
          shiftCode: i < 2 ? 'OFF' : 'SHIFT_1',
        })),
      });
    expect(bulkExceedPending.status).toBe(400);

    // Xếp 1 ngày OFF trong tuần 09/11..15/11 (3 đơn chờ + 1 ngày ca OFF = 4) -> hợp lệ 200
    const bulkOkOne = await request(app)
      .put('/api/v1/shifts/assign/bulk')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        weekStart,
        changes: week.map((date, i) => ({
          staffId: sPending.id,
          date,
          dayOfWeek: i + 1,
          shiftCode: i === 0 ? 'OFF' : 'SHIFT_1',
        })),
      });
    expect(bulkOkOne.status).toBe(200);

    // Case 3: Nếu Sales muốn nghỉ từ 3 ngày trở đi trong 1 tuần bằng Tạo đơn nhưng cách hôm nay < 3 tuần (21 ngày) -> chặn ADVANCE_NOTICE_REQUIRED
    const sThreeDays = await createSales('NV096', 'sales_3days_notice');
    const now = new Date();
    const dayOfWeek = now.getDay();
    const nextMonOffset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + nextMonOffset);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const fmt = (dt: Date) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    const dMon = fmt(nextMon);
    const dTue = fmt(new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() + 1));
    const dWed = fmt(new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() + 2));

    const req1 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${sThreeDays.token}`)
      .send({ type: 'OFF', date: dMon, reason: 'Nghỉ ngày 1' });
    expect(req1.status).toBe(201);

    const req2 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${sThreeDays.token}`)
      .send({ type: 'OFF', date: dTue, reason: 'Nghỉ ngày 2' });
    expect(req2.status).toBe(201);

    // Ngày thứ 3 trong cùng 1 tuần nhưng chỉ cách hôm nay <= 7 ngày (< 21 ngày) -> chặn 400 ADVANCE_NOTICE_REQUIRED
    const req3 = await request(app)
      .post('/api/v1/leave-requests')
      .set('Authorization', `Bearer ${sThreeDays.token}`)
      .send({ type: 'OFF', date: dWed, reason: 'Nghỉ ngày 3 trong tuần' });
    expect(req3.status).toBe(400);
    expect(req3.body.code).toBe('ADVANCE_NOTICE_REQUIRED');
  });
});
