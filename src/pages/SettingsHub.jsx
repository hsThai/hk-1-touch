/**
 * SettingsHub.jsx
 * 3 tab: Vai trò & Phân quyền / Cài đặt / Tích hợp
 * Thay thế SettingsPage hiện tại (vẫn giữ SettingsPage làm sub-component)
 */
import { useState, lazy, Suspense } from "react";
import { usePermission } from "./PermissionContext.jsx";

// Lazy load heavy tabs
const RolePermissionPage = lazy(() => import("./RolePermissionPage.jsx"));
const SettingsPage       = lazy(() => import("./Settings.jsx"));
const DepartmentPage     = lazy(() => import("./DepartmentPage.jsx"));

// ── Tích hợp placeholder ────────────────────────────────────
function IntegrationsTab() {
  const items = [
    { icon:"📩", name:"Telegram Bot",  status:"active",   desc:"Gửi thông báo đơn hàng tự động", color:"#0369a1", bg:"#e0f2fe" },
    { icon:"📲", name:"Zalo OA",       status:"inactive", desc:"Kết nối Zalo Official Account",   color:"#9ca3af", bg:"#f3f4f6" },
    { icon:"📦", name:"KiotViet",       status:"removed",  desc:"Đã xoá — không còn sử dụng",    color:"#dc2626", bg:"#fee2e2" },
    { icon:"☁️",  name:"Google Drive",  status:"inactive", desc:"Backup dữ liệu tự động",         color:"#9ca3af", bg:"#f3f4f6" },
    { icon:"🖨️", name:"Máy in nhiệt",  status:"inactive", desc:"In phiếu sửa chữa",              color:"#9ca3af", bg:"#f3f4f6" },
  ];
  const STATUS = {
    active:   { label:"Đang kết nối", color:"#059669", bg:"#dcfce7" },
    inactive: { label:"Chưa kết nối", color:"#9ca3af", bg:"#f3f4f6" },
    removed:  { label:"Đã xoá",       color:"#dc2626", bg:"#fee2e2" },
  };
  return (
    <div style={{ padding:"16px 16px 80px" }}>
      <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:4 }}>🔌 Tích hợp</div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
        Quản lý các kết nối với dịch vụ bên ngoài
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {items.map(item => {
          const st = STATUS[item.status];
          return (
            <div key={item.name}
              style={{ background:"#fff", borderRadius:16, padding:16,
                boxShadow:"0 2px 12px rgba(0,0,0,.06)", border:"1.5px solid #f3f4f6",
                display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:item.bg,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                {item.icon}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{item.name}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{item.desc}</div>
              </div>
              <span style={{ background:st.bg, color:st.color,
                fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:20, flexShrink:0 }}>
                {st.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Telegram config hint */}
      <div style={{ marginTop:24, background:"#e0f2fe", borderRadius:16, padding:16, border:"1.5px solid #7dd3fc" }}>
        <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:6 }}>📩 Telegram Bot</div>
        <div style={{ fontSize:13, color:"#1e40af", lineHeight:1.6 }}>
          Bot token được lưu trong <code style={{background:"#bfdbfe",padding:"1px 6px",borderRadius:4}}>AppSettings</code>,
          key <code style={{background:"#bfdbfe",padding:"1px 6px",borderRadius:4}}>telegram_bot_token</code> và
          <code style={{background:"#bfdbfe",padding:"1px 6px",borderRadius:4,marginLeft:4}}>telegram_chat_id</code>.
        </div>
        <div style={{ fontSize:12, color:"#6b7280", marginTop:8 }}>
          Cấu hình trong tab Cài đặt → Thông báo Telegram.
        </div>
      </div>
    </div>
  );
}

// ── Tabs config ─────────────────────────────────────────────
const TABS = [
  {
    key:   "departments",
    label: "Phòng ban",
    icon:  "account_tree",
    adminOnly: true,
  },
  {
    key:   "roles",
    label: "Vai trò & Quyền",
    icon:  "admin_panel_settings",
    adminOnly: true,
  },
  {
    key:   "settings",
    label: "Cài đặt",
    icon:  "tune",
    adminOnly: false,
  },
  {
    key:   "integrations",
    label: "Tích hợp",
    icon:  "cable",
    adminOnly: true,
  },
];

export default function SettingsHub({ user }) {
  const { can } = usePermission();
  const isAdmin = ["owner","admin","manager"].includes(user?.role);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);
  const [tab, setTab] = useState(visibleTabs[0]?.key || "settings");

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc" }}>
      {/* Tab bar */}
      <div style={{
        display:"flex", background:"#fff",
        borderBottom:"1.5px solid #e5e7eb",
        position:"sticky", top:0, zIndex:20,
        overflowX:"auto", WebkitOverflowScrolling:"touch",
      }}>
        {visibleTabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex:1, minWidth:100, padding:"14px 8px",
              border:"none", background:"none",
              borderBottom: tab===t.key ? "3px solid #4f46e5" : "3px solid transparent",
              cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
              transition:"all .15s",
            }}>
            <span className="material-icons" style={{
              fontSize:22,
              color: tab===t.key ? "#4f46e5" : "#9ca3af",
            }}>{t.icon}</span>
            <span style={{
              fontSize:11, fontWeight: tab===t.key ? 800 : 600,
              color: tab===t.key ? "#4f46e5" : "#6b7280",
              whiteSpace:"nowrap",
            }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Suspense fallback={
        <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>⏳ Đang tải...</div>
      }>
        {tab === "departments"  && <DepartmentPage user={user} />}
        {tab === "roles"        && <RolePermissionPage />}
        {tab === "settings"     && <SettingsPage user={user} />}
        {tab === "integrations" && <IntegrationsTab />}
      </Suspense>
    </div>
  );
}
