/* MainAppWidgets.jsx — Render helpers cho các page mới — HK One Touch */
import React, { Suspense, lazy } from "react";
import { WarehouseImport, WarehouseHome, WarehouseOrders, WarehouseExport } from "./WarehouseApp.jsx";


// Page → permission mapping
export const PAGE_PERMS = {
  report_profit:   ["profit_report", "view"],
  report_staff:    ["kpi", "view"],
  purchase_order:  ["purchase_order", "view"],
  wh_import_ncc:   ["stock_import", "view"],
  debt_ncc:        ["debt", "view"],
  return_order:    ["sale_order", "view"],
  price_policy:    ["sale_order", "view"],
  revenue:         ["revenue_report", "view"],
  stock_nxt:       ["stock_ledger", "view"],
  expense:         ["expense", "view"],
  rma:             ["stock_import", "view"],
  cash_journal:    ["cash_journal", "view"],
  stock_count:     ["stock_count", "view"],
  integrations:   ["settings", "view"],
  action_log:      ["settings", "view"],
  customers:       ["customer", "view"],
  suppliers:       ["supplier", "view"],
  debts:           ["debt", "view"],
  department:      ["department", "view"],
  role_perm:       ["settings", "view"],
  settings:        ["settings", "view"],
  print_settings:  ["settings", "view"],
  print_template:  ["settings", "view"],
  staff:           ["staff", "view"],
  sale_order:      ["sale_order", "view"],
  wh_manager:      ["warehouse_mgr", "view"],
  wh_import:       ["stock_import", "view"],
  wh_export:       ["stock_export", "view"],
  new:             ["repair_order", "create"],
  board:           ["repair_order", "view"],
  tasks:           ["repair_order", "view"],
  cashier_home:    ["sale_order", "view"],
};


const Loading = () => <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>⏳</div>;

const ReportProfitPage = lazy(() => import("./ReportProfitPage.jsx").catch(() => ({
  default: () => <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>⚠️ Lỗi tải Báo cáo Lợi nhuận</div>
})));
const ReportStaffPage = lazy(() => import("./ReportStaffPage.jsx").catch(() => ({
  default: () => <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>⚠️ Lỗi tải KPI Nhân viên</div>
})));
const DebtNccPage = lazy(() => import("./DebtNccPage.jsx").catch(() => ({
  default: () => <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>⚠️ Lỗi tải Công nợ NCC</div>
})));
const PurchaseOrderPage = lazy(() => import("./PurchaseOrderPage.jsx").catch(() => ({
  default: () => <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>⚠️ Lỗi tải Đặt hàng NCC</div>
})));

/**
 * renderReportPages — Render các trang Báo cáo
 * Dùng trong cả PC và Mobile layout của MainApp.jsx
 */
export function renderReportPages(page, user) {
  return (
    <>
      {page === "report_profit" && user && (
        <Suspense fallback={<Loading />}>
          <ReportProfitPage user={user} />
        </Suspense>
      )}
      {page === "report_staff" && user && (
        <Suspense fallback={<Loading />}>
          <ReportStaffPage user={user} />
        </Suspense>
      )}
    </>
  );
}

/**
 * renderPurchaseNccPages — Render các trang Mua hàng NCC
 * Dùng trong cả PC và Mobile layout của MainApp.jsx
 */
export function renderPurchaseNccPages(page, user) {
  return (
    <>
      {page === "purchase_order" && user && (
        <Suspense fallback={<Loading />}>
          <PurchaseOrderPage user={user} />
        </Suspense>
      )}
      {page === "wh_import_ncc" && user && (
        <WarehouseImport user={user} />
      )}
      {page === "debt_ncc" && user && (
        <Suspense fallback={<Loading />}>
          <DebtNccPage user={user} />
        </Suspense>
      )}
    </>
  );
}

/**
 * renderPlaceholderPages — Render các trang placeholder (chưa có component riêng)
 */
