# Graph Report - 11sport-IT  (2026-11-12)

## Corpus Check
- 167 files · ~382,462 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 1685 nodes · 3996 edges · 94 communities (84 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3b4fb8b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- productCode.ts
- RevenueDashboardModule.tsx
- attendance.ts
- exports.ts
- WiseCalculatorStash.tsx
- ref_next
- InventoryModule.tsx
- cms/src/lib/api.ts
- fileImportParser.ts
- server/package.json
- web/src/lib/api.ts
- cms/package.json
- web/package.json
- MyAttendanceCalendar.tsx
- leaveRequests.ts
- windowsPrinter.ts
- attendanceTimesheet.ts
- PosServiceSection.tsx
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- createApp
- promotions.ts
- reports.ts
- compilerOptions
- Repository
- compilerOptions
- cms/src/components/BarcodeLabelModal.tsx
- AttendanceTimesheetModule.tsx
- services
- CameraScannerModal.tsx
- TagCheckScannerModal.tsx
- compilerOptions
- web
- volumes
- server
- 2. Danh sách Endpoints
- Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0
- cms/src/app/page.tsx
- PosTab.tsx
- 2. Đặc tả Chi tiết Các Màn hình & Wireframe
- PosTab.tsx
- cms
- environment
- healthcheck
- mongodb
- 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)
- pre-commit-graphify.sh
- Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS
- db.ts
- Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)
- services.ts
- Dự án bán hàng 11 Sport
- Dự án bán hàng 11 Sport
- Design System - 11Sport (POS, Kho & CMS)
- StockMovement
- wise.ts
- cms/next.config.mjs
- ShiftScheduleModule.tsx
- productsInventory.ts
- Skill GitHub gợi ý cho từng phòng ban
- Hợp đồng API (API Contract) - 11 Sport (v1.0)
- Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)
- holidays.ts
- start-dev.sh
- web/src/components/BarcodeLabelModal.tsx
- shifts.ts
- imports.ts
- PosServiceSection.tsx
- HrmAttendanceModule.tsx
- ordersCustomers.ts
- ApiError
- StaffModule.tsx
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- RevenueDashboardModule.tsx
- fileImportParser.ts
- web/src/lib/barcodeScanner.ts
- ocr-speed.test.ts
- staffImportParser.ts
- preparePreview
- 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`)
- utils/search.ts
- 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*
- WiseCalculatorStash.tsx
- Baseline kiểm thử server — 2026-11-12
- 5. User Stories & Tiêu chí nghiệm thu (Acceptance Criteria)
- ShiftHandoverModule.tsx
- Attendance.ts
- 5. Sao lưu & Khôi phục Cơ sở dữ liệu (MongoDB Backup & Restore)
- preparePreview

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 45 edges
2. `PosTab()` - 31 edges
3. `InventoryModule()` - 30 edges
4. `apiRequest()` - 30 edges
5. `apiRequest()` - 28 edges
6. `createApp()` - 26 edges
7. `seedDatabaseIfNeeded()` - 26 edges
8. `connectDatabase()` - 24 edges
9. `generateVariantProductCode()` - 23 edges
10. `CmsDashboardPage()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)` --references--> `StockMovement`  [INFERRED]
  docs/devops/deployment-and-runbook.md → cms/src/lib/api.ts
- `4. Tiêu chí Nghiệm thu (Acceptance Criteria)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts
- `Nguyên nhân gốc — MỘT nguyên nhân chung` --references--> `ocrScanTag()`  [INFERRED]
  docs/test/baseline-2026-11-12.md → server/src/utils/ocr.ts
- `Tiến độ dự án 11 Sport` --references--> `InventoryModule()`  [INFERRED]
  docs/status.md → cms/src/components/InventoryModule.tsx
- `8. Tác động theo phần` --references--> `buildClientFallbackDashboard()`  [INFERRED]
  docs/requirements/doanh-thu-dashboard.md → cms/src/components/RevenueDashboardModule.tsx

