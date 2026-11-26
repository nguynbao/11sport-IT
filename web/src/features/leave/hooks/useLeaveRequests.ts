import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { LeaveRequestType, MyLeaveRequest } from "@/shared/types";
import { cancelLeaveRequestApi, createLeaveRequestApi, fetchMyLeaveRequestsApi } from "../api";
import {
  CONTRACT_LABEL, LEAVE_TYPE_META, fmtDate, isPaidLeaveEligible, toDateStr,
} from "../leave.constants";

export type LeaveFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveRequestFormParams {
  department: string;
  contractType?: string;
  defaultDate?: string;
  defaultFromDate?: string;
  defaultSourceLeaveId?: string;
  defaultType?: LeaveRequestType;
  onSubmitted: (msg: string) => void;
}

export function useLeaveRequestForm({
  department,
  contractType,
  defaultDate,
  defaultFromDate,
  defaultSourceLeaveId,
  defaultType,
  onSubmitted,
}: LeaveRequestFormParams) {
  const isFulltime = isPaidLeaveEligible(contractType);
  const contractLabel = CONTRACT_LABEL[contractType || ""] || "Chưa cập nhật";
  // Luôn hiển thị đủ các loại đơn (kể cả WFH và Xin chuyển ngày off); KHOÁ "Nghỉ phép có lương" nếu chưa phải nhân viên Chính thức
  const types: LeaveRequestType[] = [
    "PAID_LEAVE",
    "OFF",
    "CHANGE_OFF",
    "WFH",
    "LATE",
    "EARLY",
  ];
  const today = toDateStr(new Date());
  const [type, setType] = useState<LeaveRequestType>(
    defaultType && types.includes(defaultType) && (defaultType !== "PAID_LEAVE" || isFulltime)
      ? defaultType
      : isFulltime
        ? "PAID_LEAVE"
        : "OFF"
  );
  const [fromDate, setFromDate] = useState(defaultDate || today);
  const [toDate, setToDate] = useState(defaultDate || today);
  const [changeFromDate, setChangeFromDate] = useState(defaultFromDate || defaultDate || today);
  const [changeToDate, setChangeToDate] = useState(defaultDate && defaultFromDate && defaultDate !== defaultFromDate ? defaultDate : today);
  const [selectedSourceLeaveId, setSelectedSourceLeaveId] = useState<string | undefined>(defaultSourceLeaveId);
  const [existingOffRequests, setExistingOffRequests] = useState<MyLeaveRequest[]>([]);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (type !== "CHANGE_OFF") return;
    fetchMyLeaveRequestsApi()
      .then((res) => {
        const activeOffs = (res || []).filter(
          (l) =>
            (l.type === "OFF" || l.type === "PAID_LEAVE") &&
            (l.status === "APPROVED" || l.status === "PENDING")
        );
        setExistingOffRequests(activeOffs);
        if (!defaultFromDate && activeOffs.length > 0) {
          setChangeFromDate(activeOffs[0].date);
          setSelectedSourceLeaveId(activeOffs[0]._id);
        }
      })
      .catch(() => {
        // ignore
      });
  }, [type, defaultFromDate]);

  const allowRange = type === "PAID_LEAVE" || type === "OFF" || type === "WFH";

  const dates = useMemo(() => {
    if (!allowRange) return [fromDate];
    const out: string[] = [];
    const [y1, m1, d1] = fromDate.split("-").map(Number);
    const [y2, m2, d2] = (toDate || fromDate).split("-").map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    for (let d = new Date(start); d <= end && out.length < 31; d.setDate(d.getDate() + 1)) {
      if (department === "OFFICE" && d.getDay() === 0) continue; // Khối Văn phòng bỏ Chủ nhật
      out.push(toDateStr(d));
    }
    return out;
  }, [allowRange, fromDate, toDate, department]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr("Vui lòng nhập lý do.");
      return;
    }

    if (type === "CHANGE_OFF") {
      if (!changeFromDate || !changeToDate) {
        setErr("Vui lòng chọn đầy đủ ngày off hiện tại và ngày off mới muốn chuyển sang.");
        return;
      }
      if (changeFromDate === changeToDate) {
        setErr("Ngày off mới phải khác với ngày off ban đầu.");
        return;
      }
      setSending(true);
      setErr(null);
      try {
        await createLeaveRequestApi({
          type: "CHANGE_OFF",
          fromDate: changeFromDate,
          date: changeToDate,
          sourceLeaveId: selectedSourceLeaveId,
          reason: reason.trim(),
        });
        onSubmitted(
          `Đã gửi đơn xin chuyển ngày off (${fmtDate(changeFromDate)} → ${fmtDate(changeToDate)}), chờ HR duyệt`
        );
      } catch (e: any) {
        setErr(e?.message || "Không gửi được đơn chuyển ngày off");
      } finally {
        setSending(false);
      }
      return;
    }

    if (allowRange && toDate < fromDate) {
      setErr("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
      return;
    }
    if (dates.length === 0) {
      setErr("Khoảng ngày chọn không có ngày làm việc nào (đã bỏ Chủ nhật).");
      return;
    }
    if (type === "PAID_LEAVE" && dates.length > 7) {
      setErr("Chỉ được sử dụng ngày nghỉ phép cộng dồn tối đa 1 tuần (7 ngày) liên tiếp.");
      return;
    }
    // Kiểm tra thông báo trước 3 tuần (21 ngày) khi dùng từ 2 ngày phép trở đi hoặc Sales nghỉ từ 3 ngày/tuần trở đi
    const needAdvanceNotice =
      (type === "PAID_LEAVE" && dates.length >= 2) ||
      (department === "SALES" && (type === "OFF" || type === "PAID_LEAVE") && dates.length >= 3);
    if (needAdvanceNotice) {
      const [ty, tm, td] = today.split("-").map(Number);
      const [fy, fm, fd] = dates[0].split("-").map(Number);
      const diffDays = Math.round(
        (new Date(fy, fm - 1, fd).getTime() - new Date(ty, tm - 1, td).getTime()) / (24 * 60 * 60 * 1000)
      );
      if (diffDays < 21) {
        setErr(
          type === "PAID_LEAVE" && dates.length >= 2
            ? `Sử dụng từ 2 ngày nghỉ phép trở đi bắt buộc phải tạo đơn trước tối thiểu 3 tuần (21 ngày). Ngày ${fmtDate(dates[0])} chỉ cách hôm nay ${diffDays} ngày.`
            : `Nhân viên Bán hàng nghỉ từ 3 ngày trở đi trong tuần bắt buộc phải tạo đơn trước tối thiểu 3 tuần (21 ngày). Ngày ${fmtDate(dates[0])} chỉ cách hôm nay ${diffDays} ngày.`
        );
        return;
      }
    }
    setSending(true);
    setErr(null);
    const failed: string[] = [];
    for (const date of dates) {
      try {
        await createLeaveRequestApi({ type, date, reason: reason.trim() });
      } catch (e: any) {
        failed.push(`${fmtDate(date)}: ${e?.message || "lỗi"}`);
      }
    }
    setSending(false);
    const ok = dates.length - failed.length;
    if (failed.length && ok === 0) {
      setErr(failed.join("\n"));
      return;
    }
    onSubmitted(
      `Đã gửi ${ok} đơn "${LEAVE_TYPE_META[type].label}"${failed.length ? ` (${failed.length} ngày lỗi/trùng)` : ""}, chờ HR duyệt`
    );
  };

  return {
    isFulltime, contractLabel, types, type, setType,
    fromDate, setFromDate, toDate, setToDate,
    changeFromDate, setChangeFromDate, changeToDate, setChangeToDate,
    setSelectedSourceLeaveId, existingOffRequests, reason, setReason,
    sending, err, allowRange, dates, submit,
  };
}

