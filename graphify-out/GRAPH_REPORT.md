# Graph Report - 11sport-IT  (2026-11-26)

## Corpus Check
- 505 files · ~510,075 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 2947 nodes · 9590 edges · 136 communities (114 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 124 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b59321ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- web/src/components/MyAttendanceCalendar.tsx
- timesheet.queries.ts
- useShiftHandover.tsx
- CreateLeaveModal.tsx
- attendance/components/MyAttendanceCalendar.tsx
- seed.ts
- seed.ts
- order.service.ts
- ref_lucide_react
- db.ts
- useAttendanceTimesheet.ts
- TagCheckScannerModal.tsx
- Kiến trúc Frontend CMS (`cms/`)
- Tiến độ dự án 11 Sport
- ref_react
- recode.service.ts
- server/package.json
- useProductCatalog.ts
- serviceOrder.service.ts
- imports.ts
- Feature Danh mục & Sản phẩm (`catalog/`)
- PosTab.tsx
- getFloorStocks
- return.service.ts
- printerPrintLabels.ts
- Repository
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- windowsPrinter.ts
- product.service.ts
- ProductCatalogModule.tsx
- attendance.service.ts
- ref_react
- promotion.service.ts
- ApiError
- importFileParse.service.ts
- publicStorefront.ts
- CameraScannerModal.tsx
- recode.service.ts
- useShiftSchedule.ts
- 20261113000001-ensure-indexes.ts
- handover.service.ts
- web/src/components/HeaderAttendanceBar.tsx
- app.ts
- 5. Đặc tả Component cốt lõi (`shop/`)
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- Feature Đơn hàng, Trả/Đổi & Công nợ (`orders/`)
- attendance.ts
- routes/index.ts
- Nghiệp vụ Tích hợp ngoài (`integrations/`)
- Feature Khuyến mãi (`promotions/`)
- Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport
- format.ts
- ref_react
- ref_lucide_react
- staffImportParser.ts
- printerServer.ts
- compilerOptions
- wise.service.ts
- Repository
- compilerOptions
- web/src/components/BarcodeLabelModal.tsx
- holidays.controller.ts
- excel.ts
- 2. Danh sách Endpoints
- inventory/exports.ts
- cms/src/app/page.tsx
- utils/productCode.ts
- cms/src/app/api/printers/route.ts
- 3.1 Public Storefront API (`/api/v1/public/*`)
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- holidays.ts
- services
- types/services.ts
- compilerOptions
- Feature Dịch vụ Kỹ thuật (`services/`)
- Feature Xếp ca & Bàn giao ca (`shifts/`)
- volumes
- environment
- StockMovement
- PosServiceSection.tsx
- 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*
- formatVND
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Baseline kiểm thử server — 2026-11-12
- http.ts
- scripts
- 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)
- healthcheck
- types/index.ts
- hrm.ts
- staff.service.ts
- requireAuth
- cms/src/app/layout.tsx
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- importScan.service.ts
- types/promotions.ts
- WiseCalculatorStash.tsx
- web/src/app/page.tsx
- attendance/api.ts
- lunarCalendar.rules.ts
- middleware/auth.ts
- printers.controller.ts
- ensure-ocr-data.sh
- repositories/index.ts
- Nghiệp vụ Ngày lễ (`holidays/`)
- Nghiệp vụ Danh mục & Quy chuẩn mã (`catalog/`)
- Nghiệp vụ Kho hàng (`inventory/`)
- Nghiệp vụ Bán hàng, Khách hàng & Công nợ (`orders/`)
- Nghiệp vụ Sản phẩm (`products/`)
- Nghiệp vụ Đổi / Trả hàng (`returns/`)
- Nghiệp vụ Nhân sự (`staff/`)
- PosTab.tsx
- InventoryModule.tsx
- Attendance.ts
- cms/src/app/layout.tsx
- Nghiệp vụ Bảng công tháng (`timesheet/`)
- useViewport.ts
- staffImport.parser.ts
- tagMatch.ts
- ui/ContractFilePreviewModal.tsx
- server/scripts/check-architecture.mjs
- web/src/app/api/printers/route.ts
- importPdfInventory.ts
- return.service.ts
- ref_lucide_react
- Kiến trúc Backend (`server/`)
- ref_react
- web/src/app/layout.tsx

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 173 edges
2. `ok()` - 109 edges
3. `formatVND()` - 68 edges
4. `apiRequest()` - 61 edges
5. `normalizeToCompactUpperCode()` - 58 edges
6. `getFloorStocks()` - 47 edges
7. `withPagination()` - 38 edges
8. `generateVariantProductCode()` - 38 edges
9. `created()` - 38 edges
10. `API_ENDPOINTS` - 36 edges

