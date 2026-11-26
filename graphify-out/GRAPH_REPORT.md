# Graph Report - 11sport-IT  (2026-11-26)

## Corpus Check
- 560 files · ~515,646 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 3070 nodes · 10104 edges · 133 communities (109 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 137 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9938084b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shared/productCode.ts
- usePosTab.ts
- cms/src/shared/types/hrm.ts
- CreateLeaveModal.tsx
- staffImport.parser.ts
- web/src/features/attendance/components/HeaderAttendanceBar.tsx
- seed.ts
- order.service.ts
- routes/index.ts
- useInventoryTab.ts
- useAttendanceTimesheet.ts
- TagCheckScannerModal.tsx
- Kiến trúc Frontend CMS (`cms/`)
- Tiến độ dự án 11 Sport
- ref_lucide_react
- shared/productCode.ts
- server/package.json
- web/src/shared/utils/productCode.ts
- serviceOrder.service.ts
- imports.ts
- Feature Danh mục & Sản phẩm (`catalog/`)
- PosTab.tsx
- cms/src/shared/types/hrm.ts
- returnCalc.service.ts
- printerPrintLabels.ts
- Repository
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- windowsPrinter.ts
- product.service.ts
- ProductCatalogModule.tsx
- handover.service.ts
- ref_react
- weeklyPreference.service.ts
- useShiftSchedule.ts
- web/src/shared/ui/ContractFilePreviewModal.tsx
- publicStorefront.ts
- web/src/shared/types/promotions.ts
- useViewport.ts
- resolveVariantColorHexes
- 20261113000003-backfill-return-debt-reduction.ts
- productsInventory.controller.ts
- web/src/shared/types/index.ts
- ocr-speed.test.ts
- 5. Đặc tả Component cốt lõi (`shop/`)
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- Feature Đơn hàng, Trả/Đổi & Công nợ (`orders/`)
- attendance.ts
- ref_path
- Nghiệp vụ Tích hợp ngoài (`integrations/`)
- Feature Khuyến mãi (`promotions/`)
- Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)
- StockMovement
- Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport
- cms/src/shared/utils/format.ts
- web/src/features/attendance/components/MyAttendanceCalendar.tsx
- productRepo
- staffImportParser.ts
- cms/src/features/attendance/components/MyAttendanceCalendar.tsx
- compilerOptions
- useHrmAttendance.ts
- Repository
- compilerOptions
- web/src/components/BarcodeLabelModal.tsx
- timesheet.queries.ts
- excel.ts
- 2. Danh sách Endpoints
- inventory/exports.ts
- useInventoryModule.tsx
- utils/productCode.ts
- cms/src/app/api/printers/route.ts
- 3.1 Public Storefront API (`/api/v1/public/*`)
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- holidays.ts
- services
- ocr.ts
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
- ok
- scripts
- 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)
- healthcheck
- cms/src/shared/types/index.ts
- StaffUser
- staff.service.ts
- usePromotionModule.tsx
- cms/src/app/layout.tsx
- apiRequest
- importScan.service.ts
- ref_react
- wise.service.ts
- PosShiftBillsSection.tsx
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- server/scripts/check-architecture.mjs
- shared/auth.ts
- web/scripts/check-architecture.mjs
- ensure-ocr-data.sh
- promotion.service.ts
- Nghiệp vụ Ngày lễ (`holidays/`)
- Nghiệp vụ Danh mục & Quy chuẩn mã (`catalog/`)
- Nghiệp vụ Kho hàng (`inventory/`)
- Nghiệp vụ Bán hàng, Khách hàng & Công nợ (`orders/`)
- Nghiệp vụ Sản phẩm (`products/`)
- Nghiệp vụ Đổi / Trả hàng (`returns/`)
- Nghiệp vụ Nhân sự (`staff/`)
- mongoose
- ShiftAssignment
- web/src/app/layout.tsx
- cms/scripts/check-architecture.mjs
- CameraScannerModal.tsx
- WiseCalculatorStash.tsx
- web/src/shared/hooks/usePagedList.ts
- ocr-speed.test.ts
- useMobileTableLabels.ts
- useStaffModule.ts
- web/src/config/listing.ts
- web/src/app/api/printers/route.ts
- Kiến trúc Backend (`server/`)
- Cấu trúc

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
- `Nguyên nhân gốc — MỘT nguyên nhân chung` --references--> `ocrScanTag()`  [INFERRED]
  docs/test/baseline-2026-11-12.md → server/src/infra/ocr.ts
