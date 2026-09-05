/**
 * RoleHomePlaceholder.jsx
 * Trang home dùng chung cho 8 role mới (chưa có home riêng):
 * cashier, accountant, hr, marketing, qa, support, delivery, it, viewer, supervisor
 *
 * Props: user, setPage, orders, can()
 */
import { usePermission } from "./PermissionContext.jsx";

// ── Quick-action definitions per role ──────────────────────
const ROLE_ACTIONS = {
  cashier: [
    { icon:"point_of_sale",   label:"Bán hàng",        page:"cashier_home",  color:"#059669", bg:"#dcfce7" },
    { icon:"receipt_long",    label:"Đơn sửa chữa",    page:"tasks",         color:"#2563eb", bg:"#dbeafe" },
    { icon:"group",           label:"Khách hàng",       page:"customers",     color:"#7c3aed", bg:"#f5f3ff" },
    { icon:"bar_chart",       label:"Báo cáo",          page:"dashboard",     color:"#d97706", bg:"#fef3c7" },
  ],
  accountant: [
    { icon:"bar_chart",       label:"Báo cáo",          page:"dashboard",     color:"#2563eb", bg:"#dbeafe" },
    { icon:"receipt_long",    label:"Đơn sửa chữa",    page:"tasks",         color:"#059669", bg:"#dcfce7" },
    { icon:"point_of_sale",   label:"Bán hàng",         page:"cashier_home",  color:"#d97706", bg:"#fef3c7" },
    { icon:"warehouse",     label:"Quản lý kho",      page:"wh_manager",    color:"#0369a1", bg:"#e0f2fe" },
  ],
  hr: [
    { icon:"person",          label:"Nhân viên",        page:"staff",         color:"#7c3aed", bg:"#f5f3ff" },
    { icon:"emoji_events",    label:"KPI",               page:"kpi",           color:"#d97706", bg:"#fef3c7" },
    { icon:"bar_chart",       label:"Báo cáo",          page:"dashboard",     color:"#2563eb", bg:"#dbeafe" },
    { icon:"campaign",        label:"Thông báo",        page:"notifications", color:"#059669", bg:"#dcfce7" },
  ],
  marketing: [
    { icon:"campaign",        label:"Bài đăng",         page:"media",         color:"#db2777", bg:"#fce7f3" },
    { icon:"group",           label:"Khách hàng",       page:"customers",     color:"#7c3aed", bg:"#f5f3ff" },
    { icon:"bar_chart",       label:"Báo cáo DT",       page:"dashboard",     color:"#2563eb", bg:"#dbeafe" },
    { icon:"receipt_long",    label:"Đơn sửa chữa",    page:"tasks",         color:"#059669", bg:"#dcfce7" },
  ],
  qa: [
    { icon:"assignment",      label:"Bảng theo dõi",    page:"board",         color:"#059669", bg:"#dcfce7" },
    { icon:"check_circle",    label:"Danh sách đơn",    page:"tasks",         color:"#2563eb", bg:"#dbeafe" },
    { icon:"emoji_events",    label:"KPI",               page:"kpi",           color:"#d97706", bg:"#fef3c7" },
    { icon:"fact_check",    label:"Kiểm kho",         page:"stock_count",   color:"#0369a1", bg:"#e0f2fe" },
  ],
  support: [
    { icon:"assignment",      label:"Bảng theo dõi",    page:"board",         color:"#059669", bg:"#dcfce7" },
    { icon:"add_circle",      label:"Tạo đơn",          page:"new",           color:"#7c3aed", bg:"#f5f3ff" },
    { icon:"check_circle",    label:"Danh sách đơn",    page:"tasks",         color:"#2563eb", bg:"#dbeafe" },
    { icon:"group",           label:"Khách hàng",       page:"customers",     color:"#d97706", bg:"#fef3c7" },
  ],
  packer: [
    { icon:"inventory",       label:"Soạn hàng & Giao", page:"pack_ship",     color:"#4f46e5", bg:"#eef2ff" },
    { icon:"outbox",          label:"Phiếu xuất",       page:"wh_export",     color:"#d97706", bg:"#fef3c7" },
    { icon:"check_circle",    label:"Danh sách đơn",    page:"tasks",         color:"#059669", bg:"#dcfce7" },
  ],
  delivery: [
    { icon:"local_shipping",  label:"Soạn hàng & Giao", page:"pack_ship",     color:"#0369a1", bg:"#e0f2fe" },
    { icon:"check_circle",    label:"Danh sách đơn",    page:"tasks",         color:"#059669", bg:"#dcfce7" },
    { icon:"assignment",      label:"Bảng theo dõi",    page:"board",         color:"#2563eb", bg:"#dbeafe" },
    { icon:"group",           label:"Khách hàng",       page:"customers",     color:"#7c3aed", bg:"#f5f3ff" },
    { icon:"outbox",          label:"Phiếu xuất",       page:"wh_export",     color:"#d97706", bg:"#fef3c7" },
  ],
  it: [
    { icon:"settings",        label:"Cài đặt",          page:"settings",      color:"#374151", bg:"#f3f4f6" },
    { icon:"person",          label:"Nhân viên",        page:"staff",         color:"#7c3aed", bg:"#f5f3ff" },
    { icon:"warehouse",       label:"Quản lý kho",      page:"wh_manager",    color:"#0369a1", bg:"#e0f2fe" },
    { icon:"warehouse",     label:"Quản lý kho",      page:"wh_manager",    color:"#059669", bg:"#dcfce7" },
  ],
  supervisor: [
    { icon:"bar_chart",       label:"Tổng quan",        page:"dashboard",     color:"#2563eb", bg:"#dbeafe" },
    { icon:"assignment",      label:"Bảng theo dõi",    page:"board",         color:"#059669", bg:"#dcfce7" },
    { icon:"check_circle",    label:"Danh sách đơn",    page:"tasks",         color:"#7c3aed", bg:"#f5f3ff" },
    { icon:"emoji_events",    label:"KPI",               page:"kpi",           color:"#d97706", bg:"#fef3c7" },
  ],
  viewer: [
    { icon:"bar_chart",       label:"Báo cáo",          page:"dashboard",     color:"#2563eb", bg:"#dbeafe" },
    { icon:"check_circle",    label:"Danh sách đơn",    page:"tasks",         color:"#9ca3af", bg:"#f3f4f6" },
    { icon:"warehouse",     label:"Quản lý kho",      page:"wh_manager",    color:"#0369a1", bg:"#e0f2fe" },
    { icon:"emoji_events",    label:"KPI",               page:"kpi",           color:"#d97706", bg:"#fef3c7" },
  ],
};

