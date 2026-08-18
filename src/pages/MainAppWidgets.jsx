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
  product_mgr:     ["sale_order", "view"],
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
  wh_ledger:       ["stock_ledger", "view"],
  wh_defect:       ["stock_import", "view"],
  wh_shipping:     ["stock_import", "view"],
  wh_report:       ["stock_ledger", "view"],
  wh_orders:       ["repair_order", "view"],
  wh_home:         ["repair_order", "view"],
  wh_import_ncc:   ["stock_import", "view"],
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
export function renderReportPages(page, user, can) {
  return (
    <>
      {page === "report_profit" && user && (can && !can("profit_report","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><ReportProfitPage user={user} /></Suspense>
      )}
      {page === "report_staff" && user && (can && !can("kpi","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><ReportStaffPage user={user} /></Suspense>
      )}
    </>
  );
}

/**
 * renderPurchaseNccPages — Render các trang Mua hàng NCC
 * Dùng trong cả PC và Mobile layout của MainApp.jsx
 */
export function renderPurchaseNccPages(page, user, can) {
  return (
    <>
      {page === "purchase_order" && user && (can && !can("purchase_order","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><PurchaseOrderPage user={user} /></Suspense>
      )}
      {page === "wh_import_ncc" && user && (can && !can("stock_import","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <WarehouseImport user={user} />
      )}
      {page === "debt_ncc" && user && (can && !can("debt","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><DebtNccPage user={user} /></Suspense>
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
const ProductManagerPage = lazy(() => import("./ProductManagerPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Danh mục hàng hóa</div> })));
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
export function renderSalesPages(page, user, can) {
  return (
    <>
      {page === "return_order" && user && (can && !can("sale_order","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><ReturnOrderPage user={user} /></Suspense>
      )}
      {page === "product_mgr" && user && (can && !can("sale_order","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><ProductManagerPage user={user} /></Suspense>
      )}
      {page === "price_policy" && user && (can && !can("sale_order","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><PricePolicyPage user={user} /></Suspense>
      )}
      {page === "revenue" && user && (can && !can("revenue_report","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><RevenueReportPage user={user} /></Suspense>
      )}
      {page === "stock_nxt" && (can && !can("stock_ledger","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><StockReportNXT user={user} /></Suspense>
      )}
      {page === "expense" && user && (can && !can("expense","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><ExpensePage user={user} /></Suspense>
      )}
      {page === "rma" && user && (can && !can("stock_import","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><RMAPage user={user} /></Suspense>
      )}
      {page === "cash_journal" && user && (can && !can("cash_journal","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><CashJournalPage user={user} /></Suspense>
      )}
      {page === "stock_count" && (can && !can("stock_count","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><StockCountPage user={user} /></Suspense>
      )}
    </>
  );
}

/**
 * renderSetupPages — Thiết lập: Integrations, ActionLog
 */
export function renderSetupPages(page, user, can) {
  return (
    <>
      {page === "integrations" && (can && !can("settings","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><IntegrationsPage user={user} /></Suspense>
      )}
      {page === "action_log" && (can && !can("settings","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><ActionLogPage user={user} /></Suspense>
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
const WhLedgerPageLazy   = lazy(() => import("./WarehouseManager.jsx").then(m => ({ default: m.WhLedgerPage })).catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Tồn kho</div> })));
const WhDefectPageLazy   = lazy(() => import("./WarehouseManager.jsx").then(m => ({ default: m.WhDefectPage })).catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải LK lỗi</div> })));
const WhShippingPageLazy = lazy(() => import("./WarehouseManager.jsx").then(m => ({ default: m.WhShippingPage })).catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Vận đơn</div> })));
const WhReportPageLazy   = lazy(() => import("./WarehouseManager.jsx").then(m => ({ default: m.WhReportPage })).catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Báo cáo kho</div> })));
const CashierApp          = lazy(() => import("./CashierApp.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Thu ngân</div> })));
const PrintTemplatePage   = lazy(() => import("./PrintTemplatePage.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Mẫu in</div> })));
const RoleHomePlaceholder = lazy(() => import("./RoleHomePlaceholder.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Trang chủ</div> })));

/**
 * renderMobilePages — Mobile page renders (tách từ MainApp.jsx để giảm dòng)
 */
export function renderMobilePages(page, user, extraProps = {}) {
  const { setPage, dashboardTab, notifications = [], dbNotifications = [], setShowNotif, setShowQRScan, cashierTab, setCashierTab, setSelectedOrder } = extraProps;
  return (
    <>
      {page==="customers" && (extraProps.can && !extraProps.can("customer","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<div style={{padding:32,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}><CustomerManagerPage user={user} /></Suspense>
      )}
      {page==="suppliers" && user && (extraProps.can && !extraProps.can("supplier","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}><SupplierPage user={user} /></Suspense>
      )}
      {page==="debts" && user && (extraProps.can && !extraProps.can("debt","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}><DebtPage user={user} /></Suspense>
      )}
      {page==="department" && (extraProps.can && !extraProps.can("department","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}><DepartmentPageLazy user={user} /></Suspense>
      )}
      {page==="role_perm" && (!extraProps.can || !["manager","admin","owner","supervisor"].includes(user?.role)
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}><RolePermissionPageLazy /></Suspense>
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
      {page==="sale_order" && user && (extraProps.can && !extraProps.can("sale_order","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}><SaleHistoryPage user={user} /></Suspense>
      )}

      {/* === Dashboard === */}
      {page==="dashboard" && user && (
        <Suspense fallback={<Loading />}>
          <ManagerDashboard user={user} initialTab={dashboardTab} />
        </Suspense>
      )}

      {/* === Quản lý nhân viên === */}
      {page==="staff" && user && (extraProps.can && !extraProps.can("staff","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><StaffManagerPage currentStaff={user} /></Suspense>
      )}

      {/* === Thiết lập === */}
      {page==="settings" && user && (extraProps.can && !extraProps.can("settings","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><SettingsHub user={user} /></Suspense>
      )}

      {/* === In ấn === */}
      {page==="print_template" && user && (extraProps.can && !extraProps.can("settings","view")
        ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
        : <Suspense fallback={<Loading />}><PrintTemplatePage user={user} /></Suspense>
      )}

      {/* === Kho === */}
      {page==="wh_home" && user && setPage && (
        <WarehouseHome user={user} setPage={setPage} />
      )}
      {page==="wh_orders" && user && (
        <WarehouseOrders user={user} setSelectedOrder={setSelectedOrder||(() => {})} />
      )}
      {page==="wh_export" && user && (
        extraProps.can && !extraProps.can("stock_export","view")
          ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
          : <WarehouseExport user={user} />
      )}
      {page==="wh_import" && user && (
        extraProps.can && !extraProps.can("stock_import","view")
          ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
          : <WarehouseImport user={user} />
      )}
      {page==="wh_manager" && user && setPage && (
        <Suspense fallback={<Loading />}>
          {extraProps.can && !extraProps.can("warehouse_mgr","view")
            ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
            : <WarehouseManagerLazy user={user} onBack={() => setPage("wh_home")} />}
        </Suspense>
      )}
      {page==="wh_ledger" && user && (
        <Suspense fallback={<Loading />}>
          {extraProps.can && !extraProps.can("stock_ledger","view")
            ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
            : <WhLedgerPageLazy user={user} />}
        </Suspense>
      )}
      {page==="wh_defect" && user && (
        <Suspense fallback={<Loading />}>
          {extraProps.can && !extraProps.can("stock_import","view")
            ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
            : <WhDefectPageLazy user={user} />}
        </Suspense>
      )}
      {page==="wh_shipping" && user && (
        <Suspense fallback={<Loading />}>
          {extraProps.can && !extraProps.can("stock_import","view")
            ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
            : <WhShippingPageLazy user={user} />}
        </Suspense>
      )}
      {page==="wh_report" && user && (
        <Suspense fallback={<Loading />}>
          {extraProps.can && !extraProps.can("stock_ledger","view")
            ? <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
            : <WhReportPageLazy user={user} />}
        </Suspense>
      )}

      {/* === Thu ngân — CashierApp === */}
      {page==="cashier_home" && user && (
        <Suspense fallback={<Loading />}>
          {extraProps.can ? (extraProps.can("sale_order","view")
            ? <CashierApp user={user} forceTab={cashierTab||""} onTabChange={setCashierTab||(()=>{})} />
            : <div style={{padding:60,textAlign:"center",color:"#9ca3af"}}><span className="material-icons" style={{fontSize:64,display:"block",marginBottom:12,color:"#ef4444"}}>lock</span>Không có quyền truy cập</div>
          ) : <CashierApp user={user} forceTab={cashierTab||""} onTabChange={setCashierTab||(()=>{})} />}
        </Suspense>
      )}

      {/* === Role home placeholder === */}
      {page==="role_home" && user && setPage && (
        <Suspense fallback={<Loading />}>
          <RoleHomePlaceholder user={user} setPage={setPage} />
        </Suspense>
      )}

      {renderSalesPages(page, user, extraProps.can)}
      {renderPurchaseNccPages(page, user, extraProps.can)}
      {renderReportPages(page, user, extraProps.can)}
    </>
  );
}