## Surprising Connections (you probably didn't know these)
- `8. Tác động theo phần` --references--> `buildClientFallbackDashboard()`  [INFERRED]
  docs/requirements/doanh-thu-dashboard.md → cms/src/features/reports/fallbackDashboard.ts
- `4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)` --references--> `StockMovement`  [INFERRED]
  docs/devops/deployment-and-runbook.md → cms/src/shared/types/catalog.ts
- `3.2 Kế toán Kho & Sổ kho (Stock Movement)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/catalog.ts
- `3.3 Nhập kho (Import Receipt)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/catalog.ts
- `4. Tiêu chí Nghiệm thu (Acceptance Criteria)` --references--> `StockMovement`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → cms/src/shared/types/catalog.ts

## Import Cycles
- None detected.

## Communities (136 total, 22 thin omitted)

### Community 0 - "web/src/components/MyAttendanceCalendar.tsx"
Cohesion: 0.07
Nodes (48): addLocalDays(), DAY_NAMES, FridayShiftRegistrationModal(), getNextMondayLocalStr(), pad2(), Props, toLocalDateStr(), CONTRACT_LABEL (+40 more)

### Community 1 - "timesheet.queries.ts"
Cohesion: 0.29
Nodes (21): ShiftCode, attendanceRepo, adjustAttendanceRecord(), applyManualOffForStaffDate(), createManualAttendance(), buildTimesheet(), getMyAttendanceCalendar(), getTimesheetReport() (+13 more)

### Community 2 - "useShiftHandover.tsx"
Cohesion: 0.20
Nodes (18): confirmShiftHandoverApi(), deleteShiftHandoverApi(), fetchDailyHandoverCheckApi(), fetchHandoverScheduleConfigApi(), fetchShiftHandoversApi(), updateHandoverScheduleConfigApi(), ShiftHandoverDetailModal(), ShiftHandoverModule() (+10 more)

### Community 3 - "CreateLeaveModal.tsx"
Cohesion: 0.18
Nodes (18): cancelLeaveRequestApi(), createLeaveRequestApi(), fetchMyLeaveRequestsApi(), AvailableOffDayOption, CreateLeaveModal(), LeaveFilter, LeaveFilter, MyLeaveRequestsPanel() (+10 more)

### Community 4 - "attendance/components/MyAttendanceCalendar.tsx"
Cohesion: 0.24
Nodes (17): fetchMyCalendarApi(), MyAttendanceCalendar(), DayCell(), DayDetailModal(), InfoBox(), Row(), StatCard(), CONTRACT_LABEL (+9 more)

### Community 5 - "seed.ts"
Cohesion: 0.05
Nodes (59): buildCompactColorTokenFE(), compactColorTokenForBarcode(), ContractType, CurrentShiftOrdersSummary, DailyHandoverCategoryInfo, DebtAdjustmentRecord, DebtPaymentRecord, DebtStatus (+51 more)

### Community 6 - "seed.ts"
Cohesion: 0.15
Nodes (27): An toàn DB, supertest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), seedDatabaseIfNeeded(), orderRepo (+19 more)

### Community 7 - "order.service.ts"
Cohesion: 0.15
Nodes (40): deleteOrders_ByIdHandler, getCustomersHandler, getCustomersLookupHandler, getOrders_ByIdHandler, getOrdersByCode_ByCodeHandler, getOrdersCurrentShiftHandler, getOrdersHandler, postOrders_ByIdConfirmHandler (+32 more)