- `B. Quản lý Đơn Dịch Vụ (`/service-orders`)` --references--> `status()`  [INFERRED]
  docs/api-contract.md → server/src/migrations/runner.ts
- `3.1 Danh mục (Category) & Sản phẩm (Product)` --references--> `status()`  [INFERRED]
  docs/requirements/he-thong-pos-kho-v1.md → server/src/migrations/runner.ts

## Import Cycles
- None detected.

## Communities (133 total, 24 thin omitted)

### Community 0 - "shared/productCode.ts"
Cohesion: 0.08
Nodes (52): ensureStandardProductCodesMigrated(), Issue, main(), checkLine(), colLettersToIndex(), convertMatrixToImportRows(), decodeXmlEntities(), extractZipEntries() (+44 more)

### Community 1 - "usePosTab.ts"
Cohesion: 0.19
Nodes (30): PosTab(), usePosTab(), CartItem, cartUnitPrice(), createDraft(), createEmptyDraftData(), DEFAULT_NOTE, DraftOrder (+22 more)

### Community 2 - "cms/src/shared/types/hrm.ts"
Cohesion: 0.20
Nodes (18): confirmShiftHandoverApi(), deleteShiftHandoverApi(), fetchDailyHandoverCheckApi(), fetchHandoverScheduleConfigApi(), fetchShiftHandoversApi(), updateHandoverScheduleConfigApi(), ShiftHandoverDetailModal(), ShiftHandoverModule() (+10 more)

### Community 3 - "CreateLeaveModal.tsx"
Cohesion: 0.18
Nodes (18): cancelLeaveRequestApi(), createLeaveRequestApi(), fetchMyLeaveRequestsApi(), AvailableOffDayOption, CreateLeaveModal(), LeaveFilter, LeaveFilter, MyLeaveRequestsPanel() (+10 more)

### Community 4 - "staffImport.parser.ts"
Cohesion: 0.13
Nodes (26): Request, ContractType, IStaff, StaffDepartment, StaffModel, StaffRole, StaffSchema, StaffStatus (+18 more)

### Community 5 - "web/src/features/attendance/components/HeaderAttendanceBar.tsx"
Cohesion: 0.09
Nodes (44): checkInApi(), checkOutApi(), fetchMyShiftScheduleApi(), getTodayAttendanceApi(), submitShiftPreferencesApi(), AttendanceModal(), Props, addLocalDays() (+36 more)

### Community 6 - "seed.ts"
Cohesion: 0.18
Nodes (22): An toàn DB, supertest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), seedDatabaseIfNeeded(), app (+14 more)

### Community 7 - "order.service.ts"
Cohesion: 0.09
Nodes (58): 1. Hiện trạng đã xác minh trong code, deleteOrders_ByIdHandler, getCustomersHandler, getCustomersLookupHandler, getOrders_ByIdHandler, getOrdersByCode_ByCodeHandler, getOrdersCurrentShiftHandler, getOrdersHandler (+50 more)

### Community 8 - "routes/index.ts"
Cohesion: 0.07
Nodes (36): express, getMyCalendarHandler, getTimesheetHandler, patchAttendanceHandler, postManualAttendanceHandler, createLeaveRequestHandler, deleteLeaveRequestHandler, getLeaveRequestsHandler (+28 more)