## Import Cycles
- None detected.

## Communities (94 total, 10 thin omitted)

### Community 0 - "productCode.ts"
Cohesion: 0.13
Nodes (37): ensureStandardProductCodesMigrated(), findRowByKnownBarcode(), rowsToImportItems(), buildTagCodes(), buildCompactColorToken(), compactColorTokenForBarcode(), estimateCode128Dots(), ExtractedProductVariantInfo (+29 more)

### Community 1 - "RevenueDashboardModule.tsx"
Cohesion: 0.14
Nodes (27): DebtManagementModuleProps, ExportExcelButton(), ExportExcelButtonProps, InvoicePdfModalProps, buildFallbackPushProducts(), MarketingPushProductsModule(), parseLocalDateBound(), PushProductsReportResponse (+19 more)

### Community 2 - "attendance.ts"
Cohesion: 0.21
Nodes (16): attendanceConfigRepo, attendanceRepo, leaveRequestRepo, shiftHandoverRepo, attendanceRouter, extractClientIp(), fetchCurrentPublicWanIp(), getEnvAttendanceConfig() (+8 more)

### Community 3 - "exports.ts"
Cohesion: 0.11
Nodes (36): ROLE_LABEL, StaffActivityModule(), toInputDate(), ViewTab, DailyRevenueTrend, formatVariantLabel(), RevenueByCategory, RevenueDashboardData (+28 more)

### Community 4 - "WiseCalculatorStash.tsx"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 5 - "ref_next"
Cohesion: 0.17
Nodes (7): dynamic, revalidate, dynamic, revalidate, callWiseQuotes(), GET(), WISE_BASE_URL

### Community 6 - "InventoryModule.tsx"
Cohesion: 0.12
Nodes (33): ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch(), resolveVariantColorHexes(), sanitizeHexList(), SPORT_COLOR_PALETTE (+25 more)

### Community 7 - "cms/src/lib/api.ts"
Cohesion: 0.06
Nodes (48): AttendanceConfig, buildCompactColorTokenFE(), compactColorTokenForBarcode(), DebtAdjustmentRecord, DebtCustomerSummary, DebtManagementData, DebtPaymentRecord, DebtStatus (+40 more)

### Community 8 - "fileImportParser.ts"
Cohesion: 0.27
Nodes (10): colLettersToIndex(), convertMatrixToImportRows(), decodeXmlEntities(), extractTextFromPdfBuffer(), extractZipEntries(), parseCleanInt(), parseCleanMoney(), ParsedImportFileRow (+2 more)

### Community 9 - "server/package.json"
Cohesion: 0.07
Nodes (37): cors, mongodb-memory-server, tesseract.js, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies (+29 more)

### Community 10 - "web/src/lib/api.ts"
Cohesion: 0.06
Nodes (44): buildCompactColorTokenFE(), ContractType, DailyHandoverCategoryInfo, DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus, Department, EffectivePromotionStatus (+36 more)

### Community 11 - "cms/package.json"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 12 - "web/package.json"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 13 - "MyAttendanceCalendar.tsx"
Cohesion: 0.06
Nodes (70): AccountProfileTabProps, AttendanceModal(), Props, addLocalDays(), DAY_NAMES, FridayShiftRegistrationModal(), getNextMondayLocalStr(), pad2() (+62 more)

### Community 14 - "leaveRequests.ts"
Cohesion: 0.17
Nodes (23): applyManualOffForStaffDate(), addDaysToDateStr(), assertAdvanceNoticeForLeaveRequest(), assertPaidLeaveQuota(), assertSalesUnpaidOffQuota(), computePaidLeaveBalanceForStaff(), diffCalendarDays(), diffMonthsInclusive() (+15 more)

### Community 15 - "windowsPrinter.ts"
Cohesion: 0.18
Nodes (15): printersRouter, CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter(), LabelPrintItem (+7 more)