### Community 8 - "ref_lucide_react"
Cohesion: 0.23
Nodes (15): StaffCreateForm(), StaffCreateHrFields(), StaffEditProfileModal(), StaffEditSalarySection(), StaffImportPreviewModal(), StaffListTable(), StaffModule(), StaffPasswordModal() (+7 more)

### Community 9 - "db.ts"
Cohesion: 0.11
Nodes (41): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+33 more)

### Community 10 - "useAttendanceTimesheet.ts"
Cohesion: 0.14
Nodes (29): adjustAttendanceApi(), createManualAttendanceApi(), AttendanceTimesheetModule(), ManualAttendanceModal(), Time24Input(), CellDetailModal(), KpiCard(), MatrixView() (+21 more)

### Community 11 - "TagCheckScannerModal.tsx"
Cohesion: 0.16
Nodes (18): downloadStaffImportTemplate(), Tiến độ dự án 11 Sport, Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase (+10 more)

### Community 12 - "Kiến trúc Frontend CMS (`cms/`)"
Cohesion: 0.40
Nodes (4): Cấu trúc thư mục, Khuôn mẫu chuẩn mỗi `src/features/<feature>/`, Kiến trúc Frontend CMS (`cms/`), Quy tắc phụ thuộc một chiều

### Community 13 - "Tiến độ dự án 11 Sport"
Cohesion: 0.18
Nodes (7): 1. Quy ước chung, Hợp đồng API (API Contract) - 11 Sport (v5.0), Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc)

### Community 14 - "ref_react"
Cohesion: 0.11
Nodes (22): CmsAuthGateProps, CmsChangePasswordModalProps, CmsDrawers(), CmsDrawersProps, CmsHeader(), CmsHeaderProps, CMS_MENU_ITEMS, CmsModuleType (+14 more)

### Community 15 - "recode.service.ts"
Cohesion: 0.10
Nodes (25): RFC-4180, ApplyOptions, applyRecode(), ApplyReport, assertLocalMongoUri(), backupDatabase(), bumpVersion(), CODE_FIELDS (+17 more)

### Community 16 - "server/package.json"
Cohesion: 0.05
Nodes (44): cors, mongodb-memory-server, tesseract.js, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies (+36 more)

### Community 17 - "useProductCatalog.ts"
Cohesion: 0.14
Nodes (27): SubTab, ProductCatalogModule(), COMMON_COLORS, COMMON_SIZES, StockStatusFilter, useProductCatalog(), PushProductsReportResponse, addProductVariantsApi() (+19 more)

### Community 18 - "serviceOrder.service.ts"
Cohesion: 0.11
Nodes (45): deleteServiceTypes_ByIdHandler, getServiceOrders_ByIdHandler, getServiceOrdersHandler, getServiceTypesHandler, patchServiceOrders_ByIdHandler, patchServiceOrders_ByIdStatusHandler, patchServiceTypes_ByIdHandler, postServiceOrders_ByIdPaymentsHandler (+37 more)

### Community 19 - "imports.ts"
Cohesion: 0.07
Nodes (40): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+32 more)

### Community 21 - "PosTab.tsx"
Cohesion: 0.07
Nodes (36): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+28 more)

### Community 22 - "getFloorStocks"
Cohesion: 0.24
Nodes (26): WarehouseFloor, stockMovementRepo, buildStaffRoleMap(), getInventoryMovements(), getInventoryReport(), getInventoryTransfers(), inferActorRole(), adjustStock() (+18 more)

### Community 23 - "return.service.ts"
Cohesion: 0.09
Nodes (27): 1. Hiện trạng đã xác minh trong code, DebtAdjustmentRecordSchema, DebtPaymentRecordSchema, DebtStatus, DiscountType, IDebtAdjustmentRecord, IDebtPaymentRecord, IOrder (+19 more)

### Community 24 - "printerPrintLabels.ts"
Cohesion: 0.38
Nodes (10): CODE128_PATTERNS, compactColorTokenForBarcode(), encodeCode128BPattern(), encodeCode128RawPattern(), sanitizeAsciiCode128(), THERMAL_KEYWORDS, toCompactBarcode128(), execFileAsync (+2 more)