### Community 9 - "useInventoryTab.ts"
Cohesion: 0.12
Nodes (31): InventoryTab(), useInventoryTab(), addProductVariantsApi(), fetchBrandsApi(), lookupProductByCodeApi(), previewProductCodeApi(), describeApiError(), PRODUCT_CODE_ERROR_MESSAGES (+23 more)

### Community 10 - "useAttendanceTimesheet.ts"
Cohesion: 0.15
Nodes (27): adjustAttendanceApi(), createManualAttendanceApi(), AttendanceTimesheetModule(), ManualAttendanceModal(), Time24Input(), CellDetailModal(), KpiCard(), MatrixView() (+19 more)

### Community 11 - "TagCheckScannerModal.tsx"
Cohesion: 0.12
Nodes (29): downloadStaffImportTemplate(), Tiến độ dự án 11 Sport, Candidate, detectBarcodeFromCanvas(), expectedOf(), feedback(), isFullRow(), Phase (+21 more)

### Community 12 - "Kiến trúc Frontend CMS (`cms/`)"
Cohesion: 0.40
Nodes (4): Cấu trúc thư mục, Khuôn mẫu chuẩn mỗi `src/features/<feature>/`, Kiến trúc Frontend CMS (`cms/`), Quy tắc phụ thuộc một chiều

### Community 13 - "Tiến độ dự án 11 Sport"
Cohesion: 0.15
Nodes (8): 1. Quy ước chung, Hợp đồng API (API Contract) - 11 Sport (v5.0), Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc), Quy tắc viết migration

### Community 14 - "ref_lucide_react"
Cohesion: 0.09
Nodes (38): CmsAuthGate(), CmsChangePasswordModal(), CmsDrawers(), CmsDashboardPage(), AttendanceIpConfigModule(), BrandModule(), CategoryBrandModule(), SubTab (+30 more)

### Community 15 - "shared/productCode.ts"
Cohesion: 0.05
Nodes (82): RFC-4180, deleteBrands_ByIdHandler, getBrandsHandler, patchBrands_ByIdHandler, postBrandsHandler, brandRepo, shiftHandoverRepo, brandsRouter (+74 more)

### Community 16 - "server/package.json"
Cohesion: 0.05
Nodes (44): cors, mongodb-memory-server, tesseract.js, ts-node-dev, @types/cors, @types/express, @types/supertest, dependencies (+36 more)

### Community 17 - "web/src/shared/utils/productCode.ts"
Cohesion: 0.12
Nodes (34): BarcodeLabelItem, BarcodeLabelModal(), BarcodeLabelModalProps, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), FIXED_LABEL_CONFIG (+26 more)

### Community 18 - "serviceOrder.service.ts"
Cohesion: 0.11
Nodes (45): deleteServiceTypes_ByIdHandler, getServiceOrders_ByIdHandler, getServiceOrdersHandler, getServiceTypesHandler, patchServiceOrders_ByIdHandler, patchServiceOrders_ByIdStatusHandler, patchServiceTypes_ByIdHandler, postServiceOrders_ByIdPaymentsHandler (+37 more)

### Community 19 - "imports.ts"
Cohesion: 0.07
Nodes (40): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+32 more)

### Community 21 - "PosTab.tsx"
Cohesion: 0.06
Nodes (41): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+33 more)

### Community 22 - "cms/src/shared/types/hrm.ts"
Cohesion: 0.12
Nodes (19): fetchAttendanceConfig(), fetchTimesheetApi(), updateAttendanceConfigApi(), useAttendanceIpConfig(), AttendanceConfig, AttendanceRecord, DailyHandoverCategorySummary, Holiday (+11 more)

### Community 23 - "returnCalc.service.ts"
Cohesion: 0.23
Nodes (10): PaymentMethod, ExchangeItemSchema, IExchangeItem, IReturnExchange, IReturnItem, ReturnCondition, ReturnExchangeModel, ReturnExchangeSchema (+2 more)

