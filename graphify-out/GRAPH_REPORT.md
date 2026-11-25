# Graph Report - 11sport-IT  (2026-11-26)

## Corpus Check
- 340 files · ~492,660 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 2566 nodes · 7745 edges · 114 communities (97 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b8d4a0a4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/src/components/MyAttendanceCalendar.tsx
- ok
- shared/lib/search.ts
- cms/src/app/page.tsx
- web/src/lib/api.ts
- seed.ts
- seed.ts
- order.service.ts
- InventoryModule.tsx
- db.ts
- cms/src/lib/api.ts
- types/index.ts
- imports.controller.ts
- AttendanceTimesheetModule.tsx
- ref_react
- cms/scripts/check-architecture.mjs
- web-models.test.ts
- catalog/index.ts
- serviceOrder.service.ts
- imports.ts
- types/storefront.ts
- PosTab.tsx
- productScheme.service.ts
- cms/src/components/MyAttendanceCalendar.tsx
- ocr.ts
- ref_fs
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- scripts
- ApiError
- ProductCatalogModule.tsx
- attendance.service.ts
- getFloorStocks
- promotion.service.ts
- ImportReceipt.ts
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- publicStorefront.ts
- CameraScannerModal.tsx
- ref_next
- windowsPrinter.ts
- danh-muc/[slug]/page.tsx
- ApiError
- web/src/components/HeaderAttendanceBar.tsx
- ocr.ts
- 5. Đặc tả Component cốt lõi (`shop/`)
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- DrawerMenu.tsx
- attendance.ts
- scoreSearchMatch
- Nghiệp vụ Tích hợp ngoài (`integrations/`)
- devDependencies
- Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport
- web/src/app/layout.tsx
- app.ts
- utils/productCode.ts
- staffImportParser.ts
- cms/src/components/BarcodeLabelModal.tsx
- compilerOptions
- normalizeToCompactUpperCode
- Repository
- compilerOptions
- web/src/components/BarcodeLabelModal.tsx
- ShiftHandover.ts
- excel.ts
- 2. Danh sách Endpoints
- middleware/auth.ts
- PosServiceSection.tsx
- cms/src/app/layout.tsx
- cms/src/app/api/printers/route.ts
- 3.1 Public Storefront API (`/api/v1/public/*`)
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- holidays.ts
- services
- shared/productCode.ts
- compilerOptions
- Category.ts
- LeaveRequest.ts
- volumes
- environment
- StockMovement
- web/src/app/page.tsx
- 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*
- shared/lib/excel.ts
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Baseline kiểm thử server — 2026-11-12
- mongoose
- scripts
- 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)
- healthcheck
- ServiceType.ts
- StockMovement.ts
- tagMatch.ts
- check-architecture.mjs
- timesheet.queries.ts
- importScan.service.ts
- return.service.ts
- Kiến trúc Backend (`server/`)
- ensure-ocr-data.sh
- WiseCalculatorStash.tsx
- Nghiệp vụ Ngày lễ (`holidays/`)
- Nghiệp vụ Danh mục & Quy chuẩn mã (`catalog/`)
- Nghiệp vụ Kho hàng (`inventory/`)
- Nghiệp vụ Bán hàng, Khách hàng & Công nợ (`orders/`)
- Nghiệp vụ Sản phẩm (`products/`)
- Nghiệp vụ Đổi / Trả hàng (`returns/`)
- Nghiệp vụ Nhân sự (`staff/`)
- categories.controller.ts

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 173 edges
2. `ok()` - 124 edges
3. `normalizeToCompactUpperCode()` - 58 edges
4. `getFloorStocks()` - 47 edges
5. `apiRequest()` - 46 edges
6. `generateVariantProductCode()` - 38 edges
7. `created()` - 38 edges
8. `InventoryModule()` - 37 edges
9. `PosTab()` - 36 edges
10. `createApp()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `8. Tác động theo phần` --references--> `buildClientFallbackDashboard()`  [INFERRED]
  docs/requirements/doanh-thu-dashboard.md → cms/src/components/RevenueDashboardModule.tsx
- `4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)` --references--> `StockMovement`  [INFERRED]
  docs/devops/deployment-and-runbook.md → cms/src/shared/types/index.ts
- `3.2 Kế toán Kho & Sổ kho (Stock Movement)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/index.ts
- `3.3 Nhập kho (Import Receipt)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/index.ts
- `4. Tiêu chí Nghiệm thu (Acceptance Criteria)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/index.ts

