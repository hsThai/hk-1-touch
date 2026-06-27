/* REBUILD_20260406_1408 */
/* v4-loginv2-real-db */
import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer, SparePart, StockExportRequest, StockImport, StockImportItem, StockLedger, ActionLog, getPbUrl, getAuth, logHistory, DebtVoucher, CashJournal } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";
import { getNotifSound } from "./notifUtils.js";
const SparePartModal = lazy(() => import("./SparePartModal").catch(() => ({ default: ({ onClose }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#fff",borderRadius:16,padding:32,textAlign:"center"}}>
      <div style={{fontSize:32}}> </div>
      <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
      <button onClick={onClose} style={{marginTop:16,padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Đóng</button>
    </div>
  </div>
)})));
const StaffManagerPage = lazy(() => import("./StaffManager").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center"}}>
    <div style={{fontSize:32}}> </div>
    <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
  </div>
)})));
const CustomerManagerPage = lazy(() => import("./CustomerManager").catch(() => ({ default: () => (
  <div style={{padding:40,textAlign:"center",color:"#dc2626"}}>Lỗi tải màn hình Khách hàng</div>
)})));
const ManagerDashboard = lazy(() => import("./ManagerDashboard").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center",color:"#ef4444"}}>❌ Lỗi tải Manager Dashboard</div>
)})));
const SettingsPage = lazy(() => import("./Settings").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center"}}>
    <div style={{fontSize:32}}> </div>
    <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
  </div>
)})));
const WarehouseManager = lazy(() => import("./WarehouseManager").catch(() => ({ default: ({ onBack }) => (
  <div style={{padding:32,textAlign:"center"}}>
    <div style={{fontSize:32}}>⚠️</div>
    <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
    <button onClick={onBack} style={{marginTop:16,padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Quay lại</button>
  </div>
)})));
const CashierApp = lazy(() => import("./CashierApp").catch(() => ({ default: () => (
  <div style={{padding:32,textAlign:"center",color:"#ef4444"}}>❌ Lỗi tải App Kế toán</div>
)})));
const StockCountPage = lazy(() => import("./StockCountPage").catch(() => ({ default: () => (
  <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải kiểm kho</div>
) })));

// — lazy pages (top-level to prevent TDZ) —
const SettingsHub          = lazy(() => import("./SettingsHub").catch(() => ({ default: () => (
  <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải SettingsHub</div>
) })));
const SupplierPage         = lazy(() => import("./SupplierPage").catch(() => ({ default: () => (
  <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Đang tải Nhà cung cấp...</div>
) })));
const DebtPage             = lazy(() => import("./DebtPage").catch(() => ({ default: () => (
  <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Đang tải Công nợ...</div>
) })));
const CashJournalPage      = lazy(() => import("./CashJournalPage").catch(() => ({ default: () => (
  <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Đang tải Sổ quỹ...</div>
) })));
const DepartmentPageLazy     = lazy(() => import("./DepartmentPage.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Phòng ban</div> })));
const RolePermissionPageLazy = lazy(() => import("./RolePermissionPage.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Phân quyền</div> })));
const PrintTemplatePage = lazy(() => import("./PrintTemplatePage.jsx").catch(() => ({ default: () => <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải trang</div> })));
const PurchaseForecastPage = lazy(() => import("./PurchaseForecastPage.jsx").catch(()=>({ default: ()=><div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải Mua hàng</div> })));

const RoleHomePlaceholder  = lazy(() => import("./RoleHomePlaceholder").catch(() => ({ default: () => (
  <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⚠️ Lỗi tải trang chủ</div>
) })));



// Components loaded from OrderComponents
import { QRScanModal, IMEIScanModal } from"./QRComponents";
import { MediaViewer, AcceptChecklistModal, AcceptTimer, timeAgo, genOrderId, getKpiTimerInfo, STATUS_PB, STATUS_DISPLAY, PRIORITY_PB, PRIORITY_DISPLAY, STATUS_COLS } from "./MediaViewer";
import { OrderDrawer } from "./OrderDrawer";
import { NewOrderModal, KPIPage, ProductHistoryModal } from "./OrderForms";
import LoginPage, { showSystemNotif, requestNotifPermission } from "./LoginV2";
import { PermissionProvider, usePermission } from "./PermissionContext.jsx";
import ChangePassword from "./ChangePassword";
import { renderReportPages, renderPurchaseNccPages, renderSalesPages, renderSetupPages } from "./MainAppWidgets.jsx";
import {
  WarehouseOrders,
  TechnicianHome,
  ReceptionHome,
  WarehouseHome,
  WarehouseExport,
  PartNameInput,
  WarehouseImport,
} from "./WarehouseApp.jsx";

const _BUILD_V4 = "loginv2-real-db";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:"100vh", background:"#1e1b4b", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", padding:24 }}>
          <div style={{ fontSize:48, marginBottom:16 }}> </div>
          <div style={{ color:"#fff", fontWeight:800, fontSize:18, marginBottom:8 }}>Ứng dụng gặp lỗi</div>
          <div style={{ color:"#c7d2fe", fontSize:13, textAlign:"center", marginBottom:20, fontFamily:"monospace", background:"rgba(255,255,255,.1)", padding:12, borderRadius:10, maxWidth:400, wordBreak:"break-all" }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button onClick={() => { this.setState({error:null}); window.location.reload(); }}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, padding:"12px 28px", fontSize:16, fontWeight:700, cursor:"pointer"}}>
              Tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper: map raw PocketBase repair_orders record → app order object
function mapPbOrder(o, STATUS_DISPLAY, PRIORITY_DISPLAY) {
  const displayStatus = STATUS_DISPLAY[o.status] || o.status || "Chờ KTV";
  return {
    // ── Identity ──
    id:              o.order_code || o.id,
    _id:             o.id,
    order_code:      o.order_code || "",
    _pbSaved:        true,
    // ── Customer / Device ──
    customer_id:     o.customer_id || o.customer_name || "",
    customer_name:   o.customer_name || "",
    customer_phone:  o.customer_phone || "",
    device_name:     o.device_name || "",
    device_model:    o.device_model || o.device_name || "",
    imei:            o.imei || "",
    imei_serial:     o.imei || "",
    passcode:        o.passcode || "",
    issue_description: o.issue_description || "",
    issues: o.issue_description
      ? o.issue_description.split(/[,;]/).map(s=>s.trim()).filter(Boolean)
      : [],
    // ── Status / Priority ──
    status:          displayStatus,
    priority:        PRIORITY_DISPLAY[o.priority] || o.priority || "Bình thường",
    // ── Assignment ──
    assigned_to:      o.assigned_to || "",
    assigned_to_name: o.assigned_to_name || "",
    assigned_at:      o.assigned_at || null,
    // Nếu PB chưa có accept_stage field, suy ra từ status
    accept_stage: o.accept_stage != null
      ? (o.accept_stage ?? 0)
      : (["Cho KTV","Cho KTV Sua"].includes(o.status||"") ? 0 : ["KTV Dang Kiem","Cho Bao Gia","Cho Xac Nhan"].includes(o.status||"") ? 1 : ["Dang Sua","Cho Linh Kien"].includes(o.status||"") ? 2 : ["Hoan Thanh","Da Giao"].includes(o.status||"") ? 3 : 0),
    stage1_at:        o.stage1_at || null,
    stage2_at:        o.stage2_at || null,
    checklist_done:   o.checklist_done || null,
    estimated_done:   o.estimated_done || null,
    estimated_done_date: o.estimated_done_date || null,
    needs_reassign:   o.needs_reassign || false,
    kpi_stage1_penalized: o.kpi_stage1_penalized || false,
    kpi_stage2_penalized: o.kpi_stage2_penalized || false,
    kpi_manually_accepted: o.kpi_manually_accepted || false,
    // ── Dates ──
    received_date:     o.received_date || o.created_date || "",
    done_date:         o.done_date || null,
    created:           o.received_date || o.created_date,
    created_date:      o.created_date || "",
    // ── Finance ──
    estimated_cost: o.estimated_cost || 0,
    final_cost:     o.final_cost || 0,
    deposit:        o.deposit || 0,
    warranty_days:  o.warranty_days || 0,
    // ── Notes ──
    notes:             o.technician_note || "",
    technician_note:   o.technician_note || "",
    // ── Media ──
    images:   o.images || [],
    videos:   o.videos || [],
    // ── QR ──
    qr_code:    o.order_code || "",
    product_qr: o.product_qr || "",
  };
}


// ── SwipeableNotif: vuốt trái để xóa thông báo ──────────────
function SwipeableNotif({ notif: n, onDelete, onClick }) {
  const [offsetX, setOffsetX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(null);
  const startOffsetRef = React.useRef(0);
  const THRESHOLD = 80; // px cần vuốt để xóa

  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    startOffsetRef.current = offsetX;
    setIsDragging(true);
  };
  const onTouchMove = (e) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const newOffset = Math.min(0, startOffsetRef.current + dx); // chỉ vuốt trái
    setOffsetX(newOffset);
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    if (offsetX < -THRESHOLD) {
      setOffsetX(-320); // bay ra ngoài
      setTimeout(onDelete, 200);
    } else {
      setOffsetX(0); // snap về
    }
    startXRef.current = null;
  };

  const bg = ["mention","chat"].includes(n.type) ? "#eef2ff" : "#fff";
  const iconName = ["mention","chat"].includes(n.type)?"chat":n.type==="status_change"?"update":"notifications";
  const iconColor = ["mention","chat"].includes(n.type)?"#4f46e5":"#059669";
  const deleteVisible = offsetX < -20;

  return (
    <div style={{ position:"relative", overflow:"hidden", borderBottom:"1px solid #f9fafb" }}>
      {/* Nền đỏ xóa phía sau */}
      <div style={{
        position:"absolute", inset:0, background:"#ef4444",
        display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:20,
        opacity: deleteVisible ? 1 : 0, transition:"opacity .15s"
      }}>
        <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,color:"#fff"}}>delete</span>
      </div>
      {/* Nội dung chính */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (Math.abs(offsetX) < 5) onClick(); }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform .2s ease",
          padding:"12px 16px", fontSize:13, display:"flex", gap:10,
          alignItems:"flex-start", background: bg, cursor:"pointer",
          position:"relative", zIndex:1,
        }}
      >
        <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:iconColor,marginTop:1,flexShrink:0}}>{iconName}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:12, marginBottom:2 }}>{n.title}</div>
          <div style={{ color:"#374151" }}>{n.message}</div>
          <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.created_at || n.created_date)}</div>
        </div>
        <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,color:"#9ca3af",marginTop:2,flexShrink:0}}>chevron_right</span>
      </div>
    </div>
  );
}


