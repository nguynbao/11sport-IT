import { Router } from 'express';
import { holidayRepo } from '../config/db';
import { ApiError } from '../utils/errors';

export const holidaysRouter = Router();

// ============================================================================
// Thuật toán Âm - Dương lịch Việt Nam (Múi giờ UTC+7 - Hồ Ngọc Đức)
// ============================================================================

function INT(d: number): number {
  return Math.floor(d);
}

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

function getNewMoonDay(k: number, timeZone = 7): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) +
    0.0021 * Math.sin(2 * dr * M) -
    0.4068 * Math.sin(Mpr * dr) +
    0.0161 * Math.sin(dr * 2 * Mpr) -
    0.0004 * Math.sin(dr * 3 * Mpr) +
    0.0104 * Math.sin(dr * 2 * F) -
    0.0051 * Math.sin(dr * (M + Mpr)) -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M)) -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr)) +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return INT(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn: number, timeZone = 7): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * INT(L / (Math.PI * 2));
  return INT((L / Math.PI) * 6);
}

function getLunarMonth11(yy: number, timeZone = 7): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone = 7): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

function convertSolar2Lunar(dd: number, mm: number, yy: number, timeZone = 7): {
  day: number;
  month: number;
  year: number;
  leap: number;
} {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

export interface VietnamHolidayItem {
  _id: string;
  date: string;
  name: string;
  note: string;
  isSystemVn?: boolean;
  isOfficialDayOff?: boolean;
  lunarDate?: string;
}

const externalHolidayCache = new Map<number, Array<{ date: string; localName: string; name: string }>>();

async function fetchNagerVietnamHolidays(year: number): Promise<Array<{ date: string; localName: string; name: string }>> {
  if (externalHolidayCache.has(year)) {
    return externalHolidayCache.get(year)!;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/VN`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        externalHolidayCache.set(year, data);
        return data;
      }
    }
  } catch {
    // Fallback sang bộ tính lịch Âm - Dương Việt Nam nội bộ khi offline
  }
  externalHolidayCache.set(year, []);
  return [];
}

/**
 * Tạo danh sách đầy đủ Ngày Lễ Việt Nam (cả Dương lịch và Âm lịch) cho 1 năm bất kỳ.
 */
export async function getVietnamHolidaysForYear(year: number): Promise<VietnamHolidayItem[]> {
  const map = new Map<string, VietnamHolidayItem>();

  const setItem = (date: string, name: string, note: string, isOfficialDayOff = true, lunarDate?: string) => {
    map.set(date, {
      _id: `vn-${date}`,
      date,
      name,
      note,
      isSystemVn: true,
      isOfficialDayOff,
      lunarDate,
    });
  };

  // 1. Lấy từ Public API Nager.Date (nếu có mạng)
  const nagerList = await fetchNagerVietnamHolidays(year);
  for (const item of nagerList) {
    if (item?.date) {
      setItem(
        item.date,
        item.localName || item.name || 'Ngày lễ Việt Nam',
        'Ngày nghỉ lễ chính thức theo quy định Nhà nước',
        true
      );
    }
  }

  // 2. Các ngày lễ Dương lịch cố định tại Việt Nam
  setItem(`${year}-01-01`, 'Tết Dương Lịch', 'Nghỉ lễ toàn quốc (01 ngày)', true);
  setItem(`${year}-03-08`, 'Quốc tế Phụ nữ 8/3', 'Ngày lễ kỷ niệm tại Việt Nam', false);
  setItem(`${year}-04-30`, 'Ngày Giải Phóng Miền Nam', 'Nghỉ lễ toàn quốc 30/4', true);
  setItem(`${year}-05-01`, 'Ngày Quốc Tế Lao Động', 'Nghỉ lễ toàn quốc 1/5', true);
  setItem(`${year}-06-01`, 'Ngày Quốc Tế Thiếu Nhi', 'Ngày lễ thiếu nhi 1/6', false);
  setItem(`${year}-09-01`, 'Nghỉ Lễ Quốc Khánh (1/9)', 'Nghỉ lễ Quốc khánh liền kề', true);
  setItem(`${year}-09-02`, 'Quốc Khánh Việt Nam 2/9', 'Nghỉ lễ Quốc khánh toàn quốc', true);
  setItem(`${year}-10-20`, 'Ngày Phụ Nữ Việt Nam 20/10', 'Ngày lễ tôn vinh Phụ nữ Việt Nam', false);
  setItem(`${year}-11-20`, 'Ngày Nhà Giáo Việt Nam 20/11', 'Ngày lễ tri ân Nhà giáo Việt Nam', false);
  setItem(`${year}-12-24`, 'Lễ Giáng Sinh (Noel)', 'Đêm Giáng Sinh 24/12', false);

  // 3. Quét toàn bộ các ngày trong năm để xác định chính xác các ngày lễ Âm lịch Việt Nam
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const sDay = d.getDate();
    const sMonth = d.getMonth() + 1;
    const sYear = d.getFullYear();
    const dateStr = `${sYear}-${String(sMonth).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`;

    const lunar = convertSolar2Lunar(sDay, sMonth, sYear);
    if (lunar.leap === 1) continue;

    const lunarLabel = `${lunar.day}/${lunar.month} ÂL`;

    // Kiểm tra ngày cuối năm Âm lịch (Giao thừa: 29 hoặc 30 tháng Chạp)
    if (lunar.month === 12 && (lunar.day === 29 || lunar.day === 30)) {
      const nextDate = new Date(d);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextLunar = convertSolar2Lunar(
        nextDate.getDate(),
        nextDate.getMonth() + 1,
        nextDate.getFullYear()
      );
      if (nextLunar.month === 1 && nextLunar.day === 1) {
        setItem(dateStr, `Giao Thừa Tết Nguyên Đán (${lunar.day} Tết)`, `Nghỉ Tết Âm lịch (${lunarLabel})`, true, lunarLabel);
      } else if (lunar.day === 29) {
        setItem(dateStr, 'Nghỉ Tết Nguyên Đán (29 Tết)', `Nghỉ Tết Âm lịch (${lunarLabel})`, true, lunarLabel);
      }
    }

    if (lunar.month === 1 && lunar.day === 1) {
      setItem(dateStr, 'Mùng 1 Tết Nguyên Đán', 'Nghỉ lễ Tết Cổ truyền Việt Nam (1/1 ÂL)', true, lunarLabel);
    } else if (lunar.month === 1 && lunar.day === 2) {
      setItem(dateStr, 'Mùng 2 Tết Nguyên Đán', 'Nghỉ lễ Tết Cổ truyền Việt Nam (2/1 ÂL)', true, lunarLabel);
    } else if (lunar.month === 1 && lunar.day === 3) {
      setItem(dateStr, 'Mùng 3 Tết Nguyên Đán', 'Nghỉ lễ Tết Cổ truyền Việt Nam (3/1 ÂL)', true, lunarLabel);
    } else if (lunar.month === 1 && lunar.day === 4) {
      setItem(dateStr, 'Mùng 4 Tết Nguyên Đán', 'Nghỉ lễ Tết Cổ truyền Việt Nam (4/1 ÂL)', true, lunarLabel);
    } else if (lunar.month === 1 && lunar.day === 5) {
      setItem(dateStr, 'Mùng 5 Tết Nguyên Đán', 'Nghỉ lễ Tết Cổ truyền Việt Nam (5/1 ÂL)', true, lunarLabel);
    } else if (lunar.month === 1 && lunar.day === 15) {
      setItem(dateStr, 'Tết Nguyên Tiêu (Rằm Tháng Giêng)', 'Rằm tháng Giêng (15/1 ÂL)', false, lunarLabel);
    } else if (lunar.month === 3 && lunar.day === 10) {
      setItem(dateStr, 'Giỗ Tổ Hùng Vương (10/3 ÂL)', 'Nghỉ lễ toàn quốc Mùng 10 tháng 3 Âm lịch', true, lunarLabel);
    } else if (lunar.month === 7 && lunar.day === 15) {
      setItem(dateStr, 'Lễ Vu Lan (Rằm Tháng 7)', 'Lễ Vu Lan báo hiếu (15/7 ÂL)', false, lunarLabel);
    } else if (lunar.month === 8 && lunar.day === 15) {
      setItem(dateStr, 'Tết Trung Thu (15/8 ÂL)', 'Rằm tháng Tám Âm lịch', false, lunarLabel);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Hợp nhất lịch lễ Việt Nam + ngày lễ công ty trong DB (DB ưu tiên, marker __DELETED__ để ẩn).
 * Dùng chung cho GET /holidays và Bảng công tháng.
 */
export async function getMergedHolidayMap(years: number[]): Promise<Map<string, any>> {
  const dbHolidays = await holidayRepo.find({});
  const vnLists = await Promise.all(years.map((y) => getVietnamHolidaysForYear(y)));
  const mergedMap = new Map<string, any>();

  for (const list of vnLists) {
    for (const item of list) {
      mergedMap.set(item.date, item);
    }
  }

  for (const dbItem of dbHolidays) {
    if (dbItem.name === '__DELETED__') {
      mergedMap.delete(dbItem.date);
    } else {
      const vnMatch = mergedMap.get(dbItem.date);
      // Nếu ngày trong DB trùng với lịch lễ chuẩn VN, giữ chuẩn phân loại Lễ chính thức vs Sự kiện của VN
      const resolvedOfficial =
        vnMatch && dbItem.name === vnMatch.name
          ? Boolean(vnMatch.isOfficialDayOff)
          : typeof dbItem.isOfficialDayOff === 'boolean'
          ? dbItem.isOfficialDayOff
          : vnMatch
          ? Boolean(vnMatch.isOfficialDayOff)
          : true;

      mergedMap.set(dbItem.date, {
        ...(typeof (dbItem as any).toObject === 'function' ? (dbItem as any).toObject() : dbItem),
        isOfficialDayOff: resolvedOfficial,
        lunarDate: dbItem.lunarDate || vnMatch?.lunarDate || undefined,
      });
    }
  }
  return mergedMap;
}

// GET /api/v1/holidays
holidaysRouter.get('/holidays', async (req, res, next) => {
  try {
    const requestedYear = Number(req.query.year) || new Date().getFullYear();

    // Lấy lịch lễ Việt Nam cho năm được chọn (cùng năm trước & năm sau để chuyển tháng mượt)
    const yearsToLoad = req.query.year
      ? [requestedYear]
      : [requestedYear - 1, requestedYear, requestedYear + 1];
    const mergedMap = await getMergedHolidayMap(yearsToLoad);

    const result = Array.from(mergedMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      data: result,
      meta: { total: result.length, year: requestedYear },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/holidays/sync-vn (Đồng bộ ngày lễ Việt Nam của năm vào DB)
holidaysRouter.post('/holidays/sync-vn', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền đồng bộ ngày lễ');
    }

    const year = Number(req.body?.year) || new Date().getFullYear();
    const vnHolidays = await getVietnamHolidaysForYear(year);
    let syncedCount = 0;

    for (const item of vnHolidays) {
      const existing = await holidayRepo.findOne({ date: item.date });
      if (!existing) {
        await holidayRepo.create({
          date: item.date,
          name: item.name,
          note: item.note,
          isOfficialDayOff: Boolean(item.isOfficialDayOff),
          lunarDate: item.lunarDate || '',
        });
        syncedCount++;
      } else {
        await holidayRepo.updateById(existing._id, {
          name: item.name,
          note: item.note,
          isOfficialDayOff: Boolean(item.isOfficialDayOff),
          lunarDate: item.lunarDate || '',
        });
        syncedCount++;
      }
    }

    res.json({
      data: { year, syncedCount, totalVietnamHolidays: vnHolidays.length },
      meta: { message: `Đã đồng bộ ${totalLabel(syncedCount, vnHolidays.length)} ngày lễ Việt Nam năm ${year}` },
    });
  } catch (err) {
    next(err);
  }
});

function totalLabel(synced: number, total: number): string {
  return synced > 0 ? `${synced}/${total}` : `${total}`;
}

// POST /api/v1/holidays (HR / Admin tạo hoặc cập nhật ngày lễ)
holidaysRouter.post('/holidays', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền tạo ngày lễ');
    }

    const { date, name, note = '', isOfficialDayOff = true } = req.body || {};
    if (!date || !name) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ngày lễ và tên ngày lễ bắt buộc nhập');
    }

    const cleanDate = String(date).trim();
    const existing = await holidayRepo.findOne({ date: cleanDate });
    if (existing) {
      if (existing.name === '__DELETED__') {
        const revived = await holidayRepo.updateById(existing._id, {
          name: String(name).trim(),
          note: String(note).trim(),
          isOfficialDayOff: Boolean(isOfficialDayOff),
        });
        return res.status(201).json({
          data: revived,
          meta: { message: 'Thêm ngày lễ thành công' },
        });
      }
      throw new ApiError(400, 'DUPLICATE_HOLIDAY', 'Ngày này đã được cấu hình ngày lễ rồi');
    }

    const created = await holidayRepo.create({
      date: cleanDate,
      name: String(name).trim(),
      note: String(note).trim(),
      isOfficialDayOff: Boolean(isOfficialDayOff),
    });

    res.status(201).json({
      data: created,
      meta: { message: 'Thêm ngày lễ thành công' },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/holidays/:id
holidaysRouter.delete('/holidays/:id', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !['ADMIN', 'HR'].includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Chỉ HR hoặc ADMIN mới có quyền xóa ngày lễ');
    }

    const { id } = req.params;

    // Nếu xóa một ngày lễ mặc định của Việt Nam (id dạng vn-YYYY-MM-DD)
    if (id.startsWith('vn-')) {
      const dateStr = id.replace(/^vn-/, '');
      const existing = await holidayRepo.findOne({ date: dateStr });
      if (existing) {
        await holidayRepo.updateById(existing._id, { name: '__DELETED__', note: '' });
      } else {
        await holidayRepo.create({ date: dateStr, name: '__DELETED__', note: '' });
      }
      return res.json({
        data: { success: true },
        meta: { message: 'Đã xóa ngày lễ' },
      });
    }

    const deleted = await holidayRepo.deleteById(id);
    if (!deleted) {
      throw new ApiError(404, 'HOLIDAY_NOT_FOUND', 'Không tìm thấy ngày lễ');
    }

    res.json({
      data: { success: true },
      meta: { message: 'Đã xóa ngày lễ' },
    });
  } catch (err) {
    next(err);
  }
});