### Community 16 - "attendanceTimesheet.ts"
Cohesion: 0.20
Nodes (15): shiftAssignmentRepo, attendanceTimesheetRouter, buildTimesheet(), combineDateAndMinutes(), computeAttendanceMetrics(), getLateToleranceMinutes(), getOfficeWorkdays(), getOvertimeMinMinutes() (+7 more)

### Community 17 - "PosServiceSection.tsx"
Cohesion: 0.13
Nodes (38): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), toIsoDateSlice(), ContractFilePreviewModal() (+30 more)

### Community 18 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.11
Nodes (18): Holiday, 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions) (+10 more)

### Community 19 - "createApp"
Cohesion: 0.18
Nodes (23): An toàn DB, supertest, vitest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), getDbMode() (+15 more)

### Community 20 - "promotions.ts"
Cohesion: 0.13
Nodes (20): promotionRepo, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct, IPromotionGiftItem, PromotionConditionCategorySchema, PromotionConditionProductSchema, PromotionConditionType (+12 more)

### Community 21 - "reports.ts"
Cohesion: 0.09
Nodes (20): dotenv, importReceiptRepo, orderRepo, productRepo, returnExchangeRepo, DebtOrderRow, ProdStat, PushProdStat (+12 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 23 - "Repository"
Cohesion: 0.14
Nodes (6): CollectionRecord, generateObjectId(), matchFilter(), MemoryStore, memoryStore, Repository

### Community 24 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 25 - "cms/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.23
Nodes (13): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+5 more)

### Community 26 - "AttendanceTimesheetModule.tsx"
Cohesion: 0.08
Nodes (42): AttendanceTimesheetModule(), CELL_STYLE, CellDetailModal(), EditTarget, formatMinutes(), hasIssue(), HOURS_24, IssueFilter (+34 more)

### Community 27 - "services"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 28 - "CameraScannerModal.tsx"
Cohesion: 0.16
Nodes (19): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0), CameraScannerModal(), CameraScannerModalProps, compressImageToDataUrl() (+11 more)

### Community 29 - "TagCheckScannerModal.tsx"
Cohesion: 0.23
Nodes (13): Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase, ResultKind, scannedOf() (+5 more)

### Community 30 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 31 - "web"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 32 - "volumes"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 33 - "server"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 34 - "2. Danh sách Endpoints"
Cohesion: 0.13
Nodes (15): 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)*, 2.16 Chuẩn Hóa In Tem Nhiệt Code 128 Sắc Nét 203 DPI & Rút Gọn Mã Quét Chống Tràn Lề (`toCompactBarcode128`) *(v3.4)*, 2.17 Mua Công Nợ (Mua Trước Trả Sau) Tại Quầy POS & Quản Lý Thu Nợ Trên CMS Dashboard *(v3.5)* (+7 more)

### Community 35 - "Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging), 4. Kiểm tra Sức khỏe Hệ thống (Healthcheck & Giám sát), 6.1 Quy trình Triển khai (CI/CD & Release), 6.2 Quy trình Rollback khi gặp sự cố, 6. Quy trình Triển khai & Rollback Khẩn cấp (+3 more)

### Community 36 - "cms/src/app/page.tsx"
Cohesion: 0.12
Nodes (38): CMS_MENU_ITEMS, CmsDashboardPage(), CmsModuleType, ROLE_ALLOWED_MODULES, AccountProfileModule(), getRoleDisplayName(), toIsoDateSlice(), CategoryModule() (+30 more)

### Community 37 - "PosTab.tsx"
Cohesion: 0.12
Nodes (24): PushProductsReportResponse, CartItem, createDraft(), createEmptyDraftData(), DraftOrder, DraftOrderData, generateDraftId(), getCartLineKey() (+16 more)

### Community 38 - "2. Đặc tả Chi tiết Các Màn hình & Wireframe"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 39 - "PosTab.tsx"
Cohesion: 0.19
Nodes (25): ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch(), resolveVariantColorHexes(), sanitizeHexList(), SPORT_COLOR_PALETTE (+17 more)

