/* MainAppWidgets.jsx — Render helpers cho các page mới — HK One Touch */
import React, { Suspense, lazy } from "react";
import { WarehouseImport } from "./WarehouseApp.jsx";

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

/**
 * renderMobilePages — Mobile page renders (tách từ MainApp.jsx để giảm dòng)
 */
export function renderMobilePages(page, user, extraProps = {}) {
  const { setPage, dashboardTab, notifications = [], dbNotifications = [], setShowNotif, setShowQRScan } = extraProps;
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
      {renderSalesPages(page, user)}
      {renderPurchaseNccPages(page, user)}
      {renderReportPages(page, user)}
    </>
  );
}
