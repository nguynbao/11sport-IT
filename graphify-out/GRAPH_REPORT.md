# Graph Report - 11sport-IT  (2026-11-09)

## Corpus Check
- 147 files · ~299,481 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 1454 nodes · 3424 edges · 81 communities (71 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad9ca320`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- attendanceTimesheet.ts
- cms/src/app/page.tsx
- db.ts
- ImportTab.tsx
- web/src/app/page.tsx
- windowsPrinter.ts
- InventoryModule.tsx
- cms/src/lib/api.ts
- exports.ts
- server/package.json
- web/src/lib/api.ts
- cms/package.json
- web/package.json
- MyAttendanceCalendar.tsx
- ApiError
- productCode.ts
- web/src/components/BarcodeLabelModal.tsx
- PosTab.tsx
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
- middleware/auth.ts
- cms/src/lib/search.ts
- 2. Đặc tả Chi tiết Các Màn hình & Wireframe
- ApiError
- cms
- environment
- healthcheck
- mongodb
- 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)
- pre-commit-graphify.sh
- Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS
- WiseCalculatorStash.tsx
- Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)
- excel.ts
- Dự án bán hàng 11 Sport
- Dự án bán hàng 11 Sport
- Design System - 11Sport (POS, Kho & CMS)
- Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- cms/next.config.mjs
- Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)
- ocr-speed.test.ts
- Skill GitHub gợi ý cho từng phòng ban
- Hợp đồng API (API Contract) - 11 Sport (v1.0)
- imports.ts
- productsInventory.ts
- start-dev.sh
- attendance.ts
- ShiftScheduleModule.tsx
- preparePreview
- StockMovement
- ref_react
- importPdfInventory.ts
- shifts.ts
- web/src/lib/barcodeScanner.ts
- filterAndRankBySearch
- utils/search.ts
- 2. Cấu hình Biến môi trường (Environment Variables)
- IProductVariant

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 36 edges
2. `ImportTab()` - 31 edges
3. `apiRequest()` - 31 edges
4. `InventoryModule()` - 30 edges
5. `PosTab()` - 29 edges
6. `apiRequest()` - 25 edges
7. `createApp()` - 23 edges
8. `seedDatabaseIfNeeded()` - 23 edges
9. `generateVariantProductCode()` - 21 edges
10. `WebPosHomePage()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)` --references--> `StockMovement`  [INFERRED]
  docs/devops/deployment-and-runbook.md → cms/src/lib/api.ts
- `3.2 Kế toán Kho & Sổ kho (Stock Movement)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts
- `3.3 Nhập kho (Import Receipt)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts
- `4. Tiêu chí Nghiệm thu (Acceptance Criteria)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/lib/api.ts
- `BUG-02: Xử lý dữ liệu phản hồi tại `ImportTab.tsx` khi gọi `POST /api/v1/imports/:id/complete`` --references--> `ImportTab()`  [INFERRED]
  docs/test/bugs.md → web/src/components/ImportTab.tsx

## Import Cycles
- None detected.

## Communities (81 total, 10 thin omitted)

### Community 0 - "attendanceTimesheet.ts"
Cohesion: 0.14
Nodes (25): attendanceTimesheetRouter, buildTimesheet(), combineDateAndMinutes(), computeAttendanceMetrics(), getOfficeWorkdays(), getOvertimeMinMinutes(), getStandardHours(), pad() (+17 more)

### Community 1 - "cms/src/app/page.tsx"
Cohesion: 0.14
Nodes (32): DebtManagementModule(), DebtManagementModuleProps, InvoicePdfModal(), InvoicePdfModalProps, OrdersReturnsModule(), OrdersReturnsModuleProps, PromotionModule(), toDateTimeLocalInput() (+24 more)

### Community 2 - "db.ts"
Cohesion: 0.06
Nodes (41): mongoose, holidayRepo, AttendanceConfigModel, AttendanceConfigSchema, IAttendanceConfig, CategoryModel, CategorySchema, CategoryStatus (+33 more)

### Community 3 - "ImportTab.tsx"
Cohesion: 0.19
Nodes (27): 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, Tiến độ dự án 11 Sport, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch() (+19 more)

### Community 4 - "web/src/app/page.tsx"
Cohesion: 0.13
Nodes (34): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), AccountProfileTabProps, ContractFilePreviewModal() (+26 more)