### Community 25 - "Repository"
Cohesion: 0.14
Nodes (6): CollectionRecord, generateObjectId(), matchFilter(), MemoryStore, memoryStore, Repository

### Community 26 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.08
Nodes (23): 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions), 4.1 Cấu hình Ca & Tính Giờ Công (+15 more)

### Community 27 - "windowsPrinter.ts"
Cohesion: 0.18
Nodes (16): CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter(), LabelPrintItem, listSystemPrinters() (+8 more)

### Community 28 - "product.service.ts"
Cohesion: 0.15
Nodes (44): deleteProducts_ByIdHandler, getInventoryMovementsHandler, getInventoryReportHandler, getInventoryTransfersHandler, getProductsHandler, getProductsLookupHandler, patchProducts_ByIdHandler, patchProducts_ByIdVariantsHandler (+36 more)

### Community 29 - "ProductCatalogModule.tsx"
Cohesion: 0.22
Nodes (21): Quy tắc viết migration, getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+13 more)

### Community 30 - "attendance.service.ts"
Cohesion: 0.11
Nodes (42): ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`), getAttendanceConfigHandler (+34 more)

### Community 31 - "ref_react"
Cohesion: 0.11
Nodes (34): InventoryPaginationBar(), InventoryPaginationBarProps, parseAndApplyAdminImportFile(), downloadAdminSampleCsv(), submitAdminBatchImport(), useInventoryDerived(), InventoryAdminImportDeps, useInventoryAdminImport() (+26 more)

### Community 32 - "promotion.service.ts"
Cohesion: 0.12
Nodes (30): deletePromotions_ByIdHandler, getPromotionsHandler, patchPromotions_ByIdHandler, postPromotionsEvaluateHandler, postPromotionsHandler, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct (+22 more)

### Community 33 - "ApiError"
Cohesion: 0.18
Nodes (25): deleteBrands_ByIdHandler, getBrandsHandler, patchBrands_ByIdHandler, postBrandsHandler, brandsRouter, assertUniqueName(), brandUsage(), cleanAliases() (+17 more)

### Community 34 - "importFileParse.service.ts"
Cohesion: 0.11
Nodes (41): ALLOWED_MIME, buildTagCodes(), buildThinkingConfig(), callGeminiModel(), callGeminiTable(), callGeminiTag(), DEFAULT_TABLE_MODELS, DEFAULT_TAG_MODELS (+33 more)

### Community 35 - "publicStorefront.ts"
Cohesion: 0.08
Nodes (27): StockMovement, 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)* (+19 more)

### Community 36 - "CameraScannerModal.tsx"
Cohesion: 0.16
Nodes (18): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0), CameraScannerModal(), CameraScannerModalProps, compressImageToDataUrl() (+10 more)

### Community 37 - "recode.service.ts"
Cohesion: 0.07
Nodes (60): brandRepo, Issue, main(), checkLine(), ensureCategorySkuCode(), buildSchemeRootCode(), bumpVersionCode(), CodeConflict (+52 more)

### Community 38 - "useShiftSchedule.ts"
Cohesion: 0.17
Nodes (20): saveShiftChangesApi(), ShiftScheduleModule(), ShiftStaffSidebar(), addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf() (+12 more)

### Community 39 - "20261113000001-ensure-indexes.ts"
Cohesion: 0.28
Nodes (5): migration, migration, toObjectId(), Migration, MigrationContext

### Community 40 - "handover.service.ts"
Cohesion: 0.06
Nodes (87): confirmHandoverHandler, deleteHandoverHandler, getHandoverDailyCheckHandler, getHandoverScheduleConfigHandler, listHandoversHandler, putHandoverScheduleConfigHandler, submitHandoverHandler, createLeaveRequestHandler (+79 more)

### Community 41 - "web/src/components/HeaderAttendanceBar.tsx"
Cohesion: 0.12
Nodes (31): AccountProfileTabProps, AttendanceModal(), Props, DrawerMenuProps, DrawerPageType, TabConfig, TabType, HeaderAttendanceBar() (+23 more)

### Community 42 - "app.ts"
Cohesion: 0.15
Nodes (19): express, buildHealthPayload(), createCorsMiddleware(), DEFAULT_ORIGINS, privateNetworkAccessMiddleware(), getDbMode(), env, bootstrap() (+11 more)

### Community 43 - "5. Đặc tả Component cốt lõi (`shop/`)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 44 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.11
Nodes (18): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging) (+10 more)

### Community 46 - "attendance.ts"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 47 - "routes/index.ts"
Cohesion: 0.14
Nodes (15): getMyCalendarHandler, getTimesheetHandler, patchAttendanceHandler, postManualAttendanceHandler, attendanceRouter, attendanceTimesheetRouter, holidaysRouter, importsRouter (+7 more)

### Community 50 - "Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)"
Cohesion: 0.12
Nodes (16): 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS), Backend (`server/`), Backend (`server/.env` — tham khảo `server/.env.example`), Biến môi trường, Các lệnh thường dùng, Cách 1: Chạy nhanh bằng script có sẵn (Khuyên dùng), Cách 2: Chạy bằng Docker Compose, Cách 3: Cài đặt & chạy thủ công từng dịch vụ (+8 more)

### Community 51 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.17
Nodes (11): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement), 3.3 Nhập kho (Import Receipt), 3.4 Bán hàng (POS Order) & Xuất PDF, 3.5 Trả / Đổi hàng (Return & Exchange), 3. Quy tắc Nghiệp vụ đã chốt (Business Rules) (+3 more)

### Community 52 - "Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 53 - "format.ts"
Cohesion: 0.11
Nodes (13): ServiceEditModal(), STATUS_INFO, ServiceManagementModule(), STATUS_INFO, formatDateDisplay(), ServiceOrdersTab(), STATUS_INFO, ServicePaymentModal() (+5 more)

### Community 54 - "ref_react"
Cohesion: 0.09
Nodes (43): DEBOUNCE_MS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZE_OPTIONS, BrandForm, BrandModuleViewModel, CODE_RE, EMPTY_FORM (+35 more)

### Community 55 - "ref_lucide_react"
Cohesion: 0.22
Nodes (22): ProductCatalogTable(), ProductCatalogVariantSection(), ProductCatalogViewModel, AdminBatchImportTable(), HistoryTransfersView(), InventoryProductsTable(), InventoryTableFooter(), InventoryTransferTab() (+14 more)

### Community 56 - "staffImportParser.ts"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 57 - "printerServer.ts"
Cohesion: 0.24
Nodes (8): dynamic, GET(), POST(), runtime, isThermalPrinter(), execFileAsync, getPrintersResponsePayload(), jsonResult()

### Community 58 - "compilerOptions"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 59 - "wise.service.ts"
Cohesion: 0.32
Nodes (9): getWiseCurrenciesHandler, postWiseQuoteHandler, fetchWiseQuoteRaw(), getWiseConfig(), getWiseCurrencies(), postWiseQuote(), roundCurrency(), SUPPORTED_CURRENCIES (+1 more)

### Community 60 - "Repository"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 61 - "compilerOptions"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 62 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 63 - "holidays.controller.ts"
Cohesion: 0.24
Nodes (16): assertHolidayManager(), createHolidayHandler, deleteHolidayHandler, getHolidaysHandler, HOLIDAY_MANAGER_ROLES, syncVnHolidaysHandler, holidayRepo, createHoliday() (+8 more)

### Community 64 - "excel.ts"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 65 - "2. Danh sách Endpoints"
Cohesion: 0.17
Nodes (12): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), H. `PATCH /api/v1/products/:id` — trường mới (+4 more)

### Community 66 - "inventory/exports.ts"
Cohesion: 0.09
Nodes (49): BrandModule(), CategoryModule(), exportBrands(), exportCategories(), categoryNameOf(), checkersOf(), exportImports(), exportInventoryReport() (+41 more)

### Community 67 - "cms/src/app/page.tsx"
Cohesion: 0.08
Nodes (34): CmsAuthGate(), CmsChangePasswordModal(), CmsDashboardPage(), AttendanceIpConfigModule(), CategoryBrandModule(), DebtManagementModule(), DebtPaymentModal(), DebtManagementViewModel (+26 more)

### Community 68 - "utils/productCode.ts"
Cohesion: 0.08
Nodes (57): fetchFirstOkJson(), fetchWithTimeout(), buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), getBarcodeCandidates(), isOrderedSubsequence(), isScannedCodeMatch() (+49 more)

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

### Community 74 - "types/services.ts"
Cohesion: 0.25
Nodes (7): ServiceDiscountType, ServiceOrderItem, ServiceOrdersMeta, ServicePaymentMethod, ServicePaymentRecord, ServicePaymentStatus, ServiceType

### Community 75 - "compilerOptions"
Cohesion: 0.25
Nodes (7): 1.1. Môi trường & Base URL, 1.2. Cơ chế Xác thực & Bảo mật (Authentication & Security), 1. Tổng quan về Wise API (Wise Platform / Payouts API), 2. Kiến trúc 5 bước chuẩn của Wise API, 3. Thiết kế UX/UI trên POS (`web/`) — Nút Stash Máy tính Wise, Tài liệu Nghiên cứu & Tích hợp Wise API vào Hệ thống 11Sport POS, Đặc thù kỹ thuật quan trọng với đồng `VND` trên Wise API:

### Community 78 - "volumes"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc & Hệ thống Subagents (11 Sport), Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 79 - "environment"
Cohesion: 0.29
Nodes (6): Cấu trúc, Dự án bán hàng 11 Sport, graphify, Luồng làm việc, Quy tắc chung cho mọi agent, Thư mục tài liệu

### Community 80 - "StockMovement"
Cohesion: 0.29
Nodes (6): 1. Thanh điều hướng & Chuyển vai trò nhanh, 2. Chi tiết luồng màn hình Nhập kho (`web/`), Các Module chính, Phần A: Giao diện `web/` (POS Bán hàng & Kho vận - Port `3000`), Phần B: Giao diện `cms/` (Quản trị - Port `3001`), Đặc tả Giao diện & Luồng màn hình - 11Sport (v1.0)

### Community 81 - "PosServiceSection.tsx"
Cohesion: 0.15
Nodes (16): addDaysToDateStr(), computeServiceLinePricing(), diffDaysStr(), formatShortDate(), getTodayStr(), PaymentTimingMode, PosServiceSection(), ServiceCartLine (+8 more)

### Community 82 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 83 - "formatVND"
Cohesion: 0.21
Nodes (18): RevenueBreakdownCard(), AnimatedNumber(), CHART_COLORS, formatShortVND(), SvgDonutChart(), RevenueDashboardModule(), RevenueDebtTab(), RevenueLineChart() (+10 more)

### Community 84 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 86 - "http.ts"
Cohesion: 0.12
Nodes (35): getReportsPushProductsHandler, getReportsRevenueDashboardHandler, getReportsStaffActivityHandler, categoryRepo, importReceiptRepo, productRepo, returnExchangeRepo, serviceOrderRepo (+27 more)

### Community 87 - "scripts"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 96 - "types/index.ts"
Cohesion: 0.10
Nodes (36): OrdersReturnsModuleProps, DebtManagementModuleProps, buildClientFallbackDashboard(), computeFallbackDebtStats(), aggregateOrdersAndReturns(), computeFallbackProductAndCategoryStats(), computeFallbackServiceStats(), extractClientOrderDebtMeta() (+28 more)

### Community 97 - "hrm.ts"
Cohesion: 0.17
Nodes (11): DailyHandoverCategorySummary, LeaveRequest, LeaveRequestStatus, MyCalendarCellCode, MyCalendarLeave, MyCalendarSummary, ShiftHandoverCategoryCount, ShiftHandoverDiscrepancy (+3 more)

### Community 98 - "staff.service.ts"
Cohesion: 0.17
Nodes (24): getStaffHandler, patchStaff_ByIdHandler, postAuthChangePasswordHandler, postAuthLoginHandler, postStaffHandler, postStaffParseImportFileHandler, invalidateStaffAuthCache(), authStaffRouter (+16 more)

### Community 99 - "requireAuth"
Cohesion: 0.36
Nodes (7): deleteCategories_ByIdHandler, getCategoriesHandler, patchCategories_ByIdHandler, postCategoriesHandler, requireAuth(), categoriesRouter, deleteCategory()

### Community 100 - "cms/src/app/layout.tsx"
Cohesion: 0.17
Nodes (7): dynamic, revalidate, dynamic, revalidate, callWiseQuotes(), GET(), WISE_BASE_URL

### Community 101 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.18
Nodes (10): 10. Phiếu bàn giao → backend-dev, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên, 8. Tác động theo phần (+2 more)

### Community 102 - "importScan.service.ts"
Cohesion: 0.14
Nodes (41): ensureStandardProductCodesMigrated(), deleteImports_ByIdHandler, getImports_ByIdHandler, getImportsHandler, postImports_ByIdCompleteHandler, postImports_ByIdFinishListingHandler, postImports_ByIdScanCheckHandler, postImports_ByIdScanTagHandler (+33 more)

### Community 103 - "types/promotions.ts"
Cohesion: 0.25
Nodes (7): EffectivePromotionStatus, Promotion, PromotionConditionCategory, PromotionConditionProduct, PromotionConditionType, PromotionDiscountType, PromotionGiftItem

### Community 104 - "WiseCalculatorStash.tsx"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 105 - "web/src/app/page.tsx"
Cohesion: 0.10
Nodes (49): getDefaultTabForRole(), getRoleDisplayName(), isAttendanceOnlyRole(), isBlockedFromWebPos(), TABS_CONFIG, WebPosHomePage(), AccountProfileTab(), toIsoDateSlice() (+41 more)

### Community 106 - "attendance/api.ts"
Cohesion: 0.14
Nodes (18): createHolidayApi(), deleteHolidayApi(), fetchHolidays(), fetchTimesheetApi(), syncVietnamHolidaysApi(), HrmAttendanceModule(), HrmHolidaysTab(), HrmAttendanceViewModel (+10 more)

### Community 107 - "lunarCalendar.rules.ts"
Cohesion: 0.79
Nodes (7): convertSolar2Lunar(), getLeapMonthOffset(), getLunarMonth11(), getNewMoonDay(), getSunLongitude(), INT(), jdFromDate()

### Community 108 - "middleware/auth.ts"
Cohesion: 0.14
Nodes (23): attachUserContext(), errorHandler(), Express, Request, resolveActiveStaffCached(), staffCache, ContractType, IStaff (+15 more)

### Community 109 - "printers.controller.ts"
Cohesion: 0.43
Nodes (4): getPrintersHandler, printLabelsHandler, printersRouter, getSystemPrintersList()

### Community 111 - "repositories/index.ts"
Cohesion: 0.04
Nodes (54): mongoose, migration, AttendanceConfigModel, AttendanceConfigSchema, IAttendanceConfig, BrandModel, BrandSchema, BrandStatus (+46 more)

### Community 112 - "Nghiệp vụ Ngày lễ (`holidays/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Ngày lễ (`holidays/`), Quy tắc chính