### Community 24 - "printerPrintLabels.ts"
Cohesion: 0.19
Nodes (18): dynamic, GET(), POST(), runtime, CODE128_PATTERNS, compactColorTokenForBarcode(), encodeCode128BPattern(), encodeCode128RawPattern() (+10 more)

### Community 25 - "Repository"
Cohesion: 0.14
Nodes (6): CollectionRecord, generateObjectId(), matchFilter(), MemoryStore, memoryStore, Repository

### Community 26 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.08
Nodes (24): 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions), 4.1 Cấu hình Ca & Tính Giờ Công (+16 more)

### Community 27 - "windowsPrinter.ts"
Cohesion: 0.20
Nodes (14): CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter(), LabelPrintItem, listSystemPrinters() (+6 more)

### Community 28 - "product.service.ts"
Cohesion: 0.16
Nodes (53): F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), WarehouseFloor, findCodeConflicts(), findDuplicateProduct(), prepareSchemeVariants(), resolveCategoryAndBrand(), resolveVersionCode(), buildStaffRoleMap() (+45 more)

### Community 29 - "ProductCatalogModule.tsx"
Cohesion: 0.16
Nodes (24): 2.5 Bán hàng POS & Khách hàng (`/orders`, `/customers`), getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+16 more)

### Community 30 - "handover.service.ts"
Cohesion: 0.08
Nodes (65): A. Chấm công (`/attendance`), getAttendanceConfigHandler, getAttendanceHistoryHandler, getAttendanceTodayHandler, postAttendanceCheckInHandler, postAttendanceCheckOutHandler, putAttendanceConfigHandler, confirmHandoverHandler (+57 more)

### Community 31 - "ref_react"
Cohesion: 0.11
Nodes (32): ProductCatalogModule(), ProductCatalogTable(), COMMON_COLORS, COMMON_SIZES, ProductCatalogViewModel, StockStatusFilter, useProductCatalog(), useInventoryLoaders() (+24 more)

### Community 32 - "weeklyPreference.service.ts"
Cohesion: 0.12
Nodes (47): assignSingleShiftHandler, assignWeekBulkHandler, getMyScheduleHandler, getWeeklyScheduleHandler, markMyScheduleSeenHandler, registerWeeklyPreferencesHandler, leaveRequestRepo, shiftAssignmentRepo (+39 more)

### Community 33 - "useShiftSchedule.ts"
Cohesion: 0.17
Nodes (20): saveShiftChangesApi(), ShiftScheduleModule(), ShiftStaffSidebar(), addDays(), DAY_NAMES, DragPayload, isStaffInRow(), keyOf() (+12 more)

### Community 34 - "web/src/shared/ui/ContractFilePreviewModal.tsx"
Cohesion: 0.22
Nodes (5): preparePreview(), dataUrlToArrayBuffer(), preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer()

### Community 35 - "publicStorefront.ts"
Cohesion: 0.11
Nodes (19): 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)*, 2.15 Chọn & Hiển Thị 1 Hoặc Nhiều Mã Màu Trực Quan (`colorHexes`) Cho Biến Thể Sản Phẩm *(v3.3)*, 2.16 Chuẩn Hóa In Tem Nhiệt Code 128 Sắc Nét 203 DPI & Rút Gọn Mã Quét Chống Tràn Lề (`toCompactBarcode128`) *(v3.4)* (+11 more)

### Community 36 - "web/src/shared/types/promotions.ts"
Cohesion: 0.25
Nodes (7): EffectivePromotionStatus, Promotion, PromotionConditionCategory, PromotionConditionProduct, PromotionConditionType, PromotionDiscountType, PromotionGiftItem

### Community 37 - "useViewport.ts"
Cohesion: 0.67
Nodes (3): Breakpoint, useBreakpoint(), useIsMobile()

