/**
 * RolePermissionPage.jsx
 * Ma trận checkbox auto-save, accordion theo module
 * Refactor: dropdown role, staff badge, bảng scroll ngang+dọc mobile friendly
 */
import { useState, useEffect, useCallback } from "react";
import { Role, RolePermission } from "./pb.jsx";
import { ROLE_DEFINITIONS, buildPermissionRows } from "./seedRoles.js";
import { STATIC_MATRIX, RESOURCES } from "./PermissionContext.jsx";

// ── Resource labels / nhóm ─────────────────────────────────
const RESOURCE_META = {
  repair_order:       { label:"Đơn sửa chữa",        module:"Sửa chữa",   icon:"build" },
  repair_order_price: { label:"Báo giá / Duyệt giá", module:"Sửa chữa",   icon:"request_quote" },
  spare_part:         { label:"Linh kiện",            module:"Kho",         icon:"memory" },
  stock_export:       { label:"Xuất kho",             module:"Kho",         icon:"outbox" },
  stock_import:       { label:"Nhập kho",             module:"Kho",         icon:"move_to_inbox" },
  stock_transfer:     { label:"Chuyển kho",           module:"Kho",         icon:"swap_horiz" },
  stock_count:        { label:"Kiểm kho",             module:"Kho",         icon:"fact_check" },
  stock_ledger:       { label:"Sổ cái kho",           module:"Kho",         icon:"menu_book" },
  customer:           { label:"Khách hàng",           module:"Kinh doanh",  icon:"group" },
  sale_order:         { label:"Bán hàng lẻ",          module:"Kinh doanh",  icon:"point_of_sale" },
  expense:            { label:"Chi phí",              module:"Kinh doanh",  icon:"payments" },
  revenue_report:     { label:"Báo cáo doanh thu",   module:"Kinh doanh",  icon:"bar_chart" },
  staff:              { label:"Nhân viên",            module:"Quản trị",    icon:"person" },
  kpi:                { label:"KPI",                  module:"Quản trị",    icon:"emoji_events" },
  settings:           { label:"Cài đặt hệ thống",    module:"Quản trị",    icon:"settings" },
  media_post:         { label:"Bài đăng / Media",    module:"Quản trị",    icon:"campaign" },
  notification:       { label:"Thông báo",           module:"Quản trị",    icon:"notifications" },
  warehouse_mgr:      { label:"Quản lý kho (config)",module:"Quản trị",    icon:"warehouse" },
  supplier:           { label:"Nhà cung cấp",         module:"Kế toán",    icon:"storefront" },
  debt:               { label:"Công nợ",               module:"Kế toán",    icon:"account_balance_wallet" },
  cash_journal:       { label:"Sổ quỹ",               module:"Kế toán",    icon:"menu_book" },
  department:         { label:"Phòng ban",             module:"Quản trị",   icon:"corporate_fare" },
};

const MODULES = [...new Set(Object.values(RESOURCE_META).map(r => r.module))];
const byModule = (mod) =>
  Object.entries(RESOURCE_META).filter(([,v]) => v.module === mod).map(([k]) => k);

const ACTION_LABELS = [
  { key:"can_view",    short:"Xem",    icon:"visibility" },
  { key:"can_create",  short:"Tạo",    icon:"add_circle" },
  { key:"can_edit",    short:"Sửa",    icon:"edit" },
  { key:"can_delete",  short:"Xoá",   icon:"delete" },
  { key:"can_approve", short:"Duyệt", icon:"check_circle" },
  { key:"can_export",  short:"Export",icon:"download" },
];