### Community 119 - "PosTab.tsx"
Cohesion: 0.11
Nodes (35): CartItem, cartUnitPrice(), createDraft(), createEmptyDraftData(), DraftOrder, DraftOrderData, generateDraftId(), getCartLineKey() (+27 more)

### Community 120 - "InventoryModule.tsx"
Cohesion: 0.16
Nodes (20): AdminBatchImportModal(), CmsRoleBadge(), HistoryImportsView(), HistoryMovementsView(), ImportReceiptDetailModal(), InventoryHistoryTab(), InventoryModule(), InventoryProductsTab() (+12 more)

### Community 121 - "Attendance.ts"
Cohesion: 0.29
Nodes (6): AttendanceCheckInType, AttendanceModel, AttendanceSchema, AttendanceStatus, IAttendance, OvertimeStatus

### Community 122 - "cms/src/app/layout.tsx"
Cohesion: 0.40
Nodes (4): inter, metadata, RootLayout(), VersionChecker()

### Community 124 - "Nghiệp vụ Bảng công tháng (`timesheet/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Bảng công tháng (`timesheet/`), Quy tắc chính

### Community 125 - "useViewport.ts"
Cohesion: 0.67
Nodes (3): Breakpoint, useBreakpoint(), useIsMobile()

### Community 126 - "staffImport.parser.ts"
Cohesion: 0.22
Nodes (17): ColumnKey, inferContractType(), inferRoleAndDepartment(), matchSubHeaderKey(), matchTopHeaderKey(), normalizeCitizenIdCell(), normalizeGenderCell(), normalizePhoneCell() (+9 more)