const ROLE_LABEL = {
  cashier:"Thu ngân",accountant:"Kế toán",marketing:"Marketing",
  support:"Hỗ trợ KT",delivery:"Giao nhận",packer:"Soạn đóng hàng",
  it:"IT / Dev",supervisor:"Giám sát",viewer:"Chỉ xem",owner:"Chủ cơ sở",admin:"Quản trị viên",
};
const ROLE_ICON = {
  cashier:"💰",accountant:"📊",hr:"👥",marketing:"📣",
  qa:"✅",support:"🎧",delivery:"🚚",packer:"📦",it:"💻",supervisor:"🔭",viewer:"👁️",owner:"🏢",admin:"⚙️",
};
const GREETING_BY_HOUR = (h) =>
  h < 12 ? "Chào buổi sáng" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";

export default function RoleHomePlaceholder({ user, setPage, orders = [] }) {
  const { can } = usePermission();
  const role = user?.role || "viewer";
  const actions = ROLE_ACTIONS[role] || ROLE_ACTIONS.viewer;
  const hour = new Date().getHours();

  // Stats chung
  const active  = orders.filter(o => !["Đã Giao","Hủy"].includes(o.status)).length;
  const done    = orders.filter(o => o.status === "Đã Giao").length;
  const waiting = orders.filter(o => ["Chờ KTV","Chờ KTV Sửa"].includes(o.status)).length;

  const stats = [
    { label:"Đang xử lý",  value: active,  color:"#2563eb", bg:"#dbeafe", icon:"build_circle" },
    { label:"Chờ KTV",     value: waiting, color:"#dc2626", bg:"#fee2e2", icon:"schedule" },
    { label:"Hoàn thành",  value: done,    color:"#059669", bg:"#dcfce7", icon:"check_circle" },
  ];

  return (
    <div style={{ padding:"16px 16px 90px", maxWidth:600, margin:"0 auto" }}>
      {/* Greeting */}
      <div style={{ background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", borderRadius:20, padding:"20px 22px", marginBottom:20, color:"#fff" }}>
        <div style={{ fontSize:28, marginBottom:4 }}>{ROLE_ICON[role] || "👤"}</div>
        <div style={{ fontSize:18, fontWeight:900 }}>
          {GREETING_BY_HOUR(hour)}, {user?.name || user?.full_name || "bạn"}!
        </div>
        <div style={{ fontSize:13, opacity:.8, marginTop:3 }}>
          {ROLE_LABEL[role] || role} · HK One Touch
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
        {stats.map(s => (
          <div key={s.label}
            style={{ background:s.bg, borderRadius:14, padding:"14px 10px", textAlign:"center", border:`1.5px solid ${s.color}22` }}>
            <span className="material-icons" style={{ fontSize:22, color:s.color, display:"block", marginBottom:4 }}>{s.icon}</span>
            <div style={{ fontSize:22, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:4, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ fontWeight:800, fontSize:14, color:"#374151", marginBottom:12 }}>⚡ Thao tác nhanh</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {actions
          .filter(a => !a.resource || can(a.resource, a.action || "view"))
          .map(a => (
            <button key={a.page} onClick={() => setPage(a.page)}
              style={{
                background:a.bg, border:`1.5px solid ${a.color}33`,
                borderRadius:16, padding:"18px 16px",
                cursor:"pointer", textAlign:"left",
                display:"flex", flexDirection:"column", gap:8,
                transition:"transform .1s",
              }}
              onTouchStart={e => e.currentTarget.style.transform="scale(.97)"}
              onTouchEnd  ={e => e.currentTarget.style.transform="scale(1)"}
            >
              <span className="material-icons" style={{ fontSize:28, color:a.color }}>{a.icon}</span>
              <span style={{ fontSize:14, fontWeight:800, color:a.color }}>{a.label}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
