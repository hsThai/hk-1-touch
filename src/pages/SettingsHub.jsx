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
const IntegrationsPage   = lazy(() => import("./IntegrationsPage.jsx"));
const PrintSettingsTab   = lazy(() => import("./PrintSettingsTab.jsx"));


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
  {
    key:      "print",
    label:    "Mẫu in",
    icon:     "print",
    adminOnly: true,
  },
];

export default function SettingsHub({ user, initialTab }) {
  const { can } = usePermission();
  const isAdmin = ["owner","admin","manager"].includes(user?.role);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);
  const [tab, setTab] = useState(initialTab && visibleTabs.find(t=>t.key===initialTab) ? initialTab : (visibleTabs[0]?.key || "settings"));

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
        {tab === "integrations" && <IntegrationsPage user={user} />}
        {tab === "print"         && <PrintSettingsTab user={user} />}
      </Suspense>
    </div>
  );
}