## Import Cycles
- None detected.

## Communities (114 total, 17 thin omitted)

### Community 0 - "web/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.09
Nodes (38): CONTRACT_LABEL, fmtDate(), isPaidLeaveEligible(), LEAVE_REASON_MAX, LEAVE_TYPE_META, LeaveFilter, LeaveRequestModal(), MyLeaveRequestsPanel() (+30 more)

### Community 1 - "ok"
Cohesion: 0.11
Nodes (37): Quy ước trong mỗi domain (`services/<domain>/`), getReportsPushProductsHandler, getReportsRevenueDashboardHandler, getReportsStaffActivityHandler, CustomerModel, CustomerSchema, ICustomer, HolidayModel (+29 more)

### Community 2 - "shared/lib/search.ts"
Cohesion: 0.33
Nodes (8): boundedEditDistanceLeq1(), buildAcronym(), compactAlphaNum(), normalizePhoneDigits(), normalizeVietnamese(), PreparedField, scoreSearchMatch(), SearchField

### Community 3 - "cms/src/app/page.tsx"
Cohesion: 0.10
Nodes (30): CmsDashboardPage(), AccountProfileModule(), getRoleDisplayName(), toIsoDateSlice(), ContractFilePreviewModal(), preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer() (+22 more)

### Community 4 - "web/src/lib/api.ts"
Cohesion: 0.13
Nodes (39): ROLE_LABEL, StaffActivityModule(), toInputDate(), ViewTab, categoryNameOf(), checkersOf(), exportBrands(), exportCategories() (+31 more)

### Community 5 - "seed.ts"
Cohesion: 0.05
Nodes (54): buildCompactColorTokenFE(), ContractType, CurrentShiftOrdersSummary, DailyHandoverCategoryInfo, DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus, Department (+46 more)

### Community 6 - "seed.ts"
Cohesion: 0.07
Nodes (53): An toàn DB, dotenv, supertest, buildHealthPayload(), createApp(), createCorsMiddleware(), DEFAULT_ORIGINS, privateNetworkAccessMiddleware() (+45 more)

### Community 7 - "order.service.ts"
Cohesion: 0.15
Nodes (40): deleteOrders_ByIdHandler, getCustomersHandler, getCustomersLookupHandler, getOrders_ByIdHandler, getOrdersByCode_ByCodeHandler, getOrdersCurrentShiftHandler, getOrdersHandler, postOrders_ByIdConfirmHandler (+32 more)

### Community 8 - "InventoryModule.tsx"
Cohesion: 0.08
Nodes (60): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+52 more)

### Community 9 - "db.ts"
Cohesion: 0.11
Nodes (40): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+32 more)

### Community 10 - "cms/src/lib/api.ts"
Cohesion: 0.08
Nodes (39): AccountProfileModuleProps, AttendanceIpConfigModule(), Props, HeaderAttendanceBar(), localDateStr(), Props, HrmAttendanceModule(), SubTab (+31 more)

### Community 11 - "types/index.ts"
Cohesion: 0.04
Nodes (63): formatDateDisplay(), ServiceManagementModule(), STATUS_INFO, toInputDate(), DEFAULT_WEEKLY_SCHEDULE, getMonthStartStr(), localDateStr(), ShiftHandoverModule() (+55 more)

### Community 12 - "imports.controller.ts"
Cohesion: 0.22
Nodes (16): deleteImports_ByIdHandler, getImports_ByIdHandler, getImportsHandler, postImports_ByIdCompleteHandler, postImports_ByIdFinishListingHandler, postImports_ByIdScanCheckHandler, postImports_ByIdScanTagHandler, postImportsHandler (+8 more)

### Community 13 - "AttendanceTimesheetModule.tsx"
Cohesion: 0.14
Nodes (24): AttendanceTimesheetModule(), CELL_STYLE, CellDetailModal(), EditTarget, formatMinutes(), hasIssue(), HOURS_24, IssueFilter (+16 more)

### Community 14 - "ref_react"
Cohesion: 0.10
Nodes (45): CMS_MENU_ITEMS, CmsModuleType, ROLE_ALLOWED_MODULES, BrandForm, BrandModule(), EMPTY_FORM, CategoryModule(), DebtManagementModule() (+37 more)