### Community 40 - "cms"
Cohesion: 0.22
Nodes (9): command, container_name, image, networks, ports, restart, volumes, working_dir (+1 more)

### Community 41 - "environment"
Cohesion: 0.31
Nodes (9): environment, CORS_ORIGINS, JWT_SECRET, MONGODB_URI, NEXT_PUBLIC_API_URL, NODE_ENV, PORT, environment (+1 more)

### Community 42 - "healthcheck"
Cohesion: 0.56
Nodes (9): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck (+1 more)

### Community 43 - "mongodb"
Cohesion: 0.22
Nodes (9): MONGO_INITDB_DATABASE, container_name, environment, image, networks, ports, restart, volumes (+1 more)

### Community 44 - "2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)"
Cohesion: 0.22
Nodes (8): 1. Thống kê Lỗi theo Mức độ, 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved), 3. Kiểm thử Phi chức năng & Bảo mật cơ bản, BUG-01: Nút chuyển nhanh vai trò (Quick Login) trên `web/` và `cms/` gửi mật khẩu mặc định chưa khớp với dữ liệu Seed của `server/`, BUG-02: Xử lý dữ liệu phản hồi tại `ImportTab.tsx` khi gọi `POST /api/v1/imports/:id/complete`, BUG-03: Hiển thị mã phiếu Trả/Đổi trong thông báo thành công tại `ReturnExchangeTab.tsx`, BUG-04: Bảng hóa đơn khổ K80 bị tràn ngang do mã sản phẩm dài và dính nền trang khi bấm In PDF, Báo cáo Lỗi (Bug Report) - 11Sport (v1.0)

### Community 46 - "Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS"
Cohesion: 0.25
Nodes (7): 1.1. Môi trường & Base URL, 1.2. Cơ chế Xác thực & Bảo mật (Authentication & Security), 1. Tổng quan về Wise API (Wise Platform / Payouts API), 2. Kiến trúc 5 bước chuẩn của Wise API, 3. Thiết kế UX/UI trên POS (`web/`) — Nút Stash Máy tính Wise, Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS, Đặc thù kỹ thuật quan trọng với đồng `VND` trên Wise API:

### Community 47 - "db.ts"
Cohesion: 0.06
Nodes (44): mongoose, holidayRepo, AttendanceConfigModel, AttendanceConfigSchema, IAttendanceConfig, CategoryModel, CategorySchema, CategoryStatus (+36 more)

### Community 48 - "Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 49 - "services.ts"
Cohesion: 0.10
Nodes (17): customerRepo, serviceOrderRepo, serviceTypeRepo, IServiceOrder, IServiceOrderItem, IServicePaymentRecord, ServiceOrderItemSchema, ServiceOrderModel (+9 more)

### Community 50 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 51 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 52 - "Design System - 11Sport (POS, Kho & CMS)"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 53 - "StockMovement"
Cohesion: 0.20
Nodes (11): StockMovement, 2.3 Kho hàng, Sản phẩm & Sổ kho (`/products`, `/inventory`), 2.4 Nhập kho (`/imports`), 2.5 Bán hàng POS & Khách hàng (`/orders`, `/customers`), 2.6 Trả / Đổi hàng (`/returns`), 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement), 3.3 Nhập kho (Import Receipt) (+3 more)

### Community 54 - "wise.ts"
Cohesion: 0.18
Nodes (9): express, parseMonthYear(), requireHr(), fetchWiseQuoteRaw(), getWiseConfig(), SUPPORTED_CURRENCIES, WiseCurrencyInfo, wiseRouter (+1 more)

### Community 56 - "ShiftScheduleModule.tsx"
Cohesion: 0.18
Nodes (16): addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf(), mondayOf(), pad(), ROWS (+8 more)

### Community 57 - "productsInventory.ts"
Cohesion: 0.07
Nodes (56): 1. Hiện trạng đã xác minh trong code, stockMovementRepo, DebtAdjustmentRecordSchema, DebtPaymentRecordSchema, DebtStatus, DiscountType, IDebtAdjustmentRecord, IDebtPaymentRecord (+48 more)