### Community 5 - "windowsPrinter.ts"
Cohesion: 0.05
Nodes (50): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+42 more)

### Community 6 - "InventoryModule.tsx"
Cohesion: 0.12
Nodes (33): ColorInputWithPicker(), ColorSwatchBadge(), getColorBoxBorderStyle(), inferColorHexesFromText(), normalizeTextForColorMatch(), resolveVariantColorHexes(), sanitizeHexList(), SPORT_COLOR_PALETTE (+25 more)

### Community 7 - "cms/src/lib/api.ts"
Cohesion: 0.06
Nodes (49): HrmAttendanceModule(), SubTab, AttendanceConfig, buildCompactColorTokenFE(), cleanPhoneDigits(), compactColorTokenForBarcode(), createHolidayApi(), DailyRevenueTrend (+41 more)

### Community 8 - "exports.ts"
Cohesion: 0.22
Nodes (24): formatVariantLabel(), buildSheet(), downloadExcel(), excelFileName(), toDate(), categoryNameOf(), checkersOf(), exportCategories() (+16 more)

### Community 9 - "server/package.json"
Cohesion: 0.07
Nodes (34): cors, mongodb-memory-server, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies, cors@^2.8.5 (+26 more)

### Community 10 - "web/src/lib/api.ts"
Cohesion: 0.07
Nodes (38): buildCompactColorTokenFE(), compactColorTokenForBarcode(), ContractType, DebtPaymentRecord, DebtStatus, Department, EffectivePromotionStatus, estimateCode128Dots() (+30 more)

### Community 11 - "cms/package.json"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 12 - "web/package.json"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 13 - "MyAttendanceCalendar.tsx"
Cohesion: 0.07
Nodes (56): AttendanceModal(), Props, addLocalDays(), DAY_NAMES, FridayShiftRegistrationModal(), getNextMondayLocalStr(), pad2(), Props (+48 more)

### Community 14 - "ApiError"
Cohesion: 0.09
Nodes (25): DebtPaymentRecordSchema, DebtStatus, DiscountType, IDebtPaymentRecord, IOrder, IOrderItem, ISplitPaymentItem, OrderItemSchema (+17 more)

### Community 15 - "productCode.ts"
Cohesion: 0.13
Nodes (35): ensureStandardProductCodesMigrated(), findRowByKnownBarcode(), rowsToImportItems(), buildTagCodes(), ocrScanTag(), buildCompactColorToken(), ExtractedProductVariantInfo, extractVariantFromText() (+27 more)

### Community 16 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.23
Nodes (13): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+5 more)

### Community 17 - "PosTab.tsx"
Cohesion: 0.14
Nodes (17): CartItem, createDraft(), createEmptyDraftData(), DraftOrder, DraftOrderData, generateDraftId(), getCartLineKey(), isDraftEmpty() (+9 more)

### Community 18 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.09
Nodes (22): 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions), 4.1 Cấu hình Ca & Tính Giờ Công (+14 more)

### Community 19 - "createApp"
Cohesion: 0.22
Nodes (19): supertest, vitest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), getDbMode(), seedDatabaseIfNeeded() (+11 more)

### Community 20 - "promotions.ts"
Cohesion: 0.11
Nodes (22): categoryRepo, productRepo, promotionRepo, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct, IPromotionGiftItem, PromotionConditionCategorySchema (+14 more)

### Community 21 - "reports.ts"
Cohesion: 0.10
Nodes (14): express, stockMovementRepo, DebtOrderRow, ProdStat, reportsRouter, SalesActivity, SalesType, WarehouseActivity (+6 more)

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
Cohesion: 0.21
Nodes (14): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+6 more)

### Community 26 - "AttendanceTimesheetModule.tsx"
Cohesion: 0.14
Nodes (23): AttendanceTimesheetModule(), CELL_STYLE, CellDetailModal(), EditTarget, formatMinutes(), hasIssue(), IssueFilter, KpiCard() (+15 more)

### Community 27 - "services"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 28 - "CameraScannerModal.tsx"
Cohesion: 0.27
Nodes (14): CameraScannerModal(), CameraScannerModalProps, compressImageToDataUrl(), createEmptyOcrItem(), loadImageFromFile(), mapApiItems(), mergeOcrItemsList(), PreviewKind (+6 more)