### Community 38 - "resolveVariantColorHexes"
Cohesion: 0.19
Nodes (27): ProductCatalogVariantSection(), AdminBatchImportTable(), HistoryTransfersView(), InventoryProductsTable(), InventoryTableFooter(), InventoryTransferTab(), InventoryVariantsPanel(), SetLinkModal() (+19 more)

### Community 40 - "productsInventory.controller.ts"
Cohesion: 0.19
Nodes (18): deleteProducts_ByIdHandler, getInventoryMovementsHandler, getInventoryReportHandler, getInventoryTransfersHandler, getProductsHandler, getProductsLookupHandler, patchProducts_ByIdHandler, patchProducts_ByIdVariantsHandler (+10 more)

### Community 41 - "web/src/shared/types/index.ts"
Cohesion: 0.12
Nodes (25): WebAuthGate(), WebAuthGateProps, NavItem, WebBottomNavbar(), WebBottomNavbarProps, WebChangePasswordModal(), WebChangePasswordModalProps, WebDrawers() (+17 more)

### Community 42 - "ocr-speed.test.ts"
Cohesion: 0.21
Nodes (12): buildHealthPayload(), createCorsMiddleware(), DEFAULT_ORIGINS, privateNetworkAccessMiddleware(), getDbMode(), env, createRateLimiter(), getRequestIpKey() (+4 more)

### Community 43 - "5. Đặc tả Component cốt lõi (`shop/`)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 44 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.11
Nodes (18): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging) (+10 more)

### Community 46 - "attendance.ts"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 47 - "ref_path"
Cohesion: 0.18
Nodes (5): args, BASELINE_FILE, current, __dirname, ROUTES_DIR

### Community 50 - "Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)"
Cohesion: 0.12
Nodes (16): 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS), Backend (`server/`), Backend (`server/.env` — tham khảo `server/.env.example`), Biến môi trường, Các lệnh thường dùng, Cách 1: Chạy nhanh bằng script có sẵn (Khuyên dùng), Cách 2: Chạy bằng Docker Compose, Cách 3: Cài đặt & chạy thủ công từng dịch vụ (+8 more)

### Community 51 - "StockMovement"
Cohesion: 0.08
Nodes (23): StockMovement, 2.3 Kho hàng, Sản phẩm & Sổ kho (`/products`, `/inventory`), 2.4 Nhập kho (`/imports`), 2.6 Trả / Đổi hàng (`/returns`), G. `POST /api/v1/products/:id/variants` & `PATCH /api/v1/products/:id/variants` — thêm / sửa biến thể trên sản phẩm có sẵn, 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 3.1 Danh mục (Category) & Sản phẩm (Product) (+15 more)

### Community 52 - "Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 53 - "cms/src/shared/utils/format.ts"
Cohesion: 0.08
Nodes (31): STATUS_INFO, STATUS_INFO, formatDateDisplay(), ServiceOrdersTab(), STATUS_INFO, STATUS_INFO, STATUS_INFO, ServiceManagementViewModel (+23 more)

### Community 54 - "web/src/features/attendance/components/MyAttendanceCalendar.tsx"
Cohesion: 0.12
Nodes (34): fetchMyCalendarApi(), markMyShiftScheduleSeenApi(), addLocalDaysStr(), DayCell(), DayDetailModal(), fmtMinutes(), getNextMondayFallbackStr(), InfoBox() (+26 more)

### Community 55 - "productRepo"
Cohesion: 0.23
Nodes (9): dotenv, apiCall(), buildProductName(), FLOOR_1_ITEMS, FLOOR_2_ITEMS, main(), PdfItemRow, apiCall() (+1 more)

### Community 56 - "staffImportParser.ts"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 57 - "cms/src/features/attendance/components/MyAttendanceCalendar.tsx"
Cohesion: 0.24
Nodes (17): fetchMyCalendarApi(), MyAttendanceCalendar(), DayCell(), DayDetailModal(), InfoBox(), Row(), StatCard(), CONTRACT_LABEL (+9 more)