### Community 15 - "cms/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 16 - "web-models.test.ts"
Cohesion: 0.12
Nodes (21): cors, mongodb-memory-server, tesseract.js, @types/cors, @types/express, dependencies, cors@^2.8.5, dotenv@^16.4.5 (+13 more)

### Community 17 - "catalog/index.ts"
Cohesion: 0.25
Nodes (19): deleteBrands_ByIdHandler, getBrandsHandler, patchBrands_ByIdHandler, postBrandsHandler, assertUniqueName(), brandUsage(), cleanAliases(), countProductsByBrand() (+11 more)

### Community 18 - "serviceOrder.service.ts"
Cohesion: 0.11
Nodes (46): deleteServiceTypes_ByIdHandler, getServiceOrders_ByIdHandler, getServiceOrdersHandler, getServiceTypesHandler, patchServiceOrders_ByIdHandler, patchServiceOrders_ByIdStatusHandler, patchServiceTypes_ByIdHandler, postServiceOrders_ByIdPaymentsHandler (+38 more)

### Community 19 - "imports.ts"
Cohesion: 0.07
Nodes (40): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+32 more)

### Community 20 - "types/storefront.ts"
Cohesion: 0.09
Nodes (35): addDaysIso(), AvailableOffDayOption, CreateLeaveModal(), fmtDate(), LEAVE_REASON_MAX, LEAVE_TYPE_META, LeaveFilter, MyLeaveRequestsPanel() (+27 more)

### Community 21 - "PosTab.tsx"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 22 - "productScheme.service.ts"
Cohesion: 0.11
Nodes (29): RFC-4180, ApplyOptions, applyRecode(), ApplyReport, assertLocalMongoUri(), backupDatabase(), buildRecodePlan(), bumpVersion() (+21 more)

### Community 23 - "cms/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.11
Nodes (32): CartItem, cartUnitPrice(), createDraft(), createEmptyDraftData(), DraftOrder, DraftOrderData, generateDraftId(), getCartLineKey() (+24 more)

### Community 24 - "ocr.ts"
Cohesion: 0.14
Nodes (21): ALLOWED_MIME, buildThinkingConfig(), callGeminiModel(), callGeminiTable(), callGeminiTag(), DEFAULT_TABLE_MODELS, DEFAULT_TAG_MODELS, getGeminiModels() (+13 more)

### Community 25 - "ref_fs"
Cohesion: 0.15
Nodes (6): args, BASELINE_FILE, current, __dirname, ROUTES_DIR, migration

### Community 26 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.08
Nodes (23): 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions), 4.1 Cấu hình Ca & Tính Giờ Công (+15 more)

### Community 27 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, dev, lint, lint:arch, migrate, migrate:prod, recode:products (+6 more)

### Community 28 - "ApiError"
Cohesion: 0.14
Nodes (46): deleteProducts_ByIdHandler, getInventoryMovementsHandler, getInventoryReportHandler, getInventoryTransfersHandler, getProductsHandler, getProductsLookupHandler, patchProducts_ByIdHandler, patchProducts_ByIdVariantsHandler (+38 more)

### Community 29 - "ProductCatalogModule.tsx"
Cohesion: 0.22
Nodes (21): Quy tắc viết migration, getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+13 more)

