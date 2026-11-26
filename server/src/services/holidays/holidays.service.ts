import { holidayRepo } from "../../repositories";
import { ApiError } from "../../shared/errors";
import { convertSolar2Lunar, VietnamHolidayItem } from "./lunarCalendar.rules";

const externalHolidayCache = new Map<
  number,
  Array<{ date: string; localName: string; name: string }>
>();

async function fetchNagerVietnamHolidays(
  year: number
): Promise<Array<{ date: string; localName: string; name: string }>> {
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

/** Tạo danh sách đầy đủ Ngày Lễ Việt Nam (cả Dương lịch và Âm lịch) cho 1 năm bất kỳ. */
export async function getVietnamHolidaysForYear(year: number): Promise<VietnamHolidayItem[]> {
  const map = new Map<string, VietnamHolidayItem>();

  const setItem = (
    date: string,
    name: string,
    note: string,
    isOfficialDayOff = true,
    lunarDate?: string
  ) => {
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

/** Hợp nhất lịch lễ Việt Nam + ngày lễ công ty trong DB (DB ưu tiên, marker __DELETED__ để ẩn). */
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

export async function listHolidays(rawYear?: unknown) {
  const requestedYear = Number(rawYear) || new Date().getFullYear();
  const yearsToLoad = rawYear
    ? [requestedYear]
    : [requestedYear - 1, requestedYear, requestedYear + 1];
  const mergedMap = await getMergedHolidayMap(yearsToLoad);
  const result = Array.from(mergedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { result, requestedYear };
}

export async function syncVietnamHolidays(rawYear?: unknown) {
  const year = Number(rawYear) || new Date().getFullYear();
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

  return { year, syncedCount, totalVietnamHolidays: vnHolidays.length };
}

export async function createHoliday(body: {
  date?: unknown;
  name?: unknown;
  note?: unknown;
  isOfficialDayOff?: unknown;
}) {
  const { date, name, note = '', isOfficialDayOff = true } = body || {};
  if (!date || !name) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Ngày lễ và tên ngày lễ bắt buộc nhập');
  }

  const cleanDate = String(date).trim();
  const existing = await holidayRepo.findOne({ date: cleanDate });
  if (existing) {
    if (existing.name === '__DELETED__') {
      return holidayRepo.updateById(existing._id, {
        name: String(name).trim(),
        note: String(note).trim(),
        isOfficialDayOff: Boolean(isOfficialDayOff),
      });
    }
    throw new ApiError(400, 'DUPLICATE_HOLIDAY', 'Ngày này đã được cấu hình ngày lễ rồi');
  }

  return holidayRepo.create({
    date: cleanDate,
    name: String(name).trim(),
    note: String(note).trim(),
    isOfficialDayOff: Boolean(isOfficialDayOff),
  });
}

export async function deleteHolidayById(id: string): Promise<void> {
  if (id.startsWith('vn-')) {
    const dateStr = id.replace(/^vn-/, '');
    const existing = await holidayRepo.findOne({ date: dateStr });
    if (existing) {
      await holidayRepo.updateById(existing._id, { name: '__DELETED__', note: '' });
    } else {
      await holidayRepo.create({ date: dateStr, name: '__DELETED__', note: '' });
    }
    return;
  }

  const deleted = await holidayRepo.deleteById(id);
  if (!deleted) {
    throw new ApiError(404, 'HOLIDAY_NOT_FOUND', 'Không tìm thấy ngày lễ');
  }
}