### Community 29 - "TagCheckScannerModal.tsx"
Cohesion: 0.20
Nodes (15): Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase, ResultKind, scannedOf() (+7 more)

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
Cohesion: 0.17
Nodes (12): 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.16 Chuẩn Hóa In Tem Nhiệt Code 128 Sắc Nét 203 DPI & Rút Gọn Mã Quét Chống Tràn Lề (`toCompactBarcode128`) *(v3.4)*, 2.17 Mua Công Nợ (Mua Trước Trả Sau) Tại Quầy POS & Quản Lý Thu Nợ Trên CMS Dashboard *(v3.5)*, 2.1 Xác thực & Nhân viên (`/auth`, `/staff`), 2.2 Danh mục - Category (`/categories`) (+4 more)

### Community 35 - "Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging), 4. Kiểm tra Sức khỏe Hệ thống (Healthcheck & Giám sát), 6.1 Quy trình Triển khai (CI/CD & Release), 6.2 Quy trình Rollback khi gặp sự cố, 6. Quy trình Triển khai & Rollback Khẩn cấp (+3 more)

### Community 36 - "middleware/auth.ts"
Cohesion: 0.13
Nodes (18): attachUserContext(), errorHandler(), Express, Request, ContractType, IStaff, StaffDepartment, StaffModel (+10 more)

### Community 37 - "cms/src/lib/search.ts"
Cohesion: 0.39
Nodes (8): boundedEditDistanceLeq1(), buildAcronym(), compactAlphaNum(), normalizePhoneDigits(), normalizeVietnamese(), PreparedField, scoreSearchMatch(), SearchField

### Community 38 - "2. Đặc tả Chi tiết Các Màn hình & Wireframe"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 39 - "ApiError"
Cohesion: 0.11
Nodes (27): tesseract.js, tesseract.js@^5.1.1, parseMonthYear(), requireHr(), assertAdminRole(), ApiError, ALLOWED_MIME, buildThinkingConfig() (+19 more)

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

### Community 47 - "WiseCalculatorStash.tsx"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 48 - "Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`)"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 49 - "excel.ts"
Cohesion: 0.20
Nodes (16): CellValue, cellXml(), colLetter(), ColumnFormat, crc32(), CRC_TABLE, createXlsx(), escapeXml() (+8 more)

### Community 50 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 51 - "Dự án bán hàng 11 Sport"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 52 - "Design System - 11Sport (POS, Kho & CMS)"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 53 - "Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)"
Cohesion: 0.33
Nodes (5): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 4. Tiêu chí Nghiệm thu (Acceptance Criteria), Phạm vi hệ thống (3 thành phần), Đặc tả Yêu cầu Hệ thống Quản lý Bán hàng & Kho 11Sport (v1.0 - Chính thức)

### Community 54 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.33
Nodes (6): 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement), 3.3 Nhập kho (Import Receipt), 3.4 Bán hàng (POS Order) & Xuất PDF, 3.5 Trả / Đổi hàng (Return & Exchange), 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)

### Community 56 - "Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)"
Cohesion: 0.40
Nodes (4): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)

### Community 57 - "ocr-speed.test.ts"
Cohesion: 0.36
Nodes (7): bootstrap(), PORT, pingKeepAliveOnce(), resolveKeepAliveHealthUrl(), resolveKeepAliveIntervalMs(), startKeepAlive(), app

### Community 58 - "Skill GitHub gợi ý cho từng phòng ban"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 61 - "imports.ts"
Cohesion: 0.14
Nodes (23): applyMatchedScan(), enrichReceiptRoles(), importsRouter, inferReceiptActorRole(), inferRole(), isFullItem(), normalizeImportItems(), parseCostPrice() (+15 more)

### Community 67 - "productsInventory.ts"
Cohesion: 0.22
Nodes (17): keepCheckerFields(), applyPaidOrderSideEffects(), prepareOrderData(), productsInventoryRouter, prepareReturnExchangeCalculation(), returnsRouter, buildVariantKey(), applyFloorDelta() (+9 more)

### Community 69 - "attendance.ts"
Cohesion: 0.10
Nodes (17): attendanceConfigRepo, attendanceRepo, leaveRequestRepo, shiftHandoverRepo, staffRepo, AttendanceCheckInType, AttendanceModel, AttendanceSchema (+9 more)