export default function RolePermissionPage() {
  const [roles,      setRoles]      = useState([]);
  const [perms,      setPerms]      = useState({});
  const [staffList,  setStaffList]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState({});
  const [toast,      setToast]      = useState("");
  const [openMod,    setOpenMod]    = useState({});
  const [activeRole, setActiveRole] = useState(null);
  const [seeding,    setSeeding]    = useState(false);

  // Load roles + permissions + staff
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [dbRoles, dbPerms] = await Promise.all([
          Role.list({ limit: 100, sort: "sort_order" }),
          RolePermission.list({ limit: 2000 }),
        ]);

        const mergedRoles = dbRoles && dbRoles.length > 0
          ? dbRoles
          : ROLE_DEFINITIONS.map(r => ({ ...r, key: r.key }));
        setRoles(mergedRoles);
        if (mergedRoles.length > 0) setActiveRole(mergedRoles[0].key);

        const map = {};
        if (dbPerms && dbPerms.length > 0) {
          dbPerms.forEach(p => {
            if (!map[p.role_key]) map[p.role_key] = {};
            map[p.role_key][p.resource] = {
              id: p.id, can_view:!!p.can_view, can_create:!!p.can_create,
              can_edit:!!p.can_edit, can_delete:!!p.can_delete,
              can_approve:!!p.can_approve, can_export:!!p.can_export,
            };
          });
        } else {
          Object.entries(STATIC_MATRIX).forEach(([roleKey, resources]) => {
            map[roleKey] = {};
            Object.entries(resources).forEach(([res, actions]) => {
              map[roleKey][res] = {
                id: null,
                can_view:!!actions.view, can_create:!!actions.create,
                can_edit:!!actions.edit, can_delete:!!actions.delete,
                can_approve:!!actions.approve, can_export:!!actions.export,
              };
            });
          });
        }
        setPerms(map);
      } catch (e) {
        showToast("⚠️ Không tải được dữ liệu phân quyền — kiểm tra kết nối PocketBase.");
      }

      // Load staff list
      try {
        const pbUrl = localStorage.getItem("pb_url") || "http://localhost:8090";
        const staffData = await fetch(
          `${pbUrl}/api/collections/staffs/records?perPage=200&fields=id,full_name,role`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (staffData.ok) {
          const sj = await staffData.json();
          setStaffList(sj.items || []);
        }
      } catch {}

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

    setPerms(prev => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || {}),
        [resource]: { ...(prev[roleKey]?.[resource] || {}), [actionKey]: value },
      },
    }));

    try {
      const existing = perms[roleKey]?.[resource];
      const payload  = {
        ...(existing || {}),
        role_key: roleKey,
        resource,
        [actionKey]: value,
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
      setPerms(prev => ({
        ...prev,
        [roleKey]: {
          ...(prev[roleKey] || {}),
          [resource]: { ...(prev[roleKey]?.[resource] || {}), [actionKey]: !value },
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

  const activeRoleData  = roles.find(r => r.key === activeRole);
  const staffInRole     = staffList.filter(s => s.role === activeRole);

  return (
    <div style={{ paddingBottom:80 }}>

      {/* ── Dropdown chọn role + Seed button ── */}
      <div style={{ padding:"16px 16px 0", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <label style={{ fontSize:13, fontWeight:700, color:"#374151", whiteSpace:"nowrap" }}>
          Chọn vai trò:
        </label>
        <select
          value={activeRole || ""}
          onChange={e => setActiveRole(e.target.value)}
          style={{
            height:42, padding:"0 16px", borderRadius:12,
            border:"2px solid #4f46e5", fontSize:14, fontWeight:700,
            color:"#1e1b4b", background:"#fff", cursor:"pointer",
            minWidth:220, outline:"none",
          }}>
          {roles.map(r => (
            <option key={r.key} value={r.key}>
              {r.icon || "👤"} {r.label || r.key}
            </option>
          ))}
        </select>
        <button onClick={handleSeed} disabled={seeding}
          style={{
            height:42, padding:"0 16px", borderRadius:12,
            border:"1.5px solid #e5e7eb", background:"#f9fafb",
            fontSize:13, fontWeight:700, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6,
            marginLeft:"auto",
          }}>
          {seeding ? "⏳ Đang seed..." : "🌱 Seed mặc định"}
        </button>
      </div>

      {/* ── Role info card + danh sách nhân viên ── */}
      {activeRoleData && (
        <div style={{
          margin:"12px 16px", borderRadius:14,
          background: activeRoleData.bg || "#f3f4f6",
          border:`1.5px solid ${activeRoleData.color || "#e5e7eb"}44`,
          padding:"12px 16px",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:26 }}>{activeRoleData.icon || "👤"}</span>
            <div>
              <div style={{ fontWeight:900, fontSize:15, color: activeRoleData.color || "#374151" }}>
                {activeRoleData.label || activeRole}
              </div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:1 }}>
                {activeRoleData.description || ""}
              </div>
            </div>
          </div>
          {/* Nhân viên trong role */}
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#9ca3af", whiteSpace:"nowrap" }}>
              👤 Nhân viên ({staffInRole.length}):
            </span>
            {staffInRole.length === 0
              ? <span style={{ fontSize:12, color:"#9ca3af", fontStyle:"italic" }}>Chưa có ai</span>
              : staffInRole.map(s => (
                  <span key={s.id} style={{
                    fontSize:12, fontWeight:700, background:"#fff",
                    border:`1px solid ${activeRoleData.color || "#e5e7eb"}44`,
                    color: activeRoleData.color || "#374151",
                    borderRadius:99, padding:"2px 10px",
                  }}>
                    {s.full_name || s.id}
                  </span>
                ))
            }
          </div>
        </div>
      )}

      {/* ── Bảng ma trận — scroll ngang + dọc ── */}
      <div style={{
        overflowX:"auto", overflowY:"auto",
        WebkitOverflowScrolling:"touch",
        margin:"0 16px 16px",
        border:"1.5px solid #e5e7eb", borderRadius:14,
        maxHeight:"calc(100vh - 320px)",
      }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:560 }}>
          {/* Sticky header */}
          <thead>
            <tr style={{ background:"#f8fafc", position:"sticky", top:0, zIndex:10 }}>
              <th style={{
                textAlign:"left", padding:"10px 14px", fontSize:11, fontWeight:800,
                color:"#9ca3af", textTransform:"uppercase", letterSpacing:.5,
                borderBottom:"1.5px solid #e5e7eb", minWidth:180,
                position:"sticky", left:0, background:"#f8fafc", zIndex:11,
              }}>
                Tài nguyên
              </th>
              {ACTION_LABELS.map(a => (
                <th key={a.key} style={{
                  textAlign:"center", padding:"10px 8px", fontSize:11, fontWeight:800,
                  color:"#6b7280", textTransform:"uppercase",
                  borderBottom:"1.5px solid #e5e7eb", minWidth:64,
                }}>
                  <span className="material-icons" style={{
                    fontSize:14, verticalAlign:"middle", display:"block",
                    margin:"0 auto 2px", fontFamily:"Material Icons", lineHeight:1,
                  }}>
                    {a.icon}
                  </span>
                  {a.short}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {activeRole && MODULES.map(mod => {
              const resources = byModule(mod);
              const isOpen    = openMod[mod] !== false;
              return resources.length === 0 ? null : (
                <>
                  {/* Module header row */}
                  <tr key={`mod-${mod}`}>
                    <td colSpan={ACTION_LABELS.length + 1} style={{ padding:0 }}>
                      <button
                        onClick={() => setOpenMod(p => ({ ...p, [mod]: !isOpen }))}
                        style={{
                          width:"100%", textAlign:"left", padding:"10px 14px",
                          background: isOpen ? "#eef2ff" : "#f9fafb",
                          border:"none", borderTop:"1.5px solid #e5e7eb",
                          cursor:"pointer", fontWeight:800, fontSize:13, color:"#1e1b4b",
                          display:"flex", alignItems:"center", gap:8,
                        }}>
                        <span className="material-icons" style={{
                          fontSize:15, color:"#9ca3af",
                          fontFamily:"Material Icons", lineHeight:1,
                        }}>
                          {isOpen ? "expand_less" : "expand_more"}
                        </span>
                        📁 {mod}
                        <span style={{ fontSize:11, color:"#9ca3af", fontWeight:500 }}>
                          ({resources.length} tài nguyên)
                        </span>
                      </button>
                    </td>
                  </tr>

                  {/* Resource rows */}
                  {isOpen && resources.map((resKey, ri) => {
                    const meta     = RESOURCE_META[resKey];
                    const current  = perms[activeRole]?.[resKey] || {};
                    const cellKey  = `${activeRole}/${resKey}`;
                    const isSaving = !!saving[cellKey];
                    const bg       = isSaving ? "#fffbeb" : ri % 2 === 0 ? "#fff" : "#fafafa";

                    return (
                      <tr key={resKey} style={{ background:bg, transition:"background .3s" }}>
                        {/* Resource label — sticky trái */}
                        <td style={{
                          padding:"9px 14px", borderTop:"1px solid #f3f4f6",
                          position:"sticky", left:0, background:bg, zIndex:5,
                        }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                            {isSaving && <span style={{ fontSize:10, color:"#d97706" }}>💾</span>}
                            <span className="material-icons" style={{
                              fontSize:15, color:"#9ca3af",
                              fontFamily:"Material Icons", lineHeight:1,
                            }}>
                              {meta.icon}
                            </span>
                            <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>
                              {meta.label}
                            </span>
                          </div>
                        </td>

                        {/* Checkbox cells */}
                        {ACTION_LABELS.map(a => (
                          <td key={a.key} style={{
                            textAlign:"center", padding:"9px 4px",
                            borderTop:"1px solid #f3f4f6",
                          }}>
                            <input
                              type="checkbox"
                              checked={!!current[a.key]}
                              onChange={e => saveCell(activeRole, resKey, a.key, e.target.checked)}
                              style={{ width:18, height:18, cursor:"pointer", accentColor:"#4f46e5" }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

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