### Community 58 - "compilerOptions"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 59 - "useHrmAttendance.ts"
Cohesion: 0.24
Nodes (12): createHolidayApi(), deleteHolidayApi(), fetchHolidays(), syncVietnamHolidaysApi(), HrmAttendanceModule(), HrmHolidaysTab(), HrmAttendanceViewModel, SubTab (+4 more)

### Community 60 - "Repository"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 61 - "compilerOptions"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 62 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 63 - "timesheet.queries.ts"
Cohesion: 0.09
Nodes (53): assertHolidayManager(), createHolidayHandler, deleteHolidayHandler, getHolidaysHandler, HOLIDAY_MANAGER_ROLES, syncVnHolidaysHandler, AttendanceCheckInType, AttendanceModel (+45 more)

### Community 64 - "excel.ts"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 65 - "2. Danh sách Endpoints"
Cohesion: 0.18
Nodes (11): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), H. `PATCH /api/v1/products/:id` — trường mới, I. `GET /api/v1/products/lookup?code=<mã quét>` (+3 more)

### Community 66 - "inventory/exports.ts"
Cohesion: 0.07
Nodes (67): useAttendanceTimesheet(), exportBrands(), exportCategories(), categoryNameOf(), checkersOf(), exportImports(), exportInventoryReport(), exportMovements() (+59 more)

### Community 67 - "useInventoryModule.tsx"
Cohesion: 0.10
Nodes (47): useCmsShell(), useBrandModule(), AdminBatchImportModal(), InventoryPaginationBar(), InventoryPaginationBarProps, parseAndApplyAdminImportFile(), downloadAdminSampleCsv(), submitAdminBatchImport() (+39 more)

### Community 68 - "utils/productCode.ts"
Cohesion: 0.07
Nodes (58): useInventoryScanner(), fetchFirstOkJson(), fetchWithTimeout(), buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), getBarcodeCandidates(), isOrderedSubsequence() (+50 more)

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

### Community 74 - "ocr.ts"
Cohesion: 0.16
Nodes (17): ALLOWED_MIME, buildThinkingConfig(), callGeminiModel(), callGeminiTable(), callGeminiTag(), DEFAULT_TABLE_MODELS, DEFAULT_TAG_MODELS, getGeminiModels() (+9 more)

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
Cohesion: 0.13
Nodes (28): 1. Hiện trạng, 2. Cấu trúc đích, 3. Các giai đoạn (mỗi giai đoạn = 1 commit, build xanh trước khi sang tiếp), 4. Rủi ro & cách giảm, 5. Ngoài phạm vi, 6. Ước lượng, Kế hoạch refactor `web/` theo cấu trúc `cms/`, PosServiceSection() (+20 more)

### Community 82 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 83 - "formatVND"
Cohesion: 0.25
Nodes (17): RevenueBreakdownCard(), AnimatedNumber(), CHART_COLORS, formatShortVND(), SvgDonutChart(), RevenueDashboardModule(), RevenueDebtTab(), RevenueLineChart() (+9 more)

### Community 84 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 86 - "ok"
Cohesion: 0.11
Nodes (35): Quy ước trong mỗi domain (`services/<domain>/`), deleteCategories_ByIdHandler, getCategoriesHandler, patchCategories_ByIdHandler, postCategoriesHandler, getPrintersHandler, printLabelsHandler, printersRouter (+27 more)

### Community 87 - "scripts"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 96 - "cms/src/shared/types/index.ts"
Cohesion: 0.23
Nodes (16): OrdersReturnsModuleProps, buildClientFallbackDashboard(), computeFallbackDebtStats(), aggregateOrdersAndReturns(), computeFallbackProductAndCategoryStats(), computeFallbackServiceStats(), buildFallbackPushProducts(), PushProductsReportResponse (+8 more)

