/**
 * DepartmentPage.jsx
 * Sơ đồ tổ chức + Quản lý phòng ban
 * @version 2026-05-29-v1
 */
import { useState, useEffect } from "react";
import { Department, Staff } from "./pb.jsx";
import { ROLE_DEFINITIONS } from "./seedRoles.js";

const ROLE_MAP = Object.fromEntries(ROLE_DEFINITIONS.map(r => [r.key, r]));

const SEED_DEPTS = [
  { name:"KTV Điện thoại", code:"ktv_dt",     icon:"🔧", color:"#065f46", role_keys:["technician"],           sort_order:1 },
  { name:"KTV Máy Móc",    code:"ktv_mm",     icon:"⚙️", color:"#0369a1", role_keys:["mm_tech"],              sort_order:2 },
  { name:"Kho",            code:"kho",        icon:"📦", color:"#92400e", role_keys:["warehouse"],            sort_order:3 },
  { name:"Kế toán",        code:"ke_toan",    icon:"💰", color:"#dc2626", role_keys:["cashier","accountant"], sort_order:4 },
  { name:"Tiếp tân",       code:"tiep_tan",   icon:"💁", color:"#1d4ed8", role_keys:["receptionist"],         sort_order:5 },
  { name:"Kinh doanh",     code:"kinh_doanh", icon:"📈", color:"#7c3aed", role_keys:["sales"],                sort_order:6 },
  { name:"Marketing",      code:"marketing",  icon:"📣", color:"#db2777", role_keys:["marketing"],            sort_order:7 },
];

const FORM_EMPTY = { name:"", code:"", icon:"🏢", color:"#4f46e5", role_keys:[], sort_order:99 };

function AvatarChar({ name, size=32, color="#4f46e5" }) {
  const char = (name||"?")[0].toUpperCase();
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:color+"22", color, fontSize:size*0.45,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontWeight:800, flexShrink:0,
    }}>{char}</div>
  );
}

function Badge({ label, color="#4f46e5", bg }) {
  return (
    <span style={{
      background: bg || color+"18",
      color,
      borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:700,
      display:"inline-block", lineHeight:"18px",
    }}>{label}</span>
  );
}

