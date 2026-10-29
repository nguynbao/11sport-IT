# Tiến độ dự án 11 Sport

Trạng thái: `Backlog` | `Đang làm` | `Chờ review` | `Đang test` | `Xong` | `Bị chặn`

| ID | Task | Phần | Owner | Trạng thái | Phụ thuộc | Ghi chú |
|---|---|---|---|---|---|---|
| INIT-01 | Khởi tạo cấu trúc dự án và hệ thống Multi-Agent 11 Sport | server / web / cms | PM | Xong | - | Đã cấu hình `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `docs/` |
| BA-01 | Phân tích đặc tả v1.0 & làm rõ 9 điểm nghiệp vụ + Tech Stack | docs/requirements | BA | Xong | INIT-01 | Đã chốt trong `docs/requirements/he-thong-pos-kho-v1.md` |
| DES-01 | Thiết kế UI/UX, User Flow & Wireframe cho Web (POS/Kho) và CMS | docs/design | Designer | Xong | BA-01 | Đã tạo `docs/design/design-system.md` & `docs/design/pos-inventory-cms-v1.md` |
| BE-01 | Thiết kế Database Schema & cập nhật API Contract (`docs/api-contract.md`) | server / docs | Backend | Xong | BA-01 | Đã cập nhật đầy đủ `docs/api-contract.md` v1.0 |
| BE-02 | Xây dựng Backend API (`server/`): Auth, Staff, Category, Product, Stock Ledger, Import, Order, Customer, Return | server | Backend | Xong | BE-01 | Đã bàn giao `server/`, PASS 7/7 test suites (AC-01..AC-07) & build TypeScript |
| FE-01 | Xây dựng giao diện CMS (`cms/`): Nhân viên, Category, Kho & Sổ kho, Đơn hàng & PDF | cms | Frontend | Xong | DES-01, BE-01 | Đã bàn giao `cms/`, PASS `npm run build` |
| FE-02 | Xây dựng giao diện Web POS & Kho (`web/`): Kho, Nhập kho 7 bước + Camera, Bán hàng POS, Khách hàng & PDF, Trả/Đổi | web | Frontend | Xong | DES-01, BE-01 | Đã bàn giao `web/`, PASS `npm run build` |
| OPS-01 | Cấu hình Docker, `docker-compose.yml`, môi trường Dev/Prod và tài liệu `docs/devops/` | server / web / cms | DevOps | Xong | BE-01 | Đã bàn giao `.gitignore`, `docker-compose.yml`, `start-dev.ps1`, `docs/devops/deployment-and-runbook.md` |
| QA-01 | Viết Test Cases (`docs/test/`) & Kiểm thử tích hợp toàn hệ thống | docs/test | Tester | Xong | BE-02, FE-01, FE-02 | PASS 18/18 Test Cases & 8/8 API Test Suites (`AC-01`..`AC-07`), 0 lỗi mở |
| FE-03 | Responsive Web (`web/`): header/tab, bảng, modal, POS cho mobile/tablet | web | Frontend | Chờ review | FE-02 | Sửa className/bố cục, không đổi logic |
| BE-03 | Giá gốc (`costPrice`) khi nhập kho + phân quyền giá bán chỉ ADMIN | server / docs | Backend | Chờ review | BE-02 | Cập nhật `docs/api-contract.md` v1.1, test `server/tests/cost-price.test.ts` 3/3 PASS |
| FE-04 | Ô Giá gốc trong phiếu nhập (web) + hiển thị giá gốc/lãi gộp khi đặt giá bán (cms) | web / cms | Frontend | Chờ review | BE-03 | `ImportTab.tsx`, `InventoryModule.tsx` |
| BE-04 | Quét Tag kiểm thực tế v1.2: chỉ đối chiếu + tick xác nhận, không thêm dòng/không đổi SL, xử lý trùng nhiều dòng | server / docs | Backend | Chờ review | BE-02 | `server/src/utils/tagMatch.ts`, test `server/tests/tag-scan.test.ts` 8/8 PASS |
| FE-05 | Màn hình quét Tag liên tục (tự phát hiện tag mới, tự chụp, tiến trình x/y), tự mở sau Hoàn tất kiểm hàng | web | Frontend | Chờ review | BE-04 | `TagCheckScannerModal.tsx`, `ImportTab.tsx` |
| FE-06 | CMS: Xuất Excel (.xlsx) cho Sản phẩm, Báo cáo tồn, Sổ kho, Phiếu nhập (+chi tiết), Đơn hàng (+chi tiết), Trả/Đổi, Category, Nhân viên | cms | Frontend | Chờ review | FE-01 | `cms/src/lib/excel.ts` (không thêm thư viện), `cms/src/lib/exports.ts`, `ExportExcelButton.tsx` |
| BE-05 / FE-07 | Kiểm thực tế v1.3: chụp tag → loading → tick/cảnh báo; ĐẾM TỪNG CHIẾC (`scannedQuantity`), đủ SL mới tick, quét thừa chỉ cảnh báo, hoàn tác, +/- tay | server / web / docs | Backend + Frontend | Chờ review | BE-04, FE-05 | Sửa bug quét chiếc thứ 2 cùng mã bị báo đã kiểm; test `tag-scan.test.ts` 10/10 PASS |
