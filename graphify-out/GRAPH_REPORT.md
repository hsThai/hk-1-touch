# Graph Report - hk  (2026-11-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1444 nodes · 3521 edges · 80 communities (64 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a326aa5f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 66
- Community 67
- Community 71

## God Nodes (most connected - your core abstractions)
1. `logAction()` - 209 edges
2. `react` - 70 edges
3. `MainAppContent()` - 69 edges
4. `usePermission()` - 54 edges
5. `OrderDrawer()` - 49 edges
6. `getPbUrl()` - 47 edges
7. `getAuth()` - 38 edges
8. `logHistory()` - 29 edges
9. `SaleOrderPage()` - 27 edges
10. `renderMobilePages()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `save()` --calls--> `logAction()`  [EXTRACTED]
  src/pages/SupplierPage.jsx → src/pages/pb.jsx
- `doMerge()` --calls--> `logAction()`  [EXTRACTED]
  src/pages/ProductManagerPage.jsx → src/pages/pb.jsx
- `handleDelete()` --calls--> `logAction()`  [EXTRACTED]
  src/pages/ProductManagerPage.jsx → src/pages/pb.jsx
- `toggleActive()` --calls--> `logAction()`  [EXTRACTED]
  src/pages/ProductManagerPage.jsx → src/pages/pb.jsx
- `save()` --calls--> `logAction()`  [EXTRACTED]
  src/pages/CashJournalPage.jsx → src/pages/pb.jsx

## Import Cycles
- None detected.

## Communities (80 total, 16 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (74): ACTION_COLOR, ACTION_LABEL, actionLabel(), ActionLogPage(), load(), fetchLogs(), fmtDate(), localDateToUtcIso() (+66 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (62): DebtNccPage(), fmt(), fmtDate(), PaymentModal(), handlePay(), recordPayment(), StatCard(), STATUS (+54 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (55): HandoverModal(), canProceed(), handleNext(), autoCreateOrUpdateDebt(), KtvAssignPicker(), OrderDrawer(), applyStatusChange(), compressImage() (+47 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (43): xlsx, CustomerImportExportModal(), confirmImport(), exportExcel(), handleFile(), processRows(), normPhone(), TEMPLATE_HEADERS (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (39): ALLOWED, BarChart(), BusinessTab(), CashflowSubTab(), DebtPayableContent(), DebtSubTab(), DONE_ST, ExportSubTab() (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (37): SaleOrderPage, Expense, SaleOrder, SaleOrderItem, StockMovement, normalizeScanCode(), fmt(), getRange() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (34): AccessDenied(), CashierApp, CustomerManagerPage, DebtPage, DepartmentPageLazy, MAIN_TAB_PAGES, MainAppContent(), KanbanBoard() (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (32): StockCountPage, StockCount, StockCountItem, WarehouseZone, BTN(), CountingScreen(), confirmItem(), finishCounting() (+24 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (30): ComboPage(), addLine(), deleteCombo(), deny(), doAssemble(), doDisassemble(), load(), loadComboStock() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (25): AvatarChar(), Badge(), DepartmentPage(), DeptCard(), EditModal(), save(), FORM_EMPTY, ManageModal() (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (22): AcceptChecklistModal(), AcceptTimer(), EST_OPTIONS, genOrderId(), getKpiTimerInfo(), PRIORITY_DISPLAY, PRIORITY_PB, STATUS_COLS (+14 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (30): PUBLIC_PATH, ACTION_ICON, fetchPublicOrder(), fmtDate(), fmtDateFull(), getStatus(), MI(), OrderPublic() (+22 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (22): B44Staff, compressImageToMaxDim(), KpiRecord, MAX_VIDEO_SECONDS, MediaPost, normalizeStatus(), _normIn(), _normRec() (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (23): Field(), HaravanBlock(), save(), IntCard(), IntegrationsPage(), loadSettings(), PrintAgentBlock(), save() (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (8): CustomerConfirmModal(), MI(), PreCheckModal(), QT1_ITEMS, QT2_SECTIONS, QT2Modal(), SERVICE_FEES, SPARE_SUGGESTIONS

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (21): ActionBtn(), clearTimers(), hideTip(), ADMIN_ROLES, compressImageFile(), fmtDT(), fmtMoney(), INP (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (27): CategoryManagerModal(), handleCreate(), handleDelete(), handleUpdate(), toggleActive(), EditOrderModal(), handleSave(), createOrder() (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (22): CameraControls(), getQRDataUrl(), getTrackCapabilities(), IMEIScanModal(), _jsQRCallbacks, loadQRLib(), loadZxing(), openScannerStream() (+14 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (22): SparePartModal, getVideoDuration(), uploadFile(), CBlock(), fmtDt(), fmtMoney(), genCode(), minsLeft() (+14 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (22): compressImageFile(), DELIVERY_TAG, deliveryKind(), fmtDateTime(), fmtTimeShort(), fmtVnd(), handleFiles(), inputStyle (+14 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (20): _jsQRCallbacks, loadJsQR(), loadQRLib(), QRCanvas(), _qrLibCallbacks, QRPrintModal(), QRScanModal(), handleManual() (+12 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (21): useIsDesktop(), WarehouseExport(), doConfirmExport(), handleMediaUpload(), load(), showToast(), WarehouseImport(), applyPO() (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (21): CashJournalTab(), CustomerReportTab(), DONE_STATUS, endOf(), EXP_COLORS, EXP_LABELS, fmtDate(), fmtMoney() (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (13): buildExcelXml(), buildSheets(), colLetter(), e(), sheetDatabase(), sheetFeatures(), sheetKPI(), sheetNotifications() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (21): AppSettings, Customer, Notification, OrderHistory, RepairChat, RepairOrder, SparePart, SparePartUsage (+13 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (20): APPROVER_ROLES, CAT_MAP, CATEGORIES, ExpensePage(), handleApprove(), handleDelete(), handleReject(), handleSubmit() (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.26
Nodes (19): HandoverModal(), confirm(), notifyRoles(), notifyUser(), PackingPage(), applyUpdate(), carrierReceived(), customerPickup() (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (20): Catalog, Count, CountItem, Imports, Ledger, Loc, Move, Notif (+12 more)

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (19): dependencies, @ant-design/icons@^5.3.0, antd@^5.15.0, @base44/vite-plugin@^1.0.23, dayjs@^1.11.10, qrcode.react@^3.1.0, react@^18.2.0, react-dom@^18.2.0 (+11 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (15): ChangePassword(), clearCred(), loadCred(), LoginV2(), requestNotifPermission(), saveCred(), showSystemNotif(), useBreakpoint() (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (12): @base44/sdk@^0.8.34, @base44/sdk, checkExportReminders, getPublicOrder, getStaff, saveStaff, base44, appParams (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (13): PurchaseOrder, PurchaseOrderItem, fmt(), fmtDate(), genPOCode(), POModal(), handleSave(), PortalDropdown() (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (16): compilerOptions, allowSyntheticDefaultImports, baseUrl, checkJs, esModuleInterop, jsx, lib, module (+8 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (14): ALLOWED_ROLES, CashierApp(), DONE_STATUS, fmtMoney(), isToday(), OverviewTab(), load(), ShiftReconcilePage() (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.23
Nodes (12): DebtPage(), DetailModal(), fmtDate(), fmtMoney(), OverdueTab(), PaymentModal(), submit(), recordPayment() (+4 more)

### Community 36 - "Community 36"
Cohesion: 0.19
Nodes (10): MediaViewer(), applyTransform(), clampOffset(), dist(), getPos(), onDrawMove(), onDrawStart(), onMove() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (8): react, CHECKLIST_ITEMS, PurchaseForecastPage, OrderHistory, StockImport, fmtDate(), fmtMoney(), PurchaseForecastPage()

### Community 38 - "Community 38"
Cohesion: 0.28
Nodes (11): exportExcel(), StaffKpiTab(), exportKpi(), StockReportTab(), exportReport(), buildConditions(), dayStamp(), exportSheet() (+3 more)

### Community 39 - "Community 39"
Cohesion: 0.23
Nodes (11): BUILT_IN_SOUNDS, NOTIF_TYPES, playSound(), Settings(), handleCustomFile(), saveAll(), saveNotifSettings(), saveSetting() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.23
Nodes (11): normalizePbUrl(), ADMIN_ROLES, EditPriceModal(), save(), fmtMoney(), PricePolicyPage(), getProductImages(), loadImages() (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.19
Nodes (12): Role, RolePermission, ACTIONS, EMPTY_PERMS, p(), PermissionContext, RESOURCES, STATIC_MATRIX (+4 more)

### Community 42 - "Community 42"
Cohesion: 0.17
Nodes (7): compressImage(), NewOrderModal(), saveNewCustomer(), submit(), QRScanModal(), handleManual(), handleRaw()

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (7): ALLOWED, CashJournalPage(), exportCSV(), fmtMoney(), ManualEntryModal(), save(), CashJournalPage

### Community 44 - "Community 44"
Cohesion: 0.27
Nodes (11): Field(), filterWarehousesByUser(), genCode(), Modal(), StockLedgerTab(), saveAdjust(), TransferTab(), cancel() (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.31
Nodes (9): fmtTime(), goFocus(), isOverdue(), MyTasksPage(), renderTeam(), ROLE_LABELS, SectionHeader(), TaskCard() (+1 more)

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (9): ensureStockLedgerForPart(), parseBool(), parseNum(), ProductImportExportModal(), confirmImport(), handleFile(), processRows(), slugify() (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (6): devDependencies, vite@^5.1.0, @vitejs/plugin-react@^4.2.0, vite, @vitejs/plugin-react, BUILD_ID

### Community 48 - "Community 48"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, orientation, short_name, start_url (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.22
Nodes (6): ZoneLocationTab(), buildLocCode(), deleteLoc(), deleteZone(), saveLoc(), saveZone()

### Community 50 - "Community 50"
Cohesion: 0.22
Nodes (5): ErrorBoundary, MainApp(), MainAppInner(), useBreakpoint(), PermissionProvider()

### Community 51 - "Community 51"
Cohesion: 0.42
Nodes (8): playSound(), Settings(), handleCustomFile(), saveAll(), saveNotifSettings(), saveSetting(), showToast(), testSound()

### Community 52 - "Community 52"
Cohesion: 0.32
Nodes (7): OrderDrawerWithPerm(), usePermission(), GREETING_BY_HOUR(), ROLE_ACTIONS, ROLE_ICON, ROLE_LABEL, RoleHomePlaceholder()

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (7): fmtDate(), RMAPage(), DefectTab(), loadList(), submit(), PartNameInput(), SupplierNameInput()

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (5): WarehouseTab(), doDeleteEmpty(), doDeleteWarehouse(), save(), toggleActive()

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (5): CategoryFormRow(), COLOR_OPTIONS, INP, LBL, ProductCategory

### Community 56 - "Community 56"
Cohesion: 0.24
Nodes (6): CustomerList(), Dashboard(), goToPendingAccept(), renderManagerSidebar(), setPage(), usePageGuard()

### Community 57 - "Community 57"
Cohesion: 0.38
Nodes (6): pbSettings, loadShareQR(), ShareOrderModal(), copyLink(), shareViaWeb(), _shareQrCbs

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (3): ShippingTab(), saveTracking(), WhShippingPage()

### Community 60 - "Community 60"
Cohesion: 0.40
Nodes (3): react-router-dom@^6.22.0, react-router-dom, PUBLIC_ROUTES

### Community 62 - "Community 62"
Cohesion: 0.60
Nodes (5): initials(), StaffListSubTab(), resetKpi(), showToast(), toggleActive()

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 64 - "Community 64"
Cohesion: 0.50
Nodes (3): getNotifSound(), playNotifSound(), AppSettings

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (3): findCode(), showCopyToast(), tryCopy()

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logAction()` connect `Community 16` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 15`, `Community 18`, `Community 19`, `Community 21`, `Community 25`, `Community 26`, `Community 27`, `Community 29`, `Community 32`, `Community 34`, `Community 35`, `Community 37`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 49`, `Community 51`, `Community 53`, `Community 54`, `Community 55`, `Community 59`, `Community 62`?**
  _High betweenness centrality (0.283) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `MainAppContent()` (e.g. with `checkExportDeadlines()` and `checkWaitingParts()`) actually correct?**
  _`MainAppContent()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05359831376091539 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Community 37` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 22`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 31`, `Community 32`, `Community 34`, `Community 35`, `Community 39`, `Community 40`, `Community 41`, `Community 43`, `Community 45`, `Community 46`, `Community 55`, `Community 57`, `Community 60`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.051106639839034206 - nodes in this community are weakly interconnected._
- **Why does `OrderDrawer()` connect `Community 2` to `Community 0`, `Community 36`, `Community 6`, `Community 40`, `Community 10`, `Community 14`, `Community 16`, `Community 17`, `Community 18`, `Community 52`, `Community 57`, `Community 26`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06308610400682012 - nodes in this community are weakly interconnected._