function EditModal({ dept, onSave, onClose }) {
  const [form, setForm] = useState(dept
    ? { name:dept.name, code:dept.code, icon:dept.icon||"🏢", color:dept.color||"#4f46e5",
        role_keys: Array.isArray(dept.role_keys) ? dept.role_keys : [], sort_order:dept.sort_order||99 }
    : { ...FORM_EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const toggleRole = (key) => {
    setForm(f => ({
      ...f,
      role_keys: f.role_keys.includes(key)
        ? f.role_keys.filter(k => k !== key)
        : [...f.role_keys, key],
    }));
  };

  async function save() {
    if (!form.name.trim()) { setErr("Nhập tên phòng ban"); return; }
    setSaving(true);
    try {
      if (dept && dept.id) await Department.update(dept.id, form);
      else                 await Department.create(form);
      onSave();
    } catch(e) { setErr(e.message||"Lỗi lưu"); }
    setSaving(false);
  }

  const inputStyle = {
    width:"100%", height:40, borderRadius:10, border:"1.5px solid #e5e7eb",
    padding:"0 12px", fontSize:14, boxSizing:"border-box", outline:"none",
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.45)",
      zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center",
    }} onClick={onClose}>
      <div style={{
        background:"#fff", borderRadius:"20px 20px 0 0", padding:24,
        width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto",
        paddingBottom:40,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:18 }}>
          {dept ? "✏️ Sửa phòng ban" : "+ Thêm phòng ban"}
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <div style={{ flex:"0 0 72px" }}>
            <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Icon</label>
            <input value={form.icon} onChange={e => setForm(f => ({...f, icon:e.target.value}))}
              style={{ ...inputStyle, textAlign:"center", fontSize:22, padding:0 }} maxLength={4}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Tên phòng ban *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}
              placeholder="VD: KTV Điện thoại" style={inputStyle} />
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Mã (code)</label>
            <input value={form.code} onChange={e => setForm(f => ({...f, code:e.target.value}))}
              placeholder="ktv_dt" style={inputStyle} />
          </div>
          <div style={{ flex:"0 0 140px" }}>
            <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Màu</label>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color:e.target.value}))}
                style={{ width:40, height:40, border:"none", borderRadius:8, cursor:"pointer", padding:2 }}/>
              <input value={form.color} onChange={e => setForm(f => ({...f, color:e.target.value}))}
                style={{ ...inputStyle, flex:1, fontSize:12 }} maxLength={7}/>
            </div>
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:8 }}>
            Vai trò thuộc phòng này
          </label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {ROLE_DEFINITIONS.filter(r => !["owner","admin","manager","supervisor"].includes(r.key)).map(r => {
              const active = form.role_keys.includes(r.key);
              return (
                <button key={r.key} onClick={() => toggleRole(r.key)}
                  style={{
                    padding:"4px 10px", borderRadius:99, border:"1.5px solid",
                    borderColor: active ? r.color : "#e5e7eb",
                    background: active ? r.bg : "#f9fafb",
                    color: active ? r.color : "#6b7280",
                    fontSize:12, fontWeight:700, cursor:"pointer",
                  }}>
                  {r.icon} {r.label}
                </button>
              );
            })}
          </div>
        </div>
        {err && <div style={{ color:"#dc2626", fontSize:13, marginBottom:10 }}>⚠️ {err}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb",
              background:"#f9fafb", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            Hủy
          </button>
          <button onClick={save} disabled={saving}
            style={{ flex:2, height:44, borderRadius:12, border:"none",
              background: saving ? "#c7d2fe" : "#4f46e5", color:"#fff",
              fontSize:14, fontWeight:800, cursor:"pointer" }}>
            {saving ? "Đang lưu..." : "💾 Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageModal({ depts, onClose, onRefresh }) {
  const [editing, setEditing] = useState(null);

  async function deleteDept(d) {
    if (!window.confirm(`Xóa phòng ban "${d.name}"?`)) return;
    try { await Department.delete(d.id); onRefresh(); }
    catch(e) { alert("Lỗi xóa: " + e.message); }
  }

  if (editing !== null) {
    return <EditModal
      dept={editing || null}
      onSave={() => { setEditing(null); onRefresh(); }}
      onClose={() => setEditing(null)}
    />;
  }

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.45)",
      zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center",
    }} onClick={onClose}>
      <div style={{
        background:"#fff", borderRadius:"20px 20px 0 0", padding:24,
        width:"100%", maxWidth:540, maxHeight:"80vh", overflowY:"auto",
        paddingBottom:40,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>🏢 Quản lý phòng ban</div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Thêm, sửa, xóa phòng ban</div>
        <button onClick={() => setEditing(false)}
          style={{ width:"100%", height:40, borderRadius:10, border:"2px dashed #c7d2fe",
            background:"#f5f3ff", color:"#4f46e5", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
          + Thêm phòng ban
        </button>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {depts.map(d => (
            <div key={d.id} style={{
              background:"#f9fafb", borderRadius:12, padding:"10px 14px",
              display:"flex", alignItems:"center", gap:10,
              borderLeft:`4px solid ${d.color||"#4f46e5"}`,
            }}>
              <span style={{ fontSize:20 }}>{d.icon||"🏢"}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{d.name}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>
                  {(d.role_keys||[]).map(k => ROLE_MAP[k] ? ROLE_MAP[k].label : k).join(", ")}
                </div>
              </div>
              <button onClick={() => setEditing(d)}
                style={{ background:"#e0e7ff", border:"none", borderRadius:8,
                  width:32, height:32, cursor:"pointer", fontSize:14 }}>✏️</button>
              <button onClick={() => deleteDept(d)}
                style={{ background:"#fee2e2", border:"none", borderRadius:8,
                  width:32, height:32, cursor:"pointer", fontSize:14 }}>🗑️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeptCard({ dept, staffList }) {
  const [open, setOpen] = useState(true);
  const members = staffList.filter(s => s.department_id === dept.id);
  const roles   = dept.role_keys || [];

  return (
    <div style={{
      background:"#fff", borderRadius:16, overflow:"hidden",
      boxShadow:"0 2px 12px rgba(0,0,0,.06)",
      borderLeft:`4px solid ${dept.color||"#4f46e5"}`,
      marginBottom:12,
    }}>
      <div onClick={() => setOpen(o => !o)}
        style={{
          display:"flex", alignItems:"center", gap:12,
          padding:"14px 16px", cursor:"pointer",
          background: dept.color ? dept.color + "0d" : "#f5f3ff",
        }}>
        <span style={{ fontSize:22 }}>{dept.icon||"🏢"}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b" }}>{dept.name}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:4 }}>
            {roles.map(k => {
              const r = ROLE_MAP[k];
              return r
                ? <Badge key={k} label={r.icon + " " + r.label} color={r.color} bg={r.bg} />
                : <Badge key={k} label={k} />;
            })}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{
            background: (dept.color||"#4f46e5") + "22", color: dept.color||"#4f46e5",
            borderRadius:99, padding:"2px 10px", fontSize:12, fontWeight:700,
          }}>{members.length} NV</span>
          <span className="material-icons" style={{ color:"#9ca3af", fontSize:18 }}>
            {open ? "expand_less" : "expand_more"}
          </span>
        </div>
      </div>
      {open && (
        <div style={{ padding:"10px 16px 14px" }}>
          {members.length === 0
            ? <div style={{ color:"#9ca3af", fontSize:13, fontStyle:"italic", textAlign:"center", padding:"8px 0" }}>
                Chưa có nhân viên
              </div>
            : members.map(s => {
                const rDef = ROLE_MAP[s.role];
                return (
                  <div key={s.id} style={{
                    display:"flex", alignItems:"center", gap:10,
                    padding:"8px 0", borderBottom:"1px solid #f3f4f6",
                  }}>
                    <AvatarChar name={s.full_name} size={36} color={dept.color||"#4f46e5"} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>
                        {s.full_name}
                        {s.is_leader && (
                          <span style={{
                            marginLeft:6, background:"#fef9c3", color:"#92400e",
                            borderRadius:99, padding:"1px 7px", fontSize:11, fontWeight:700,
                          }}>🔭 Tổ trưởng</span>
                        )}
                      </div>
                      {rDef && <Badge label={rDef.icon + " " + rDef.label} color={rDef.color} bg={rDef.bg} />}
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}

export default function DepartmentPage({ user }) {
  const isAdmin = ["owner","admin","manager"].includes(user?.role);
  const [depts,     setDepts]   = useState([]);
  const [staffList, setStaff]   = useState([]);
  const [loading,   setLoading] = useState(true);
  const [showMgr,   setShowMgr] = useState(false);
  const [seeded,    setSeeded]  = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [ds, ss] = await Promise.all([
        Department.list({ sort:"sort_order", limit:50 }),
        Staff.list({ limit:300 }),
      ]);
      if ((ds||[]).length === 0 && !seeded) {
        setSeeded(true);
        for (const d of SEED_DEPTS) {
          try { await Department.create(d); } catch {}
        }
        const ds2 = await Department.list({ sort:"sort_order", limit:50 });
        setDepts(ds2||[]);
        setStaff(ss||[]);
      } else {
        setDepts(ds||[]);
        setStaff(ss||[]);
      }
    } catch(e) { console.error("DeptPage load:", e); }
    setLoading(false);
  }

  if (loading) return (
    <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>⏳ Đang tải...</div>
  );

  const topStaff = staffList.filter(s => ["owner","admin","manager"].includes(s.role));

  return (
    <div style={{ padding:"16px 14px 100px", maxWidth:600, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>🏢 Sơ đồ Phòng ban</div>
          <div style={{ fontSize:13, color:"#6b7280" }}>
            {depts.length} phòng · {staffList.filter(s => s.is_active !== false).length} nhân viên
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowMgr(true)}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:10,
              padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            ✏️ Chỉnh sửa
          </button>
        )}
      </div>

      {/* Root: Ban lãnh đạo */}
      <div style={{
        background:"linear-gradient(135deg,#1e1b4b,#312e81)",
        borderRadius:16, padding:"14px 18px", marginBottom:12,
        boxShadow:"0 4px 20px rgba(79,70,229,.3)",
      }}>
        <div style={{ color:"#fff", fontWeight:900, fontSize:15, marginBottom:8 }}>👑 Ban Lãnh đạo</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {topStaff.length === 0
            ? <div style={{ color:"#a5b4fc", fontSize:13 }}>Chưa có nhân sự</div>
            : topStaff.map(s => (
                <div key={s.id} style={{ display:"flex", alignItems:"center", gap:6,
                  background:"rgba(255,255,255,.12)", borderRadius:99, padding:"4px 10px 4px 4px" }}>
                  <AvatarChar name={s.full_name} size={26} color="#c7d2fe" />
                  <span style={{ color:"#e0e7ff", fontSize:12, fontWeight:700 }}>{s.full_name}</span>
                </div>
              ))
          }
        </div>
      </div>

      {/* Connector */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:4 }}>
        <div style={{ width:2, height:16, background:"#e5e7eb" }}/>
      </div>

      {/* Dept cards */}
      {depts.map(d => (
        <DeptCard key={d.id} dept={d} staffList={staffList} />
      ))}
      {depts.length === 0 && (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Chưa có phòng ban nào</div>
      )}

      {showMgr && (
        <ManageModal
          depts={depts}
          onClose={() => setShowMgr(false)}
          onRefresh={() => { setShowMgr(false); load(); }}
        />
      )}
    </div>
  );
}
