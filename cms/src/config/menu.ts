import type React from "react";
import {
  Boxes,
  TrendingUp,
  FolderKanban,
  ShoppingBag,
  Users,
  Activity,
  Gift,
  Wallet,
  CalendarCheck,
  ClipboardCheck,
  Rocket,
  Wrench,
} from "lucide-react";
import type { CmsModuleType } from "./roles";

export const CMS_MENU_ITEMS: {
  id: CmsModuleType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "amber" | "teal";
}[] = [
    {
      id: "REVENUE",
      label: "Doanh thu",
      desc: "Thống kê doanh thu, lãi gộp, xu hướng & tổng quan công nợ",
      icon: TrendingUp,
    },
    {
      id: "PUSH_PRODUCTS",
      label: "SP Cần đẩy mạnh",
      desc: "Quan sát các mặt hàng tồn kho cao, bán chậm, đọng vốn hoặc nằm ở Kho Tầng 2",
      icon: Rocket,
    },
    {
      id: "INVENTORY",
      label: "Kho & Giá niêm yết",
      desc: "Tồn kho Tầng 1 & Tầng 2, phiếu nhập/xuất, điều chỉnh giá niêm yết",
      icon: Boxes,
    },
    {
      id: "CATEGORIES",
      label: "Danh mục & Sản phẩm",
      desc: "Quản lý Category, Thương hiệu (Brand) và Danh mục Sản phẩm chuẩn mã",
      icon: FolderKanban,
    },
    {
      id: "ORDERS",
      label: "Đơn hàng & Trả/Đổi",
      desc: "Tra cứu hóa đơn POS, bản nháp, lịch sử trả/đổi & in PDF",
      icon: ShoppingBag,
    },
    {
      id: "SERVICES",
      label: "Dịch vụ",
      desc: "Tạo loại dịch vụ (giá mặc định) & theo dõi đơn dịch vụ khách gửi / hẹn trả",
      icon: Wrench,
    },
    {
      id: "STAFF",
      label: "Nhân sự",
      desc: "Danh sách nhân viên và khóa / mở khóa tài khoản",
      icon: Users,
    },
    {
      id: "HRM",
      label: "Chấm công & Xếp ca",
      desc: "Duyệt WFH, kéo-thả xếp ca tuần, quản lý ngày lễ & tạo tài khoản NV",
      icon: CalendarCheck,
    },
    {
      id: "SHIFT_HANDOVERS",
      label: "Bàn giao ca",
      desc: "Theo dõi biên bản chốt két, kiểm hàng Tầng 1 theo ngày (Vợt + ...) & xác nhận Ca 1 - Ca 2",
      icon: ClipboardCheck,
    },
    {
      id: "ACTIVITY",
      label: "Hoạt động NV",
      desc: "Nhật ký hiệu suất bán hàng & kiểm đếm kho theo nhân sự",
      icon: Activity,
    },
    {
      id: "PROMOTIONS",
      label: "Khuyến mãi",
      desc: "Cấu hình giảm giá %, giảm tiền & quà tặng kèm tự động",
      icon: Gift,
    },
    {
      id: "DEBTS",
      label: "Công nợ & Thu nợ",
      desc: "Theo dõi khách mua trước trả sau, cảnh báo quá hạn & tất toán",
      icon: Wallet,
    },
  ];