### Community 58 - "Skill GitHub gợi ý cho từng phòng ban"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 61 - "Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)"
Cohesion: 0.33
Nodes (5): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 4. Tiêu chí Nghiệm thu (Acceptance Criteria), Phạm vi hệ thống (3 thành phần), Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)

### Community 67 - "holidays.ts"
Cohesion: 0.30
Nodes (13): convertSolar2Lunar(), externalHolidayCache, fetchNagerVietnamHolidays(), getLeapMonthOffset(), getLunarMonth11(), getMergedHolidayMap(), getNewMoonDay(), getSunLongitude() (+5 more)

### Community 69 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.18
Nodes (17): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+9 more)

### Community 70 - "shifts.ts"
Cohesion: 0.19
Nodes (17): ADVANCE_NOTICE_DAYS_REQUIRED, SALES_MAX_UNPAID_OFF_PER_WEEK_SHIFT_REG, addDaysStr(), buildDeterministicPermutation(), computeDailyHandoverCheck(), expireStalePendingHandovers(), getCurrentMondayStr(), getNextMondayStr() (+9 more)

### Community 71 - "imports.ts"
Cohesion: 0.23
Nodes (13): applyMatchedScan(), enrichReceiptRoles(), importsRouter, inferReceiptActorRole(), inferRole(), isFullItem(), normalizeImportItems(), parseCostPrice() (+5 more)

### Community 72 - "PosServiceSection.tsx"
Cohesion: 0.18
Nodes (14): addDaysStr(), formatShortDate(), getTodayStr(), PaymentTimingMode, PosServiceSection(), ServiceCartLine, STATUS_BADGE_MAP, formatNumberDots() (+6 more)

### Community 73 - "HrmAttendanceModule.tsx"
Cohesion: 0.36
Nodes (9): HrmAttendanceModule(), SubTab, createHolidayApi(), deleteHolidayApi(), fetchHolidays(), fetchLeaveRequests(), fetchShiftSchedule(), reviewLeaveRequestApi() (+1 more)

### Community 74 - "ordersCustomers.ts"
Cohesion: 0.50
Nodes (4): 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables)

### Community 75 - "ApiError"
Cohesion: 0.14
Nodes (20): ALLOWED_MIME, buildThinkingConfig(), callGeminiModel(), callGeminiTable(), callGeminiTag(), DEFAULT_TABLE_MODELS, DEFAULT_TAG_MODELS, getGeminiModels() (+12 more)

### Community 76 - "StaffModule.tsx"
Cohesion: 0.11
Nodes (21): AccountProfileModuleProps, ContractFilePreviewModal(), ContractFilePreviewModalProps, HeaderAttendanceBar(), localDateStr(), Props, EditableImportRow, formatMoneyInput() (+13 more)

### Community 77 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.20
Nodes (9): 10. Phiếu bàn giao → backend-dev, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên, 9. Điểm mâu thuẫn / cần PM hỏi chủ (+1 more)

### Community 78 - "RevenueDashboardModule.tsx"
Cohesion: 0.10
Nodes (23): staffRepo, attachUserContext(), errorHandler(), Express, Request, ContractType, IStaff, StaffDepartment (+15 more)

### Community 79 - "fileImportParser.ts"
Cohesion: 0.23
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 80 - "web/src/lib/barcodeScanner.ts"
Cohesion: 0.23
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 81 - "ocr-speed.test.ts"
Cohesion: 0.52
Nodes (5): pingKeepAliveOnce(), resolveKeepAliveHealthUrl(), resolveKeepAliveIntervalMs(), startKeepAlive(), app

### Community 82 - "staffImportParser.ts"
Cohesion: 0.23
Nodes (17): parseCsvTextToMatrix(), ColumnKey, inferContractType(), inferRoleAndDepartment(), matchSubHeaderKey(), matchTopHeaderKey(), normalizeCitizenIdCell(), normalizeGenderCell() (+9 more)

