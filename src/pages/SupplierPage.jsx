/**
 * SupplierPage.jsx — Quản lý nhà cung cấp
 * @version 2026-05-29-v1
 */
import React, { useState, useEffect } from "react";
import { Supplier, StockImport, logAction } from "./pb.jsx";

const TYPES = {
  goods:    { label:"🏭 Hàng hóa",   color:"#d97706", bg:"#fef3c7" },
  shipping: { label:"🚚 Vận chuyển", color:"#2563eb", bg:"#dbeafe" },
  platform: { label:"🛒 Sàn TMĐT",  color:"#7c3aed", bg:"#f5f3ff" },
  other:    { label:"📦 Khác",       color:"#6b7280", bg:"#f3f4f6" },
};

const INP = { width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#fafafa" };
const SEL = { ...{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#fff" } };
const ADMIN = ["owner","admin","manager","accountant"];

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }

const EMPTY = { name:"", code:"", supplier_type:"goods", phone:"", email:"", address:"", contact_name:"", bank_account:"", bank_name:"", total_debt:0, note:"", is_active:true };

// ── Modal form ────────────────────────────────────────────
function SupplierModal({ init, onSave, onClose }) {
  const [form, setForm] = useState(init ? { ...init } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { setErr("Nhập tên nhà cung cấp"); return; }
    setSaving(true);
    try {
      if (init && init.id) { await Supplier.update(init.id, form); logAction(user, "update", "supplier", init.id, `Sửa NCC: ${form.name||""}`); }
      else                  { const s = await Supplier.create(form); logAction(user, "create", "supplier", s.id, `Tạo NCC: ${form.name||""}`); }
      onSave();
    } catch(e) { setErr(e.message || "Lỗi lưu"); }
    setSaving(false);
  }

  // KHÔNG dùng inline component F — gây mất focus mỗi lần gõ
  function field(label, key, type="text", placeholder="") {
    return (
      <div style={{ marginBottom:12 }}>
        <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>{label}</label>
        <input type={type} value={form[key]||""} onChange={e => set(key, e.target.value)}
          placeholder={placeholder} style={INP} />
      </div>
    );
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"24px 16px 40px", width:"100%", maxWidth:540, maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:18 }}>{init ? "✏️ Sửa nhà cung cấp" : "➕ Thêm nhà cung cấp"}</div>

        {field("Tên nhà cung cấp *", "name", "text", "Công ty ABC...")}
        {field("Mã NCC", "code", "text", "NCC-001")}

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Loại</label>
          <select value={form.supplier_type} onChange={e => set("supplier_type", e.target.value)} style={SEL}>
            {Object.entries(TYPES).map(([k,t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {field("SĐT", "phone", "tel", "0901234567")}
          {field("Email", "email", "email", "...")}
        </div>
        {field("Người liên hệ", "contact_name", "text", "Nguyễn Văn A")}
        {field("Địa chỉ", "address", "text", "123 đường...")}
        {field("Số tài khoản", "bank_account", "text", "0123456789")}
        {field("Ngân hàng", "bank_name", "text", "VCB, TCB...")}
        {field("Ghi chú", "note")}

        <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, cursor:"pointer" }}>
          <input type="checkbox" checked={!!form.is_active} onChange={e => set("is_active", e.target.checked)}
            style={{ width:18, height:18, accentColor:"#059669" }} />
          <span style={{ fontSize:13, fontWeight:700, color:"#374151" }}>Đang hoạt động</span>
        </label>

        {err && <div style={{ color:"#dc2626", fontSize:13, marginBottom:10 }}>⚠️ {err}</div>}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontSize:14, fontWeight:700, cursor:"pointer" }}>Hủy</button>
          <button onClick={save} disabled={saving} style={{ flex:2, height:44, borderRadius:12, border:"none", background:saving?"#c7d2fe":"#4f46e5", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer" }}>
            {saving ? "Đang lưu..." : "💾 Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function SupplierPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);  const isAdmin = ADMIN.includes(user?.role);
  const [list,            setList]            = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [modal,           setModal]           = useState(null); // null | false | supplier
  const [filter,          setFilter]          = useState("");
  const [toast,           setToast]           = useState("");
  const [selectedSupplier,setSelectedSupplier]= useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [histLoading,     setHistLoading]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await Supplier.list({ limit:200, sort:"name" });
      setList(data || []);
    } catch {}
    setLoading(false);
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function loadHistory(supplier) {
    setSelectedSupplier(supplier);
    setPurchaseHistory([]);
    setHistLoading(true);
    try {
      const imports = await StockImport.list({
        filter: `supplier_name="${supplier.name}"`,
        sort: "-id",
        limit: 100,
      });
      setPurchaseHistory(imports || []);
    } catch { setPurchaseHistory([]); }
    setHistLoading(false);
  }

  async function del(s) {
    if (!window.confirm(`Xóa nhà cung cấp "${s.name}"?`)) return;
    try { await Supplier.delete(s.id); logAction(user, "delete", "supplier", s.id, `Xóa NCC: ${s.name||""}`); showToast("🗑️ Đã xóa"); setList(l => l.filter(x => x.id !== s.id)); }
    catch(e) { showToast("❌ " + e.message); }
  }

  const filtered = list.filter(s =>
    !filter || s.supplier_type === filter
  );

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: isPC ? 1100 : "100%", margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>🏭 Nhà cung cấp</div>
          <div style={{ fontSize:13, color:"#6b7280" }}>{list.length} NCC</div>
        </div>
        {isAdmin && (
          <button onClick={() => setModal(false)}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            + Thêm NCC
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:16, WebkitOverflowScrolling:"touch" }}>
        <button onClick={() => setFilter("")}
          style={{ padding:"6px 14px", borderRadius:99, border:"1.5px solid", borderColor:filter===""?"#4f46e5":"#e5e7eb",
            background:filter===""?"#eef2ff":"#fff", color:filter===""?"#4f46e5":"#6b7280", fontWeight:700, fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>
          Tất cả ({list.length})
        </button>
        {Object.entries(TYPES).map(([k,t]) => {
          const cnt = list.filter(s => s.supplier_type === k).length;
          return (
            <button key={k} onClick={() => setFilter(k)}
              style={{ padding:"6px 14px", borderRadius:99, border:"1.5px solid", borderColor:filter===k?t.color:"#e5e7eb",
                background:filter===k?t.bg:"#fff", color:filter===k?t.color:"#6b7280", fontWeight:700, fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>
              {t.label} ({cnt})
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Chưa có nhà cung cấp nào</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(s => {
            const t = TYPES[s.supplier_type] || TYPES.other;
            return (
              <div key={s.id} style={{
                background:"#fff", borderRadius:16, padding:"14px 16px",
                border:"1.5px solid #e5e7eb", boxShadow:"0 2px 8px rgba(0,0,0,.04)",
                borderLeft:`4px solid ${t.color}`,
              }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b" }}>{s.name}</div>
                      {s.code && <span style={{ fontSize:11, color:"#9ca3af" }}>#{s.code}</span>}
                      <span style={{ background:t.bg, color:t.color, borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{t.label}</span>
                      {!s.is_active && <span style={{ background:"#f3f4f6", color:"#9ca3af", borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:700 }}>⏸ Ngưng HĐ</span>}
                    </div>
                    <div style={{ fontSize:13, color:"#6b7280", marginTop:4, display:"flex", flexWrap:"wrap", gap:12 }}>
                      {s.phone      && <span>📞 {s.phone}</span>}
                      {s.contact_name && <span>👤 {s.contact_name}</span>}
                      {s.bank_name  && <span>🏦 {s.bank_name} · {s.bank_account}</span>}
                    </div>
                    {(s.total_debt || 0) > 0 && (
                      <div style={{ marginTop:6, fontSize:13, fontWeight:700, color:"#dc2626" }}>
                        💰 Tổng nợ: {fmtMoney(s.total_debt)}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
                    <button onClick={() => loadHistory(s)} style={{
                      padding:"5px 10px", borderRadius:8, border:"1.5px solid #e0e7ff",
                      background: selectedSupplier?.id===s.id ? "#e0e7ff" : "#f5f3ff",
                      color:"#7c3aed", fontSize:12, fontWeight:600, cursor:"pointer"
                    }}>📋 Lịch sử</button>
                    {isAdmin && <>
                      <button onClick={() => setModal(s)}
                        style={{ background:"#e0e7ff", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:14 }}>✏️</button>
                      <button onClick={() => del(s)}
                        style={{ background:"#fee2e2", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:14 }}>🗑️</button>
                    </>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel lịch sử NCC */}
      {selectedSupplier && (
        <div style={{ marginTop:20, background:"#fff", borderRadius:16, border:"1.5px solid #6366f1", padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:16 }}>📦 Lịch sử mua hàng</div>
              <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>{selectedSupplier.name}</div>
            </div>
            <button onClick={() => setSelectedSupplier(null)} style={{
              width:32, height:32, borderRadius:"50%", border:"none",
              background:"#f3f4f6", cursor:"pointer", fontSize:16
            }}>✕</button>
          </div>

          {histLoading && <div style={{ textAlign:"center", padding:24, color:"#6b7280" }}>⏳ Đang tải...</div>}

          {!histLoading && purchaseHistory.length === 0 && (
            <div style={{ textAlign:"center", padding:32, color:"#9ca3af" }}>
              <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:40, display:"block", marginBottom:8 }}>inbox</span>
              Chưa có lịch sử nhập hàng từ NCC này
            </div>
          )}

          {!histLoading && purchaseHistory.length > 0 && (
            <>
              {/* Tổng kết */}
              <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                {[
                  { label:"Số lần nhập", val: purchaseHistory.length + " lần", color:"#4f46e5" },
                  { label:"Tổng giá trị", val: purchaseHistory.reduce((s,i)=>s+(i.total_value||i.total_amount||0),0).toLocaleString("vi-VN")+"đ", color:"#059669" },
                ].map((c,i) => (
                  <div key={i} style={{ flex:1, minWidth:140, background:"#f8fafc", borderRadius:12, padding:"12px 16px", borderLeft:`4px solid ${c.color}` }}>
                    <div style={{ fontSize:12, color:"#6b7280" }}>{c.label}</div>
                    <div style={{ fontSize:16, fontWeight:800, color:c.color, marginTop:4 }}>{c.val}</div>
                  </div>
                ))}
              </div>

              {/* Bảng lịch sử */}
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"#f3f4f6" }}>
                      <th style={{ padding:"8px 10px", textAlign:"left" }}>Ngày nhập</th>
                      <th style={{ padding:"8px 10px", textAlign:"left" }}>Mã phiếu</th>
                      <th style={{ padding:"8px 10px", textAlign:"right" }}>Tổng tiền</th>
                      <th style={{ padding:"8px 10px", textAlign:"center" }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseHistory.map(imp => (
                      <tr key={imp.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                        <td style={{ padding:"8px 10px", color:"#374151" }}>
                          {new Date(imp.import_date||imp.created||imp.created_date).toLocaleDateString("vi-VN")}
                        </td>
                        <td style={{ padding:"8px 10px", color:"#6366f1", fontWeight:600 }}>
                          {imp.import_code || imp.code || imp.id?.slice(-6)}
                        </td>
                        <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:"#059669" }}>
                          {(imp.total_value||imp.total_amount||0).toLocaleString("vi-VN")}đ
                        </td>
                        <td style={{ padding:"8px 10px", textAlign:"center" }}>
                          <span style={{
                            padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                            background: imp.status==="confirmed"||imp.status==="completed"?"#dcfce7": imp.status==="pending"?"#fef9c3":"#f3f4f6",
                            color:      imp.status==="confirmed"||imp.status==="completed"?"#059669": imp.status==="pending"?"#ca8a04":"#6b7280",
                          }}>
                            {imp.status==="confirmed"||imp.status==="completed"?"✅ Xong": imp.status==="pending"?"⏳ Chờ":"—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <SupplierModal
          init={modal || null}
          onSave={() => { setModal(null); load(); showToast("✅ Đã lưu nhà cung cấp"); }}
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff", borderRadius:14, padding:"12px 24px", fontSize:14, fontWeight:700, zIndex:9999, boxShadow:"0 8px 24px rgba(0,0,0,.3)", whiteSpace:"nowrap" }}>{toast}</div>
      )}
    </div>
  );
}
