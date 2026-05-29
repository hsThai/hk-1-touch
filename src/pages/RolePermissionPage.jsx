/**
 * RolePermissionPage.jsx
 * Ma trận checkbox auto-save, accordion theo module
 * Dùng trong SettingsHub → tab "Vai trò & Phân quyền"
 */
import { useState, useEffect, useCallback } from "react";
import { Role, RolePermission } from "./pb.jsx";
import { ROLE_DEFINITIONS, buildPermissionRows } from "./seedRoles.js";
import { STATIC_MATRIX, RESOURCES } from "./PermissionContext.jsx";

// ── Resource labels / nhóm ─────────────────────────────────
const RESOURCE_META = {
  repair_order:       { label:"Đơn sửa chữa",     module:"Sửa chữa",   icon:"build" },
  repair_order_price: { label:"Báo giá / Duyệt giá",module:"Sửa chữa",  icon:"request_quote" },
  spare_part:         { label:"Linh kiện",           module:"Kho",        icon:"memory" },
  stock_export:       { label:"Xuất kho",            module:"Kho",        icon:"outbox" },
  stock_import:       { label:"Nhập kho",            module:"Kho",        icon:"move_to_inbox" },
  stock_transfer:     { label:"Chuyển kho",          module:"Kho",        icon:"swap_horiz" },
  stock_count:        { label:"Kiểm kho",            module:"Kho",        icon:"fact_check" },
  stock_ledger:       { label:"Sổ cái kho",         module:"Kho",        icon:"menu_book" },
  customer:           { label:"Khách hàng",          module:"Kinh doanh", icon:"group" },
  sale_order:         { label:"Bán hàng lẻ",         module:"Kinh doanh", icon:"point_of_sale" },
  expense:            { label:"Chi phí",             module:"Kinh doanh", icon:"payments" },
  revenue_report:     { label:"Báo cáo doanh thu",  module:"Kinh doanh", icon:"bar_chart" },
  staff:              { label:"Nhân viên",           module:"Quản trị",   icon:"person" },
  kpi:                { label:"KPI",                 module:"Quản trị",   icon:"emoji_events" },
  settings:           { label:"Cài đặt hệ thống",   module:"Quản trị",   icon:"settings" },
  media_post:         { label:"Bài đăng / Media",   module:"Quản trị",   icon:"campaign" },
  notification:       { label:"Thông báo",           module:"Quản trị",   icon:"notifications" },
  warehouse_mgr:      { label:"Quản lý kho (config)",module:"Quản trị",  icon:"warehouse" },
  supplier:           { label:"Nhà cung cấp",         module:"Kế toán",   icon:"storefront" },
  debt:               { label:"Công nợ",               module:"Kế toán",   icon:"account_balance_wallet" },
  cash_journal:       { label:"Sổ quỹ",                module:"Kế toán",   icon:"menu_book" },
  department:         { label:"Phòng ban",              module:"Quản trị",  icon:"corporate_fare" },
};

// Group resources by module
const MODULES = [...new Set(Object.values(RESOURCE_META).map(r => r.module))];
const byModule = (mod) =>
  Object.entries(RESOURCE_META).filter(([,v]) => v.module === mod).map(([k]) => k);

const ACTION_LABELS = [
  { key:"can_view",    short:"Xem",     icon:"visibility" },
  { key:"can_create",  short:"Tạo",     icon:"add_circle" },
  { key:"can_edit",    short:"Sửa",     icon:"edit" },
  { key:"can_delete",  short:"Xoá",     icon:"delete" },
  { key:"can_approve", short:"Duyệt",   icon:"check_circle" },
  { key:"can_export",  short:"Export",  icon:"download" },
];

// Debounce helper
function useDebounce(fn, delay = 600) {
  const [timer, setTimer] = useState(null);
  return useCallback((...args) => {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => fn(...args), delay);
    setTimer(t);
  }, [fn, delay, timer]);
}