### Community 97 - "StaffUser"
Cohesion: 0.14
Nodes (17): CmsAuthGateProps, CmsChangePasswordModalProps, CmsDrawersProps, CmsHeader(), CmsHeaderProps, CMS_MENU_ITEMS, CmsModuleType, ROLE_ALLOWED_MODULES (+9 more)

### Community 98 - "staff.service.ts"
Cohesion: 0.18
Nodes (23): getStaffHandler, patchStaff_ByIdHandler, postAuthChangePasswordHandler, postAuthLoginHandler, postStaffHandler, postStaffParseImportFileHandler, invalidateStaffAuthCache(), changePassword() (+15 more)

### Community 99 - "usePromotionModule.tsx"
Cohesion: 0.16
Nodes (13): PromotionConditionFields(), PromotionFormModal(), PromotionRewardFields(), PromotionModuleViewModel, toDateTimeLocalInput(), usePromotionModule(), EffectivePromotionStatus, Promotion (+5 more)

### Community 100 - "cms/src/app/layout.tsx"
Cohesion: 0.12
Nodes (11): dynamic, revalidate, inter, metadata, RootLayout(), VersionChecker(), dynamic, revalidate (+3 more)

### Community 101 - "apiRequest"
Cohesion: 0.18
Nodes (19): useWebShell(), getDefaultTabForRole(), isBlockedFromWebPos(), buildFallbackPushProducts(), MarketingPushProductsTab(), parseLocalDateBound(), PushProductRow, PushProductsReportResponse (+11 more)

### Community 102 - "importScan.service.ts"
Cohesion: 0.11
Nodes (61): deleteImports_ByIdHandler, getImports_ByIdHandler, getImportsHandler, postImports_ByIdCompleteHandler, postImports_ByIdFinishListingHandler, postImports_ByIdScanCheckHandler, postImports_ByIdScanTagHandler, postImportsHandler (+53 more)

### Community 103 - "ref_react"
Cohesion: 0.08
Nodes (36): DEBOUNCE_MS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZE_OPTIONS, BrandForm, BrandModuleViewModel, CODE_RE, EMPTY_FORM (+28 more)

### Community 104 - "wise.service.ts"
Cohesion: 0.26
Nodes (10): getWiseCurrenciesHandler, postWiseQuoteHandler, wiseRouter, fetchWiseQuoteRaw(), getWiseConfig(), getWiseCurrencies(), postWiseQuote(), roundCurrency() (+2 more)

### Community 105 - "PosShiftBillsSection.tsx"
Cohesion: 0.09
Nodes (45): AccountProfileTab(), toIsoDateSlice(), CustomerTab(), CustomerTabProps, fetchCurrentShiftOrdersApi(), formatPaymentMethodLabel(), formatShiftBadge(), formatShortVnDate() (+37 more)

### Community 106 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.18
Nodes (10): 10. Phiếu bàn giao → backend-dev, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên, 8. Tác động theo phần (+2 more)

### Community 107 - "server/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 108 - "shared/auth.ts"
Cohesion: 0.17
Nodes (17): bootstrap(), attachUserContext(), errorHandler(), Express, requireRoles(), resolveActiveStaffCached(), staffCache, assertSecurityEnvironment() (+9 more)

### Community 109 - "web/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 111 - "promotion.service.ts"
Cohesion: 0.11
Nodes (32): deletePromotions_ByIdHandler, getPromotionsHandler, patchPromotions_ByIdHandler, postPromotionsEvaluateHandler, postPromotionsHandler, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct (+24 more)

### Community 112 - "Nghiệp vụ Ngày lễ (`holidays/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Ngày lễ (`holidays/`), Quy tắc chính

### Community 119 - "mongoose"
Cohesion: 0.04
Nodes (77): mongoose, migration, AttendanceConfigModel, AttendanceConfigSchema, IAttendanceConfig, BrandModel, BrandSchema, BrandStatus (+69 more)