export function renderPlaceholderPages(page, user) {
  return (
    <>
      {page === "report_profit" && !user && null}
      {page === "expense" && user && (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 15 }}>
          🧾 Thu / Chi — đang phát triển
        </div>
      )}
      {page === "debt_ncc" && !user && null}
    </>
  );
}

// ── Lazy imports bổ sung ────────────────────────────────────────────────────
const RMAPage         = lazy(() => import("./RMAPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải RMA</div> })));
const SaleOrderPage   = lazy(() => import("./SaleOrderPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Đơn bán hàng</div> })));
const ReturnOrderPage = lazy(() => import("./ReturnOrderPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Đổi trả</div> })));
const PricePolicyPage = lazy(() => import("./PricePolicyPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Chính sách giá</div> })));
const RevenueReportPage = lazy(() => import("./RevenueReportPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Doanh thu</div> })));
const StockReportNXT  = lazy(() => import("./StockReportNXT.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Thẻ kho</div> })));
const IntegrationsPage = lazy(() => import("./IntegrationsPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Tích hợp</div> })));
const ActionLogPage   = lazy(() => import("./ActionLogPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Nhật ký</div> })));
const CashJournalPage = lazy(() => import("./CashJournalPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Sổ quỹ</div> })));
const StockCountPage  = lazy(() => import("./StockCountPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Kiểm kê</div> })));
const ExpensePage     = lazy(() => import("./ExpensePage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Thu/Chi</div> })));

/**
 * renderSalesPages — Bán hàng + Báo cáo doanh thu + Thẻ kho
 */
export function renderSalesPages(page, user) {
  return (
    <>
      {page === "return_order" && user && (
        <Suspense fallback={<Loading />}><ReturnOrderPage user={user} /></Suspense>
      )}
      {page === "price_policy" && user && (
        <Suspense fallback={<Loading />}><PricePolicyPage user={user} /></Suspense>
      )}
      {page === "revenue" && user && (
        <Suspense fallback={<Loading />}><RevenueReportPage user={user} /></Suspense>
      )}
      {page === "stock_nxt" && (
        <Suspense fallback={<Loading />}><StockReportNXT user={user} /></Suspense>
      )}
      {page === "expense" && user && (
        <Suspense fallback={<Loading />}><ExpensePage user={user} /></Suspense>
      )}
      {page === "rma" && user && (
        <Suspense fallback={<Loading />}><RMAPage user={user} /></Suspense>
      )}
      {page === "cash_journal" && user && (
        <Suspense fallback={<Loading />}><CashJournalPage user={user} /></Suspense>
      )}
      {page === "stock_count" && (
        <Suspense fallback={<Loading />}><StockCountPage user={user} /></Suspense>
      )}
    </>
  );
}

/**
 * renderSetupPages — Thiết lập: Integrations, ActionLog
 */
export function renderSetupPages(page, user) {
  return (
    <>
      {page === "integrations" && (
        <Suspense fallback={<Loading />}><IntegrationsPage user={user} /></Suspense>
      )}
      {page === "action_log" && (
        <Suspense fallback={<Loading />}><ActionLogPage user={user} /></Suspense>
      )}
    </>
  );
}

// ── Thêm imports cần thiết cho renderMobilePages ────────────────────────────
const CustomerManagerPage = lazy(() => import("./CustomerManager.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Khách hàng</div> })));
const SupplierPage   = lazy(() => import("./SupplierPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Nhà cung cấp</div> })));
const DebtPage       = lazy(() => import("./DebtPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Công nợ</div> })));
const DepartmentPageLazy    = lazy(() => import("./DepartmentPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Phòng ban</div> })));
const RolePermissionPageLazy = lazy(() => import("./RolePermissionPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Vai trò</div> })));
const SaleHistoryPage = lazy(() => import("./SaleHistoryPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Lịch sử bán</div> })));
const ManagerDashboard    = lazy(() => import("./ManagerDashboard.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Dashboard</div> })));
const StaffManagerPage    = lazy(() => import("./StaffManager.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Nhân viên</div> })));
const SettingsHub         = lazy(() => import("./SettingsHub.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Cài đặt</div> })));
const WarehouseManagerLazy = lazy(() => import("./WarehouseManager.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Quản lý kho</div> })));
const CashierApp          = lazy(() => import("./CashierApp.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Thu ngân</div> })));
const PrintTemplatePage   = lazy(() => import("./PrintTemplatePage.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Mẫu in</div> })));
const RoleHomePlaceholder = lazy(() => import("./RoleHomePlaceholder.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Trang chủ</div> })));

/**
 * renderMobilePages — Mobile page renders (tách từ MainApp.jsx để giảm dòng)
 */
export function renderMobilePages(page, user, extraProps = {}) {
  const { setPage, dashboardTab, notifications = [], dbNotifications = [], setShowNotif, setShowQRScan, cashierTab, setCashierTab } = extraProps;
  return (
    <>
      {page==="customers" && (
        <Suspense fallback={<div style={{padding:32,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
          <CustomerManagerPage />
        </Suspense>
      )}
      {page==="suppliers" && user && (
        <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
          <SupplierPage user={user} />
        </Suspense>
      )}
      {page==="debts" && user && (
        <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
          <DebtPage user={user} />
        </Suspense>
      )}
      {page==="department" && (
        <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}>
          <DepartmentPageLazy user={user} />
        </Suspense>
      )}
      {page==="role_perm" && (
        <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}>
          <RolePermissionPageLazy />
        </Suspense>
      )}
      {page==="integrations" && (
        <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}>
          <IntegrationsPage user={user} />
        </Suspense>
      )}
      {page==="action_log" && (
        <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}>
          <ActionLogPage user={user} />
        </Suspense>
      )}
      {page==="sale_order" && user && (
        <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}>
          <SaleHistoryPage user={user} />
        </Suspense>
      )}

      {/* === Dashboard === */}
      {page==="dashboard" && user && (
        <Suspense fallback={<Loading />}>
          <ManagerDashboard user={user} initialTab={dashboardTab} />
        </Suspense>
      )}

      {/* === Quản lý nhân viên === */}
      {page==="staff" && user && (
        <Suspense fallback={<Loading />}><StaffManagerPage currentStaff={user} /></Suspense>
      )}

      {/* === Thiết lập === */}
      {page==="settings" && user && (
        <Suspense fallback={<Loading />}><SettingsHub user={user} /></Suspense>
      )}

      {/* === In ấn === */}
      {page==="print_template" && user && (
        <Suspense fallback={<Loading />}><PrintTemplatePage user={user} /></Suspense>
      )}

      {/* === Kho === */}
      {page==="wh_home" && user && setPage && (
        <WarehouseHome user={user} setPage={setPage} />
      )}
      {page==="wh_orders" && user && (
        <WarehouseOrders user={user} />
      )}
      {page==="wh_export" && user && (
        <WarehouseExport user={user} />
      )}
      {page==="wh_import" && user && (
        <WarehouseImport user={user} />
      )}
      {page==="wh_manager" && user && setPage && (
        <Suspense fallback={<Loading />}>
          <WarehouseManagerLazy user={user} onBack={() => setPage("wh_home")} />
        </Suspense>
      )}

      {/* === Thu ngân — CashierApp === */}
      {page==="cashier_home" && user && (
        <Suspense fallback={<Loading />}>
          <CashierApp user={user} forceTab={cashierTab||""} onTabChange={setCashierTab||(()=>{})} />
        </Suspense>
      )}

      {/* === Role home placeholder === */}
      {page==="role_home" && user && setPage && (
        <Suspense fallback={<Loading />}>
          <RoleHomePlaceholder user={user} setPage={setPage} />
        </Suspense>
      )}

      {renderSalesPages(page, user)}
      {renderPurchaseNccPages(page, user)}
      {renderReportPages(page, user)}
    </>
  );
}