export function useBreakpoint() {
  const [bp, setBp] = React.useState(() => {
    const w = window.innerWidth;
    if (w >= 1200) return "pc";
    if (w >= 768)  return "tablet";
    return "mobile";
  });
  React.useEffect(() => {
    const fn = () => {
      const w = window.innerWidth;
      setBp(w >= 1200 ? "pc" : w >= 768 ? "tablet" : "mobile");
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return bp;
}


// ── 8 accordion Manager theo Excel ──────────────────────
const MGR_ACCORDIONS = [
  {
    key: "acc_overview",
    icon: "dashboard",
    label: "Tổng quan",
    pages: ["dashboard"],
    items: [
      { key:"dashboard", icon:"home", label:"Tổng quan Dashboard" },
    ],
  },
  {
    key: "acc_service",
    icon: "build",
    label: "Dịch vụ Sửa chữa",
    pages: ["new","board","tasks"],
    items: [
      { key:"new",   icon:"add_circle",  label:"Tạo đơn" },
      { key:"board", icon:"view_kanban", label:"Bảng điều phối (Kanban)" },
      { key:"tasks", icon:"list_alt",    label:"Danh sách & Lịch sử đơn" },
    ],
  },
  {
    key: "acc_sales",
    icon: "point_of_sale",
    label: "Bán hàng",
    pages: ["cashier_home","sale_order","return_order","price_policy"],
    items: [
      { key:"cashier_home", icon:"point_of_sale", label:"Bán hàng tại quầy" },
      { key:"sale_order",   icon:"receipt_long",  label:"Đơn bán hàng" },
      { key:"return_order", icon:"swap_horiz",    label:"Xử lý Đổi trả" },
      { key:"price_policy", icon:"price_change",  label:"Chính sách giá" },
    ],
  },
  {
    key: "acc_warehouse",
    icon: "warehouse",
    label: "Kho & Vật tư",
    pages: ["wh_manager","wh_import","wh_export","stock_nxt","stock_count"],
    items: [
      { key:"wh_manager",  icon:"warehouse",     label:"Danh mục hàng & dịch vụ" },
      { key:"wh_import",   icon:"move_to_inbox", label:"Nhập kho" },
      { key:"wh_export",   icon:"outbox",        label:"Xuất kho" },
      { key:"stock_nxt",   icon:"assessment",    label:"Thẻ kho (Lịch sử NXT)" },
      { key:"stock_count", icon:"fact_check",    label:"Kiểm kê kho" },
    ],
  },
  {
    key: "acc_purchase",
    icon: "shopping_cart",
    label: "Mua hàng (NCC)",
    pages: ["purchase_order","wh_import_ncc","rma","debt_ncc","suppliers"],
    items: [
      { key:"purchase_order", icon:"add_shopping_cart",      label:"Đặt hàng NCC" },
      { key:"wh_import_ncc",  icon:"move_to_inbox",          label:"Nhập kho (nhận hàng)" },
      { key:"rma",            icon:"assignment_return",      label:"Trả hàng NCC (RMA)" },
      { key:"debt_ncc",       icon:"account_balance_wallet", label:"Công nợ NCC" },
      { key:"suppliers",      icon:"storefront",             label:"Danh sách NCC" },
    ],
  },
  {
    key: "acc_customers",
    icon: "group",
    label: "Khách hàng",
    pages: ["customers"],
    items: [
      { key:"customers", icon:"group", label:"Danh sách khách hàng" },
    ],
  },
  {
    key: "acc_accounting",
    icon: "account_balance",
    label: "Kế toán",
    pages: ["cash_journal","debts","expense"],
    items: [
      { key:"cash_journal", icon:"menu_book",              label:"Sổ quỹ" },
      { key:"debts",        icon:"account_balance_wallet", label:"Công nợ khách hàng" },
      { key:"expense",      icon:"receipt",                label:"Thu / Chi" },
    ],
  },
  {
    key: "acc_report",
    icon: "bar_chart",
    label: "Báo cáo",
    pages: ["revenue","report_profit","report_staff"],
    items: [
      { key:"revenue",       icon:"bar_chart",   label:"Doanh thu" },
      { key:"report_profit", icon:"trending_up", label:"Lợi nhuận" },
      { key:"report_staff",  icon:"people",      label:"KPI Nhân viên" },
    ],
  },
  {
    key: "acc_setup",
    icon: "manage_accounts",
    label: "Thiết lập",
    pages: ["staff","department","role_perm","settings","integrations","print_template","action_log"],
    items: [
      { key:"staff",          icon:"badge",                label:"Nhân viên" },
      { key:"department",     icon:"account_tree",         label:"Phòng ban" },
      { key:"role_perm",      icon:"admin_panel_settings", label:"Vai trò & Quyền" },
      { key:"settings",       icon:"store",                label:"Cài đặt cửa hàng" },
      { key:"integrations",   icon:"cable",                label:"Tích hợp" },
      { key:"print_template", icon:"print",                label:"Mẫu in ấn" },
      { key:"action_log",     icon:"history",              label:"Nhật ký thao tác" },
    ],
  },
];
function MainAppContent({ onUserChange }) {
  const { can } = usePermission();
  const bp = useBreakpoint();
  const isPC = bp === "pc";
  const [user, setUser] = useState(null);
  const role = user?.role || "";
  const ordersRef = useRef([]); // luôn giữ latest orders snapshot
  const usersRef  = useRef([]); // luôn giữ latest users snapshot
  const kanbanScrollRef = useRef(null); // persist scroll qua re-render
  const kanbanScrollLeft = useRef(0);   // lưu vị trí scroll
  // ── Âm thanh thông báo ─────────────────────────
  const notifAudioRef = useRef(null);

  // ── Inject CSS animation vào document.head ──────────────
  useEffect(() => {
    // Remove old and re-inject to ensure latest version
    const old = document.getElementById("hk-pulse-red");
    if (old) old.remove();
    const el = document.createElement("style");
    el.id = "hk-pulse-red";
    el.textContent = `
      @keyframes pulseRed {
        0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.8), 0 2px 8px rgba(0,0,0,.1); border-color: #ef4444; }
        50%  { box-shadow: 0 0 0 10px rgba(239,68,68,0), 0 2px 8px rgba(0,0,0,.1); border-color: #fca5a5; }
        100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.8), 0 2px 8px rgba(0,0,0,.1); border-color: #ef4444; }
      }
    `;
    document.head.appendChild(el);
  }, []);

  // Tạo AudioContext lưu toàn cục, unlock sau gesture
  useEffect(() => {
    const unlock = () => {
      try {
        if (!window.__hk_actx) {
          window.__hk_actx = new (window.AudioContext || window.webkitAudioContext)();
        }
        window.__hk_actx.resume();
      } catch {}
    };
    ["touchstart","mousedown","keydown"].forEach(e =>
      window.addEventListener(e, unlock, { once: true })
    );
  }, []);

  const playNotifSound = () => {
    try {
      const ctx = window.__hk_actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!window.__hk_actx) window.__hk_actx = ctx;
      const play = () => {
        // Nốt 1: 880Hz
        const o1 = ctx.createOscillator(), g1 = ctx.createGain();
        o1.connect(g1); g1.connect(ctx.destination);
        o1.type = "sine"; o1.frequency.value = 880;
        g1.gain.setValueAtTime(0.5, ctx.currentTime);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o1.start(ctx.currentTime); o1.stop(ctx.currentTime + 0.35);
        // Nốt 2: 1100Hz
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = "sine"; o2.frequency.value = 1100;
        g2.gain.setValueAtTime(0, ctx.currentTime + 0.2);
        g2.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.3);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        o2.start(ctx.currentTime + 0.2); o2.stop(ctx.currentTime + 0.65);
      };
      if (ctx.state === "suspended") { ctx.resume().then(play); } else { play(); }
    } catch(e) { console.warn("Sound:", e); }
  };
  const [loggedOut, setLoggedOut] = useState(false);
  const [orders, setOrders_raw] = useState([]);
  const setOrders = (fn_or_val) => {
    setOrders_raw(prev => {
      const next = typeof fn_or_val === "function" ? fn_or_val(prev) : fn_or_val;
      ordersRef.current = next;
      return next;
    });
  };
  const [users_raw, setUsers_raw] = useState([]);
  const setUsers = (fn_or_val) => {
    setUsers_raw(prev => {
      const next = typeof fn_or_val === "function" ? fn_or_val(prev) : fn_or_val;
      usersRef.current = next;
      return next;
    });
  };
  const users = users_raw;
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState("board");
  // openAccordion: key của accordion đang mở, hoặc null
  const [openAccordion, setOpenAccordion] = useState("acc_overview");
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [dashboardFilter, setDashboardFilter] = useState(null); // "active"|"done"|"needs_reassign"|null
  const [selectedOrder, setSelectedOrder] = useState(null);
  const selectedOrderRef = useRef(null); // track để poll có thể sync drawer
  // Helper: set cả state lẫn ref cùng lúc
  const setSelectedOrderSync = (valOrFn) => {
    setSelectedOrder(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      selectedOrderRef.current = next;
      return next;
    });
  };
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isWarehouse  = role === "warehouse";
  const isManager    = ["manager","admin","owner","supervisor"].includes(role);
  const isKtv        = role === "technician";
  const isReception  = role === "receptionist";
  const isRoleHome   = ["cashier","accountant","hr","marketing","qa","support","delivery","it","viewer","supervisor"].includes(role);

  // ── Set initial page khi user login lần đầu ──────────────
  useEffect(() => {
    if (!user) return;
    const isManagerRole = ["manager","admin","owner","supervisor"].includes(role);
    if (isManagerRole && page === "board") {
      setPage("dashboard");
    }
  }, [user]);

  // Auto mở accordion chứa page hiện tại
  useEffect(() => {
    if (!isManager) return;
    const found = MGR_ACCORDIONS.find(acc => acc.pages.some(p => {
      if (p.includes("__")) { const [pg, tab] = p.split("__"); return page === pg && dashboardTab === tab; }
      return page === p;
    }));
    if (found) setOpenAccordion(found.key);
  }, [page]);

  // ── Global: chặn chọn chữ toàn app ──────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "hkapp-no-select";
    style.textContent = `
      * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
      input, textarea, [contenteditable] { -webkit-user-select: text !important; user-select: text !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("hkapp-no-select")?.remove(); };
  }, []);

  // ── Chặn nút Back + Android gesture back ─────────────────
  useEffect(() => {
    // Nhồi nhiều state vào history để gesture back phải "tiêu thụ" hết
    // trước khi thoát được app (Android cần ít nhất 2-3 state)
    const STACK = 5;
    for (let i = 0; i < STACK; i++) {
      window.history.pushState({ hkapp: i }, "");
    }

    const onPop = () => {
      // Luôn push lại ngay để duy trì stack
      window.history.pushState({ hkapp: true }, "");

      // Xử lý navigation nội bộ
      if (selectedOrder) { setSelectedOrderSync(null); return; }
      if (sidebarOpen)   { setSidebarOpen(false);  return; }
      if (page !== "board" && page !== "tasks") {
        setPage(
          user?.role === "technician"   ? "ktv_home"    :
          user?.role === "receptionist" ? "rec_home"    :
          user?.role === "warehouse"    ? "wh_home"     :
          user?.role === "accountant"   ? "cashier_home":
          user?.role === "cashier"      ? "cashier_home":
          user?.role === "owner"        ? "dashboard" :
          "dashboard"
        );
      }
    };

    // pageshow bắt được cả trường hợp Android bfcache restore
    const onPageShow = (e) => {
      if (e.persisted) {
        for (let i = 0; i < STACK; i++) window.history.pushState({ hkapp: i }, "");
      }
    };

    // visibilitychange: khi app quay lại foreground, refill stack
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        for (let i = 0; i < STACK; i++) window.history.pushState({ hkapp: i }, "");
      }
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [selectedOrder, sidebarOpen, page, user]);
  const [notifications, setNotifications] = useState([]);
  const [dbNotifications, setDbNotifications] = useState([]); // từ PocketBase
  const [showNotif, setShowNotif] = useState(false);

  // Realtime notifications via PocketBase SSE + fallback poll
  const seenNotifIds = useRef(new Set());

  // Hàm xử lý notification mới — phát sound + show system notif
  const handleNewNotif = useCallback(async (n) => {
    if (!n?.id) return;
    if (seenNotifIds.current.has(n.id)) return;
    seenNotifIds.current.add(n.id);
    // Chỉ xử lý notif của user hiện tại
    if (n.user_id && n.user_id !== user?.id) return;
    // Chỉ notif mới (dưới 5 phút)
    const age = Date.now() - new Date(n.created_date || n.updated).getTime();
    if (age > 300000) return;
    // Cập nhật state
    setDbNotifications(p => {
      if (p.find(x => x.id === n.id)) return p;
      return [n, ...p].sort((a,b) => (b.id||"").localeCompare(a.id||""));
    });
    // Sound + system notif
    const master = await getNotifSound("notif_sound_master").catch(()=>"on");
    if (master !== "off") {
      showSystemNotif(n.title || "HK One Touch", n.message || "", { tag: n.id });
      try { playNotifSound(); } catch {}
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    requestNotifPermission().catch(() => {});

    // Load notif cũ ban đầu
    const fetchAll = async () => {
      try {
        const list = await Notification.filter({ user_id: user.id, is_read: false });
        const sorted = list.sort((a,b) => (b.id||"").localeCompare(a.id||""));
        sorted.forEach(n => seenNotifIds.current.add(n.id)); // đánh dấu seen, ko phát sound
        setDbNotifications(sorted);
      } catch {}
    };
    fetchAll();

    // Smart poll notification: 10s khi active, 30s khi background
    let notifTimer = null;
    let lastNotifCheck = new Date(Date.now() - 60000).toISOString(); // nhìn lại 1 phút khi mới load

    const pollNotif = async () => {
      try {
        const fresh = await Notification.filter({
          user_id: user.id,
          is_read: false,
        }).catch(() => null);
        if (fresh && fresh.length > 0) {
          for (const n of fresh) {
            await handleNewNotif(n);  // handleNewNotif tự dedup qua seenNotifIds
          }
        }
      } catch {}
      const delay = document.hidden ? 30000 : 10000;
      notifTimer = setTimeout(pollNotif, delay);
    };

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(notifTimer);
        pollNotif();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    pollNotif();

    return () => {
      clearTimeout(notifTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, handleNewNotif]);
  const [qrOrder, setQrOrder] = useState(null);
  const [showQRScan, setShowQRScan] = useState(false);
  const [newOrderProductQR, setNewOrderProductQR] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null); // toast xác nhận tạo đơn
  const [productHistory, setProductHistory] = useState(null);
  const [warehouseStockModal, setWarehouseStockModal] = useState(null);

  // ── Load real data from entities ──────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        setDataLoading(true);
        // Staff lấy từ Base44 entities (nguồn chính)
        // RepairOrder lấy từ PocketBase local
        const [staffList, orderList] = await Promise.all([
          Staff.list().catch(async () => {
            // Fallback về PocketBase nếu B44 lỗi
            return [];
          }),
          RepairOrder.list({ sort: "-received_date", limit: 200 }).catch(() => []),
        ]);
        const mappedUsers = staffList.map(s => ({
          id: s.id,
          _id: s.id,
          name: s.full_name,
          full_name: s.full_name,
          username: s.username,
          password: s.password_hash,
          role: s.role,
          kpi: s.kpi_score || 0,
          phone: s.phone || "",
          note: s.note || "",
          is_active: s.is_active !== false,
          avatar_url: s.avatar_url || "",
          must_change_password: s.must_change_password || false,
        }));
        const mappedOrders = orderList.map(o => mapPbOrder(o, STATUS_DISPLAY, PRIORITY_DISPLAY));
        setUsers(mappedUsers);
        setOrders(mappedOrders);
      } catch(e) {
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  // ── Smart Poll: cập nhật orders theo visibility ──────────────
  // Active: poll 8s | Background: poll 60s
  // Strategy: fetch light snapshot (id+status+accept_stage+kpi fields),
  //           so sánh hash với state hiện tại → nếu có diff → fetch full record đó
  useEffect(() => {
    if (!user?.id) return;
    let timer = null;

    // Tạo hash nhanh từ các field quan trọng
    const hashOrder = (o) => [
      o.id, o.status, o.accept_stage,
      o.kpi_manually_accepted, o.kpi_stage1_penalized, o.kpi_stage2_penalized,
      o.needs_reassign, o.assigned_to
    ].join("|");

    const poll = async () => {
      try {
        // Fetch nhẹ: chỉ lấy các field cần so sánh
        const snapshot = await RepairOrder.list({
          sort: "-received_date",
          limit: 200,
          fields: "id,status,accept_stage,kpi_manually_accepted,kpi_stage1_penalized,kpi_stage2_penalized,needs_reassign,assigned_to,order_code"
        }).catch(() => null);

        if (!snapshot) return;

        // So sánh với state hiện tại
        setOrders(prev => {
          const prevMap = Object.fromEntries(prev.map(o => [o._id || o.id, o]));
          const changedIds = [];
          const newIds = [];

          for (const s of snapshot) {
            const existing = prevMap[s.id];
            if (!existing) {
              newIds.push(s.id); // đơn mới
            } else {
              const prevHash = hashOrder({ ...existing, id: existing._id || existing.id });
              const snapHash = hashOrder(s);
              if (prevHash !== snapHash) changedIds.push(s.id); // có thay đổi
            }
          }

          // Kiểm tra đơn bị xóa
          const snapshotIds = new Set(snapshot.map(s => s.id));
          const deletedIds = prev.filter(o => {
            const pbId = o._id || o.id;
            return pbId && !snapshotIds.has(pbId);
          }).map(o => o._id || o.id);

          const toFetch = [...changedIds, ...newIds];

          if (toFetch.length === 0 && deletedIds.length === 0) return prev; // không có gì thay đổi

          // Fetch full record cho những cái thay đổi (async, update sau)
          if (toFetch.length > 0) {
            Promise.all(
              toFetch.map(id => RepairOrder.get(id).catch(() => null))
            ).then(results => {
              setOrders(p => {
                let next = [...p];
                for (const raw of results) {
                  if (!raw) continue;
                  const mapped = mapPbOrder(raw, STATUS_DISPLAY, PRIORITY_DISPLAY);
                  const idx = next.findIndex(x => (x._id || x.id) === raw.id);
                  if (idx >= 0) next[idx] = { ...next[idx], ...mapped };
                  else next = [mapped, ...next];
                }
                return next;
              });
              // Nếu drawer đang mở và đúng đơn thay đổi → sync luôn selectedOrder
              const current = selectedOrderRef.current;
              if (current) {
                const fresh = results.find(r => r && r.id === (current._id || current.id));
                if (fresh) {
                  const mapped = mapPbOrder(fresh, STATUS_DISPLAY, PRIORITY_DISPLAY);
                  setSelectedOrderSync(prev => ({ ...prev, ...mapped }));
                }
              }
            });
          }

          // Xóa ngay những đơn đã bị xóa
          if (deletedIds.length > 0) {
            return prev.filter(o => !deletedIds.includes(o._id || o.id));
          }

          return prev; // state chưa thay đổi, full update sẽ đến từ Promise.all
        });

      } catch {}

      const delay = document.hidden ? 60000 : 8000;
      timer = setTimeout(poll, delay);
    };

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    poll();

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);


  // ── In-app Export Deadline Reminder (thay thế Base44 automation) ─────────────
  // Chạy mỗi 5 phút, chỉ khi user là warehouse hoặc manager
  useEffect(() => {
    if (!user?.id) return;
    const isWHorMgr = ["warehouse","manager","admin"].includes(role);
    if (!isWHorMgr) return;

    async function checkExportDeadlines() {
      try {
        // Lấy tất cả phiếu pending chưa nhắc
        const pending = await StockExportRequest.filter({ status: "pending" });
        const now = Date.now();
        for (const req of pending) {
          if (!req.due_datetime || req.reminded_15min) continue;
          const dueMs = new Date(req.due_datetime).getTime();
          const remMs = dueMs - now;
          if (remMs > 0 && remMs <= 15 * 60 * 1000) {
            // Còn 15 phút → nhắc tất cả NV kho
            const remMins = Math.floor(remMs / 60000);
            // Lấy staff kho để gửi thông báo
            const staffList = await Staff.filter({ role: "warehouse", is_active: true }).catch(() => []);
            for (const ws of staffList) {
              await Notification.create({
                user_id: ws.id, user_name: ws.full_name,
                title: `⏰ Sắp hết hạn xuất — ${req.request_code}`,
                message: `Phiếu ${req.request_code} (${req.order_code}) còn ${remMins} phút! Vào Phiếu xuất kho để xử lý ngay.`,
                order_id: req.order_id, order_code: req.order_code,
                type: "export_deadline", is_read: false,
              }).catch(() => {});
            }
            // Đánh dấu đã nhắc
            await StockExportRequest.update(req.id, { reminded_15min: true }).catch(() => {});
          }
        }

        // Kiểm tra phiếu mượn quá hạn trả — chỉ nhắc 1 lần/ngày (dùng localStorage làm flag)
        const borrowing = await StockExportRequest.filter({ export_type: "borrow", status: "ktv_confirmed" }).catch(() => []);
        const today = new Date().toLocaleDateString("vi-VN");
        for (const req of borrowing) {
          if (!req.return_due_date) continue;
          const retMs = new Date(req.return_due_date).getTime();
          if (retMs < now) {
            // Kiểm tra đã nhắc hôm nay chưa
            const flagKey = `overdue_notif_${req.id}_${today}`;
            if (localStorage.getItem(flagKey)) continue;
            // Quá hạn — nhắc NV kho
            const staffList = await Staff.filter({ role: "warehouse", is_active: true }).catch(() => []);
            for (const ws of staffList) {
              await Notification.create({
                user_id: ws.id, user_name: ws.full_name,
                title: `🚨 Quá hạn trả linh kiện — ${req.request_code}`,
                message: `Phiếu ${req.request_code} đã quá hạn trả (${new Date(req.return_due_date).toLocaleDateString("vi-VN")}). Liên hệ KTV ${req.requested_by_name||"?"} để thu hồi.`,
                order_id: req.order_id, order_code: req.order_code,
                type: "export_overdue", is_read: false,
              }).catch(() => {});
            }
            // Đánh dấu đã nhắc hôm nay
            localStorage.setItem(flagKey, "1");
          }
        }
      } catch (e) {}
    }

    // Chạy ngay lần đầu sau 30 giây
    const firstRun = setTimeout(checkExportDeadlines, 30000);
    // Sau đó mỗi 5 phút
    const iv = setInterval(checkExportDeadlines, 5 * 60 * 1000);
    return () => { clearTimeout(firstRun); clearInterval(iv); };
  }, [user?.id, user?.role]);

  // ── Auto KPI deduction per timeline diagram ──────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      let kpiChanges   = [];
      let pbPatches    = []; // [{ orderId, pbId, patch }]
      let notifPayload = []; // thông báo đẩy vào PocketBase + state

      // Kiểm tra nhanh trước khi setOrders để tránh re-render không cần thiết
      const snapshot = ordersRef.current;
      const hasActive = snapshot.some(o =>
        o.assigned_to && o.assigned_at && (o.accept_stage||0) < 2 &&
        !["Hoàn Thành","Đã Giao","Hủy","Hoan Thanh","Da Giao","Huy"].includes(o.status)
      );
      if (!hasActive) return;

      setOrders(prev => {
        kpiChanges   = [];
        pbPatches    = [];
        notifPayload = [];
        let changed  = false;

        const next = prev.map(o => {
          if (!o.assigned_to || !o.assigned_at) return o;
          if ((o.accept_stage||0) >= 2) return o;
          if (["Hoàn Thành","Đã Giao","Hủy","Hoan Thanh","Da Giao","Huy"].includes(o.status)) return o;

          const assignedAt  = new Date(o.assigned_at).getTime();
          const stage1At    = o.stage1_at ? new Date(o.stage1_at).getTime() : null;
          const stage       = o.accept_stage || 0;
          let patch = {};

          // ══════════════════════════════════════════════════════════════
          // QUY TRÌNH KPI:
          //   Stage 0 (chưa nhận): KTV có 60p để bấm Nhận
          //     → Quá 60p: -1 KPI, tự chuyển stage 1 (đếm tiếp 60p)
          //     → Quá 120p (60p stage 1): -2 KPI thêm, báo quản lý
          //   Nếu KTV BẤM NHẬN BẤT KỲ LÚC NÀO (stage 0 hoặc 1):
          //     → accept_stage = 2 (đếm dừng, không KPI thêm), chờ bấm Sửa
          // ══════════════════════════════════════════════════════════════

          // ── STAGE 0: KTV chưa nhận → 60 phút đầu ─────────────────────────
          if (stage === 0) {
            const deadline0  = assignedAt + 60 * 60000;
            const remMs      = deadline0 - now;
            const remMins    = Math.floor(remMs / 60000);

            // Nhắc khi còn < 20 phút
            if (remMs > 0 && remMs <= 20 * 60000) {
              const urgentLevel = remMs < 5*60000 ? "🚨" : remMs < 10*60000 ? "⚠️" : "⏰";
              notifPayload.push({
                userId: o.assigned_to,
                title: `${urgentLevel} Nhận đơn ${o.order_code || o.id}`,
                message: `Còn ${remMins} phút để nhận đơn! Bấm vào đơn để nhận ngay.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_reminder", role: null,
              });
            }

            // Hết 60p chưa nhận → -1 KPI, tự chuyển sang giai đoạn chờ lần 2
            if (remMs <= 0 && !o.kpi_stage1_penalized) {
              patch.kpi_stage1_penalized = true;
              patch.accept_stage         = 1;
              // stage1_at = thời điểm hết hạn 60p đầu (không phải now, để tính đúng 60p tiếp)
              patch.stage1_at = new Date(assignedAt + 60 * 60000).toISOString();
              kpiChanges.push({ userId: o.assigned_to, delta: -1 });
              notifPayload.push({
                userId: o.assigned_to,
                title: `🔴 Quá 60 phút — Đơn ${o.order_code || o.id}`,
                message: `Chưa bấm Nhận Đơn → -1 KPI. Hệ thống tự chuyển sang đếm tiếp 60 phút lần 2.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_penalty", role: null,
              });
              notifPayload.push({
                userId: null,
                title: `⚠️ KTV chậm nhận — ${o.order_code || o.id}`,
                message: `KTV ${o.assigned_to_name || "?"} quá 60p không nhận đơn → -1 KPI. Đang đếm tiếp 60p.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_penalty", role: "manager",
              });
              changed = true;
            }
          }

          // ── STAGE 1 (tự động): 60p kế tiếp — vẫn chưa nhận ──────────────
          // Lưu ý: stage 1 TỰ ĐỘNG do hệ thống chuyển, KHÔNG phải KTV bấm nhận
          // Nếu KTV bấm nhận thủ công → accept_stage = 2, không vào đây nữa
          if (stage === 1 && o.stage1_at && !o.kpi_manually_accepted) {
            const stage1Start = new Date(o.stage1_at).getTime();
            const deadline1   = stage1Start + 60 * 60000;
            const remMs       = deadline1 - now;
            const remMins     = Math.floor(remMs / 60000);

            // Nhắc khi còn < 20 phút của giai đoạn 2
            if (remMs > 0 && remMs <= 20 * 60000) {
              const urgentLevel = remMs < 5*60000 ? "🚨" : "⚠️";
              notifPayload.push({
                userId: o.assigned_to,
                title: `${urgentLevel} KHẨN: Nhận đơn ${o.order_code || o.id}`,
                message: `Còn ${remMins} phút — nếu không nhận sẽ bị -2 KPI tiếp! Bấm Nhận ngay.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_reminder", role: null,
              });
            }

            // Hết 60p lần 2 → -2 KPI thêm, báo quản lý cần giao lại
            if (remMs <= 0 && !o.kpi_stage2_penalized) {
              patch.kpi_stage2_penalized = true;
              patch.needs_reassign       = true;
              kpiChanges.push({ userId: o.assigned_to, delta: -2 });
              notifPayload.push({
                userId: o.assigned_to,
                title: `🔴 Quá 120 phút — Đơn ${o.order_code || o.id}`,
                message: `Tổng 120 phút không nhận đơn → -2 KPI thêm. Ngừng nhận việc tạm thời.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "kpi_penalty", role: null,
              });
              notifPayload.push({
                userId: null,
                title: `📋 Cần Giao Lại — ${o.order_code || o.id}`,
                message: `KTV ${o.assigned_to_name||"?"} quá 120p không nhận → -2 KPI. Vui lòng giao KTV khác.`,
                orderId: o.id, orderCode: o.order_code || o.id, type: "needs_reassign", role: "manager",
              });
              changed = true;
            }
          }

          if (Object.keys(patch).length > 0) {
            changed = true;
            if (o._id) pbPatches.push({ orderId: o.id, pbId: o._id, patch });
            return { ...o, ...patch };
          }
          return o;
        });

        return changed ? next : prev;
      });

      // Apply KPI changes to users
      if (kpiChanges.length > 0) {
        setUsers(u => {
          let next = [...u];
          kpiChanges.forEach(({ userId, delta }) => {
            next = next.map(x => x.id===userId ? { ...x, kpi: Math.max(0, (x.kpi||0) + delta) } : x);
          });
          return next;
        });
        // Lưu KPI mới xuống PocketBase
        kpiChanges.forEach(async ({ userId, delta }) => {
          try {
            const staffRec = usersRef?.current?.find(u => u.id === userId) || [];
            if (staffRec?._id) {
              const newKpi = Math.max(0, (staffRec.kpi||0) + delta);
              await Staff.update(staffRec._id, { kpi_score: newKpi });
            }
          } catch(e) { console.warn("KPI PB update error:", e); }
        });
      }

      // Lưu các patch đơn xuống PocketBase
      pbPatches.forEach(async ({ pbId, patch }) => {
        try { await RepairOrder.update(pbId, patch); } catch(e) { console.warn("Order patch error:", e); }
      });

      // Gửi thông báo (chỉ lưu vào Notification entity — SSE sẽ push real-time)
      notifPayload.forEach(async (n) => {
        try {
          if (n.role === "manager") {
            // Broadcast cho tất cả manager
            const managers = usersRef?.current?.filter(u => u.role === "manager") || [];
            for (const m of managers) {
              await Notification.create({
                user_id: m.id, user_name: m.name || m.full_name || "",
                title: n.title, message: n.message,
                order_id: n.orderId, order_code: n.orderCode,
                type: n.type, is_read: false,
              });
            }
          } else if (n.userId) {
            await Notification.create({
              user_id: n.userId, user_name: "",
              title: n.title, message: n.message,
              order_id: n.orderId, order_code: n.orderCode,
              type: n.type, is_read: false,
            });
          }
        } catch(e) { console.warn("Notif push error:", e); }
      });

    }, 15 * 60 * 1000); // chạy mỗi 15 phút
    return () => clearInterval(iv);
  }, []);

  if (dataLoading) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:56 }}> </div>
      <div style={{ color:"#fff", fontWeight:800, fontSize:20 }}>Đang tải hệ thống...</div>
      <div style={{ color:"#c7d2fe", fontSize:14 }}>⏳ Vui lòng chờ</div>
    </div>
  );
  const doLogout = () => {
    setUser(null);
    onUserChange?.(null);
    setLoggedOut(true);
    setSidebarOpen && setSidebarOpen(false);
  };
  if (!user) return <LoginPage onLogin={u => {
    setUser(u);
    onUserChange?.(u);
    setLoggedOut(false);
    // Ưu tiên default_page từ DB role (nếu có), fallback hardcode
    const DEFAULT_PAGE_MAP = {
      technician:   "ktv_home",
      receptionist: "rec_home",
      warehouse:    "wh_home",
      accountant:   "role_home",
      cashier:      "role_home",
      owner:        "dashboard",
      admin:        "dashboard",
      manager:      "dashboard",
      supervisor:   "role_home",
      hr:           "role_home",
      marketing:    "role_home",
      qa:           "role_home",
      support:      "role_home",
      delivery:     "role_home",
      it:           "role_home",
      viewer:       "role_home",
    };
    setPage(DEFAULT_PAGE_MAP[u.role] || "board");
  }} loggedOut={loggedOut} />;
  if (user.must_change_password) return <ChangePassword user={user} forceChange={true} onSuccess={() => setUser(u => ({...u, must_change_password: false}))} />;

  async function updateOrder(id, patch, kpiEvent, action) {
    // Xóa đơn khỏi state
    if (action === "delete" || patch === null) {
      setOrders(p => p.filter(o => o.id !== id && o.order_code !== id));
      if (selectedOrder?.id === id || selectedOrder?.order_code === id) setSelectedOrderSync(null);
      return;
    }
    // Auto-set assigned_at khi assign/reassign KTV (nếu patch chưa có)
    if (patch?.assigned_to && !patch.assigned_at) {
      const curOrder = ordersRef.current.find(o => o.id===id) || orders.find(o => o.id===id);
      if (!curOrder?.assigned_at || curOrder.assigned_to !== patch.assigned_to) {
        patch = { ...patch, assigned_at: new Date().toISOString() };
      }
    }
    setOrders(p => p.map(o => (o.id===id || o.order_code===id) ? {...o,...patch} : o));
    if (selectedOrder?.id===id || selectedOrder?.order_code===id) setSelectedOrderSync(p => ({...p,...patch}));
    if (kpiEvent) setUsers(p => p.map(u => u.id===kpiEvent.userId ? {...u, kpi:Math.max(0,u.kpi+kpiEvent.delta)} : u));

    // Lưu xuống PocketBase (dùng _id thật)
    try {
      const order = ordersRef.current.find(o => o.id === id) || orders.find(o => o.id === id);
      const pbId = order?._id;
      if (!pbId) return; // đơn chưa lưu vào PB
      // Map patch field sang schema PocketBase
      const pbPatch = {};
      // Fields trực tiếp (1-1 với PB schema)
      const directFields = [
        "customer_name","customer_phone","device_name","device_model","imei","passcode",
        "issue_description","technician_note","assigned_to","assigned_to_name",
        "estimated_cost","final_cost","deposit","warranty_days",
        "received_date","estimated_done_date","done_date","images","videos",
        "accept_stage","stage1_at","stage2_at","estimated_done","assigned_at",
        "checklist_done","kpi_stage1_penalized","kpi_stage2_penalized","needs_reassign","kpi_manually_accepted",
      ];
      directFields.forEach(f => { if (patch[f] !== undefined) pbPatch[f] = patch[f]; });
      // Fields cần map enum
      if (patch.status    !== undefined) pbPatch.status   = STATUS_PB[patch.status]   || patch.status;
      if (patch.priority  !== undefined) pbPatch.priority = PRIORITY_PB[patch.priority]|| patch.priority;
      // Alias cũ
      if (patch.notes     !== undefined) pbPatch.technician_note = patch.notes;
      // accept_stage đã có trong directFields - không cần làm gì thêm
      if (Object.keys(pbPatch).length > 0) {
        const saved = await RepairOrder.update(pbId, pbPatch);
        // Sau khi PB lưu thành công → map lại từ PB để đảm bảo đồng bộ
        if (saved && saved.id) {
          const fresh = mapPbOrder(saved, STATUS_DISPLAY, PRIORITY_DISPLAY);
          // Chỉ sync nếu không có thêm patch đang pending
          setOrders(p => p.map(o => (o._id === saved.id) ? { ...fresh, ...patch } : o));
          if (selectedOrder?._id === saved.id) setSelectedOrderSync(p => ({ ...fresh, ...patch }));
        }
      }
      if (kpiEvent) {
        const staffRec = users.find(u => u.id === kpiEvent.userId);
        if (staffRec?._id) {
          await Staff.update(staffRec._id, { kpi_score: Math.max(0, (staffRec.kpi||0) + kpiEvent.delta) });
        }
      }
    } catch(e) {
      console.warn("updateOrder PB error:", e.message);
    }
  }
  async function createOrder(data) {
    // Lưu vào PocketBase
    // pbData khai báo ngoài try để catch có thể dùng lại
    const pbData = {
      order_code:        data.id,
      customer_name:     data.customer_name || "",
      customer_phone:    data.customer_phone || "",
      device_name:       data.device_model || "",
      device_model:      data.device_model || "",
      imei:              data.imei_serial || "",
      passcode:          data.passcode || "",
      product_qr:        data.product_qr || "",
      issue_description: data.notes || "",
      status:            "Cho KTV",
      assigned_to:       data.assigned_to || null,
      assigned_to_name:  data.assigned_to_name || "",
      received_date:     new Date().toISOString(),
      images:            data.images || [],
      technician_note:   data.notes || "",
      warranty_days:     0,
      priority:          "Thuong",
      qt1_checklist:     data.qt1_checklist || "",
      qt1_note:          data.qt1_note || "",
    };
    try {
      const saved = await RepairOrder.create(pbData);
      data._id = saved.id;
      data._pbSaved = true;
      logHistory({
        order_id:        saved.id,
        order_code:      data.id,
        action_type:     "created",
        action_label:    "Tạo đơn mới",
        changed_by_id:   user?.id || "",
        changed_by_name: user?.name || user?.full_name || "",
        changed_by_role: user?.role || "",
        new_value:       `${data.device_model || ""} — ${data.customer_name || ""}`,
      });
      logAction(user, "create_order", "repair_order", saved.id, `${data.device_model||""} — ${data.customer_name||""}`);
    } catch(e) {
      console.error("[createOrder] Lần 1 thất bại:", e?.message, JSON.stringify(e?.data || {}));
      console.error("[createOrder] pbData gửi lên:", JSON.stringify(pbData));
      // Thử lại bỏ các field có thể gây lỗi
      try {
        const pbData2 = { ...pbData, status: "Cho KTV", priority: "Thuong", warranty_days: 0 };
        delete pbData2.assigned_at;
        delete pbData2.accept_stage;
        const saved2 = await RepairOrder.create(pbData2);
        data._id = saved2.id;
        data._pbSaved = true;
        logHistory({
          order_id:        saved2.id,
          order_code:      data.id,
          action_type:     "created",
          action_label:    "Tạo đơn mới",
          changed_by_id:   user?.id || "",
          changed_by_name: user?.name || user?.full_name || "",
          changed_by_role: user?.role || "",
          new_value:       `${data.device_model || ""} — ${data.customer_name || ""}`,
        });
      } catch(e2) {
        console.error("[createOrder] Lần 2 thất bại:", e2?.message, e2?.data || "");
        const detail = JSON.stringify(e2?.data || e?.data || {}, null, 2);
        const msg = e2?.message || e?.message || "Kiểm tra kết nối PocketBase.";
        alert("Không lưu được đơn vào database!\n\nLỗi: " + msg + "\n\nChi tiết:\n" + detail);
        return;
      }
    }

    setOrders(p => [data, ...p]);
    // Gửi Notification vào DB để KTV + Manager + Receptionist nhận realtime
    const orderCode = data.id || data._id;
    const orderId   = data._id || data.id;

    if (data.assigned_to) {
      const ktv = users.find(u => u.id === data.assigned_to);
      // Thông báo cho KTV được giao
      Notification.create({
        user_id:    data.assigned_to,
        user_name:  ktv?.name || "",
        title:      `🔧 Đơn mới được giao: ${orderCode}`,
        message:    `${data.customer_name || ""} - ${data.device_model || ""}. Vui lòng xác nhận!`,
        order_id:   orderId,
        order_code: orderCode,
        type:       "assign",
        is_read:    false,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }

    // Thông báo cho tất cả Manager + Receptionist (trừ người tạo)
    const notifyStaff = users.filter(u =>
      ["manager", "admin", "receptionist"].includes(u.role) && u.id !== user?.id
    );
    notifyStaff.forEach(u => {
      Notification.create({
        user_id:    u.id,
        user_name:  u.name || "",
        title:      `📋 Đơn mới: ${orderCode}`,
        message:    `${data.customer_name || ""} - ${data.device_model || ""}`,
        order_id:   orderId,
        order_code: orderCode,
        type:       "new_order",
        is_read:    false,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    });

    setCreatedOrder(data);
    setPage("board");
  }
  function goToPendingAccept() {
    setPage("tasks");
    const p = orders.find(o => o.assigned_to===user.id && (o.accept_stage||0)<2 && o.assigned_at);
    if (p) { setHighlightId(p.id); setTimeout(() => setHighlightId(null), 3000); }
  }


  function handleGlobalQRScan(result) {
    setShowQRScan(false);
    if (result.type === "product_history") {
      setProductHistory(result);
    } else if (result.type === "warehouse_stock") {
      // Máy đang trong kho, chưa bán
      setWarehouseStockModal(result.data);
    } else if (result.type === "assign_qr") {
      setNewOrderProductQR(result.qr);
      setShowNewOrder(true);
    } else if (result.type === "order") {
      setSelectedOrderSync(result.data);
    }
  }

  const myOrders = user.role==="technician" ? orders.filter(o => o.assigned_to===user.id) : orders;
  const filtered = myOrders.filter(o => {
    // Dashboard quick filter
    if (dashboardFilter === "active" && (["Hoàn Thành","Đã Giao","Hủy"].includes(o.status))) return false;
    if (dashboardFilter === "done" && !["Hoàn Thành","Đã Giao"].includes(o.status)) return false;
    if (dashboardFilter === "needs_reassign" && !o.needs_reassign) return false;
    if (!search) return true;
    const q = search.toLowerCase().trim();
    const nameMatch = (o.customer_name||"").toLowerCase().includes(q);
    const phoneMatch = (o.customer_phone||"").includes(q);
    const deviceMatch = (o.device_model||"").toLowerCase().includes(q);
    const idMatch = (o.id||"").toLowerCase().includes(q);
    const qrMatch = (o.qr_code||"").toLowerCase().includes(q);
    const imeiMatch = (o.imei_serial||"").includes(q);
    const noteMatch = (o.notes||"").toLowerCase().includes(q);
    return nameMatch || phoneMatch || deviceMatch || idMatch || qrMatch || imeiMatch || noteMatch;
  });
  const pendingAccepts = orders.filter(o => o.assigned_to===user.id && ["Chờ KTV","Chờ KTV Sửa"].includes(o.status));

  // navItems dùng can() để lọc quyền
  const navItems = (() => {
    // ── WAREHOUSE — menu riêng ──────────────────────────────
    if (isWarehouse) return [
      { key:"wh_home",        icon:"home",                   label:"Trang chủ" },
      { key:"wh_orders",      icon:"chat",                   label:"Chat đơn" },
      { key:"wh_export",      icon:"outbox",                 label:"Phiếu xuất kho" },
      { key:"wh_import",      icon:"move_to_inbox",          label:"Nhập hàng" },
      { key:"wh_manager",     icon:"warehouse",              label:"Quản lý kho" },
      { key:"purchase_order", icon:"add_shopping_cart",      label:"Đặt hàng NCC" },
      { key:"wh_import_ncc",  icon:"move_to_inbox",          label:"Nhập kho (nhận NCC)" },
      { key:"rma",            icon:"assignment_return",      label:"Trả hàng NCC" },
      { key:"debt_ncc",       icon:"account_balance_wallet", label:"Công nợ NCC" },
    ];

    const items = [];

    // 1. TRANG CHỦ
    if (isKtv)            items.push({ key:"ktv_home",  icon:"home", label:"Trang chủ" });
    else if (isReception) items.push({ key:"rec_home",  icon:"home", label:"Trang chủ" });
    else if (isRoleHome)  items.push({ key:"role_home", icon:"home", label:"Trang chủ" });

    // 2. DỊCH VỤ SỬA CHỮA
    if (can("repair_order","create") && !isKtv)
      items.push({ key:"new",   icon:"add_circle", label:"Tạo đơn" });
    if (can("repair_order","view"))
      items.push({ key:"tasks", icon:"list_alt",   label:"Danh sách & Lịch sử đơn" });

    // 3. BÁN HÀNG
    if (can("sale_order","view"))
      items.push({ key:"cashier_home", icon:"point_of_sale", label:"Bán hàng" });
    if (["owner","admin","manager","team_leader","cashier"].includes(user?.role))
      items.push({ key:"return_order", icon:"swap_horiz", label:"Đổi trả & BH" });

    // 4. KHO & VẬT TƯ
    if (can("warehouse_mgr","view") && !isManager)
      items.push({ key:"wh_manager",  icon:"warehouse",  label:"Quản lý kho" });
    if (can("stock_count","view") && !isManager && !isRoleHome)
      items.push({ key:"stock_count", icon:"fact_check", label:"Kiểm kê kho" });

    // 5. MUA HÀNG NCC
    if (["owner","admin","team_leader","warehouse"].includes(user?.role) && !isManager) {
      items.push({ key:"purchase_order", icon:"add_shopping_cart",      label:"Đặt hàng NCC" });
      items.push({ key:"wh_import_ncc",  icon:"move_to_inbox",          label:"Nhập kho (nhận NCC)" });
      items.push({ key:"rma",            icon:"assignment_return",       label:"Trả hàng NCC (RMA)" });
      items.push({ key:"debt_ncc",       icon:"account_balance_wallet",  label:"Công nợ NCC" });
      items.push({ key:"suppliers",      icon:"storefront",              label:"Danh sách NCC" });
    }

    // 6. KHÁCH HÀNG
    if (can("customer","view") && !isKtv && !isManager)
      items.push({ key:"customers", icon:"group", label:"Khách hàng" });

    // 7. KẾ TOÁN
    if (can("cash_journal","view") && !isManager)
      items.push({ key:"cash_journal", icon:"menu_book",              label:"Sổ quỹ" });
    if (can("debt","view") && !isManager)
      items.push({ key:"debts",        icon:"account_balance_wallet", label:"Công nợ KH" });

    // 8. THIẾT LẬP
    if (can("staff","view") && !isManager)
      items.push({ key:"staff",    icon:"person",   label:"Nhân viên" });
    if (can("settings","view") && !isManager)
      items.push({ key:"settings", icon:"settings", label:"Cài đặt" });

    return items;
  })();

  // ── Accordion Manager ───────────────────────────────────
  // ── Render toàn bộ 8 accordion Manager ─────────────────
  function renderManagerSidebar() {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
        {MGR_ACCORDIONS.map(acc => {
          const isOpen = openAccordion === acc.key;
          const isAccActive = acc.pages.some(p => {
            if (p.includes("__")) {
              const [pg, tab] = p.split("__");
              return page === pg && dashboardTab === tab;
            }
            return page === p;
          });
          return (
            <div key={acc.key} style={{ marginBottom:1 }}>
              {/* Header accordion */}
              <button
                onClick={() => {
                  setOpenAccordion(isOpen ? null : acc.key);
                }}
                style={{
                  width:"100%", textAlign:"left", padding:"11px 14px", borderRadius:10,
                  border:"none",
                  background: isAccActive ? "rgba(255,255,255,.15)" : "transparent",
                  color:      isAccActive ? "#fff" : "rgba(255,255,255,.75)",
                  fontWeight: isAccActive ? 800 : 600,
                  fontSize:13, cursor:"pointer", fontFamily:"system-ui,sans-serif",
                  display:"flex", alignItems:"center", gap:9,
                }}>
                <span className="material-icons"
                  style={{fontSize:18,fontFamily:"Material Icons",verticalAlign:"middle",lineHeight:1}}>
                  {acc.icon}
                </span>
                <span style={{ flex:1 }}>{acc.label}</span>
                <span className="material-icons"
                  style={{
                    fontSize:16, fontFamily:"Material Icons", lineHeight:1,
                    transition:"transform .2s",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    color:"rgba(255,255,255,.4)",
                  }}>
                  expand_more
                </span>
              </button>

              {/* Sub-items */}
              {isOpen && (
                <div style={{ paddingLeft:12, marginTop:1, marginBottom:2 }}>
                  {acc.items.map(sub => {
                    const isActive = sub.key.includes("__")
                      ? (page === sub.key.split("__")[0] && dashboardTab === sub.key.split("__")[1])
                      : page === sub.key;
                    return (
                      <button key={`${acc.key}-${sub.key}`}
                        onClick={() => {
                          const [basePg, subT] = sub.key.split("__");
                          setPage(basePg);
                          if (subT) setDashboardTab(subT);
                          else if (basePg === "dashboard") setDashboardTab("overview");
                          setSidebarOpen(false);
                          setDashboardFilter(null);
                        }}
                        style={{
                          width:"100%", textAlign:"left",
                          padding:"8px 10px", borderRadius:8, border:"none",
                          background: isActive ? "rgba(255,255,255,.2)" : "transparent",
                          color:      isActive ? "#fff" : "rgba(255,255,255,.6)",
                          fontWeight: isActive ? 700 : 400,
                          fontSize:12, cursor:"pointer", fontFamily:"system-ui,sans-serif",
                          display:"flex", alignItems:"center", gap:7, marginBottom:1,
                        }}>
                        <div style={{
                          width:2, height:12, borderRadius:2, flexShrink:0,
                          background: isActive ? "#fff" : "rgba(255,255,255,.2)",
                        }} />
                        <span className="material-icons"
                          style={{fontSize:14,fontFamily:"Material Icons",lineHeight:1}}>
                          {sub.icon}
                        </span>
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }


  // ── Kanban Board ─────────────────────────────────────────
  const COLUMNS = ["Chờ KTV","KTV Đang Kiểm","Chờ Báo Giá","Chờ Xác Nhận","Chờ KTV Sửa","Đang Sửa","Chờ Linh Kiện","Hoàn Thành","Đã Giao"];
  const colColors = { "Chờ KTV":"#fef2f2","KTV Đang Kiểm":"#e0f2fe","Chờ Báo Giá":"#fffbeb","Chờ Xác Nhận":"#fdf2f8","Chờ KTV Sửa":"#f5f3ff","Đang Sửa":"#ede9fe","Chờ Linh Kiện":"#fff7ed","Hoàn Thành":"#dcfce7","Đã Giao":"#f1f5f9" };
  const colBorder = { "Chờ KTV":"#fca5a5","KTV Đang Kiểm":"#7dd3fc","Chờ Báo Giá":"#fcd34d","Chờ Xác Nhận":"#fbcfe8","Chờ KTV Sửa":"#ddd6fe","Đang Sửa":"#c4b5fd","Chờ Linh Kiện":"#fed7aa","Hoàn Thành":"#86efac","Đã Giao":"#cbd5e1" };

  function KanbanBoard() {
    // Dùng ref từ outer scope → không bị reset khi re-render
    useLayoutEffect(() => {
      const el = kanbanScrollRef.current;
      if (!el) return;
      el.scrollLeft = kanbanScrollLeft.current;
    }, []); // restore sau mount

    const handleScroll = (e) => {
      kanbanScrollLeft.current = e.currentTarget.scrollLeft;
    };

    const filterLabel = dashboardFilter==="active"?"Đang xử lý":dashboardFilter==="done"?"Hoàn thành":dashboardFilter==="needs_reassign"?"Cần xử lý":null;

    return (
      <div style={{ paddingBottom:80 }}>
        {filterLabel && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px 0" }}>
            <div style={{ background:"#eef2ff", border:"1.5px solid #c7d2fe", borderRadius:99, padding:"4px 14px", fontSize:12, fontWeight:700, color:"#4f46e5", display:"flex", alignItems:"center", gap:6 }}>
              <span className="material-icons" style={{fontSize:14}}>filter_list</span>
              Lọc: {filterLabel}
            </div>
            <button onClick={()=>setDashboardFilter(null)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:12, fontWeight:600, padding:"4px 8px" }}>✕ Bỏ lọc</button>
          </div>
        )}
      <div
        ref={kanbanScrollRef}
        onScroll={handleScroll}
        style={{ overflowX:"auto", padding:"8px 16px 80px", WebkitOverflowScrolling:"touch",
          scrollSnapType:"x mandatory",
          WebkitMaskImage:"linear-gradient(to right, black 85%, transparent 100%)",
          maskImage:"linear-gradient(to right, black 85%, transparent 100%)" }}
      >
        <div style={{ display:"flex", gap:12, minWidth: COLUMNS.length * 240 }}>
          {COLUMNS.map(col => {
            const colOrders = filtered.filter(o => o.status===col);
            return (
              <div key={col} style={{ flex:"0 0 230px", background:colColors[col], borderRadius:16, border:`1.5px solid ${colBorder[col]}`, padding:12, minHeight:300 }}>
                <div style={{ fontWeight:800, fontSize:13, color:"#374151", marginBottom:10, display:"flex", justifyContent:"space-between" }}>
                  <span>{col}</span>
                  <span style={{ background:"#fff", borderRadius:99, padding:"2px 10px", fontSize:12 }}>{colOrders.length}</span>
                </div>
                {colOrders.map(o => <OrderCard key={o.id} order={o} highlight={highlightId===o.id} onClick={() => setSelectedOrderSync(o)} users={users} />)}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    );
  }

  function OrderCard({ order: o, highlight, onClick, users }) {
    const ktv = users.find(u => u.id===o.assigned_to);
    const timerInfo = ktv ? getKpiTimerInfo(o) : null;
    const isPending = ["Chờ KTV","Chờ KTV Sửa"].includes(o.status);
    return (
      <div onClick={onClick}
        style={{
          background: isPending && !highlight ? "#fff5f5" : "#fff",
          borderRadius:12, padding:12, marginBottom:8, cursor:"pointer",
          boxShadow: highlight ? "0 0 0 3px #f59e0b" : "0 1px 4px rgba(0,0,0,.08)",
          border: highlight ? "2px solid #f59e0b" : isPending ? "2px solid #ef4444" : "2px solid transparent",
          animation: isPending && !highlight ? "pulseRed 1.6s ease-in-out infinite" : "none",
          transition: isPending ? "none" : "box-shadow .2s"
        }}>
        <div style={{ fontWeight:800, fontSize:13, color:"#1e1b4b", marginBottom:4 }}>{o.id}</div>
        <div style={{ fontSize:12, color:"#374151", marginBottom:2 }}>  {o.customer_name||"?"} · {o.customer_phone||""}</div>
        <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>  {o.device_model}</div>
        {o.issues?.length>0 && <div style={{ fontSize:11, color:"#7c3aed", marginBottom:4 }}>{o.issues.slice(0,2).join(" · ")}</div>}
        {ktv && <div style={{ fontSize:11, color:"#059669", marginBottom:timerInfo?4:0 }}>  {ktv.name}</div>}
        {timerInfo && (
          <div style={{ fontSize:11, color:timerInfo.urgent?"#dc2626":"#d97706", fontWeight:700 }}>
            ⏱ {timerInfo.label}: {timerInfo.timeStr}
          </div>
        )}
      </div>
    );
  }

  // ── Tasks list ───────────────────────────────────────────
  function TaskList() {
    const list = user.role==="technician" ? filtered : filtered;
    const filterLabel = dashboardFilter==="active"?"Đang xử lý":dashboardFilter==="done"?"Hoàn thành":dashboardFilter==="needs_reassign"?"Cần xử lý":null;
    return (
      <div style={{ padding:"0 16px 80px" }}>
        {filterLabel && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, padding:"2px 0" }}>
            <div style={{ background:"#eef2ff", border:"1.5px solid #c7d2fe", borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:700, color:"#4f46e5", display:"flex", alignItems:"center", gap:6 }}>
              <span className="material-icons" style={{fontSize:14,fontFamily:"Material Icons",verticalAlign:"middle"}}>filter_list</span>
              Lọc: {filterLabel} · {list.length} đơn
            </div>
            <button onClick={()=>setDashboardFilter(null)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:12, fontWeight:700, padding:"4px 8px", borderRadius:8 }}>✕ Bỏ lọc</button>
          </div>
        )}
        {pendingAccepts.length > 0 && user.role==="technician" && (
          <div style={{ background:"#fef3c7", borderRadius:14, padding:14, marginBottom:12, border:"2px solid #fcd34d" }}>
            <div style={{ fontWeight:800, color:"#d97706" }}>⏰ Có {pendingAccepts.length} đơn cần xác nhận!</div>
            <div style={{ fontSize:12, color:"#92400e", marginTop:4 }}>Nhớ cập nhật trạng thái để tránh bị trừ KPI nhé!</div>
          </div>
        )}
        {list.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>Không có đơn nào</div>}
        {list.map(o => {
          const ktv = users.find(u=>u.id===o.assigned_to);
          const timerInfo = getKpiTimerInfo(o);
          const isChuaNhan   = ["Chờ KTV","Chờ KTV Sửa"].includes(o.status);
          const noKTV        = !o.assigned_to;
          // Màu nền theo trạng thái
          const STATUS_CARD = {
            
            
            "Chờ Báo Giá":  { bg:"#fffbeb", border:"#fcd34d", badge_bg:"#fef3c7", badge_color:"#d97706" },
            "Chờ Xác Nhận": { bg:"#fdf2f8", border:"#fbcfe8", badge_bg:"#fce7f3", badge_color:"#db2777" },
            "Chờ KTV":      { bg:"#fff1f2", border:"#fca5a5", badge_bg:"#fee2e2", badge_color:"#dc2626" },
            "Chờ Phụ Tùng":{ bg:"#fff7ed", border:"#fed7aa", badge_bg:"#ffedd5", badge_color:"#c2410c" },
            "Đang Sửa":   { bg:"#f5f3ff", border:"#c4b5fd", badge_bg:"#ede9fe", badge_color:"#6d28d9" },
            "Chờ Kiểm Tra":{ bg:"#ecfeff", border:"#a5f3fc", badge_bg:"#cffafe", badge_color:"#0e7490" },
            "Hoàn Thành": { bg:"#f0fdf4", border:"#86efac", badge_bg:"#dcfce7", badge_color:"#15803d" },
            "Đã Giao":    { bg:"#f1f5f9", border:"#cbd5e1", badge_bg:"#e2e8f0", badge_color:"#475569" },
            "Hủy":        { bg:"#fafafa", border:"#e5e7eb", badge_bg:"#f3f4f6", badge_color:"#6b7280" },
          };
          const sc = STATUS_CARD[o.status] || { bg:"#f9fafb", border:"#e5e7eb", badge_bg:"#f3f4f6", badge_color:"#374151" };
          // Override nếu có urgent
          const urgentBg     = o.needs_reassign || o.kpi_stage2_penalized ? "#fff5f5"
                             : noKTV ? "#fffbeb" : sc.bg;
          const urgentBorder = o.needs_reassign || o.kpi_stage2_penalized ? "#ef4444"
                             : noKTV ? "#f59e0b" : sc.border;
          return (
            <div key={o.id} onClick={() => setSelectedOrderSync(o)}
              style={{
                background: urgentBg,
                borderRadius:14, padding:14, marginBottom:10, cursor:"pointer",
                boxShadow:"0 2px 8px rgba(0,0,0,.08)",
                border:`2px solid ${urgentBorder}`,
                animation: (isChuaNhan || noKTV) && !o.needs_reassign ? "pulseRed 1.6s ease-in-out infinite" : "none",
                transition: "none"
              }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontWeight:800, color:"#1e1b4b" }}>{o.id}</div>
                <div style={{ fontSize:12, padding:"3px 10px", borderRadius:99, background:sc.badge_bg, color:sc.badge_color, fontWeight:700 }}>{o.status}</div>
              </div>
              <div style={{ fontSize:13, color:"#374151", marginBottom:2 }}>  {o.customer_name} ·   {o.device_model}</div>
              {!noKTV && ktv && <div style={{ fontSize:12, color:"#6b7280"}}>  {ktv.name}</div>}
              {/* Giá tiền */}
              {(o.estimated_cost > 0 || o.final_cost > 0) && (
                <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap" }}>
                  {o.estimated_cost > 0 && (
                    <span style={{ fontSize:11, background:"#fef3c7", color:"#92400e", padding:"2px 7px", borderRadius:20, fontWeight:700 }}>
                      💰 {Number(o.estimated_cost).toLocaleString("vi-VN")}đ
                    </span>
                  )}
                  {o.deposit > 0 && (
                    <span style={{ fontSize:11, background:"#dcfce7", color:"#166534", padding:"2px 7px", borderRadius:20, fontWeight:700 }}>
                      🪙 cọc {Number(o.deposit).toLocaleString("vi-VN")}đ
                    </span>
                  )}
                </div>
              )}
              {timerInfo && <div style={{ fontSize:12, color:timerInfo.urgent?"#dc2626":"#d97706", fontWeight:700, marginTop:4 }}>⏱ {timerInfo.label}: {timerInfo.timeStr}</div>}
              {noKTV && <div style={{ fontSize:12, color:"#d97706", fontWeight:700, marginTop:4 }}>👤 Chưa phân công KTV</div>}
              {!noKTV && o.needs_reassign && <div style={{ fontSize:12, color:"#ef4444", fontWeight:700, marginTop:4 }}>⚠️ Cần chuyển KTV khác!</div>}
              {!noKTV && !o.needs_reassign && o.kpi_stage2_penalized && <div style={{ fontSize:12, color:"#ef4444", fontWeight:700, marginTop:4 }}>⏰ Quá 120p chưa sửa!</div>}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Customer List ─────────────────────────────────────────
  function CustomerList() {
    const [custs, setCusts]           = useState([]);
    const [search, setSearch]         = useState("");
    const [loading, setLoading]       = useState(true);
    const [detail, setDetail]         = useState(null);
    const [custOrders, setCustOrders] = useState([]);

    useEffect(() => {
      Customer.list({ limit:500, sort:"-id" })
        .then(d => setCusts(d||[]))
        .catch(()=>{})
        .finally(()=>setLoading(false));
    }, []);

    async function openDetail(c) {
      setDetail(c);
      try {
        const ords = await RepairOrder.filter({ customer_phone: c.phone });
        setCustOrders((ords||[]).sort((a,b)=>new Date(b.created_date||b.created)-new Date(a.created_date||a.created)));
      } catch { setCustOrders([]); }
    }

    const filtered = custs.filter(c =>
      !search ||
      (c.full_name||"").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone||"").includes(search)
    );

    if (detail) return (
      <div style={{ padding:"0 16px 80px" }}>
        <button onClick={()=>setDetail(null)}
          style={{ background:"none", border:"none", color:"#4f46e5", fontSize:14, cursor:"pointer", padding:"8px 0" }}>
          ← Quay lại
        </button>
        <div style={{ background:"#fff", borderRadius:14, padding:16, marginBottom:12, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
          <div style={{ fontWeight:800, fontSize:17 }}>{detail.full_name}</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>📱 {detail.phone}</div>
          {detail.address && <div style={{ fontSize:13, color:"#6b7280" }}>📍 {detail.address}</div>}
          {detail.note && <div style={{ fontSize:13, color:"#9ca3af", marginTop:4 }}>💬 {detail.note}</div>}
          <div style={{ display:"flex", gap:16, marginTop:12 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#4f46e5" }}>{detail.total_orders||custOrders.length}</div>
              <div style={{ fontSize:11, color:"#6b7280" }}>Đơn</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#059669" }}>{Number(detail.total_spent||0).toLocaleString("vi-VN")}đ</div>
              <div style={{ fontSize:11, color:"#6b7280" }}>Tổng chi</div>
            </div>
          </div>
        </div>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>Lịch sử sửa chữa ({custOrders.length})</div>
        {custOrders.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:20 }}>Chưa có đơn nào</div>}
        {custOrders.map(o => (
          <div key={o.id} style={{ background:"#fff", borderRadius:12, padding:12, marginBottom:8, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontWeight:700, fontSize:13 }}>{o.order_code||o.id}</div>
              <div style={{ fontSize:11, background:"#eef2ff", color:"#4f46e5", borderRadius:6, padding:"2px 8px" }}>{o.status}</div>
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>{o.device_model||o.device_name} · {o.issue_description?.slice(0,40)}</div>
            <div style={{ fontSize:12, color:"#059669", marginTop:4, fontWeight:700 }}>
              {o.final_cost>0 ? Number(o.final_cost).toLocaleString("vi-VN")+"đ"
                : o.estimated_cost>0 ? "~"+Number(o.estimated_cost).toLocaleString("vi-VN")+"đ"
                : "Chưa báo giá"}
            </div>
            <div style={{ fontSize:11, color:"#9ca3af" }}>{new Date(o.created_date||o.created).toLocaleDateString("vi-VN")}</div>
          </div>
        ))}
      </div>
    );

    return (
      <div style={{ padding:"0 16px 80px" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Tìm theo tên hoặc SĐT..."
          style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"10px 14px",
                   fontSize:14, marginBottom:12, boxSizing:"border-box" }} />
        {loading && <div style={{ textAlign:"center", color:"#9ca3af", padding:20 }}>Đang tải...</div>}
        {!loading && filtered.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>Không tìm thấy</div>}
        {filtered.map(c => (
          <div key={c.id} onClick={()=>openDetail(c)}
            style={{ background:"#fff", borderRadius:14, padding:14, marginBottom:8,
                     boxShadow:"0 1px 4px rgba(0,0,0,.06)", cursor:"pointer" }}>
            <div style={{ fontWeight:800, fontSize:15 }}>{c.full_name}</div>
            <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>📱 {c.phone} · {c.total_orders||0} đơn</div>
            {c.address && <div style={{ fontSize:12, color:"#9ca3af" }}>📍 {c.address}</div>}
          </div>
        ))}
      </div>
    );
  }
  // ── Dashboard ─────────────────────────────────────────────
  function Dashboard() {
    const stats = {
      total: orders.length,
      active: orders.filter(o=>!["Hoàn Thành","Đã Giao","Hủy"].includes(o.status)).length,
      done: orders.filter(o=>o.status==="Hoàn Thành"||o.status==="Đã Giao").length,
      needsReassign: orders.filter(o=>o.needs_reassign).length,
    };

    // Xác định filter khi bấm card -> setFilter rồi chuyển sang orders list
    const cards = [
      {
        label:"Tổng đơn", value:stats.total,
        icon:"assignment", bg:"#eef2ff", border:"#c7d2fe", color:"#4f46e5",
        urgent: false,
        onClick: () => { setDashboardFilter(null); setPage("tasks"); },
      },
      {
        label:"Đang xử lý", value:stats.active,
        icon:"settings", bg:"#fffbeb", border:"#fcd34d", color:"#d97706",
        urgent: stats.active > 0,
        onClick: () => { setDashboardFilter("active"); setPage("tasks"); },
      },
      {
        label:"Hoàn thành", value:stats.done,
        icon:"check_circle", bg:"#f0fdf4", border:"#86efac", color:"#059669",
        urgent: false,
        onClick: () => { setDashboardFilter("done"); setPage("tasks"); },
      },
      {
        label:"Cần xử lý", value:stats.needsReassign,
        icon:"notifications_active", bg:"#fef2f2", border:"#fca5a5", color:"#dc2626",
        urgent: stats.needsReassign > 0,
        onClick: () => { setDashboardFilter("needs_reassign"); setPage("tasks"); },
      },
    ];

    return (
      <div style={{ padding:"16px 14px 100px" }}>
        {/* Header giống WarehouseHome */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:"#1e1b4b" }}>👑 Xin chào, {user.name}!</div>
            <div style={{ fontSize:14, color:"#6b7280", marginTop:4 }}>
              Quản lý · {new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}
            </div>
          </div>
        </div>

        {/* Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
          {cards.map((c,i) => (
            <div key={i} onClick={c.onClick}
              style={{
                background:c.bg, borderRadius:16, padding:"16px 14px",
                border:`2px solid ${c.urgent ? c.border : "#e5e7eb"}`,
                cursor:"pointer",
                boxShadow: c.urgent ? "0 4px 12px rgba(0,0,0,.08)" : "none",
              }}>
              <span className="material-icons" style={{ fontSize:28, color:c.color, display:"block", marginBottom:8 }}>{c.icon}</span>
              <div style={{ fontSize:32, fontWeight:900, color: c.urgent ? c.color : "#1e1b4b", lineHeight:1 }}>{c.value}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:6, fontWeight:600 }}>{c.label}</div>
            </div>
          ))}
        </div>


      </div>
    );
  }

  return (
    <>
    {/* ── PC SIDEBAR LAYOUT ── */}
    {isPC && (
      <div style={{ display:"flex", height:"100vh", background:"#f9fafb" }}>
        {/* Left Sidebar */}
        <div style={{ width:240, background:"#1e1b4b", display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"20px 16px 16px", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
            <div style={{ fontWeight:900, fontSize:16, color:"#fff" }}>🏠 HK One Touch</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.6)", marginTop:4 }}>
              {user?.name} · {user?.role}
            </div>
          </div>
          <nav style={{ flex:1, padding:"12px 8px", display:"flex", flexDirection:"column", gap:2 }}>
            {/* 8 Accordion Manager */}
            {isManager && renderManagerSidebar()}
            {!isManager && (() => {
              const shownDividers = new Set();
              return navItems.map((item, idx) => {
              const dividerLabel = (() => {
                const groups = {
                  "new":               "Dịch vụ Sửa chữa",
                  "board":             "Dịch vụ Sửa chữa",
                  "tasks":             "Dịch vụ Sửa chữa",
                  "cashier_home":      "🛒 Bán hàng",
                  "return_order":      "🛒 Bán hàng",
                  "price_policy":      "🛒 Bán hàng",
                  "wh_manager":        "Kho & Vật tư",
                  "stock_count":       "Kho & Vật tư",
                  "purchase_forecast": "Kho & Vật tư",
                  "rma":               "Kho & Vật tư",
                  "customers":         "👥 Đối tác",
                  "suppliers":         "👥 Đối tác",
                  "cash_journal":      "💰 Kế toán",
                  "debts":             "💰 Kế toán",
                };
                const label = groups[item.key];
                if (label && !shownDividers.has(label)) {
                  shownDividers.add(label);
                  return label;
                }
                return null;
              })();
              const active = page === item.key;
              return (
                <React.Fragment key={item.key}>
                  {dividerLabel && (
                    <div style={{
                      fontSize:10, fontWeight:700, color:"rgba(255,255,255,.35)",
                      padding:"12px 14px 4px", letterSpacing:"0.1em",
                      textTransform:"uppercase", userSelect:"none",
                    }}>
                      {dividerLabel}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setPage(item.key);
                      if(["board","tasks","ktv_home","rec_home"].includes(item.key)) setDashboardFilter(null);
                    }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                      borderRadius:10, border:"none", textAlign:"left", cursor:"pointer",
                      background: active ? "rgba(255,255,255,.15)" : "transparent",
                      color: active ? "#fff" : "rgba(255,255,255,.7)",
                      fontWeight: active ? 700 : 400, fontSize:14 }}>
                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,lineHeight:1}}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                </React.Fragment>
              );
            });
            })()}
          </nav>
          <button onClick={doLogout}
            style={{ margin:"12px 8px", padding:"10px 14px", borderRadius:10, border:"none",
              background:"rgba(239,68,68,.2)", color:"#fca5a5", cursor:"pointer",
              display:"flex", alignItems:"center", gap:10, fontSize:14, fontWeight:700 }}>
            <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,lineHeight:1}}>logout</span>
            Đăng xuất
          </button>
        </div>
        {/* Main Content PC */}
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
          <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"12px 24px",
            display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div style={{ fontWeight:700, fontSize:16, color:"#1e1b4b" }}>
              {navItems.find(n=>n.key===page)?.label || "HK One Touch"}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ position:"relative" }}>
                <button onClick={() => setShowNotif(v=>!v)} style={{ background:"none", border:"none", color:"#374151", fontSize:22, cursor:"pointer", padding:4 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1}}>notifications</span>
                  {(notifications.length+dbNotifications.length)>0 && <span style={{ position:"absolute", top:-2, right:-2, background:"#ef4444", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{notifications.length+dbNotifications.length}</span>}
                </button>
              </div>
              <button onClick={() => setShowQRScan(true)} style={{ background:"none", border:"none", color:"#374151", fontSize:22, cursor:"pointer", padding:4 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1}}>qr_code_scanner</span>
              </button>
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
              {page==="ktv_home" && <TechnicianHome user={user} orders={orders} setPage={setPage} />}
              {page==="rec_home" && <ReceptionHome user={user} orders={orders} setPage={setPage} />}
              {page==="board" && <KanbanBoard />}
              {page==="tasks" && <TaskList />}
              {page==="new" && <div style={{padding:24}}><button onClick={() => setShowNewOrder(true)} style={{ width:"100%", height:52, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:14, fontWeight:800, fontSize:16, cursor:"pointer" }}>+ Tạo Đơn Mới</button></div>}
              {page==="customers" && <Suspense fallback={<div style={{padding:32,textAlign:"center"}}>⏳</div>}><CustomerManagerPage /></Suspense>}
              {page==="dashboard" && (["manager","admin","owner","supervisor"].includes(user.role) ? <Suspense fallback={<div style={{padding:32}}>⏳</div>}><ManagerDashboard user={user} initialTab={dashboardTab} /></Suspense> : <Dashboard />)}
              {page==="staff" && <StaffManagerPage currentStaff={user} />}
              {page==="settings" && <Suspense fallback={<div style={{padding:40}}>⏳</div>}><SettingsHub user={user} /></Suspense>}
              {page==="wh_home" && <WarehouseHome user={user} setPage={setPage} />}
              {page==="wh_orders" && <WarehouseOrders user={user} users={users} setSelectedOrder={setSelectedOrderSync} />}
              {page==="wh_export" && <WarehouseExport user={user} />}
              {page==="wh_import" && <WarehouseImport user={user} />}
              {page==="wh_manager" && <WarehouseManager user={user} onBack={()=>setPage(isWarehouse?"wh_home":isRoleHome?"role_home":"dashboard")} />}
              {page==="cashier_home" && <CashierApp user={user} />}
              {page==="suppliers" && user && <Suspense fallback={<div style={{padding:40}}>⏳</div>}><SupplierPage user={user} /></Suspense>}
              {page==="debts" && user && <Suspense fallback={<div style={{padding:40}}>⏳</div>}><DebtPage user={user} /></Suspense>}
              {page==="department" && <Suspense fallback={<div style={{padding:40}}>⏳</div>}><DepartmentPageLazy user={user} /></Suspense>}
              {page==="role_perm" && <Suspense fallback={<div style={{padding:40}}>⏳</div>}><RolePermissionPageLazy /></Suspense>}
              {page==="print_template" && user && <PrintTemplatePage user={user} />}
              {/* Sales, Kho, Tài chính */}
              {renderSalesPages(page, user)}
              {/* Thiết lập (Integrations, ActionLog) */}
              {renderSetupPages(page, user)}
              {/* Mua hàng NCC */}
              {renderPurchaseNccPages(page, user)}
              {/* Báo cáo */}
              {renderReportPages(page, user)}
              {page==="role_home" && <Suspense fallback={<div style={{padding:40}}>⏳</div>}><RoleHomePlaceholder user={user} setPage={setPage} orders={orders} /></Suspense>}
            </Suspense>
          </div>
        </div>
      </div>
    )}
    {!isPC && (
    <div style={{ minHeight:"100vh", width:"100%", maxWidth:"100vw", background:"#f8fafc", fontFamily:"system-ui,-apple-system,sans-serif", overflowX:"hidden" }}>
      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:"#1e1b4b", padding: bp==="tablet"?"14px 20px 12px":"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setSidebarOpen(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>menu</span></button>
        <div style={{ flex:1, fontWeight:800, fontSize:16, color:"#fff"}}>HK One Touch</div>
        <div style={{ position:"relative" }}>
          <button onClick={() => setShowNotif(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>notifications</span>
            {(notifications.length+dbNotifications.length)>0 && <span style={{ position:"absolute", top:-2, right:-2, background:"#ef4444", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{notifications.length+dbNotifications.length}</span>}
          </button>
        </div>
        <button onClick={() => setShowQRScan(true)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer", padding:4 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>qr_code_scanner</span></button>

      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:200 }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.4)" }} onClick={() => setSidebarOpen(false)} />
          <div onClick={e => e.stopPropagation()} style={{ position:"absolute", left:0, top:0, bottom:0, width: bp==="tablet" ? 260 : 240, background:"#1e1b4b", boxShadow:"4px 0 20px rgba(0,0,0,.15)", display:"flex", flexDirection:"column" }}>
            <div style={{ background:"#1e1b4b", padding:24, color:"#fff" }}>
              <div style={{ fontSize:40 }}>{user.avatar_url ? <img src={user.avatar_url} style={{width:48,height:48,borderRadius:"50%"}} alt="" /> : <span className="material-icons" style={{fontSize:48,fontFamily:"Material Icons",color:"#9ca3af"}}>person</span>}</div>
              <div style={{ fontWeight:800, fontSize:16, marginTop:8, color:"#fff" }}>{user.name}</div>
              <div style={{ fontSize:12, color:"#c7d2fe", marginTop:2 }}>{user.role}{(user.role==="technician"||user.role==="manager")?" · KPI: "+user.kpi:""}</div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:8, background:"#1e1b4b" }}>
              {/* Accordion Tổng quan — chỉ với isManager */}
              {isManager && renderManagerSidebar()}
              {!isManager && (() => {
                const shownDividers = new Set();
                return navItems.map((n, idx) => {
                const dividerLabel = (() => {
                  const groups = {
                    "new":               "Dịch vụ Sửa chữa",
                    "board":             "Dịch vụ Sửa chữa",
                    "tasks":             "Dịch vụ Sửa chữa",
                    "cashier_home":      "🛒 Bán hàng",
                    "return_order":      "🛒 Bán hàng",
                    "price_policy":      "🛒 Bán hàng",
                    "wh_manager":        "Kho & Vật tư",
                    "stock_count":       "Kho & Vật tư",
                    "purchase_forecast": "Kho & Vật tư",
                    "rma":               "Kho & Vật tư",
                    "customers":         "👥 Đối tác",
                    "suppliers":         "👥 Đối tác",
                    "cash_journal":      "💰 Kế toán",
                    "debts":             "💰 Kế toán",
                  };
                  const label = groups[n.key];
                  if (label && !shownDividers.has(label)) {
                    shownDividers.add(label);
                    return label;
                  }
                  return null;
                })();
                const active = page === n.key;
                return (
                  <React.Fragment key={n.key}>
                    {dividerLabel && (
                      <div style={{
                        fontSize:10, fontWeight:700, color:"#9ca3af",
                        padding:"12px 16px 4px", letterSpacing:"0.1em",
                        textTransform:"uppercase", userSelect:"none",
                      }}>
                        {dividerLabel}
                      </div>
                    )}
                    <button onClick={() => {
                        setPage(n.key); setSidebarOpen(false);
                        if(["board","tasks","ktv_home","rec_home"].includes(n.key)) setDashboardFilter(null);
                      }}
                      style={{ width:"100%", textAlign:"left", padding:"14px 16px", borderRadius:12, border:"none",
                        background: active ? "#eef2ff" : "transparent",
                        color:      active ? "#4f46e5" : "#374151",
                        fontWeight: active ? 800 : 500,
                        fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
                      <span className="material-icons" style={{fontSize:20,fontFamily:"Material Icons",verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>{n.icon}</span>
                      {n.label}
                    </button>
                  </React.Fragment>
                );
              });
              })()}
            </div>
            <div style={{ padding:16, borderTop:"1px solid rgba(255,255,255,.15)", display:"flex", flexDirection:"column", gap:8 }}>
              <button onClick={doLogout} style={{ width:"100%", padding:14, background:"rgba(239,68,68,.2)", border:"none", borderRadius:12, color:"#fca5a5", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>logout</span> Đăng xuất</button>
              <button onClick={doLogout} style={{ width:"100%", padding:12, background:"rgba(255,255,255,.1)", border:"none", borderRadius:12, color:"rgba(255,255,255,.7)", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>power_settings_new</span> Thoát</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification panel */}
      {showNotif && (
        <div style={{ position:"fixed", inset:0, zIndex:300 }}>
          <div style={{ position:"absolute", inset:0 }} onClick={() => setShowNotif(false)} />
          <div style={{ position:"absolute", top:60, right:8, width:320, background:"#fff", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,.2)", overflow:"hidden" }}>
            <div style={{ padding:"14px 16px", fontWeight:800, borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1}}>notifications</span> Thông báo</span>
              {(notifications.length+dbNotifications.length)>0 && (
                <button onClick={() => {
                  setNotifications([]);
                  dbNotifications.forEach(n => Notification.update(n.id, { is_read: true }).catch(()=>{}));
                  setDbNotifications([]);
                  setShowNotif(false);
                }} style={{ fontSize:11, background:"#f3f4f6", border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#6b7280", fontWeight:600 }}>Đọc tất cả</button>
              )}
            </div>
            <div style={{ maxHeight:400, overflowY:"auto" }}>
              {notifications.length===0 && dbNotifications.length===0 && (
                <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>Không có thông báo mới</div>
              )}
              {/* Merge local + DB notifications, sort mới nhất lên trên */}
              {[
                ...notifications.map(n => ({ _type:"local", _time: new Date(n.time||0).getTime(), ...n })),
                ...dbNotifications.map(n => ({ _type:"db",    _time: new Date(n.created_date||n.updated_date||0).getTime(), ...n })),
              ].sort((a,b) => b._time - a._time).map(n => n._type === "local" ? (
                <div key={"loc_"+n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f9fafb", fontSize:13, display:"flex", gap:10, alignItems:"flex-start", background:"#fffbeb" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:"#d97706",marginTop:1,flexShrink:0}}>info</span>
                  <div style={{ flex:1 }}>
                    <div>{n.msg}</div>
                    <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.time)}</div>
                  </div>
                  <button onClick={() => setNotifications(p => p.filter(x=>x.id!==n.id))}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:2, flexShrink:0 }}>
                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16}}>close</span>
                  </button>
                </div>
              ) : (
                <SwipeableNotif key={"db_"+n.id} notif={n}
                  onDelete={() => {
                    Notification.update(n.id, { is_read: true }).catch(()=>{});
                    setDbNotifications(p => p.filter(x=>x.id!==n.id));
                  }}
                  onClick={async () => {
                    Notification.update(n.id, { is_read: true }).catch(()=>{});
                    setDbNotifications(p => p.filter(x=>x.id!==n.id));
                    setShowNotif(false);
                    const targetId   = n.order_id;
                    const targetCode = n.order_code;
                    if (targetId || targetCode) {
                      try {
                        let mapped = null;
                        if (targetId)   mapped = orders.find(o => o._id === targetId);
                        if (!mapped && targetCode) mapped = orders.find(o => o.id === targetCode || o.qr_code === targetCode);
                        if (!mapped && targetId) {
                          const raw = await RepairOrder.get(targetId);
                          if (raw) mapped = mapPbOrder(raw, STATUS_DISPLAY, PRIORITY_DISPLAY);
                        }
                        if (mapped) {
                          // Xác định tab cần mở theo loại thông báo
                          const NOTIF_TAB_MAP = {
                            "mention":        "chat",
                            "chat":           "chat",
                            "export_ready":   "exports",
                            "export_deadline":"exports",
                            "export_overdue": "exports",
                            "assign":         "info",
                            "new_order":      "info",
                            "kpi_reminder":   "info",
                            "kpi_penalty":    "info",
                            "needs_reassign": "info",
                            "status_change":  "info",
                          };
                          const openTab = NOTIF_TAB_MAP[n.type] || (["mention","chat"].includes(n.type) ? "chat" : "info");
                          if (user?.role === "technician") setPage("tasks");
                          else setPage("board");
                          setTimeout(() => {
                            setSelectedOrderSync({ ...mapped, _openTab: openTab });
                          }, 150);
                        }
                      } catch {}
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + Tạo đơn bar (chỉ hiện ở board/tasks) */}
      {(page==="board"||page==="tasks") && (
        <div style={{ padding:"10px 16px 6px", display:"flex", gap:8, alignItems:"center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm..."
            style={{ flex:1, height:38, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none" }} />
          {user.role!=="technician" && (
            <button onClick={() => setShowNewOrder(true)}
              style={{ height:38, padding:"0 16px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer", flexShrink:0 }}>
                Tạo
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
        <div style={{ paddingBottom:72 }}>
        {page==="ktv_home" && <TechnicianHome user={user} orders={orders} setPage={setPage} />}
        {page==="rec_home" && <ReceptionHome user={user} orders={orders} setPage={setPage} />}
        {page==="board" && <KanbanBoard />}
        {page==="tasks" && <TaskList />}
        {page==="new" && (
          <div style={{ padding:"0 0 80px" }}>
            {/* Nút tạo đơn sticky top */}
            <div style={{ padding:"12px 16px 8px", position:"sticky", top:0, zIndex:10, background:"#f8fafc", borderBottom:"1px solid #e5e7eb" }}>
              <button onClick={() => setShowNewOrder(true)}
                style={{ width:"100%", height:52, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:14, fontWeight:800, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 14px rgba(79,70,229,.35)" }}>
                <span className="material-icons" style={{fontSize:22}}>add_circle</span>
                Tạo Đơn Mới
              </button>
            </div>
            {/* Danh sách đơn gần đây — tiếp tân tra cứu nhanh */}
            <div style={{ padding:"10px 16px 0" }}>
              <div style={{ fontWeight:800, fontSize:13, color:"#6b7280", marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>
                Đơn gần đây
              </div>
              {filtered.filter(o => !["Đã Giao"].includes(o.status)).slice(0,30).map(o => {
                const col2 = STATUS_COLS.find(s => s.key === o.status);
                return (
                  <div key={o.id} onClick={() => setSelectedOrderSync(o)}
                    style={{
                      background: ["Chờ KTV","Chờ KTV Sửa"].includes(o.status) ? "#fff5f5" : "#fff",
                      borderRadius:14, padding:"12px 14px", marginBottom:8, cursor:"pointer",
                      boxShadow:"0 1px 4px rgba(0,0,0,.07)",
                      border: ["Chờ KTV","Chờ KTV Sửa"].includes(o.status) ? "2px solid #ef4444" : "1.5px solid #f3f4f6",
                      animation: ["Chờ KTV","Chờ KTV Sửa"].includes(o.status) ? "pulseRed 1.6s ease-in-out infinite" : "none",
                      display:"flex", justifyContent:"space-between", alignItems:"center"
                    }}>
                    <div>
                      <div style={{ fontWeight:800, color:"#1e1b4b", fontSize:14 }}>{o.order_code || o.id}</div>
                      <div style={{ fontSize:12, color:"#374151", marginTop:2 }}>{o.customer_name} · {o.device_model}</div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{o.customer_phone}</div>
                    </div>
                    <span style={{ background:col2?.bg||"#f3f4f6", color:col2?.color||"#374151", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20, whiteSpace:"nowrap", flexShrink:0 }}>
                      {col2?.icon} {o.status}
                    </span>
                  </div>
                );
              })}
              {filtered.filter(o => !["Đã Giao"].includes(o.status)).length === 0 && (
                <div style={{ textAlign:"center", color:"#9ca3af", padding:40, fontSize:14 }}>Chưa có đơn nào</div>
              )}
            </div>
          </div>
        )}
        
        {page==="customers" && (
          <Suspense fallback={<div style={{padding:32,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}>
            <CustomerManagerPage />
          </Suspense>
        )}
        {page==="dashboard" && (
          user.role==="manager" || user.role==="admin"
            ? <Suspense fallback={<div style={{padding:32,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>}><ManagerDashboard user={user} initialTab={dashboardTab} /></Suspense>
            : <Dashboard />
        )}
        {page==="staff"      && <StaffManagerPage currentStaff={user} />}
        {page==="settings"   && <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}><SettingsHub user={user} /></Suspense>}
        {page==="role_home"  && <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}><RoleHomePlaceholder user={user} setPage={setPage} orders={orders} /></Suspense>}
        {page==="wh_home"   && <WarehouseHome   user={user} setPage={setPage} />}
        {page==="wh_orders" && <WarehouseOrders user={user} users={users} setSelectedOrder={setSelectedOrderSync} />}
        {page==="wh_export" && <WarehouseExport user={user} />}
        {page==="wh_import" && <WarehouseImport user={user} />}
        {page==="wh_manager" && <WarehouseManager user={user} onBack={()=>setPage(isWarehouse?"wh_home":isRoleHome?"role_home":"dashboard")} />}
        {page==="cashier_home" && <CashierApp user={user} />}
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
              {page==="print_template" && user && <PrintTemplatePage user={user} />}
        {page==="stock_nxt" && (
          <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}>
            <StockReportNXT user={user} />
          </Suspense>
        )}
        {page==="revenue" && (
          <Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳</div>}>
            <RevenueReportPage user={user} />
          </Suspense>
        )}
        {/* Sales, Kho, Tài chính, Báo cáo, Mua hàng NCC */}
        {renderSalesPages(page, user)}
        {renderPurchaseNccPages(page, user)}
        {renderReportPages(page, user)}
        </div>
      </Suspense>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1px solid #e5e7eb", display:"flex", zIndex:50, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {navItems.slice(0,5).map(n => (
          <button key={n.key} onClick={() => { setPage(n.key); if(n.key==="board"||n.key==="dashboard"||n.key==="tasks"||n.key==="ktv_home"||n.key==="rec_home")setDashboardFilter(null); }}
            style={{ flex:1, padding:"10px 4px", background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span className="material-icons" style={{fontSize:22,fontFamily:"Material Icons",lineHeight:1}}>{n.icon}</span>
            <span style={{ fontSize: bp==="tablet"?11:10, color:page===n.key?"#4f46e5":"#9ca3af", fontWeight:page===n.key?800:500 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {/* Modals */}
      {showNewOrder && <NewOrderModal onClose={() => { setShowNewOrder(false); setNewOrderProductQR(""); }} onCreate={createOrder} users={users} orders={orders} initialProductQR={newOrderProductQR} />}

      {/* Modal: Hàng trong kho - Chưa bán */}
      {warehouseStockModal && (
        <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:380, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ background:"linear-gradient(135deg,#0369a1,#0284c7)", padding:"20px 20px 16px", textAlign:"center" }}>
              <span className="material-icons" style={{fontSize:48,color:"#fff",display:"block",marginBottom:8}}>inventory_2</span>
              <div style={{ color:"#fff", fontWeight:900, fontSize:18 }}>Hàng trong kho</div>
              <div style={{ color:"#bae6fd", fontSize:13, marginTop:4 }}>Thiết bị này chưa được bán</div>
            </div>
            <div style={{ padding:"16px 20px 20px" }}>
              <div style={{ background:"#e0f2fe", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#0369a1", marginBottom:4 }}>{warehouseStockModal.name}</div>
                {warehouseStockModal.sku && <div style={{ fontSize:13, color:"#0369a1" }}>IMEI/Serial: {warehouseStockModal.sku}</div>}
                <div style={{ fontSize:13, color:"#0369a1", marginTop:4 }}>Tồn kho: {warehouseStockModal.stock_qty||0} cái</div>
                {warehouseStockModal.price>0 && <div style={{ fontSize:13, color:"#0369a1" }}>Giá: {(warehouseStockModal.price||0).toLocaleString("vi-VN")}đ</div>}
              </div>
              <div style={{ background:"#fef9c3", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#854d0e" }}>
                <span className="material-icons" style={{fontSize:16,verticalAlign:"middle",marginRight:4}}>info</span>
                Thiết bị này đang được lưu trong kho. Vui lòng liên hệ nhân viên kho nếu cần xuất máy.
              </div>
              <button onClick={()=>setWarehouseStockModal(null)}
                style={{ width:"100%", height:46, borderRadius:12, border:"none", background:"#0369a1", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrderSync(null)}
          onUpdate={(id, patch, kpiEvent, action) => { updateOrder(id, patch, kpiEvent, action); }}
          users={users}
          currentUser={user}
          onGoToPendingAccept={goToPendingAccept}
        />
      )}

      {showQRScan && <QRScanModal onClose={() => setShowQRScan(false)} onFound={handleGlobalQRScan} orders={orders} />}
      {productHistory && (
        <ProductHistoryModal
          qr={productHistory.qr}
          orders={productHistory.orders}
          onClose={() => setProductHistory(null)}
          onOpenOrder={o => { setProductHistory(null); setSelectedOrderSync(o); }}
        />
      )}

      {/* Created order toast */}
      {createdOrder && (
        <div style={{ position:"fixed", bottom:80, left:16, right:16, zIndex:400, background:"#059669", borderRadius:16, padding:"14px 18px", color:"#fff", boxShadow:"0 8px 24px rgba(0,0,0,.2)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <div style={{ fontWeight:800 }}>  Đã tạo đơn {createdOrder.id}</div>
            <div style={{ fontSize:12, opacity:.9, marginTop:2 }}>{createdOrder.customer_name} · {createdOrder.device_model}</div>
          </div>
          <button onClick={() => setCreatedOrder(null)}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontWeight:700, fontSize:13 }}>
            OK
          </button>
        </div>
      )}
    </div>
    )}
    </>
  );
}



// ═══════════════════════════════════════════════════════════
// WAREHOUSE COMPONENTS
// ═══════════════════════════════════════════════════════════


// ─── Warehouse: Chat đơn hàng ────────────────────────────
function MainAppInner() {
  const bp = useBreakpoint();
  const isPC = bp === "pc";
  const [user, setUser] = useState(null);
  return (
    <PermissionProvider user={user}>
      <MainAppContent onUserChange={setUser} />
    </PermissionProvider>
  );
}

// ─── Log thao tác ───────────────────────────────────────
async function logAction(user, action, target_type, target_id="", detail="") {
  try {
    await ActionLog.create({
      staff_id:   user?.id||"",
      staff_name: user?.name||user?.full_name||"",
      staff_role: user?.role||"",
      action,
      target_type,
      target_id,
      detail,
      logged_at: new Date().toISOString(),
    });
  } catch(e) { console.warn("logAction:", e.message); }
}


export default function MainApp() { return <ErrorBoundary><MainAppInner /></ErrorBoundary>; }