### Community 120 - "ShiftAssignment"
Cohesion: 0.22
Nodes (9): ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`), Cấu trúc, Nghiệp vụ Đơn nghỉ & Quỹ phép (`leave/`) (+1 more)

### Community 121 - "web/src/app/layout.tsx"
Cohesion: 0.32
Nodes (5): inter, metadata, RootLayout(), viewport, VersionChecker()

### Community 122 - "cms/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 123 - "CameraScannerModal.tsx"
Cohesion: 0.15
Nodes (22): boundedEditDistanceLeq1(), buildAcronym(), compactAlphaNum(), filterAndRankBySearch(), normalizePhoneDigits(), normalizeVietnamese(), PreparedField, scoreSearchMatch() (+14 more)

### Community 124 - "WiseCalculatorStash.tsx"
Cohesion: 0.36
Nodes (7): CURRENCIES, CurrencyOption, evaluateExpression(), formatExpressionDisplay(), formatNumber(), WiseCalculatorStash(), WiseRateResponse

### Community 125 - "web/src/shared/hooks/usePagedList.ts"
Cohesion: 0.43
Nodes (6): buildPageQuery(), extractPagination(), PagedQueryParams, PaginationMeta, usePagedList(), UsePagedListOptions

### Community 126 - "ocr-speed.test.ts"
Cohesion: 0.52
Nodes (5): pingKeepAliveOnce(), resolveKeepAliveHealthUrl(), resolveKeepAliveIntervalMs(), startKeepAlive(), app

### Community 127 - "useMobileTableLabels.ts"
Cohesion: 0.67
Nodes (5): applyTableLabels(), buildColumnLabels(), cellText(), extractFullCellText(), useMobileTableLabels()

### Community 128 - "useStaffModule.ts"
Cohesion: 0.17
Nodes (22): StaffCreateForm(), StaffCreateHrFields(), StaffEditProfileModal(), StaffEditSalarySection(), StaffImportPreviewModal(), StaffListTable(), StaffModule(), StaffPasswordModal() (+14 more)

### Community 129 - "web/src/config/listing.ts"
Cohesion: 0.40
Nodes (4): DEBOUNCE_MS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZE_OPTIONS

### Community 130 - "web/src/app/api/printers/route.ts"
Cohesion: 0.23
Nodes (13): CODE128_PATTERNS, compactColorTokenForBarcode(), dynamic, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, GET(), isThermalPrinter() (+5 more)

### Community 134 - "Kiến trúc Backend (`server/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc phân tầng (Layered Architecture), Kiến trúc Backend (`server/`), Quy tắc phụ thuộc một chiều

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 761 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StockMovement` connect `StockMovement` to `inventory/exports.ts`, `useInventoryModule.tsx`, `resolveVariantColorHexes`, `TagCheckScannerModal.tsx`, `Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)`, `ProductCatalogModule.tsx`, `ref_react`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `PATH`, `RFC-4180` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `shared/productCode.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08270676691729323 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `product.service.ts` to `weeklyPreference.service.ts`, `staff.service.ts`, `importScan.service.ts`, `order.service.ts`, `routes/index.ts`, `wise.service.ts`, `ocr.ts`, `productsInventory.controller.ts`, `shared/auth.ts`, `shared/productCode.ts`, `promotion.service.ts`, `serviceOrder.service.ts`, `returnCalc.service.ts`, `ok`, `mongoose`, `handover.service.ts`, `timesheet.queries.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `staffImport.parser.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Why does `A. Chấm công (`/attendance`)` connect `handover.service.ts` to `ShiftAssignment`, `web/src/features/attendance/components/HeaderAttendanceBar.tsx`, `ProductCatalogModule.tsx`, `cms/src/shared/types/hrm.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Should `web/src/features/attendance/components/HeaderAttendanceBar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09071117561683599 - nodes in this community are weakly interconnected._