/* v1774860462-5573 */
import { useState, useEffect } from "react";
import { Staff, Warehouse, Role, ActionLog, RepairOrder, Department, logAction } from "./pb.jsx";
import { ROLE_DEFINITIONS } from "./seedRoles.js";

// Fallback tĩnh — dùng khi DB chưa có dữ liệu
const ROLES_FALLBACK = ROLE_DEFINITIONS.map(r => ({
  value: r.key,
  label: r.label,
  color: r.color,
  bg:    r.bg,
  icon:  r.icon,
}));

function simpleHash(str) { return btoa(unescape(encodeURIComponent(str))); }

const EMPTY = { full_name:"", phone:"", username:"", role:"technician", password:"", note:"", is_active:true, warehouse_ids:[], department_id:"", is_leader:false, leader_id:"" };

// ─────────────────────────────────────────────────────────────────────────────
// StaffKpiTab — KPI nhân viên + Log thao tác
// ─────────────────────────────────────────────────────────────────────────────
function StaffKpiTab({ currentUser }) {
  const [logs,     setLogs]     = useState([]);
  const [records,  setRecords]  = useState([]);
  const [staffs,   setStaffs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState("month");
  const [selStaff, setSelStaff] = useState("");
  const [depts,    setDepts]    = useState([]);

  useEffect(() => { load(); }, [period]);

  useEffect(() => { Department.list({ sort:"sort_order", limit:50 }).then(d => setDepts(d||[])).catch(()=>{}); }, []);

  async function load() {
    setLoading(true);
    try {
      const [l, r, s] = await Promise.all([
        ActionLog.list({ limit:500, sort:"-id" }),
        RepairOrder.list({ limit:500 }),
        Staff.list({ limit:100 }),
      ]);
      setLogs(l||[]);
      setRecords(r||[]);
      setStaffs(s||[]);
    } catch {}
    setLoading(false);
  }

  const now = new Date();
  function inPeriod(d) {
    if (!d) return false;
    const dt = new Date(d);
    if (period==="today") return dt.toDateString()===now.toDateString();
    if (period==="week")  { const s=new Date(now); s.setDate(now.getDate()-7); return dt>=s; }
    if (period==="month") return dt.getMonth()===now.getMonth() && dt.getFullYear()===now.getFullYear();
    return true;
  }

  const DONE = ["Hoàn Thành","Đã Thanh Toán","Đã Giao"];
  const periodOrders = records.filter(o=>DONE.includes(o.status) && inPeriod(o.done_date||o.updated_date||o.updated));

  const kpiMap = {};
  staffs.forEach(s=>{ kpiMap[s.id]={ id:s.id, name:s.name||s.full_name, role:s.role, orders:0, revenue:0, actions:0 }; });
  periodOrders.forEach(o=>{
    const k = o.assigned_to||o.assigned_to_id;
    if (k && kpiMap[k]) { kpiMap[k].orders++; kpiMap[k].revenue+=(o.final_cost||0); }
  });
  logs.filter(l=>inPeriod(l.logged_at)).forEach(l=>{
    if (kpiMap[l.staff_id]) kpiMap[l.staff_id].actions++;
  });
  const kpiList = Object.values(kpiMap).filter(k=>k.orders>0||k.actions>0).sort((a,b)=>b.revenue-a.revenue);
  const maxRev  = Math.max(...kpiList.map(k=>k.revenue), 1);
  const detailLogs = selStaff ? logs.filter(l=>l.staff_id===selStaff && inPeriod(l.logged_at)) : [];

  function exportKpi() {
    const BOM = "﻿";
    const rows = [
      ["KPI NHÂN VIÊN — "+period.toUpperCase()],
      ["Tên","Chức vụ","Đơn HT","Doanh thu","Thao tác"],
      ...kpiList.map(k=>[k.name, k.role, k.orders, k.revenue, k.actions]),
    ];
    const blob = new Blob([BOM+rows.map(r=>r.join(",")).join("\n")], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download = "KPI_"+period+"_"+new Date().toISOString().slice(0,10)+".csv"; a.click();
  }

  return (
    <div style={{ padding:"0 0 100px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontWeight:800, fontSize:17 }}>📊 KPI Nhân viên</div>
        <button onClick={exportKpi}
          style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:8, padding:"7px 12px", fontSize:13, cursor:"pointer" }}>
          ⬇️ CSV
        </button>
      </div>

      {/* Period filter */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[{v:"today",l:"Hôm nay"},{v:"week",l:"7 ngày"},{v:"month",l:"Tháng này"},{v:"all",l:"Tất cả"}].map(p=>(
          <button key={p.v} onClick={()=>setPeriod(p.v)}
            style={{ flex:1, padding:"7px 4px", fontSize:12, fontWeight:period===p.v?700:400,
              background:period===p.v?"#4f46e5":"#f3f4f6", color:period===p.v?"#fff":"#374151",
              border:"none", borderRadius:8, cursor:"pointer" }}>
            {p.l}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:"center", padding:30, color:"#9ca3af" }}>Đang tải...</div>}
      {!loading && (<>
        {kpiList.length===0 && <div style={{ textAlign:"center", padding:30, color:"#9ca3af" }}>Chưa có dữ liệu KPI kỳ này</div>}
        {kpiList.map(k=>(
          <div key={k.id} onClick={()=>setSelStaff(selStaff===k.id?"":k.id)}
            style={{ background:selStaff===k.id?"#eef2ff":"#fff", borderRadius:12, padding:14, marginBottom:10,
              boxShadow:"0 1px 4px rgba(0,0,0,.06)", cursor:"pointer",
              border:selStaff===k.id?"1.5px solid #4f46e5":"1.5px solid transparent" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{k.name}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{k.role} · {k.actions} thao tác</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#4f46e5" }}>{Number(k.revenue).toLocaleString("vi-VN")}đ</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{k.orders} đơn HT</div>
              </div>
            </div>
            <div style={{ height:8, background:"#f3f4f6", borderRadius:4 }}>
              <div style={{ height:"100%", background:"#4f46e5", borderRadius:4, width:`${(k.revenue/maxRev*100).toFixed(1)}%` }}/>
            </div>
            {selStaff===k.id && detailLogs.length>0 && (
              <div style={{ marginTop:12, paddingTop:10, borderTop:"1px dashed #e5e7eb" }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>Log thao tác ({detailLogs.length})</div>
                {detailLogs.slice(0,20).map(l=>(
                  <div key={l.id} style={{ fontSize:12, padding:"4px 0", borderBottom:"1px solid #f3f4f6", color:"#374151" }}>
                    <span style={{ color:"#4f46e5", fontWeight:600 }}>{l.action}</span>
                    {" · "}{l.target_type} {l.target_id?.slice(-6)||""}
                    {l.detail && <span style={{ color:"#9ca3af" }}> — {l.detail}</span>}
                    <span style={{ float:"right", color:"#9ca3af" }}>
                      {new Date(l.logged_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {selStaff===k.id && detailLogs.length===0 && (
              <div style={{ marginTop:10, fontSize:12, color:"#9ca3af", textAlign:"center", paddingTop:8, borderTop:"1px dashed #e5e7eb" }}>
                Chưa có log thao tác kỳ này
              </div>
            )}
          </div>
        ))}
      </>)}
    </div>
  );
}




// ─────────────────────────────────────────────────────────────────────────────
// StaffHierarchicalList — Hiển thị nhân viên theo phân cấp phòng ban + tổ trưởng
// ─────────────────────────────────────────────────────────────────────────────
function StaffCard({ s, roleInfo, currentStaff, openEdit, toggleActive, setConfirmReset, indent }) {
  const ri = roleInfo(s.role);
  return (
    <div style={{
      background: s.is_leader ? "#fffbeb" : "#fff",
      borderRadius: indent ? 10 : 16,
      padding: indent ? "12px 16px" : 16,
      marginLeft: indent ? 28 : 0,
      boxShadow: "0 2px 12px rgba(0,0,0,.07)",
      border: s.is_leader ? "1.5px solid #fde68a" : "1.5px solid #f3f4f6",
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      marginBottom: indent ? 6 : 10,
    }}>
      <div style={{ width: indent ? 40 : 50, height: indent ? 40 : 50, borderRadius:"50%", background: ri.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize: indent ? 18 : 22, flexShrink:0, border:`2px solid ${ri.color}22` }}>
        {ri.icon}
      </div>
      <div style={{ flex:1, minWidth:160 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontWeight:800, fontSize: indent ? 14 : 15, color:"#1e1b4b" }}>{s.full_name}</span>
          {s.is_leader && <span style={{ background:"#fef3c7", color:"#92400e", fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20 }}>🔭 Tổ trưởng</span>}
          <span style={{ background:ri.bg, color:ri.color, fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20 }}>{ri.icon} {ri.label}</span>
          {!s.is_active && <span style={{ background:"#fef2f2", color:"#dc2626", fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20 }}>🔒 Đã khóa</span>}
          {s.must_change_password && <span style={{ background:"#fffbeb", color:"#d97706", fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20 }}>⚠️ Chưa đổi pass</span>}
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginTop:3 }}>
          @{s.username} {s.phone ? `· 📞 ${s.phone}` : ""}
        </div>
      </div>
      <div style={{ textAlign:"center", minWidth:60 }}>
        <div style={{ fontSize:18, fontWeight:900, color: s.kpi_score>=80?"#065f46":s.kpi_score>=50?"#92400e":"#991b1b" }}>{s.kpi_score ?? 100}</div>
        <div style={{ fontSize:11, color:"#9ca3af" }}>KPI</div>
      </div>
      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
        <button onClick={() => openEdit(s)}
          style={{ height:36, padding:"0 14px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          ✏️ Sửa
        </button>
        {s.id !== currentStaff?.id && (
          <button onClick={() => toggleActive(s)}
            style={{ height:36, padding:"0 14px", borderRadius:10, border:"none", background: s.is_active?"#fef2f2":"#ecfdf5", color: s.is_active?"#dc2626":"#059669", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            {s.is_active ? "🔒 Khóa" : "🔓 Mở"}
          </button>
        )}
        <button onClick={() => setConfirmReset(s)}
          style={{ height:36, padding:"0 14px", borderRadius:10, border:"none", background:"#eff6ff", color:"#2563eb", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          🔄 KPI
        </button>
      </div>
    </div>
  );
}

function StaffHierarchicalList({ filtered, depts, roles, roleInfo, currentStaff, openEdit, toggleActive, setConfirmReset }) {
  // Group staff by department_id
  const deptMap = {};
  const noDept = [];

  filtered.forEach(s => {
    const did = s.department_id || "";
    if (!did) {
      noDept.push(s);
    } else {
      if (!deptMap[did]) deptMap[did] = [];
      deptMap[did].push(s);
    }
  });

  // Sort: leaders first within each dept
  function sortDept(arr) {
    return arr.sort((a, b) => {
      if (a.is_leader && !b.is_leader) return -1;
      if (!a.is_leader && b.is_leader) return 1;
      return 0;
    });
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {depts.map(dept => {
        const members = deptMap[dept.id] || [];
        if (members.length === 0) return null; // skip empty depts

        const sorted = sortDept([...members]);
        const leaders = sorted.filter(s => s.is_leader);
        const nonLeaders = sorted.filter(s => !s.is_leader);

        // Assign each non-leader to their leader (by leader_id if set, else to first leader in dept)
        const leaderMembers = {}; // leaderId -> [staff]
        const unassigned = [];

        nonLeaders.forEach(s => {
          const lid = s.leader_id;
          if (lid && leaders.find(l => l.id === lid)) {
            if (!leaderMembers[lid]) leaderMembers[lid] = [];
            leaderMembers[lid].push(s);
          } else if (leaders.length > 0) {
            // Auto-assign to first leader if no explicit leader_id
            const defaultLeader = leaders[0];
            if (!leaderMembers[defaultLeader.id]) leaderMembers[defaultLeader.id] = [];
            leaderMembers[defaultLeader.id].push(s);
          } else {
            unassigned.push(s);
          }
        });

        return (
          <div key={dept.id} style={{
            background: "#fafafa",
            borderRadius: 18,
            padding: 14,
            border: "1.5px solid #f0f0f0",
          }}>
            {/* Department header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 12, paddingBottom: 10,
              borderBottom: "2px solid #f0f0f0",
            }}>
              <span style={{ fontSize: 22 }}>{dept.icon || "🏢"}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1e1b4b" }}>{dept.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {leaders.length} tổ trưởng · {members.length} nhân viên
                </div>
              </div>
            </div>

            {/* Leaders with their members indented */}
            {leaders.map(leader => (
              <div key={leader.id}>
                <StaffCard s={leader} roleInfo={roleInfo} currentStaff={currentStaff}
                  openEdit={openEdit} toggleActive={toggleActive} setConfirmReset={setConfirmReset} indent={false} />
                {(leaderMembers[leader.id] || []).map(m => (
                  <StaffCard key={m.id} s={m} roleInfo={roleInfo} currentStaff={currentStaff}
                    openEdit={openEdit} toggleActive={toggleActive} setConfirmReset={setConfirmReset} indent={true} />
                ))}
              </div>
            ))}

            {/* Non-leaders with no leader in dept */}
            {unassigned.map(s => (
              <StaffCard key={s.id} s={s} roleInfo={roleInfo} currentStaff={currentStaff}
                openEdit={openEdit} toggleActive={toggleActive} setConfirmReset={setConfirmReset} indent={false} />
            ))}
          </div>
        );
      })}

      {/* Staff without department */}
      {noDept.length > 0 && (
        <div>
          {depts.length > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", marginBottom: 8, paddingLeft: 4 }}>
              📋 Chưa xếp phòng ban
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {noDept.map(s => (
              <StaffCard key={s.id} s={s} roleInfo={roleInfo} currentStaff={currentStaff}
                openEdit={openEdit} toggleActive={toggleActive} setConfirmReset={setConfirmReset} indent={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffManager({ currentStaff }) {
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // null | {mode:"add"|"edit", data}
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [toast, setToast]   = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [roles, setRoles]           = useState(ROLES_FALLBACK);
  const [depts, setDepts]           = useState([]);
  const [confirmReset, setConfirmReset] = useState(null); // null | staff record

  function roleInfo(roleKey) {
    return roles.find(r => r.value===roleKey) || ROLES_FALLBACK.find(r=>r.value===roleKey) || ROLES_FALLBACK[0];
  }

  useEffect(() => { load(); loadWarehouses(); loadRoles(); loadDepts(); }, []);

  async function loadWarehouses() {
    try {
      const whs = await Warehouse.list({ limit: 50, filter: "is_active=true" });
      setWarehouses(whs);
    } catch {}
  }

  async function loadRoles() {
    try {
      const dbRoles = await Role.list({ limit: 100, sort: "sort_order" });
      if (dbRoles && dbRoles.length > 0) {
        setRoles(dbRoles.map(r => ({
          value: r.key,
          label: r.label,
          color: r.color || "#6b7280",
          bg:    r.bg    || "#f3f4f6",
          icon:  r.icon  || "👤",
        })));
      }
      // Nếu DB rỗng → giữ ROLES_FALLBACK
    } catch {
      // Lỗi mạng → giữ fallback, không crash
    }
  }

  async function loadDepts() {
    try {
      const ds = await Department.list({ sort:"sort_order", limit:50 });
      setDepts(ds||[]);
    } catch {}
  }

  async function load() {
    setLoading(true);
    try { const d = await Staff.list(); setList(d); } catch {}
    setLoading(false);
  }

  function openAdd() { setForm(EMPTY); setErr(""); setModal({ mode:"add" }); }
  function openEdit(s) {
    let wids = s.warehouse_ids || [];
    if (typeof wids === "string") { try { wids = JSON.parse(wids); } catch { wids = []; } }
    setForm({ ...s, password:"", warehouse_ids: Array.isArray(wids) ? wids : [], department_id: s.department_id||"" , is_leader: s.is_leader||false, leader_id: s.leader_id||"" });
    setErr("");
    setModal({ mode:"edit", id:s.id });
  }

  async function save() {
    setErr("");
    if (!form.full_name.trim()) { setErr("Cần nhập họ tên."); return; }
    if (!form.username.trim())  { setErr("Cần nhập username."); return; }
    if (modal.mode==="add" && !form.password) { setErr("Cần nhập mật khẩu tạm."); return; }
    // check duplicate username
    const dup = list.find(s => s.username===form.username.trim() && (modal.mode==="add" || s.id!==modal.id));
    if (dup) { setErr("Username đã tồn tại."); return; }

    setSaving(true);
    try {
      if (modal.mode==="add") {
        await Staff.create({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          username: form.username.trim(),
          role: form.role,
          password_hash: simpleHash(form.password),
          must_change_password: true,
          is_active: true,
          kpi_score: 100,
          note: form.note,
          warehouse_ids: form.warehouse_ids || [],
          department_id: form.department_id || "",
          is_leader: form.is_leader || false,
          leader_id: form.leader_id || "",
        });
        logAction(currentStaff, "create_staff", "staff", "", "Tao NV: " + form.full_name + " (" + form.role + ")");
        showToast("✅ Đã tạo tài khoản " + form.full_name);
      } else {
        const patch = {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          username: form.username.trim(),
          role: form.role,
          is_active: form.is_active,
          note: form.note,
          warehouse_ids: form.warehouse_ids || [],
          department_id: form.department_id || "",
          is_leader: form.is_leader || false,
          leader_id: form.leader_id || "",
        };
        if (form.password) { patch.password_hash = simpleHash(form.password); patch.must_change_password = true; }
        await Staff.update(modal.id, patch);
        logAction(currentStaff, "update", "staff", modal.id, "Sua NV: " + form.full_name + " (" + form.role + ")");
        showToast("✅ Đã cập nhật " + form.full_name);
      }
      setModal(null);
      load();
    } catch { setErr("Lỗi lưu dữ liệu."); }
    setSaving(false);
  }

  async function toggleActive(s) {
    await Staff.update(s.id, { is_active: !s.is_active });
    logAction(currentStaff, "update", "staff", s.id, (s.is_active ? "Khoa tai khoan: " : "Mo khoa tai khoan: ") + s.full_name);
    showToast(s.is_active ? `🔒 Đã khóa ${s.full_name}` : `🔓 Đã mở khóa ${s.full_name}`);
    load();
  }

  async function resetKpi(s) {
    await Staff.update(s.id, { kpi_score: 100 });
    logAction(currentStaff, "update", "staff", s.id, "Reset KPI " + s.full_name + " -> 100");
    showToast(`🔄 Reset KPI ${s.full_name} → 100`);
    load();
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  const filtered = list.filter(s => {
    const q = search.toLowerCase();
    const matchQ = !q || s.full_name?.toLowerCase().includes(q) || s.username?.toLowerCase().includes(q) || s.phone?.includes(q);
    const matchR = filterRole==="all" || s.role===filterRole;
    return matchQ && matchR;
  });

  return (
    <div style={{ padding:16, paddingBottom:100, maxWidth:900, margin:"0 auto" }}>
      <>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:"#1e1b4b" }}>👥 Quản lý nhân viên</div>
          <div style={{ fontSize:13, color:"#6b7280" }}>{list.filter(s=>s.is_active).length} đang hoạt động / {list.length} tổng</div>
        </div>
        <button onClick={openAdd}
          style={{ height:44, padding:"0 20px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer" }}>
          ＋ Thêm nhân viên
        </button>
      </div>

      {/* Filter */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Tìm tên, username, SĐT..."
          style={{ flex:1, minWidth:200, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none" }} />
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)}
          style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:13, background:"#fff", cursor:"pointer" }}>
          <option value="all">Tất cả vai trò</option>
          {roles.map(r=><option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
          <div style={{ fontSize:40 }}>👤</div>
          <div style={{ marginTop:8 }}>Chưa có nhân viên nào</div>
        </div>
      ) : (
        <StaffHierarchicalList
          filtered={filtered}
          depts={depts}
          roles={roles}
          roleInfo={roleInfo}
          currentStaff={currentStaff}
          openEdit={openEdit}
          toggleActive={toggleActive}
          setConfirmReset={setConfirmReset}
        />
      )}

      {/* Modal thêm/sửa */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e => { if(e.target===e.currentTarget) setModal(null); }}>
          <div style={{ background:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#1e1b4b", marginBottom:20 }}>
              {modal.mode==="add" ? "➕ Thêm nhân viên mới" : "✏️ Chỉnh sửa nhân viên"}
            </div>
            {[
              { label:"Họ tên *", key:"full_name", placeholder:"Nguyễn Văn A" },
              { label:"Số điện thoại", key:"phone", placeholder:"0901234567" },
              { label:"Username *", key:"username", placeholder:"nguyenvana" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>{f.label}</label>
                <input value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{ width:"100%", height:44, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Vai trò *</label>
              <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}
                style={{ width:"100%", height:44, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, background:"#fff", boxSizing:"border-box" }}>
                {roles.map(r=><option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>
                {modal.mode==="add" ? "Mật khẩu tạm *" : "Đặt lại mật khẩu (để trống nếu không đổi)"}
              </label>
              <input value={form.password||""} onChange={e=>setForm(p=>({...p,password:e.target.value}))}
                type="password" placeholder="Tối thiểu 6 ký tự..."
                style={{ width:"100%", height:44, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              {modal.mode==="add" && <div style={{ fontSize:11, color:"#6b7280", marginTop:4 }}>⚠️ Nhân viên sẽ bị yêu cầu đổi mật khẩu khi đăng nhập lần đầu.</div>}
            </div>
            {/* ── Phòng ban + Tổ trưởng ── */}
            <div style={{ marginBottom:16, display:"flex", gap:10, alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:6 }}>🏢 Phòng ban</label>
                <select value={form.department_id||""} onChange={e=>setForm(f=>({...f,department_id:e.target.value}))}
                  style={{ width:"100%", height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:14, background:"#fff" }}>
                  <option value="">-- Chưa xếp phòng --</option>
                  {depts.map(d=>(
                    <option key={d.id} value={d.id}>{d.icon||"🏢"} {d.name}</option>
                  ))}
                </select>
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", paddingBottom:8, whiteSpace:"nowrap" }}>
                <input type="checkbox" checked={!!form.is_leader} onChange={e=>setForm(f=>({...f,is_leader:e.target.checked, leader_id: e.target.checked ? "" : f.leader_id}))}
                  style={{ width:18, height:18, accentColor:"#f59e0b" }}/>
                <span style={{ fontSize:13, fontWeight:700, color:"#92400e" }}>🔭 Tổ trưởng</span>
              </label>
            </div>
            {/* ── Chọn tổ trưởng (chỉ hiện khi không phải leader) ── */}
            {!form.is_leader && form.department_id && (() => {
              const deptLeaders = list.filter(s => s.is_leader && s.department_id === form.department_id && s.is_active && s.id !== modal.id);
              if (deptLeaders.length === 0) return null;
              return (
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:6 }}>🔭 Tổ trưởng phụ trách</label>
                  <select value={form.leader_id||""} onChange={e=>setForm(f=>({...f,leader_id:e.target.value}))}
                    style={{ width:"100%", height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:14, background:"#fff" }}>
                    <option value="">-- Chọn tổ trưởng --</option>
                    {deptLeaders.map(l => (
                      <option key={l.id} value={l.id}>{l.full_name} (@{l.username})</option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* ── Phân quyền kho ── */}
            <div style={{ marginBottom:20, background:"#f8fafc", borderRadius:14, padding:"14px 16px", border:"1.5px solid #e5e7eb" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:4 }}>🏭 Kho được phép truy cập</div>
              <div style={{ fontSize:12, color:"#9ca3af", marginBottom:10 }}>Tích chọn kho được phép vào. Không tích = không được vào kho nào</div>
              {warehouses.length === 0 ? (
                <div style={{ fontSize:13, color:"#9ca3af" }}>Chưa có kho nào</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {warehouses.map(wh => {
                    const checked = (form.warehouse_ids || []).includes(wh.id);
                    return (
                      <label key={wh.id} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding:"8px 10px", borderRadius:10, background: checked ? "#ede9fe" : "#fff", border:`1.5px solid ${checked ? "#7c3aed" : "#e5e7eb"}`, transition:"all .15s" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const ids = form.warehouse_ids || [];
                            setForm(p => ({
                              ...p,
                              warehouse_ids: e.target.checked
                                ? [...ids, wh.id]
                                : ids.filter(id => id !== wh.id)
                            }));
                          }}
                          style={{ width:16, height:16, accentColor:"#7c3aed", cursor:"pointer" }}
                        />
                        <span style={{ flex:1, fontWeight:600, fontSize:14, color: checked ? "#5b21b6" : "#374151" }}>
                          🏭 {wh.name}
                        </span>
                        {wh.code && <span style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>{wh.code}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Ghi chú</label>
              <textarea value={form.note||""} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
                rows={2} placeholder="Ghi chú thêm..."
                style={{ width:"100%", borderRadius:10, border:"1.5px solid #e5e7eb", padding:"10px 12px", fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
            </div>
            {modal.mode==="edit" && (
              <div style={{ marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
                <input type="checkbox" id="activeChk" checked={form.is_active||false} onChange={e=>setForm(p=>({...p,is_active:e.target.checked}))} />
                <label htmlFor="activeChk" style={{ fontSize:13, fontWeight:700, color:"#374151", cursor:"pointer" }}>Tài khoản đang hoạt động</label>
              </div>
            )}
            {err && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:16, fontWeight:600 }}>⚠️ {err}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setModal(null)}
                style={{ flex:1, height:46, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                Hủy
              </button>
              <button onClick={save} disabled={saving}
                style={{ flex:2, height:46, borderRadius:12, border:"none", background:"#4f46e5", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                {saving ? "Đang lưu..." : modal.mode==="add" ? "Tạo tài khoản" : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      </>

      {/* Confirm Reset KPI */}
      {confirmReset && (
        <div onClick={() => setConfirmReset(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:6000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:"#fff", borderRadius:18, padding:28, maxWidth:380, width:"100%", boxShadow:"0 12px 40px rgba(0,0,0,.25)" }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <span className="material-icons" style={{ fontSize:52, color:"#f59e0b" }}>warning</span>
              <div style={{ fontSize:18, fontWeight:900, color:"#1e1b4b", marginTop:8 }}>Xác nhận reset KPI</div>
              <div style={{ fontSize:14, color:"#6b7280", marginTop:6 }}>
                Đặt lại điểm KPI của <b>{confirmReset.full_name}</b> về <b>100</b>?
              </div>
              <div style={{ fontSize:13, color:"#dc2626", marginTop:8, fontWeight:600 }}>
                Hành động này không thể hoàn tác.
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirmReset(null)}
                style={{ flex:1, height:46, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                Hủy
              </button>
              <button onClick={() => { resetKpi(confirmReset); setConfirmReset(null); }}
                style={{ flex:1, height:46, borderRadius:12, border:"none", background:"#f59e0b", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                🔄 Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff", borderRadius:14, padding:"12px 24px", fontSize:14, fontWeight:700, zIndex:5000, boxShadow:"0 8px 24px rgba(0,0,0,.3)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}// rebuild Tue May 26 11:09:24 UTC 2026