### Community 83 - "preparePreview"
Cohesion: 0.47
Nodes (3): metadata, RootLayout(), VersionChecker()

### Community 84 - "2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`)"
Cohesion: 0.67
Nodes (3): 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), A. Danh mục Loại Dịch Vụ (`/service-types`), B. Quản lý Đơn Dịch Vụ (`/service-orders`)

### Community 85 - "utils/search.ts"
Cohesion: 0.27
Nodes (11): categoryRepo, categoriesRouter, boundedEditDistance(), compactAlphaNum(), filterAndRankBySearch(), getWordInitials(), normalizePhoneDigits(), normalizeVietnamese() (+3 more)

### Community 86 - "2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*"
Cohesion: 0.29
Nodes (8): LeaveRequest, ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`)

### Community 87 - "WiseCalculatorStash.tsx"
Cohesion: 0.40
Nodes (4): metadata, RootLayout(), viewport, VersionChecker()

### Community 88 - "Baseline kiểm thử server — 2026-11-12"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 89 - "5. User Stories & Tiêu chí nghiệm thu (Acceptance Criteria)"
Cohesion: 0.33
Nodes (6): 5. User Stories & Tiêu chí nghiệm thu (Acceptance Criteria), US-01: Chấm công kết hợp GPS & Mạng LAN, US-02: Đăng ký lịch bận và Tự động xếp ca Sales, US-03: HR Kéo - Thả xếp ca khi có trùng lịch, US-04: Bàn giao Kho Tầng 1 & Mở khóa Check-out, US-05: Làm tròn Check-in sớm & Tạm dừng Giờ nghỉ trưa

### Community 90 - "ShiftHandoverModule.tsx"
Cohesion: 0.31
Nodes (10): getMonthStartStr(), localDateStr(), ShiftHandoverModule(), shiftLabel(), confirmShiftHandoverApi(), DailyHandoverCheckData, deleteShiftHandoverApi(), fetchDailyHandoverCheckApi() (+2 more)

### Community 91 - "Attendance.ts"
Cohesion: 0.25
Nodes (7): AttendanceCheckInType, AttendanceModel, AttendanceSchema, AttendanceStatus, IAttendance, OvertimeStatus, ShiftCode

### Community 92 - "5. Sao lưu & Khôi phục Cơ sở dữ liệu (MongoDB Backup & Restore)"
Cohesion: 0.29
Nodes (6): 5.1 Sao lưu (Backup), 5.2 Khôi phục (Restore), 5. Sao lưu & Khôi phục Cơ sở dữ liệu (MongoDB Backup & Restore), Tiến độ dự án 11 Sport, TagCheckScannerModalProps, ImportReceipt

### Community 93 - "preparePreview"
Cohesion: 0.40
Nodes (4): preparePreview(), dataUrlToArrayBuffer(), preparePreview(), dataUrlToArrayBuffer()

## Knowledge Gaps
- **1 isolated node(s):** `PATH`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 577 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StockMovement` connect `StockMovement` to `Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0`, `exports.ts`, `InventoryModule.tsx`, `cms/src/lib/api.ts`, `CameraScannerModal.tsx`, `5. Sao lưu & Khôi phục Cơ sở dữ liệu (MongoDB Backup & Restore)`, `Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `PosTab()` (e.g. with `2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*` and `2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi)`) actually correct?**
  _`PosTab()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PATH` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `productCode.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12685560053981107 - nodes in this community are weakly interconnected._
- **Why does `2.6 Trả / Đổi hàng (`/returns`)` connect `StockMovement` to `productsInventory.ts`, `2. Danh sách Endpoints`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Should `RevenueDashboardModule.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13548387096774195 - nodes in this community are weakly interconnected._
- **Why does `executeUnpackSetToRetail()` connect `productsInventory.ts` to `StockMovement`, `wise.ts`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._