### Community 30 - "attendance.service.ts"
Cohesion: 0.10
Nodes (44): ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`), getAttendanceConfigHandler (+36 more)

### Community 31 - "getFloorStocks"
Cohesion: 0.19
Nodes (30): F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), IProduct, ProductModel, ProductSchema, ProductVariantSchema, WarehouseFloor, stockMovementRepo, buildStaffRoleMap() (+22 more)

### Community 32 - "promotion.service.ts"
Cohesion: 0.11
Nodes (32): deletePromotions_ByIdHandler, getPromotionsHandler, patchPromotions_ByIdHandler, postPromotionsEvaluateHandler, postPromotionsHandler, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct (+24 more)

### Community 33 - "ImportReceipt.ts"
Cohesion: 0.25
Nodes (7): IImportReceipt, ImportReceiptItemSchema, ImportReceiptModel, ImportReceiptSchema, ImportReceiptStatus, IScanCount, WarehouseFloor

### Community 34 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.15
Nodes (12): 10. Phiếu bàn giao → backend-dev, 1. Hiện trạng đã xác minh trong code, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên (+4 more)

### Community 35 - "publicStorefront.ts"
Cohesion: 0.08
Nodes (27): StockMovement, 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)* (+19 more)

### Community 36 - "CameraScannerModal.tsx"
Cohesion: 0.16
Nodes (18): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0), CameraScannerModal(), CameraScannerModalProps, compressImageToDataUrl() (+10 more)

### Community 37 - "ref_next"
Cohesion: 0.17
Nodes (7): dynamic, revalidate, dynamic, revalidate, callWiseQuotes(), GET(), WISE_BASE_URL

### Community 38 - "windowsPrinter.ts"
Cohesion: 0.15
Nodes (19): getPrintersHandler, printLabelsHandler, CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter() (+11 more)

### Community 39 - "danh-muc/[slug]/page.tsx"
Cohesion: 0.27
Nodes (5): migration, migration, toObjectId(), Migration, MigrationContext

### Community 40 - "ApiError"
Cohesion: 0.06
Nodes (91): confirmHandoverHandler, deleteHandoverHandler, getHandoverDailyCheckHandler, getHandoverScheduleConfigHandler, listHandoversHandler, putHandoverScheduleConfigHandler, submitHandoverHandler, createLeaveRequestHandler (+83 more)

### Community 41 - "web/src/components/HeaderAttendanceBar.tsx"
Cohesion: 0.12
Nodes (34): AccountProfileTabProps, AttendanceModal(), Props, addLocalDays(), DAY_NAMES, FridayShiftRegistrationModal(), getNextMondayLocalStr(), pad2() (+26 more)

### Community 42 - "ocr.ts"
Cohesion: 0.11
Nodes (34): Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase, ResultKind, scannedOf() (+26 more)

### Community 43 - "5. Đặc tả Component cốt lõi (`shop/`)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 44 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.11
Nodes (18): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging) (+10 more)

### Community 45 - "DrawerMenu.tsx"
Cohesion: 0.33
Nodes (7): DrawerMenuProps, DrawerPageType, TabConfig, TabType, applyTheme(), ThemeToggle(), UserRole

### Community 46 - "attendance.ts"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 47 - "scoreSearchMatch"
Cohesion: 0.43
Nodes (7): boundedEditDistance(), compactAlphaNum(), filterAndRankBySearch(), getWordInitials(), normalizeVietnamese(), scoreSearchMatch(), SearchFieldWeight

### Community 49 - "devDependencies"
Cohesion: 0.25
Nodes (8): ts-node-dev, @types/supertest, devDependencies, supertest@^7.0.0, ts-node-dev@^2.0.0, @types/supertest@^6.0.2, vitest@^2.1.4, vitest

### Community 50 - "Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)"
Cohesion: 0.12
Nodes (16): 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS), Backend (`server/`), Backend (`server/.env` — tham khảo `server/.env.example`), Biến môi trường, Các lệnh thường dùng, Cách 1: Chạy nhanh bằng script có sẵn (Khuyên dùng), Cách 2: Chạy bằng Docker Compose, Cách 3: Cài đặt & chạy thủ công từng dịch vụ (+8 more)

### Community 51 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.17
Nodes (11): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement), 3.3 Nhập kho (Import Receipt), 3.4 Bán hàng (POS Order) & Xuất PDF, 3.5 Trả / Đổi hàng (Return & Exchange), 3. Quy tắc Nghiệp vụ đã chốt (Business Rules) (+3 more)

### Community 52 - "Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 53 - "web/src/app/layout.tsx"
Cohesion: 0.32
Nodes (5): inter, metadata, RootLayout(), viewport, VersionChecker()

### Community 54 - "app.ts"
Cohesion: 0.21
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 55 - "utils/productCode.ts"
Cohesion: 0.12
Nodes (35): buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), exactCodeMatch(), findProductAndVariantByScannedBarcode(), findProductByScannedBarcode(), getBarcodeCandidates(), isOrderedSubsequence() (+27 more)

### Community 56 - "staffImportParser.ts"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 57 - "cms/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.27
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 58 - "compilerOptions"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 59 - "normalizeToCompactUpperCode"
Cohesion: 0.20
Nodes (25): ensureStandardProductCodesMigrated(), Issue, main(), checkLine(), parseImportFile(), colLettersToIndex(), convertMatrixToImportRows(), decodeXmlEntities() (+17 more)

### Community 60 - "Repository"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 61 - "compilerOptions"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 62 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 63 - "ShiftHandover.ts"
Cohesion: 0.29
Nodes (6): HandoverStatus, IHandoverCategoryCount, IHandoverDiscrepancy, IShiftHandover, ShiftHandoverModel, ShiftHandoverSchema

### Community 64 - "excel.ts"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 65 - "2. Danh sách Endpoints"
Cohesion: 0.18
Nodes (11): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), H. `PATCH /api/v1/products/:id` — trường mới, I. `GET /api/v1/products/lookup?code=<mã quét>` (+3 more)

### Community 66 - "middleware/auth.ts"
Cohesion: 0.05
Nodes (78): express, getStaffHandler, patchStaff_ByIdHandler, postAuthChangePasswordHandler, postAuthLoginHandler, postStaffHandler, postStaffParseImportFileHandler, getWiseCurrenciesHandler (+70 more)

### Community 67 - "PosServiceSection.tsx"
Cohesion: 0.17
Nodes (7): 1. Quy ước chung, Hợp đồng API (API Contract) - 11 Sport (v5.0), Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc)

### Community 68 - "cms/src/app/layout.tsx"
Cohesion: 0.31
Nodes (6): inter, metadata, RootLayout(), VersionChecker(), fetchFirstOkJson(), fetchWithTimeout()

### Community 69 - "cms/src/app/api/printers/route.ts"
Cohesion: 0.22
Nodes (9): command, container_name, image, networks, ports, restart, volumes, working_dir (+1 more)

### Community 70 - "3.1 Public Storefront API (`/api/v1/public/*`)"
Cohesion: 0.31
Nodes (9): environment, CORS_ORIGINS, JWT_SECRET, MONGODB_URI, NEXT_PUBLIC_API_URL, NODE_ENV, PORT, environment (+1 more)

### Community 71 - "11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)"
Cohesion: 0.56
Nodes (9): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck (+1 more)

### Community 72 - "holidays.ts"
Cohesion: 0.22
Nodes (9): MONGO_INITDB_DATABASE, container_name, environment, image, networks, ports, restart, volumes (+1 more)

### Community 73 - "services"
Cohesion: 0.22
Nodes (8): 1. Thống kê Lỗi theo Mức độ, 2. Danh sách Lỗi đã Phát hiện & Đã Xác minh Sửa lỗi (Resolved), 3. Kiểm thử Phi chức năng & Bảo mật cơ bản, BUG-01: Nút chuyển nhanh vai trò (Quick Login) trên `web/` và `cms/` gửi mật khẩu mặc định chưa khớp với dữ liệu Seed của `server/`, BUG-02: Xử lý dữ liệu phản hồi tại `ImportTab.tsx` khi gọi `POST /api/v1/imports/:id/complete`, BUG-03: Hiển thị mã phiếu Trả/Đổi trong thông báo thành công tại `ReturnExchangeTab.tsx`, BUG-04: Bảng hóa đơn khổ K80 bị tràn ngang do mã sản phẩm dài và dính nền trang khi bấm In PDF, Báo cáo Lỗi (Bug Report) - 11Sport (v1.0)

### Community 74 - "shared/productCode.ts"
Cohesion: 0.08
Nodes (47): brandRepo, ensureCategorySkuCode(), bumpVersionCode(), CodeConflict, ImportProductProposal, ImportSchemeContext, proposeImportProduct(), SchemeVariantInput (+39 more)

### Community 75 - "compilerOptions"
Cohesion: 0.25
Nodes (7): 1.1. Môi trường & Base URL, 1.2. Cơ chế Xác thực & Bảo mật (Authentication & Security), 1. Tổng quan về Wise API (Wise Platform / Payouts API), 2. Kiến trúc 5 bước chuẩn của Wise API, 3. Thiết kế UX/UI trên POS (`web/`) — Nút Stash Máy tính Wise, Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS, Đặc thù kỹ thuật quan trọng với đồng `VND` trên Wise API:

### Community 76 - "Category.ts"
Cohesion: 0.40
Nodes (4): CategoryModel, CategorySchema, CategoryStatus, ICategory

### Community 77 - "LeaveRequest.ts"
Cohesion: 0.33
Nodes (5): ILeaveRequest, LeaveRequestModel, LeaveRequestSchema, LeaveRequestStatus, LeaveRequestType

### Community 78 - "volumes"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 79 - "environment"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 80 - "StockMovement"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 81 - "web/src/app/page.tsx"
Cohesion: 0.08
Nodes (56): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), isBlockedFromWebPos(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), toIsoDateSlice() (+48 more)

### Community 82 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 83 - "shared/lib/excel.ts"
Cohesion: 0.18
Nodes (16): CellValue, cellXml(), colLetter(), ColumnFormat, crc32(), CRC_TABLE, createXlsx(), escapeXml() (+8 more)

### Community 84 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 86 - "mongoose"
Cohesion: 0.18
Nodes (9): mongoose, mongoose@^8.8.1, AttendanceConfigModel, AttendanceConfigSchema, IAttendanceConfig, BrandModel, BrandSchema, BrandStatus (+1 more)

### Community 87 - "scripts"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 96 - "ServiceType.ts"
Cohesion: 0.40
Nodes (4): IServiceType, ServiceTypeModel, ServiceTypeSchema, ServiceTypeStatus

### Community 97 - "StockMovement.ts"
Cohesion: 0.40
Nodes (4): IStockMovement, StockMovementModel, StockMovementSchema, StockMovementType

### Community 98 - "tagMatch.ts"
Cohesion: 0.22
Nodes (16): buildTagCodes(), compactColorTokenForBarcode(), isCompactBarcodeMatchVariant(), normalizeToUpperCode(), toCompactBarcode128(), collapseUnikeyBackspaceStutter(), decodeScannedBarcodeServer(), getBarcodeCandidatesServer() (+8 more)

### Community 99 - "check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 101 - "timesheet.queries.ts"
Cohesion: 0.06
Nodes (67): getMyCalendarHandler, getTimesheetHandler, patchAttendanceHandler, postManualAttendanceHandler, assertHolidayManager(), createHolidayHandler, deleteHolidayHandler, getHolidaysHandler (+59 more)

### Community 102 - "importScan.service.ts"
Cohesion: 0.18
Nodes (35): ocrScanTag(), sanitizeBarcode(), IImportReceiptItem, findCodeConflictsInList(), findExistingProductForImport(), loadImportSchemeContext(), resolveExplicitImportSchemeItem(), resolveImportColorCode() (+27 more)

### Community 106 - "return.service.ts"
Cohesion: 0.08
Nodes (37): getReturnsHandler, postReturnsCalculateHandler, postReturnsHandler, requireRoles(), DebtAdjustmentRecordSchema, DebtPaymentRecordSchema, DebtStatus, DiscountType (+29 more)

### Community 107 - "Kiến trúc Backend (`server/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc phân tầng (Layered Architecture), Kiến trúc Backend (`server/`), Quy tắc phụ thuộc một chiều

### Community 111 - "WiseCalculatorStash.tsx"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 112 - "Nghiệp vụ Ngày lễ (`holidays/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Ngày lễ (`holidays/`), Quy tắc chính

### Community 120 - "categories.controller.ts"
Cohesion: 0.33
Nodes (10): deleteCategories_ByIdHandler, getCategoriesHandler, patchCategories_ByIdHandler, postCategoriesHandler, createCategory(), deleteCategory(), listCategories(), requireCategoryManager() (+2 more)

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 731 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ApiError` connect `ApiError` to `promotion.service.ts`, `ok`, `middleware/auth.ts`, `timesheet.queries.ts`, `importScan.service.ts`, `windowsPrinter.ts`, `ApiError`, `order.service.ts`, `return.service.ts`, `shared/productCode.ts`, `imports.controller.ts`, `catalog/index.ts`, `serviceOrder.service.ts`, `ocr.ts`, `normalizeToCompactUpperCode`, `categories.controller.ts`, `attendance.service.ts`, `getFloorStocks`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **What connects `PATH`, `RFC-4180` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/src/components/MyAttendanceCalendar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._
- **Why does `StockMovement` connect `publicStorefront.ts` to `cms/src/app/page.tsx`, `web/src/lib/api.ts`, `CameraScannerModal.tsx`, `InventoryModule.tsx`, `types/index.ts`, `Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)`, `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `ok` be split into smaller, more focused modules?**
  _Cohesion score 0.11180992313067785 - nodes in this community are weakly interconnected._
- **Why does `A. Chấm công (`/attendance`)` connect `attendance.service.ts` to `web/src/components/HeaderAttendanceBar.tsx`, `types/storefront.ts`, `ProductCatalogModule.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `cms/src/app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09639953542392567 - nodes in this community are weakly interconnected._