### Community 127 - "tagMatch.ts"
Cohesion: 0.16
Nodes (24): sanitizeBarcode(), isFullItem(), progressOfItems(), applyMatchedScan(), findRowByKnownBarcode(), scanCheck(), scanTag(), Cấu trúc (+16 more)

### Community 128 - "ui/ContractFilePreviewModal.tsx"
Cohesion: 0.21
Nodes (6): preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer(), preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer()

### Community 129 - "server/scripts/check-architecture.mjs"
Cohesion: 0.05
Nodes (27): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+19 more)

### Community 130 - "web/src/app/api/printers/route.ts"
Cohesion: 0.27
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 131 - "importPdfInventory.ts"
Cohesion: 0.32
Nodes (7): dotenv, apiCall(), buildProductName(), FLOOR_1_ITEMS, FLOOR_2_ITEMS, main(), PdfItemRow

### Community 132 - "return.service.ts"
Cohesion: 0.17
Nodes (19): getReturnsHandler, postReturnsCalculateHandler, postReturnsHandler, listCategories(), createReturnExchange(), listReturns(), calculateReturnExchange(), prepareReturnExchangeCalculation() (+11 more)

### Community 133 - "ref_lucide_react"
Cohesion: 0.24
Nodes (4): PromotionConditionFields(), PromotionFormModal(), PromotionRewardFields(), PromotionModuleViewModel