export function useMyLeaveRequests({
  reloadKey,
  onChanged,
}: {
  reloadKey: number;
  onChanged: (msg: string) => void;
}) {
  const [list, setList] = useState<MyLeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<LeaveFilter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await fetchMyLeaveRequestsApi());
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const counts: Record<LeaveFilter, number> = {
    ALL: list.length,
    PENDING: list.filter((l) => l.status === "PENDING").length,
    APPROVED: list.filter((l) => l.status === "APPROVED").length,
    REJECTED: list.filter((l) => l.status === "REJECTED").length,
  };
  const shown = list.filter((l) => filter === "ALL" || l.status === filter);

  const cancel = async (id: string) => {
    if (!confirm("Hủy đơn này?")) return;
    try {
      await cancelLeaveRequestApi(id);
      onChanged("Đã hủy đơn");
      load();
    } catch (e: any) {
      alert(e?.message || "Không hủy được đơn");
    }
  };

  const FILTERS: [LeaveFilter, string][] = [
    ["ALL", "Tất cả"],
    ["PENDING", "Chờ"],
    ["APPROVED", "Duyệt"],
    ["REJECTED", "Từ chối"],
  ];

  return { list, loading, filter, setFilter, openId, setOpenId, counts, shown, cancel, FILTERS };
}
