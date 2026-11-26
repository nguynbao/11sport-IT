# Graph Report - 11sport-IT  (2026-11-26)

## Corpus Check
- 767 files · ~544,267 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 3, .example 3, .css 2)

## Summary
- 3625 nodes · 12483 edges · 132 communities (109 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 139 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4888c0df`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cms/src/app/page.tsx
- Product
- cms/src/features/attendance/components/MyAttendanceCalendar.tsx
- CreateLeaveModal.tsx
- shared/auth.ts
- web/src/features/attendance/hooks/useHeaderAttendanceBar.ts
- seed.ts
- order.service.ts
- ref_react
- ref_react
- cms/src/shared/types/hrm.ts
- useTagCheckScanner.ts
- Kiến trúc Frontend CMS (`cms/`)
- Migration DB — 11 Sport
- useServiceManagement.ts
- shared/productCode.ts
- server/package.json
- web/src/shared/utils/productCode.ts
- serviceOrder.service.ts
- imports.ts
- Feature Danh mục & Sản phẩm (`catalog/`)
- PosTab.tsx
- formatVND
- product.service.ts
- printerPrintLabels.ts
- mongoose
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- ApiError
- ref_lucide_react
- ProductCatalogModule.tsx
- handover.service.ts
- promotion.service.ts
- types/reports.ts
- useShiftHandover.tsx
- ref_lucide_react
- publicStorefront.ts
- barcodeMatch.ts
- importScan.service.ts
- weeklyPreference.service.ts
- migrations/types.ts
- web/scripts/check-architecture.mjs
- web/src/app/page.tsx
- RevenueDashboardModule.tsx
- 5. Đặc tả Component cốt lõi (`shop/`)
- Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)
- Feature Đơn hàng, Trả/Đổi & Công nợ (`orders/`)
- attendance.ts
- PosShiftBillsSection.tsx
- Nghiệp vụ Tích hợp ngoài (`integrations/`)
- Feature Khuyến mãi (`promotions/`)
- 11Sport CMS (Quản trị)
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport
- windowsPrinter.ts
- web/src/features/attendance/components/MyAttendanceCalendar.tsx
- useLeaveRequests.ts
- staffImportParser.ts
- cms/src/shared/types/hrm.ts
- compilerOptions
- useInventoryModule.tsx
- Repository
- compilerOptions
- web/src/components/BarcodeLabelModal.tsx
- repositories/index.ts
- excel.ts
- 2. Danh sách Endpoints
- inventory/exports.ts
- Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ
- utils/productCode.ts
- cms/src/app/api/printers/route.ts
- 3.1 Public Storefront API (`/api/v1/public/*`)
- 11Sport — Hệ thống Quản lý Bán hàng (POS), Kho vận & Quản trị (CMS)
- holidays.ts
- services
- 11Sport Server
- compilerOptions
- Feature Dịch vụ Kỹ thuật (`services/`)
- Feature Xếp ca & Bàn giao ca (`shifts/`)
- volumes
- environment
- StockMovement
- web/src/shared/utils/format.ts
- 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*
- server/scripts/check-architecture.mjs
- 3. Quy tắc Nghiệp vụ đã chốt (Business Rules)
- Baseline kiểm thử server — 2026-11-12
- ShiftHandoverModal.tsx
- scripts
- 2. Danh sách Test Case chi tiết (`AC-01` .. `AC-08`)
- healthcheck
- web/src/app/layout.tsx
- web/src/shared/hooks/usePagedList.ts
- handover.service.ts
- ocr-speed.test.ts
- web/src/app/layout.tsx
- importPdfInventory.ts
- scripts
- staffImport.parser.ts
- ShiftAssignment
- Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)
- cms/scripts/check-architecture.mjs
- wise.service.ts
- ensure-ocr-data.sh
- ocr-speed.test.ts
- Nghiệp vụ Ngày lễ (`holidays/`)
- Nghiệp vụ Danh mục & Quy chuẩn mã (`catalog/`)
- Nghiệp vụ Kho hàng (`inventory/`)
- Nghiệp vụ Bán hàng, Khách hàng & Công nợ (`orders/`)
- Nghiệp vụ Sản phẩm (`products/`)
- returns/README.md
- Nghiệp vụ Nhân sự (`staff/`)
- useStaffModule.ts
- useShiftSchedule.ts
- ref_react
- WiseCalculatorPanel.tsx
- AttendanceModal.tsx
- web/src/config/listing.ts
- web/src/app/api/printers/route.ts
- Product
- marketing/hooks/useMarketingPushProducts.ts
- useHrmAttendance.ts
- ref_lucide_react
- useViewport.ts
- Cấu trúc
- Kiến trúc Backend (`server/`)
- web/src/shared/hooks/useMobileTableLabels.ts

## God Nodes (most connected - your core abstractions)
1. `ApiError` - 174 edges
2. `ok()` - 109 edges
3. `formatVND()` - 82 edges
4. `formatVND()` - 78 edges
5. `apiRequest()` - 64 edges
6. `normalizeToCompactUpperCode()` - 58 edges
7. `Product` - 57 edges
8. `formatNumberDots()` - 52 edges
9. `apiRequest()` - 48 edges
10. `getFloorStocks()` - 47 edges

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

## Communities (132 total, 23 thin omitted)

### Community 0 - "cms/src/app/page.tsx"
Cohesion: 0.06
Nodes (55): CmsAuthGate(), CmsAuthGateProps, CmsChangePasswordModal(), CmsChangePasswordModalProps, CmsDrawers(), CmsDrawersProps, CmsHeader(), CmsHeaderProps (+47 more)

### Community 1 - "Product"
Cohesion: 0.10
Nodes (51): CartItemDiscountPanelProps, PosCartSlice, usePosCart(), PosCatalogSlice, usePosCatalog(), PosCheckoutSlice, PosDraftsSlice, usePosDrafts() (+43 more)

### Community 2 - "cms/src/features/attendance/components/MyAttendanceCalendar.tsx"
Cohesion: 0.24
Nodes (17): fetchMyCalendarApi(), MyAttendanceCalendar(), DayCell(), DayDetailModal(), InfoBox(), Row(), StatCard(), CONTRACT_LABEL (+9 more)

### Community 3 - "CreateLeaveModal.tsx"
Cohesion: 0.17
Nodes (19): cancelLeaveRequestApi(), createLeaveRequestApi(), fetchMyLeaveRequestsApi(), AvailableOffDayOption, CreateLeaveModal(), LeaveFilter, LeaveFilter, MyLeaveRequestsPanel() (+11 more)

### Community 4 - "shared/auth.ts"
Cohesion: 0.11
Nodes (26): buildHealthPayload(), createCorsMiddleware(), DEFAULT_ORIGINS, privateNetworkAccessMiddleware(), getDbMode(), env, bootstrap(), attachUserContext() (+18 more)

### Community 5 - "web/src/features/attendance/hooks/useHeaderAttendanceBar.ts"
Cohesion: 0.19
Nodes (18): checkInApi(), checkOutApi(), getTodayAttendanceApi(), AttendanceModal(), Props, HeaderAttendanceBar(), Props, IncomingHandoverPopup() (+10 more)

### Community 6 - "seed.ts"
Cohesion: 0.16
Nodes (27): An toàn DB, supertest, createApp(), clearDatabase(), connectDatabase(), disconnectDatabase(), seedDatabaseIfNeeded(), staffRepo (+19 more)

### Community 7 - "order.service.ts"
Cohesion: 0.15
Nodes (40): deleteOrders_ByIdHandler, getCustomersHandler, getCustomersLookupHandler, getOrders_ByIdHandler, getOrdersByCode_ByCodeHandler, getOrdersCurrentShiftHandler, getOrdersHandler, postOrders_ByIdConfirmHandler (+32 more)

### Community 8 - "ref_react"
Cohesion: 0.12
Nodes (19): preparePreview(), ContractFilePreviewModalProps, dataUrlToArrayBuffer(), AccountHero(), AccountHrSection(), AccountProfileTab(), AccountRulesCard(), AccountProfileState (+11 more)

### Community 9 - "ref_react"
Cohesion: 0.10
Nodes (37): useInventoryData(), Params, useInventoryDisplayed(), Params, useInventoryLabels(), useInventoryPriceEdit(), useInventoryScanner(), useInventoryTab() (+29 more)

### Community 10 - "cms/src/shared/types/hrm.ts"
Cohesion: 0.14
Nodes (30): adjustAttendanceApi(), createManualAttendanceApi(), fetchTimesheetApi(), AttendanceTimesheetModule(), ManualAttendanceModal(), Time24Input(), CellDetailModal(), KpiCard() (+22 more)

### Community 11 - "useTagCheckScanner.ts"
Cohesion: 0.06
Nodes (62): TagCheckCameraPanel(), Props, TagCheckHeader(), Props, TagCheckItemList(), ChooseOverlay(), ChooseProps, ProcessingOverlay() (+54 more)

### Community 12 - "Kiến trúc Frontend CMS (`cms/`)"
Cohesion: 0.40
Nodes (4): Cấu trúc thư mục, Khuôn mẫu chuẩn mỗi `src/features/<feature>/`, Kiến trúc Frontend CMS (`cms/`), Quy tắc phụ thuộc một chiều

### Community 13 - "Migration DB — 11 Sport"
Cohesion: 0.33
Nodes (5): Cơ chế an toàn, Lệnh, Migration DB — 11 Sport, Migration hiện có, Quy trình deploy (bắt buộc)

### Community 14 - "useServiceManagement.ts"
Cohesion: 0.06
Nodes (46): DEBOUNCE_MS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZE_OPTIONS, BrandModule(), CategoryModule(), BrandForm, BrandModuleViewModel (+38 more)

### Community 15 - "shared/productCode.ts"
Cohesion: 0.04
Nodes (104): RFC-4180, deleteBrands_ByIdHandler, getBrandsHandler, patchBrands_ByIdHandler, postBrandsHandler, deleteCategories_ByIdHandler, getCategoriesHandler, patchCategories_ByIdHandler (+96 more)

### Community 16 - "server/package.json"
Cohesion: 0.08
Nodes (31): cors, dotenv, mongodb-memory-server, tesseract.js, ts-node-dev, @types/cors, @types/express, @types/supertest (+23 more)

### Community 17 - "web/src/shared/utils/productCode.ts"
Cohesion: 0.09
Nodes (48): Params, CODE128_PATTERNS, encodeCode128Bars(), encodeCode128RawPattern(), escapeHtml(), renderCode128PrintSvgFor203Dpi(), renderCode128SvgString(), sanitizeAscii() (+40 more)

### Community 18 - "serviceOrder.service.ts"
Cohesion: 0.11
Nodes (45): deleteServiceTypes_ByIdHandler, getServiceOrders_ByIdHandler, getServiceOrdersHandler, getServiceTypesHandler, patchServiceOrders_ByIdHandler, patchServiceOrders_ByIdStatusHandler, patchServiceTypes_ByIdHandler, postServiceOrders_ByIdPaymentsHandler (+37 more)

### Community 19 - "imports.ts"
Cohesion: 0.07
Nodes (40): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+32 more)

### Community 21 - "PosTab.tsx"
Cohesion: 0.06
Nodes (41): dependencies, docx-preview@^0.4.1, lucide-react@^0.460.0, mammoth@^1.13.0, next@^14.2.15, react@^18.3.1, react-dom@^18.3.1, devDependencies (+33 more)

### Community 22 - "formatVND"
Cohesion: 0.08
Nodes (47): ProductCatalogMobileCards(), ProductCatalogTable(), ProductCatalogVariantSection(), ProductCatalogViewModel, AdminBatchImportTable(), SetLinkModal(), DebtManagementModule(), DebtPaymentModal() (+39 more)

### Community 23 - "product.service.ts"
Cohesion: 0.11
Nodes (72): F. `POST /api/v1/products` — luồng mới (khi body có `brandId`), deleteProducts_ByIdHandler, getInventoryMovementsHandler, getInventoryReportHandler, getInventoryTransfersHandler, getProductsHandler, getProductsLookupHandler, patchProducts_ByIdHandler (+64 more)

### Community 24 - "printerPrintLabels.ts"
Cohesion: 0.18
Nodes (18): dynamic, GET(), POST(), runtime, CODE128_PATTERNS, compactColorTokenForBarcode(), encodeCode128BPattern(), encodeCode128RawPattern() (+10 more)

### Community 25 - "mongoose"
Cohesion: 0.04
Nodes (37): mongoose, AttendanceConfigModel, AttendanceConfigSchema, IAttendanceConfig, BrandModel, BrandSchema, BrandStatus, IBrand (+29 more)

### Community 26 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.08
Nodes (23): 1. Bối cảnh & Mục tiêu kinh doanh, 2.1 Trong phạm vi (In-Scope - Phase 1), 2.2 Ngoài phạm vi (Out-of-Scope - Phase 2), 2. Phạm vi (Scope), 3.1 Danh sách Tác nhân theo 2 Khối, 3.2 Ma trận Phân quyền Mô-đun CMS (CMS Access Matrix), 3. Tác nhân hệ thống & Phân quyền CMS (Actors & Permissions), 4.1 Cấu hình Ca & Tính Giờ Công (+15 more)

### Community 27 - "ApiError"
Cohesion: 0.07
Nodes (62): Quy ước trong mỗi domain (`services/<domain>/`), express, getMyCalendarHandler, getTimesheetHandler, patchAttendanceHandler, postManualAttendanceHandler, getStaffHandler, patchStaff_ByIdHandler (+54 more)

### Community 28 - "ref_lucide_react"
Cohesion: 0.09
Nodes (43): PosServicesModeBarProps, CollectModal(), PosServiceSection(), PrintServiceReceipt(), ServiceCart(), ServiceCatalogPanel(), ServiceCustomerForm(), ServiceHeader() (+35 more)

### Community 29 - "ProductCatalogModule.tsx"
Cohesion: 0.22
Nodes (21): Quy tắc viết migration, getFlag(), getOpt(), main(), acquireLock(), AppliedRecord, connect(), create() (+13 more)

### Community 30 - "handover.service.ts"
Cohesion: 0.16
Nodes (31): getAttendanceConfigHandler, getAttendanceHistoryHandler, getAttendanceTodayHandler, postAttendanceCheckInHandler, postAttendanceCheckOutHandler, putAttendanceConfigHandler, attendanceRouter, AttendanceConfig (+23 more)

### Community 31 - "promotion.service.ts"
Cohesion: 0.14
Nodes (28): deletePromotions_ByIdHandler, getPromotionsHandler, patchPromotions_ByIdHandler, postPromotionsEvaluateHandler, postPromotionsHandler, IPromotion, IPromotionConditionCategory, IPromotionConditionProduct (+20 more)

### Community 32 - "types/reports.ts"
Cohesion: 0.06
Nodes (54): canProcessReturn(), OrderDetailModal(), Props, OrdersReturnsModule(), OrdersReturnsModuleProps, OrdersTableSectionProps, Props, ReturnDetailModal() (+46 more)

### Community 33 - "useShiftHandover.tsx"
Cohesion: 0.24
Nodes (15): confirmShiftHandoverApi(), deleteShiftHandoverApi(), fetchDailyHandoverCheckApi(), fetchHandoverScheduleConfigApi(), fetchShiftHandoversApi(), updateHandoverScheduleConfigApi(), ShiftHandoverDetailModal(), ShiftHandoverModule() (+7 more)

### Community 34 - "ref_lucide_react"
Cohesion: 0.07
Nodes (42): 1. Hiện trạng, 2. Cấu trúc đích, 4. Rủi ro & cách giảm, 5. Ngoài phạm vi, 6. Ước lượng, Kế hoạch refactor `web/` theo cấu trúc `cms/`, CartGiftRows(), CartGiftRowsProps (+34 more)

### Community 35 - "publicStorefront.ts"
Cohesion: 0.07
Nodes (29): downloadStaffImportTemplate(), StockMovement, 2.0 Kiểm tra trạng thái hệ thống (`/health`), 2.10 Chương trình Khuyến mãi (`/promotions`) *(v2.7)*, 2.10 Quản lý Loại Dịch Vụ & Đơn Dịch Vụ (`/service-types`, `/service-orders`), 2.11 Chuẩn hóa Mã Sản Phẩm Viết Liền, Biến Thể (`Size` / `Màu`) & Nhập Kho File PDF/Excel + In Tem Label *(v2.8)*, 2.13 Máy in Tem Mã Vạch Nhiệt & In Trực Tiếp (`/printers`) *(v3.1)*, 2.14 Mã Con Theo Thuộc Tính Biến Thể (`variantCode`) — In Tem & Quét Kiểm Kho / Bán Hàng POS *(v3.2)* (+21 more)

### Community 36 - "barcodeMatch.ts"
Cohesion: 0.26
Nodes (13): buildTelexCandidatesFromNormalized(), cleanBarcodeCode(), collapseUnikeyBackspaceStutter(), getBarcodeCandidates(), NFD_TO_TELEX_KEY, exactCodeMatch(), findProductAndVariantByScannedBarcode(), findProductByScannedBarcode() (+5 more)

### Community 37 - "importScan.service.ts"
Cohesion: 0.05
Nodes (116): ensureStandardProductCodesMigrated(), deleteImports_ByIdHandler, getImports_ByIdHandler, getImportsHandler, postImports_ByIdCompleteHandler, postImports_ByIdFinishListingHandler, postImports_ByIdScanCheckHandler, postImports_ByIdScanTagHandler (+108 more)

### Community 38 - "weeklyPreference.service.ts"
Cohesion: 0.05
Nodes (98): assignSingleShiftHandler, assignWeekBulkHandler, getMyScheduleHandler, getWeeklyScheduleHandler, markMyScheduleSeenHandler, registerWeeklyPreferencesHandler, AttendanceCheckInType, AttendanceModel (+90 more)

### Community 39 - "migrations/types.ts"
Cohesion: 0.27
Nodes (5): migration, migration, toObjectId(), Migration, MigrationContext

### Community 40 - "web/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 41 - "web/src/app/page.tsx"
Cohesion: 0.09
Nodes (39): WebAuthGate(), WebAuthGateProps, NavItem, WebBottomNavbar(), WebBottomNavbarProps, WebChangePasswordModal(), WebChangePasswordModalProps, WebDrawers() (+31 more)

### Community 42 - "RevenueDashboardModule.tsx"
Cohesion: 0.18
Nodes (18): RevenueBreakdownCard(), AnimatedNumber(), CHART_COLORS, formatShortVND(), SvgDonutChart(), RevenueDashboardModule(), RevenueDebtTab(), RevenueLineChart() (+10 more)

### Community 43 - "5. Đặc tả Component cốt lõi (`shop/`)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 44 - "Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)"
Cohesion: 0.11
Nodes (18): 1. Kiến trúc Triển khai & Danh sách Cổng (Ports), 2.1 `server/.env.example`, 2.2 `web/.env.example` (POS & Kho - Port 3000), 2.3 `cms/.env.example` (Quản trị - Port 3001), 2. Cấu hình Biến môi trường (Environment Variables), 3. Hướng dẫn Khởi chạy Hệ thống, 4.1 Điểm kiểm tra (Endpoints), 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging) (+10 more)

### Community 46 - "attendance.ts"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 47 - "PosShiftBillsSection.tsx"
Cohesion: 0.13
Nodes (29): fetchCurrentShiftOrdersApi(), PosShiftBillsSection(), PosShiftBillsSectionProps, Props, ShiftBillDetailModal(), Props, ShiftBillsFilters(), Props (+21 more)

### Community 50 - "11Sport CMS (Quản trị)"
Cohesion: 0.13
Nodes (12): 11Sport CMS (Quản trị), Cài đặt & chạy, Cấu trúc, Lệnh, 11Sport — Hệ thống Bán hàng (POS), Kho vận & Quản trị, Chạy nhanh, Công nghệ, Tính năng chính (+4 more)

### Community 51 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.17
Nodes (11): 1. Bối cảnh & Mục tiêu kinh doanh, 2. Vai trò người dùng & Phân quyền (RBAC), 3.1 Danh mục (Category) & Sản phẩm (Product), 3.2 Kế toán Kho & Sổ kho (Stock Movement), 3.3 Nhập kho (Import Receipt), 3.4 Bán hàng (POS Order) & Xuất PDF, 3.5 Trả / Đổi hàng (Return & Exchange), 3. Quy tắc Nghiệp vụ đã chốt (Business Rules) (+3 more)

### Community 52 - "Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport"
Cohesion: 0.13
Nodes (14): generateValue, key, sync, value, services, buildCommand, envVars, healthCheckPath (+6 more)

### Community 53 - "windowsPrinter.ts"
Cohesion: 0.14
Nodes (19): getPrintersHandler, printLabelsHandler, CODE128_PATTERNS, DirectPrintPayload, encodeCode128BPattern(), encodeCode128RawPattern(), execFileAsync, isThermalPrinter() (+11 more)

### Community 54 - "web/src/features/attendance/components/MyAttendanceCalendar.tsx"
Cohesion: 0.09
Nodes (30): DayCell(), MyCalendarGrid(), Props, Props, Props, MyCalendarNextWeekSchedule(), Props, addLocalDaysStr() (+22 more)

### Community 55 - "useLeaveRequests.ts"
Cohesion: 0.15
Nodes (30): MyAttendanceCalendar(), Props, InfoBox(), MyCalendarDayModal(), Row(), MyCalendarHeader(), MyCalendarLegend(), MyCalendarSummary() (+22 more)

### Community 56 - "staffImportParser.ts"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 57 - "cms/src/shared/types/hrm.ts"
Cohesion: 0.13
Nodes (18): AttendanceConfig, AttendanceRecord, DailyHandoverCategorySummary, DailyHandoverCheckData, HandoverScheduleConfigData, MyCalendarCellCode, MyCalendarLeave, MyCalendarSummary (+10 more)

### Community 58 - "compilerOptions"
Cohesion: 0.15
Nodes (13): depends_on, server, condition, web, command, container_name, depends_on, image (+5 more)

### Community 59 - "useInventoryModule.tsx"
Cohesion: 0.13
Nodes (31): AdminBatchImportModal(), CmsRoleBadge(), HistoryImportsView(), HistoryMovementsView(), HistoryTransfersView(), ImportReceiptDetailModal(), InventoryHistoryTab(), InventoryModule() (+23 more)

### Community 60 - "Repository"
Cohesion: 0.17
Nodes (11): driver, networks, 11sport-net, services, version, volumes, cms_node_modules, mongodb_config (+3 more)

### Community 61 - "compilerOptions"
Cohesion: 0.17
Nodes (12): mongodb, condition, command, container_name, depends_on, image, networks, ports (+4 more)

### Community 62 - "web/src/components/BarcodeLabelModal.tsx"
Cohesion: 0.17
Nodes (11): 1. Kiến trúc Thông tin & Luồng người dùng (User Flows), 2. Đặc tả Chi tiết Các Màn hình & Wireframe, 3. Design Tokens Áp dụng (TailwindCSS), 4. Phiếu Bàn giao Thiết kế (Designer -> Backend & Frontend Dev), Màn hình 1: Mobile / Web Check-in & Chấm công (Dùng chung Showroom & Văn phòng), Màn hình 2: Pop-up Thứ 6 Đăng ký Ca & Lịch bận (Khối Sales), Màn hình 3: Giao diện Kéo - Thả Xếp Ca cho HR (`Drag & Drop Scheduler` trên CMS), Màn hình 4: Màn hình Bàn giao Kho Tầng 1 & Chốt Két (Showroom Sales) (+3 more)

### Community 63 - "repositories/index.ts"
Cohesion: 0.04
Nodes (90): getReportsPushProductsHandler, getReportsRevenueDashboardHandler, getReportsStaffActivityHandler, getReturnsHandler, postReturnsCalculateHandler, postReturnsHandler, IImportReceipt, ImportReceiptItemSchema (+82 more)

### Community 64 - "excel.ts"
Cohesion: 0.17
Nodes (11): 1. Thực hiện đề xuất an toàn DB & cập nhật 4 file test theo chuẩn mã v3.2, 2. Đối chiếu nghiệm thu 16 tiêu chí `AC-01`..`AC-16` (`docs/requirements/doanh-thu-dashboard.md`), 3. Kết quả chạy toàn bộ Test Suite (`server`), 4. Phiếu bàn giao (QA-03), Baseline kiểm thử server — 2026-11-12, Báo cáo Nghiệm thu QA-03 (Sau khi chủ xác nhận quy chuẩn mã v3.2 & kiểm thử AC-01..AC-16), Kết quả tổng, Nguyên nhân gốc — MỘT nguyên nhân chung (+3 more)

### Community 65 - "2. Danh sách Endpoints"
Cohesion: 0.18
Nodes (11): 2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*, A. Quy tắc mã, B. Thương hiệu (`/brands`), C. Category — trường mới, D. Product — trường mới (response `GET /products`, `POST/PATCH /products`), E. `POST /api/v1/products/preview-code` (xem trước mã, không ghi DB), H. `PATCH /api/v1/products/:id` — trường mới, I. `GET /api/v1/products/lookup?code=<mã quét>` (+3 more)

### Community 66 - "inventory/exports.ts"
Cohesion: 0.08
Nodes (59): ProductCatalogModule(), exportBrands(), exportCategories(), COMMON_SIZES, categoryNameOf(), checkersOf(), exportImports(), exportInventoryReport() (+51 more)

### Community 67 - "Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ"
Cohesion: 0.15
Nodes (12): 10. Phiếu bàn giao → backend-dev, 1. Hiện trạng đã xác minh trong code, 2. Công thức chuẩn, 3. Ví dụ số (một đơn đủ các yếu tố), 4. User story, 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ, 6. Tiêu chí nghiệm thu (Given/When/Then), 7. Trường hợp biên (+4 more)

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

### Community 74 - "11Sport Server"
Cohesion: 0.22
Nodes (7): 1. Quy ước chung, Hợp đồng API (API Contract) - 11 Sport (v5.0), 11Sport Server, Biến môi trường (`.env`), Cài đặt & chạy, Cấu trúc, Lệnh thường dùng

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

### Community 81 - "web/src/shared/utils/format.ts"
Cohesion: 0.06
Nodes (45): AccountPersonalForm(), fetchRecentCustomersApi(), lookupCustomerByPhoneApi(), CustomerOrdersTable(), CustomerOrdersTableProps, CustomerProfileSummary(), CustomerProfileSummaryProps, CustomerReturnsList() (+37 more)

### Community 82 - "2.19 Chuẩn hoá Mã Sản Phẩm `CATE + BRAND + VERSION + MÀU + SIZE`, Thương hiệu (`/brands`) & Giá theo biến thể *(v5.0)*"
Cohesion: 0.33
Nodes (5): 1. Nhận diện Thương hiệu Thể thao (Athletic & High-Contrast POS), 2. Bảng màu (Color Tokens - TailwindCSS — White & Clean Dual-App), 3. Typography & Định dạng hiển thị, 4. Các Component cốt lõi, Design System - 11Sport (POS, Kho & CMS)

### Community 83 - "server/scripts/check-architecture.mjs"
Cohesion: 0.07
Nodes (17): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+9 more)

### Community 84 - "3. Quy tắc Nghiệp vụ đã chốt (Business Rules)"
Cohesion: 0.33
Nodes (5): 1. Vấn đề, 2. Quy tắc đã chốt, 3. Chuyển đổi dữ liệu cũ (CHỈ DB LOCAL), 4. Tiêu chí nghiệm thu, Chuẩn hoá mã sản phẩm: CATEGORY + BRAND + VERSION + MÀU + SIZE (v1)

### Community 86 - "ShiftHandoverModal.tsx"
Cohesion: 0.10
Nodes (32): Props, createHandoverApi(), CashSection(), NoteSection(), CategoryTotalsSection(), Props, CheckoutTimeNotice(), LateReasonSection() (+24 more)

### Community 87 - "scripts"
Cohesion: 0.50
Nodes (3): Cài đặt (Claude Code), Cách dùng, Skill GitHub gợi ý cho từng phòng ban

### Community 96 - "web/src/app/layout.tsx"
Cohesion: 0.32
Nodes (5): inter, metadata, RootLayout(), viewport, VersionChecker()

### Community 97 - "web/src/shared/hooks/usePagedList.ts"
Cohesion: 0.43
Nodes (6): buildPageQuery(), extractPagination(), PagedQueryParams, PaginationMeta, usePagedList(), UsePagedListOptions

### Community 98 - "handover.service.ts"
Cohesion: 0.15
Nodes (34): confirmHandoverHandler, deleteHandoverHandler, getHandoverDailyCheckHandler, getHandoverScheduleConfigHandler, listHandoversHandler, putHandoverScheduleConfigHandler, submitHandoverHandler, attendanceConfigRepo (+26 more)

### Community 99 - "ocr-speed.test.ts"
Cohesion: 0.52
Nodes (5): pingKeepAliveOnce(), resolveKeepAliveHealthUrl(), resolveKeepAliveIntervalMs(), startKeepAlive(), app

### Community 100 - "web/src/app/layout.tsx"
Cohesion: 0.12
Nodes (11): dynamic, revalidate, inter, metadata, RootLayout(), VersionChecker(), dynamic, revalidate (+3 more)

### Community 101 - "importPdfInventory.ts"
Cohesion: 0.38
Nodes (6): apiCall(), buildProductName(), FLOOR_1_ITEMS, FLOOR_2_ITEMS, main(), PdfItemRow

### Community 103 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, dev, lint, lint:arch, migrate, migrate:prod, recode:products (+6 more)

### Community 104 - "staffImport.parser.ts"
Cohesion: 0.13
Nodes (28): Request, ContractType, IStaff, StaffDepartment, StaffModel, StaffRole, StaffSchema, StaffStatus (+20 more)

### Community 105 - "ShiftAssignment"
Cohesion: 0.20
Nodes (11): LeaveRequest, ShiftAssignment, 2.13 Quản trị Nhân sự, Chấm công & Xếp ca HRM (`/attendance`, `/leave-requests`, `/shifts`, `/holidays`) *(v4.0)*, A. Chấm công (`/attendance`), B. Đơn từ & Phê duyệt WFH / Nghỉ phép (`/leave-requests`), C. Xếp ca & Bàn giao Kho Tầng 1 (`/shifts`), D. Cấu hình Ngày Lễ (`/holidays`), E. Kiểm tra Phiên bản Build trên Web & CMS (`GET /api/version`) (+3 more)

### Community 106 - "Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)"
Cohesion: 0.33
Nodes (5): 1. Tổng quan Phạm vi & Môi trường Kiểm thử, 2. Bảng Ma trận Test Cases chi tiết (AC-01 đến AC-07 & Biên/Lỗi), 3. Kết quả Chạy Kiểm thử Tự động & Kiểm tra Build/Type-check, 4. Kết luận Nghiệm thu, Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)

### Community 107 - "cms/scripts/check-architecture.mjs"
Cohesion: 0.13
Nodes (11): cycles, dfs(), __dirname, files, FORBIDDEN, graph, inStack, SRC_ROOT (+3 more)

### Community 108 - "wise.service.ts"
Cohesion: 0.28
Nodes (10): getWiseCurrenciesHandler, postWiseQuoteHandler, wiseRouter, fetchWiseQuoteRaw(), getWiseConfig(), getWiseCurrencies(), postWiseQuote(), roundCurrency() (+2 more)

### Community 111 - "ocr-speed.test.ts"
Cohesion: 0.14
Nodes (6): CollectionRecord, generateObjectId(), matchFilter(), MemoryStore, memoryStore, Repository

### Community 112 - "Nghiệp vụ Ngày lễ (`holidays/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc, Nghiệp vụ Ngày lễ (`holidays/`), Quy tắc chính

### Community 119 - "useStaffModule.ts"
Cohesion: 0.18
Nodes (22): StaffCreateForm(), StaffCreateHrFields(), StaffEditProfileModal(), StaffEditSalarySection(), StaffImportPreviewModal(), StaffListTable(), StaffModule(), StaffPasswordModal() (+14 more)

### Community 120 - "useShiftSchedule.ts"
Cohesion: 0.22
Nodes (17): fetchShiftSchedule(), saveShiftChangesApi(), ShiftScheduleModule(), ShiftStaffSidebar(), addDays(), DAY_NAMES, DragPayload, isStaffInRow() (+9 more)

### Community 122 - "ref_react"
Cohesion: 0.07
Nodes (65): SubTab, COMMON_COLORS, StockStatusFilter, useProductCatalog(), InventoryPaginationBar(), InventoryPaginationBarProps, parseAndApplyAdminImportFile(), downloadAdminSampleCsv() (+57 more)

### Community 124 - "WiseCalculatorPanel.tsx"
Cohesion: 0.24
Nodes (12): WiseCalc, WiseCalculatorPanel(), WiseKeypad(), WiseKeypadProps, WiseCalculatorStash(), useWiseCalculator(), CURRENCIES, CurrencyOption (+4 more)

### Community 125 - "AttendanceModal.tsx"
Cohesion: 0.26
Nodes (13): fetchMyCalendarApi(), fetchMyShiftScheduleApi(), markMyShiftScheduleSeenApi(), submitShiftPreferencesApi(), FridayShiftRegistrationModal(), Props, useFridayShiftRegistration(), useMyAttendanceCalendar() (+5 more)

### Community 129 - "web/src/config/listing.ts"
Cohesion: 0.40
Nodes (4): DEBOUNCE_MS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZE_OPTIONS

### Community 130 - "web/src/app/api/printers/route.ts"
Cohesion: 0.23
Nodes (15): CODE128_PATTERNS, compactColorTokenForBarcode(), encodeCode128BPattern(), encodeCode128RawPattern(), sanitizeAsciiCode128(), toCompactBarcode128(), dynamic, execFileAsync (+7 more)

### Community 131 - "Product"
Cohesion: 0.08
Nodes (47): canOverrideExchangeDowngrade(), Params, ExchangeCart(), Props, ExchangeCartDesktopTable(), ExchangeCartViewProps, ExchangeCartMobileCards(), ExchangeCartViewProps (+39 more)

### Community 132 - "marketing/hooks/useMarketingPushProducts.ts"
Cohesion: 0.26
Nodes (11): MarketingPushProductsTab(), PushFiltersHeader(), PushKpiCards(), PushProductsTable(), MarketingPushState, useMarketingPushProducts(), buildFallbackPushProducts(), parseLocalDateBound() (+3 more)

### Community 135 - "useHrmAttendance.ts"
Cohesion: 0.21
Nodes (13): createHolidayApi(), deleteHolidayApi(), fetchHolidays(), syncVietnamHolidaysApi(), HrmAttendanceModule(), HrmHolidaysTab(), HrmAttendanceViewModel, SubTab (+5 more)

### Community 136 - "ref_lucide_react"
Cohesion: 0.10
Nodes (47): AddVariantForm(), Props, InventoryCtx, InventoryMobileCards(), Props, InventoryMobileVariantsExpand(), Props, InventoryRow() (+39 more)

### Community 137 - "useViewport.ts"
Cohesion: 0.67
Nodes (3): Breakpoint, useBreakpoint(), useIsMobile()

### Community 140 - "Kiến trúc Backend (`server/`)"
Cohesion: 0.50
Nodes (3): Cấu trúc phân tầng (Layered Architecture), Kiến trúc Backend (`server/`), Quy tắc phụ thuộc một chiều

### Community 150 - "web/src/shared/hooks/useMobileTableLabels.ts"
Cohesion: 0.67
Nodes (5): applyTableLabels(), buildColumnLabels(), cellText(), extractFullCellText(), useMobileTableLabels()

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `RFC-4180`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 818 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StockMovement` connect `publicStorefront.ts` to `inventory/exports.ts`, `Tài liệu Kịch bản Kiểm thử & Kết quả Nghiệm thu - 11Sport (v1.0)`, `Đặc tả yêu cầu: Hệ thống Chấm công & Quản trị Nhân sự (HRM & Shift Handover)`, `3. Quy tắc Nghiệp vụ đã chốt (Business Rules)`, `ref_react`, `useInventoryModule.tsx`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **What connects `PATH`, `RFC-4180` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cms/src/app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05679974034404414 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `ApiError` to `handover.service.ts`, `importScan.service.ts`, `weeklyPreference.service.ts`, `order.service.ts`, `wise.service.ts`, `shared/productCode.ts`, `serviceOrder.service.ts`, `windowsPrinter.ts`, `product.service.ts`, `promotion.service.ts`, `handover.service.ts`, `repositories/index.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Product` be split into smaller, more focused modules?**
  _Cohesion score 0.09728622631848438 - nodes in this community are weakly interconnected._
- **Why does `A. Chấm công (`/attendance`)` connect `ShiftAssignment` to `ShiftHandoverModal.tsx`, `ProductCatalogModule.tsx`, `handover.service.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `shared/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._