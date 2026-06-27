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