### Community 70 - "ShiftScheduleModule.tsx"
Cohesion: 0.14
Nodes (20): addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf(), mondayOf(), pad(), ROWS (+12 more)

### Community 71 - "preparePreview"
Cohesion: 0.40
Nodes (4): preparePreview(), dataUrlToArrayBuffer(), preparePreview(), dataUrlToArrayBuffer()

### Community 72 - "StockMovement"
Cohesion: 0.25
Nodes (8): StockMovement, 2.3 Kho hàng, Sản phẩm & Sổ kho (`/products`, `/inventory`), 2.4 Nhập kho (`/imports`), 2.5 Bán hàng POS & Khách hàng (`/orders`, `/customers`), 2.6 Trả / Đổi hàng (`/returns`), 5.1 Sao lưu (Backup), 5.2 Khôi phục (Restore), 5. Sao lưu & Khôi phục Cơ sở dữ liệu (MongoDB Backup & Restore)

### Community 73 - "ref_react"
Cohesion: 0.10
Nodes (33): CMS_MENU_ITEMS, CmsDashboardPage(), CmsModuleType, ROLE_ALLOWED_MODULES, CategoryModule(), ContractFilePreviewModal(), ContractFilePreviewModalProps, ExportExcelButton() (+25 more)

### Community 74 - "importPdfInventory.ts"
Cohesion: 0.17
Nodes (12): dotenv, customerRepo, importReceiptRepo, orderRepo, returnExchangeRepo, apiCall(), buildProductName(), FLOOR_1_ITEMS (+4 more)

### Community 75 - "shifts.ts"
Cohesion: 0.22
Nodes (11): shiftAssignmentRepo, IShiftAssignment, ShiftAssignmentModel, ShiftAssignmentSchema, ShiftType, addDaysStr(), getCurrentMondayStr(), getNextMondayStr() (+3 more)

### Community 76 - "web/src/lib/barcodeScanner.ts"
Cohesion: 0.32
Nodes (12): buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), findProductAndVariantByScannedBarcode(), findProductByScannedBarcode(), getBarcodeCandidates(), isOrderedSubsequence(), isScannedCodeMatch() (+4 more)

### Community 77 - "filterAndRankBySearch"
Cohesion: 0.36
Nodes (9): boundedEditDistanceLeq1(), buildAcronym(), compactAlphaNum(), filterAndRankBySearch(), normalizePhoneDigits(), normalizeVietnamese(), PreparedField, scoreSearchMatch() (+1 more)

### Community 78 - "utils/search.ts"
Cohesion: 0.39
Nodes (8): boundedEditDistance(), compactAlphaNum(), filterAndRankBySearch(), getWordInitials(), normalizePhoneDigits(), normalizeVietnamese(), scoreSearchMatch(), SearchFieldWeight

### Community 79 - "2. Cấu hình Biến môi trường (Environment Variables)"
Cohesion: 0.50
Nodes (4): 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables)

### Community 80 - "IProductVariant"
Cohesion: 0.67
Nodes (3): 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)*, IImportReceiptItem, IProductVariant

## Knowledge Gaps
- **1 isolated node(s):** `PATH`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 508 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `IProductVariant` connect `IProductVariant` to `productsInventory.ts`, `db.ts`, `ImportTab.tsx`?**
  _High betweenness centrality (0.268) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `ImportTab()` (e.g. with `2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*` and `Tiến độ dự án 11 Sport`) actually correct?**
  _`ImportTab()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PATH` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `attendanceTimesheet.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14039408866995073 - nodes in this community are weakly interconnected._
- **Why does `2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*` connect `ImportTab.tsx` to `IProductVariant`, `2. Danh sách Endpoints`?**
  _High betweenness centrality (0.258) - this node is a cross-community bridge._
- **Should `cms/src/app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13963963963963963 - nodes in this community are weakly interconnected._
- **Why does `ImportTab()` connect `ImportTab.tsx` to `web/src/app/page.tsx`, `web/src/lib/api.ts`, `2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved)`, `web/src/lib/barcodeScanner.ts`, `filterAndRankBySearch`, `web/src/components/BarcodeLabelModal.tsx`, `CameraScannerModal.tsx`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._