/**
 * RolePermissionPage.jsx
 * Ma trận phân quyền: dropdown role, table scroll 2 chiều,
 * toggle hàng "Chọn tất cả", staff badge, checkbox lớn mobile-friendly
 */
import React, { useState, useEffect } from "react";
import { Role, RolePermission, Staff } from "./pb.jsx";
import { ROLE_DEFINITIONS } from "./seedRoles.js";
import { STATIC_MATRIX } from "./PermissionContext.jsx";

// ── Resource meta ─────────────────────────────────────────
const RESOURCE_META = {
  repair_order:       { label:"Đơn sửa chữa",         module:"Sửa chữa",   icon:"build" },
  repair_order_price: { label:"Báo giá / Duyệt giá",  module:"Sửa chữa",   icon:"request_quote" },
  spare_part:         { label:"Linh kiện",             module:"Kho",         icon:"memory" },
  stock_export:       { label:"Xuất kho",              module:"Kho",         icon:"outbox" },
  stock_import:       { label:"Nhập kho",              module:"Kho",         icon:"move_to_inbox" },
  stock_transfer:     { label:"Chuyển kho",            module:"Kho",         icon:"swap_horiz" },
  stock_count:        { label:"Kiểm kho",              module:"Kho",         icon:"fact_check" },
  stock_ledger:       { label:"Sổ cái kho",            module:"Kho",         icon:"menu_book" },
  customer:           { label:"Khách hàng",            module:"Kinh doanh",  icon:"group" },
  sale_order:         { label:"Bán hàng lẻ",           module:"Kinh doanh",  icon:"point_of_sale" },
  expense:            { label:"Chi phí",               module:"Kinh doanh",  icon:"payments" },
  revenue_report:     { label:"Báo cáo doanh thu",    module:"Kinh doanh",  icon:"bar_chart" },
  staff:              { label:"Nhân viên",             module:"Quản trị",    icon:"person" },
  kpi:                { label:"KPI",                   module:"Quản trị",    icon:"emoji_events" },
  settings:           { label:"Cài đặt hệ thống",     module:"Quản trị",    icon:"settings" },
  media_post:         { label:"Bài đăng / Media",     module:"Quản trị",    icon:"campaign" },
  notification:       { label:"Thông báo",            module:"Quản trị",    icon:"notifications" },
  warehouse_mgr:      { label:"Quản lý kho (config)", module:"Quản trị",    icon:"warehouse" },
  department:         { label:"Phòng ban",             module:"Quản trị",    icon:"corporate_fare" },
  supplier:           { label:"Nhà cung cấp",          module:"Kế toán",    icon:"storefront" },
  debt:               { label:"Công nợ",               module:"Kế toán",    icon:"account_balance_wallet" },
  cash_journal:       { label:"Sổ quỹ",               module:"Kế toán",    icon:"menu_book" },
  purchase_order:     { label:"Đơn mua hàng NCC",      module:"Mua hàng",   icon:"shopping_cart" },
  profit_report:      { label:"Báo cáo lợi nhuận",     module:"Báo cáo",    icon:"trending_up" },
};

const MODULES   = [
  "Sửa chữa", "Kho", "Kinh doanh", "Kế toán",
  "Mua hàng", "Báo cáo", "Quản trị",
];
const byModule  = (mod) =>
  Object.entries(RESOURCE_META).filter(([,v]) => v.module === mod).map(([k]) => k);

const ACTION_LABELS = [
  { key:"can_view",    short:"Xem",    icon:"visibility" },
  { key:"can_create",  short:"Tạo",    icon:"add_circle" },
  { key:"can_edit",    short:"Sửa",    icon:"edit" },
  { key:"can_delete",  short:"Xoá",   icon:"delete" },
  { key:"can_approve", short:"Duyệt", icon:"check_circle" },
  { key:"can_export",  short:"Export",icon:"download" },
];