export default function RolePermissionPage() {
  const [roles,      setRoles]      = useState([]);
  const [perms,      setPerms]      = useState({}); // { roleKey: { resource: { can_*: bool, id? } } }
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState({}); // { "roleKey/resource": true }
  const [toast,      setToast]      = useState("");
  const [openMod,    setOpenMod]    = useState({}); // accordion state
  const [activeRole, setActiveRole] = useState(null);
  const [seeding,    setSeeding]    = useState(false);

  // Load roles + permissions
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [dbRoles, dbPerms] = await Promise.all([
          Role.list({ limit: 100, sort: "sort_order" }),
          RolePermission.list({ limit: 2000 }),
        ]);

        // Merge DB roles với ROLE_DEFINITIONS fallback
        const mergedRoles = dbRoles && dbRoles.length > 0
          ? dbRoles
          : ROLE_DEFINITIONS.map(r => ({ ...r, key: r.key }));
        setRoles(mergedRoles);
        if (mergedRoles.length > 0) setActiveRole(mergedRoles[0].key);

        // Build perms map
        const map = {};
        if (dbPerms && dbPerms.length > 0) {
          dbPerms.forEach(p => {
            if (!map[p.role_key]) map[p.role_key] = {};
            map[p.role_key][p.resource] = {
              id:          p.id,
              can_view:    !!p.can_view,
              can_create:  !!p.can_create,
              can_edit:    !!p.can_edit,
              can_delete:  !!p.can_delete,
              can_approve: !!p.can_approve,
              can_export:  !!p.can_export,
            };
          });
        } else {
          // Fallback: load từ STATIC_MATRIX
          Object.entries(STATIC_MATRIX).forEach(([roleKey, resources]) => {
            map[roleKey] = {};
            Object.entries(resources).forEach(([res, actions]) => {
              map[roleKey][res] = {
                id: null,
                can_view:    !!actions.view,
                can_create:  !!actions.create,
                can_edit:    !!actions.edit,
                can_delete:  !!actions.delete,
                can_approve: !!actions.approve,
                can_export:  !!actions.export,
              };
            });
          });
        }
        setPerms(map);
      } catch (e) {
        showToast("⚠️ Không tải được dữ liệu phân quyền — kiểm tra kết nối PocketBase.");
      }
      setLoading(false);
    })();
  }, []);

  function showToast(msg, dur = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), dur);
  }

  // Auto-save 1 cell
  async function saveCell(roleKey, resource, actionKey, value) {
    const cellKey = `${roleKey}/${resource}`;
    setSaving(p => ({ ...p, [cellKey]: true }));

    // Optimistic update
    setPerms(prev => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || {}),
        [resource]: {
          ...(prev[roleKey]?.[resource] || {}),
          [actionKey]: value,
        },
      },
    }));

    try {
      const existing = perms[roleKey]?.[resource];
      const payload  = {
        ...(existing || {}),
        role_key: roleKey,
        resource,
        [actionKey]: value,
        // Xoá fields không thuộc DB schema
        id: undefined,
      };
      delete payload.id;

      if (existing?.id) {
        await RolePermission.update(existing.id, payload);
      } else {
        const created = await RolePermission.create(payload);
        setPerms(prev => ({
          ...prev,
          [roleKey]: {
            ...(prev[roleKey] || {}),
            [resource]: { ...(prev[roleKey]?.[resource] || {}), id: created.id },
          },
        }));
      }
    } catch (e) {
      showToast("❌ Lỗi lưu quyền — kiểm tra kết nối hoặc quyền PocketBase.");
      // Rollback
      setPerms(prev => ({
        ...prev,
        [roleKey]: {
          ...(prev[roleKey] || {}),
          [resource]: {
            ...(prev[roleKey]?.[resource] || {}),
            [actionKey]: !value,
          },
        },
      }));
    }
    setSaving(p => { const n = { ...p }; delete n[cellKey]; return n; });
  }

  // Seed all từ STATIC_MATRIX
  async function handleSeed() {
    if (!confirm("Seed toàn bộ ma trận quyền từ file mặc định? Các quyền hiện có sẽ bị ghi đè.")) return;
    setSeeding(true);
    try {
      const { seedAll } = await import("./seedRoles.js");
      await seedAll(msg => showToast(msg, 1500));
      // Reload
      const dbPerms = await RolePermission.list({ limit: 2000 });
      const map = {};
      dbPerms.forEach(p => {
        if (!map[p.role_key]) map[p.role_key] = {};
        map[p.role_key][p.resource] = {
          id: p.id, can_view:!!p.can_view, can_create:!!p.can_create,
          can_edit:!!p.can_edit, can_delete:!!p.can_delete,
          can_approve:!!p.can_approve, can_export:!!p.can_export,
        };
      });
      setPerms(map);
      showToast("✅ Seed xong!");
    } catch (e) {
      showToast("❌ Lỗi thao tác — vui lòng thử lại.");
    }
    setSeeding(false);
  }

  if (loading) return (
    <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
      Đang tải ma trận phân quyền...
    </div>
  );

  const activeRoleData = roles.find(r => r.key === activeRole);

  return (
    <div style={{ padding:"0 0 80px" }}>
      {/* Role tabs (horizontal scroll) */}
      <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch",
        background:"#fff", borderBottom:"1.5px solid #e5e7eb",
        position:"sticky", top:0, zIndex:20 }}>
        <div style={{ display:"flex", gap:0, minWidth:"max-content", padding:"0 8px" }}>
          {roles.map(r => (
            <button key={r.key} onClick={() => setActiveRole(r.key)}
              style={{
                padding:"12px 16px", border:"none", background:"none",
                fontWeight: activeRole===r.key ? 900 : 600,
                fontSize:13,
                color: activeRole===r.key ? "#4f46e5" : "#6b7280",
                borderBottom: activeRole===r.key ? "3px solid #4f46e5" : "3px solid transparent",
                cursor:"pointer", whiteSpace:"nowrap",
                transition:"all .15s",
              }}>
              {r.icon || "👤"} {r.label || r.key}
            </button>
          ))}
        </div>
      </div>

      {/* Role info bar */}
      {activeRoleData && (
        <div style={{
          display:"flex", alignItems:"center", gap:12, padding:"14px 16px",
          background: activeRoleData.bg || "#f3f4f6",
          borderBottom:"1.5px solid #e5e7eb"
        }}>
          <span style={{ fontSize:28 }}>{activeRoleData.icon || "👤"}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900, fontSize:15, color: activeRoleData.color || "#374151" }}>
              {activeRoleData.label || activeRole}
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
              {activeRoleData.description || ""}
            </div>
          </div>
          <button onClick={handleSeed} disabled={seeding}
            style={{
              height:36, padding:"0 14px", borderRadius:10, border:"1.5px solid #e5e7eb",
              background:"#f9fafb", fontSize:12, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6
            }}>
            {seeding ? "⏳" : "🌱"} {seeding ? "Đang seed..." : "Seed mặc định"}
          </button>
        </div>
      )}

      {/* Header hàng actions */}
      <div style={{
        display:"grid", gap:0,
        gridTemplateColumns:`200px repeat(${ACTION_LABELS.length}, 1fr)`,
        background:"#f8fafc", borderBottom:"1.5px solid #e5e7eb",
        padding:"8px 16px", position:"sticky", top:49, zIndex:10,
      }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase" }}>Tài nguyên</div>
        {ACTION_LABELS.map(a => (
          <div key={a.key} style={{ textAlign:"center", fontSize:10, fontWeight:800, color:"#6b7280", textTransform:"uppercase" }}>
            {a.short}
          </div>
        ))}
      </div>

      {/* Accordion by module */}
      {activeRole && MODULES.map(mod => {
        const resources = byModule(mod);
        const isOpen = openMod[mod] !== false; // default open
        return (
          <div key={mod} style={{ borderBottom:"1.5px solid #e5e7eb" }}>
            {/* Module header */}
            <button
              onClick={() => setOpenMod(p => ({ ...p, [mod]: !isOpen }))}
              style={{
                width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"12px 16px", background: isOpen ? "#eef2ff" : "#fff",
                border:"none", cursor:"pointer", fontWeight:800, fontSize:14, color:"#1e1b4b",
                textAlign:"left",
              }}>
              <span>📁 {mod}</span>
              <span className="material-icons" style={{ fontSize:18, color:"#9ca3af" }}>
                {isOpen ? "expand_less" : "expand_more"}
              </span>
            </button>

            {/* Resource rows */}
            {isOpen && resources.map(resKey => {
              const meta    = RESOURCE_META[resKey];
              const current = perms[activeRole]?.[resKey] || {};
              const cellKey = `${activeRole}/${resKey}`;
              const isSaving= !!saving[cellKey];

              return (
                <div key={resKey}
                  style={{
                    display:"grid",
                    gridTemplateColumns:`200px repeat(${ACTION_LABELS.length}, 1fr)`,
                    alignItems:"center", padding:"10px 16px",
                    borderTop:"1px solid #f3f4f6",
                    background: isSaving ? "#fffbeb" : "#fff",
                    transition:"background .3s",
                  }}>
                  {/* Resource label */}
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {isSaving && <span style={{ color:"#d97706", fontSize:11 }}>💾</span>}
                    <span className="material-icons" style={{ fontSize:16, color:"#6b7280" }}>{meta.icon}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{meta.label}</span>
                  </div>

                  {/* Checkboxes */}
                  {ACTION_LABELS.map(a => (
                    <div key={a.key} style={{ display:"flex", justifyContent:"center" }}>
                      <input
                        type="checkbox"
                        checked={!!current[a.key]}
                        onChange={e => saveCell(activeRole, resKey, a.key, e.target.checked)}
                        style={{ width:18, height:18, cursor:"pointer", accentColor:"#4f46e5" }}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
          background:"#1e1b4b", color:"#fff", borderRadius:14, padding:"12px 24px",
          fontSize:13, fontWeight:700, zIndex:5000, boxShadow:"0 8px 24px rgba(0,0,0,.3)",
          whiteSpace:"nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