### Community 134 - "Kiến trúc Backend (`server/`)"
Cohesion: 0.40
Nodes (4): Cấu trúc phân tầng (Layered Architecture), Kiến trúc Backend (`server/`), Quy tắc phụ thuộc một chiều, Quy ước trong mỗi domain (`services/<domain>/`)

### Community 135 - "ref_react"
Cohesion: 0.18
Nodes (20): useCmsShell(), ViewTab, parseStaffImportFileApi(), buildStaffActions(), buildStaffImportActions(), toIsoDateSlice(), useAccountProfile(), useStaffModule() (+12 more)

### Community 136 - "web/src/app/layout.tsx"
Cohesion: 0.32
Nodes (5): inter, metadata, RootLayout(), viewport, VersionChecker()

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 745 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `A. Chấm công (`/attendance`)` connect `attendance.service.ts` to `hrm.ts`, `ProductCatalogModule.tsx`, `web/src/components/HeaderAttendanceBar.tsx`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `PATH`, `RFC-4180` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/src/components/MyAttendanceCalendar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07372549019607844 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `product.service.ts` to `timesheet.queries.ts`, `return.service.ts`, `order.service.ts`, `serviceOrder.service.ts`, `getFloorStocks`, `return.service.ts`, `windowsPrinter.ts`, `attendance.service.ts`, `promotion.service.ts`, `ApiError`, `importFileParse.service.ts`, `recode.service.ts`, `handover.service.ts`, `wise.service.ts`, `holidays.controller.ts`, `http.ts`, `staff.service.ts`, `requireAuth`, `importScan.service.ts`, `middleware/auth.ts`, `printers.controller.ts`, `tagMatch.ts`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.051715309779825906 - nodes in this community are weakly interconnected._
- **Why does `StockMovement` connect `publicStorefront.ts` to `inventory/exports.ts`, `CameraScannerModal.tsx`, `TagCheckScannerModal.tsx`, `Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)`, `useProductCatalog.ts`, `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)`, `ref_lucide_react`, `ref_react`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10606060606060606 - nodes in this community are weakly interconnected._