// ── Component ─────────────────────────────────────────────
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
        const dupesToDelete = [];
        if (dbPerms && dbPerms.length > 0) {
          dbPerms.forEach(p => {
            if (!map[p.role_key]) map[p.role_key] = {};
            const key = p.resource;
            const existing = map[p.role_key][key];
            if (existing) {
              // Bản ghi trùng role_key+resource (do lỗi race condition cũ) → gộp quyền (OR) và đánh dấu xoá bản ghi dư
              map[p.role_key][key] = {
                id: existing.id, // giữ bản ghi tạo trước (id nhỏ hơn / cũ hơn)
                can_view:    existing.can_view    || !!p.can_view,
                can_create:  existing.can_create  || !!p.can_create,
                can_edit:    existing.can_edit    || !!p.can_edit,
                can_delete:  existing.can_delete  || !!p.can_delete,
                can_approve: existing.can_approve || !!p.can_approve,
                can_export:  existing.can_export  || !!p.can_export,
              };
              dupesToDelete.push({ id: p.id, keepId: existing.id, role_key: p.role_key, resource: key });
            } else {
              map[p.role_key][key] = {
                id: p.id,
                can_view:!!p.can_view, can_create:!!p.can_create,
                can_edit:!!p.can_edit, can_delete:!!p.can_delete,
                can_approve:!!p.can_approve, can_export:!!p.can_export,
              };
            }
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

        // Tự động dọn dẹp bản ghi trùng (lỗi race condition cũ từ nút "Chọn tất cả")
        if (dupesToDelete.length > 0) {
          (async () => {
            try {
              // Gộp quyền (đã OR ở trên) và lưu lại vào bản ghi giữ, rồi xoá các bản ghi dư
              const seen = new Set();
              for (const dup of dupesToDelete) {
                const mergeKey = `${dup.role_key}/${dup.resource}`;
                if (!seen.has(mergeKey)) {
                  seen.add(mergeKey);
                  const merged = map[dup.role_key]?.[dup.resource];
                  if (merged && dup.keepId) {
                    await RolePermission.update(dup.keepId, {
                      can_view: merged.can_view, can_create: merged.can_create,
                      can_edit: merged.can_edit, can_delete: merged.can_delete,
                      can_approve: merged.can_approve, can_export: merged.can_export,
                    });
                  }
                }
                await RolePermission.delete(dup.id).catch(()=>{});
              }
              showToast(`🧹 Đã tự động dọn ${dupesToDelete.length} bản ghi phân quyền bị trùng (lỗi cũ) và gộp lại quyền chính xác.`, 4000);
            } catch (e) {
              console.warn("[RolePermission cleanup]", e.message);
            }
          })();
        }
      } catch (e) {
        showToast("⚠️ Không tải được dữ liệu phân quyền — kiểm tra kết nối PocketBase.");
      }

      // Load staff list để hiện badge nhân viên
      try {
        const staffData = await Staff.list({ limit: 200, fields: "id,full_name,role" });
        setStaffList(staffData || []);
      } catch {}

      setLoading(false);
    })();
  }, []);

  function showToast(msg, dur = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), dur);
  }

  // permsRef giữ bản mới nhất đồng bộ (tránh đọc state cũ khi có nhiều lệnh lưu gọi liên tiếp — nguyên nhân gây trùng bản ghi)
  const permsRef = React.useRef(perms);
  useEffect(() => { permsRef.current = perms; }, [perms]);

  async function saveCell(roleKey, resource, actionKey, value) {
    const cellKey = `${roleKey}/${resource}`;
    setSaving(p => ({ ...p, [cellKey]: true }));

    const existingBefore = permsRef.current[roleKey]?.[resource];

    const nextResourceState = { ...(existingBefore || {}), [actionKey]: value };
    permsRef.current = {
      ...permsRef.current,
      [roleKey]: { ...(permsRef.current[roleKey] || {}), [resource]: nextResourceState },
    };
    setPerms(prev => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || {}),
        [resource]: nextResourceState,
      },
    }));

    try {
      const payload = { ...(existingBefore || {}), role_key: roleKey, resource, [actionKey]: value };
      delete payload.id;

      if (existingBefore?.id) {
        await RolePermission.update(existingBefore.id, payload);
      } else {
        const created = await RolePermission.create(payload);
        permsRef.current = {
          ...permsRef.current,
          [roleKey]: {
            ...(permsRef.current[roleKey] || {}),
            [resource]: { ...(permsRef.current[roleKey]?.[resource] || {}), id: created.id },
          },
        };
        setPerms(prev => ({
          ...prev,
          [roleKey]: {
            ...(prev[roleKey] || {}),
            [resource]: { ...(prev[roleKey]?.[resource] || {}), id: created.id },
          },
        }));
      }
    } catch {
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

  // Lưu TOÀN BỘ 6 quyền của 1 resource trong ĐÚNG 1 lệnh duy nhất (tránh gọi saveCell nhiều lần liên tiếp gây trùng bản ghi)
  async function saveRowAll(roleKey, resource, newVal) {
    const cellKey = `${roleKey}/${resource}`;
    setSaving(p => ({ ...p, [cellKey]: true }));

    const existingBefore = permsRef.current[roleKey]?.[resource];
    const nextResourceState = {
      id: existingBefore?.id,
      can_view: newVal, can_create: newVal, can_edit: newVal,
      can_delete: newVal, can_approve: newVal, can_export: newVal,
    };
    permsRef.current = {
      ...permsRef.current,
      [roleKey]: { ...(permsRef.current[roleKey] || {}), [resource]: nextResourceState },
    };
    setPerms(prev => ({
      ...prev,
      [roleKey]: { ...(prev[roleKey] || {}), [resource]: nextResourceState },
    }));

    try {
      const payload = {
        role_key: roleKey, resource,
        can_view: newVal, can_create: newVal, can_edit: newVal,
        can_delete: newVal, can_approve: newVal, can_export: newVal,
      };
      if (existingBefore?.id) {
        await RolePermission.update(existingBefore.id, payload);
      } else {
        const created = await RolePermission.create(payload);
        permsRef.current = {
          ...permsRef.current,
          [roleKey]: {
            ...(permsRef.current[roleKey] || {}),
            [resource]: { ...nextResourceState, id: created.id },
          },
        };
        setPerms(prev => ({
          ...prev,
          [roleKey]: {
            ...(prev[roleKey] || {}),
            [resource]: { ...nextResourceState, id: created.id },
          },
        }));
      }
    } catch {
      showToast("❌ Lỗi lưu quyền — kiểm tra kết nối hoặc quyền PocketBase.");
    }
    setSaving(p => { const n = { ...p }; delete n[cellKey]; return n; });
  }

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
    } catch {
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
    <div style={{ paddingBottom:80 }}>

      {/* ── Toolbar: Dropdown + Seed button ── */}
      <div style={{
        padding:"10px 12px 8px", borderBottom:"1.5px solid #e5e7eb",
        background:"#fff", position:"sticky", top:0, zIndex:20,
      }}>
        {/* Dòng 1: label + dropdown + seed */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"nowrap" }}>
          <label style={{ fontSize:13, fontWeight:700, color:"#374151", whiteSpace:"nowrap", flexShrink:0 }}>
            🔑 Vai trò:
          </label>
          <select
            value={activeRole || ""}
            onChange={e => setActiveRole(e.target.value)}
            style={{
              flex:1, minWidth:0, height:38, padding:"0 10px",
              borderRadius:10, border:"2px solid #4f46e5",
              fontSize:14, fontWeight:700, color:"#1e1b4b",
              background:"#fff", cursor:"pointer", outline:"none",
            }}>
            {roles.map(r => (
              <option key={r.key} value={r.key}>
                {r.icon || "👤"} {r.label || r.key}
              </option>
            ))}
          </select>
          <button onClick={handleSeed} disabled={seeding}
            style={{
              flexShrink:0, height:38, padding:"0 12px", borderRadius:10,
              border:"1.5px solid #e5e7eb", background:"#f9fafb",
              fontSize:13, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap",
            }}>
            {seeding ? "⏳" : "🌱"} Seed
          </button>
        </div>

        {/* Dòng 2: Role info card */}
        {activeRoleData && (() => {
          const staffInRole = staffList.filter(s => s.role === activeRole);
          return (
            <div style={{
              display:"flex", alignItems:"center", gap:8, marginTop:7,
              background: activeRoleData.bg || "#f3f4f6",
              border:`1.5px solid ${activeRoleData.color || "#e5e7eb"}44`,
              borderRadius:10, padding:"6px 10px",
            }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{activeRoleData.icon || "👤"}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:13, color: activeRoleData.color || "#374151", lineHeight:1.2 }}>
                  {activeRoleData.label || activeRole}
                </div>
                <div style={{ fontSize:11, color:"#6b7280", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {activeRoleData.description || ""}
                </div>
              </div>
              {/* Staff count + badges */}
              <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                <span style={{
                  fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99,
                  background: activeRoleData.color || "#6b7280",
                  color:"#fff", whiteSpace:"nowrap",
                }}>
                  👤 {staffInRole.length} người
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Bảng ma trận scroll 2 chiều ── */}
      <div style={{
        margin:"8px 8px 24px", border:"1.5px solid #e5e7eb",
        borderRadius:12, overflow:"hidden",
      }}>
        <div style={{
          overflowX:"auto", overflowY:"auto",
          WebkitOverflowScrolling:"touch",
          maxHeight:"calc(100vh - 200px)",
        }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:440 }}>

            {/* Sticky header */}
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                <th style={{
                  textAlign:"left", padding:"9px 10px",
                  fontSize:11, fontWeight:800, color:"#9ca3af",
                  textTransform:"uppercase", letterSpacing:.5,
                  borderBottom:"1.5px solid #e5e7eb",
                  position:"sticky", top:0, left:0, zIndex:12,
                  background:"#f8fafc", minWidth:150, whiteSpace:"nowrap",
                  boxShadow:"2px 0 4px rgba(0,0,0,.04)",
                }}>
                  Tài nguyên
                </th>
                {/* Cột toggle tất cả */}
                <th style={{
                  textAlign:"center", padding:"8px 4px",
                  fontSize:9, fontWeight:800, color:"#4f46e5",
                  textTransform:"uppercase", borderBottom:"1.5px solid #e5e7eb",
                  position:"sticky", top:0, zIndex:11, background:"#f8fafc",
                  minWidth:40, width:40,
                }}>
                  <span className="material-icons" style={{
                    fontSize:13, display:"block", margin:"0 auto 1px",
                    fontFamily:"Material Icons", lineHeight:1,
                  }}>select_all</span>
                  All
                </th>
                {ACTION_LABELS.map(a => (
                  <th key={a.key} style={{
                    textAlign:"center", padding:"8px 2px",
                    fontSize:9, fontWeight:800, color:"#6b7280",
                    textTransform:"uppercase", borderBottom:"1.5px solid #e5e7eb",
                    position:"sticky", top:0, zIndex:11, background:"#f8fafc",
                    minWidth:44, width:44, whiteSpace:"nowrap",
                  }}>
                    <span className="material-icons" style={{
                      fontSize:16, display:"block", margin:"0 auto 1px",
                      fontFamily:"Material Icons", lineHeight:1,
                      color:"#9ca3af",
                    }}>{a.icon}</span>
                    <span style={{ fontSize:9 }}>{a.short}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {activeRole && MODULES.map(mod => {
                const resources = byModule(mod);
                if (!resources.length) return null;
                const isOpen = openMod[mod] !== false;

                return (
                  <React.Fragment key={mod}>
                    {/* Module header row */}
                    <tr>
                      <td colSpan={ACTION_LABELS.length + 2} style={{ padding:0 }}>
                        <button
                          onClick={() => setOpenMod(p => ({ ...p, [mod]: !isOpen }))}
                          style={{
                            width:"100%", textAlign:"left",
                            padding:"9px 14px", border:"none",
                            borderTop:"1.5px solid #e5e7eb",
                            background: isOpen ? "#eef2ff" : "#f9fafb",
                            cursor:"pointer", fontWeight:800,
                            fontSize:13, color:"#1e1b4b",
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
                            ({resources.length})
                          </span>
                        </button>
                      </td>
                    </tr>

                    {/* Resource rows */}
                    {isOpen && resources.map((resKey, ri) => {
                      const meta      = RESOURCE_META[resKey];
                      const current   = perms[activeRole]?.[resKey] || {};
                      const cellKey   = `${activeRole}/${resKey}`;
                      const isSaving  = !!saving[cellKey];
                      const bg        = isSaving ? "#fffbeb" : ri % 2 === 0 ? "#fff" : "#fafafa";
                      const allChecked = ACTION_LABELS.every(a => !!current[a.key]);

                      function toggleAllForResource() {
                        const newVal = !allChecked;
                        saveRowAll(activeRole, resKey, newVal);
                      }

                      return (
                        <tr key={resKey} style={{ background:bg, transition:"background .2s" }}>
                          {/* Resource label — sticky left */}
                          <td style={{
                            padding:"8px 10px", borderTop:"1px solid #f0f0f0",
                            position:"sticky", left:0, background:bg, zIndex:5,
                            boxShadow:"2px 0 4px rgba(0,0,0,.04)",
                          }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span className="material-icons" style={{
                                fontSize:14, color:"#9ca3af", flexShrink:0,
                                fontFamily:"Material Icons", lineHeight:1,
                              }}>
                                {meta.icon}
                              </span>
                              <span style={{ fontSize:12, fontWeight:600, color:"#374151", whiteSpace:"nowrap" }}>
                                {meta.label}
                              </span>
                              {isSaving && <span style={{ fontSize:10, color:"#d97706", flexShrink:0 }}>💾</span>}
                            </div>
                          </td>

                          {/* Cột "Tất cả" — toggle hàng */}
                          <td style={{ textAlign:"center", padding:"8px 2px", borderTop:"1px solid #f0f0f0" }}>
                            <button
                              onClick={toggleAllForResource}
                              title={allChecked ? "Bỏ tất cả" : "Chọn tất cả"}
                              style={{
                                width:24, height:24, borderRadius:6,
                                border:"1.5px solid #4f46e5",
                                background: allChecked ? "#4f46e5" : "#fff",
                                cursor:"pointer", display:"flex",
                                alignItems:"center", justifyContent:"center",
                                margin:"0 auto",
                              }}>
                              <span className="material-icons" style={{
                                fontSize:13, lineHeight:1, fontFamily:"Material Icons",
                                color: allChecked ? "#fff" : "#4f46e5",
                              }}>
                                {allChecked ? "done_all" : "add"}
                              </span>
                            </button>
                          </td>

                          {/* Checkbox cells */}
                          {ACTION_LABELS.map(a => (
                            <td key={a.key} style={{
                              textAlign:"center", padding:"8px 2px",
                              borderTop:"1px solid #f0f0f0",
                            }}>
                              <input
                                type="checkbox"
                                checked={!!current[a.key]}
                                onChange={e => saveCell(activeRole, resKey, a.key, e.target.checked)}
                                style={{ width:22, height:22, cursor:"pointer", accentColor:"#4f46e5" }}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
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
