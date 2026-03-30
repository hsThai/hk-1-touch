/* BUILD:1774859185-72587 */
import { useState, useEffect } from "react";
import { Customer, RepairOrder } from "@/api/entities";

const EMPTY = { full_name:"", phone:"", address:"", note:"" };

export default function CustomerManager({ onSelectCustomer }) {
  const [list, setList]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [detail, setDetail]   = useState(null); // customer history
  const [orders, setOrders]   = useState([]);
  const [toast, setToast]     = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const d = await Customer.list("-created_date"); setList(d); } catch {}
    setLoading(false);
  }

  async function openDetail(c) {
    setDetail(c);
    try {
      const ords = await RepairOrder.filter({ customer_phone: c.phone });
      setOrders(ords.sort((a,b) => new Date(b.created_date)-new Date(a.created_date)));
    } catch { setOrders([]); }
  }

  function openAdd()  { setForm(EMPTY); setErr(""); setModal({ mode:"add" }); }
  function openEdit(c){ setForm(c); setErr(""); setModal({ mode:"edit", id:c.id }); }

  async function save() {
    setErr("");
    if (!form.full_name.trim()) { setErr("Cần nhập họ tên."); return; }
    if (!form.phone.trim())     { setErr("Cần nhập số điện thoại."); return; }
    setSaving(true);
    try {
      if (modal.mode==="add") {
        await Customer.create({ ...form, full_name:form.full_name.trim(), phone:form.phone.trim() });
        showToast("✅ Đã thêm khách hàng");
      } else {
        await Customer.update(modal.id, form);
        showToast("✅ Đã cập nhật khách hàng");
      }
      setModal(null); load();
    } catch { setErr("Lỗi lưu dữ liệu."); }
    setSaving(false);
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""),2500); }

  const filtered = list.filter(c => {
    const q = search.toLowerCase();
    return !q || c.full_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.address?.toLowerCase().includes(q);
  });

  const STATUS_COLOR = {
    "Tiếp nhận":"#3b82f6","Đang sửa":"#f59e0b","Chờ linh kiện":"#8b5cf6",
    "Hoàn thành":"#10b981","Bàn giao":"#6b7280","Huỷ":"#ef4444"
  };

  return (
    <div style={{ padding:16, maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900, color:"#1e1b4b" }}>👤 Quản lý khách hàng</div>
          <div style={{ fontSize:13, color:"#6b7280" }}>{list.length} khách hàng</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {onSelectCustomer && <div style={{ fontSize:12, color:"#6b7280", alignSelf:"center" }}>Chọn khách để điền vào đơn</div>}
          <button onClick={openAdd}
            style={{ height:44, padding:"0 20px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer" }}>
            ＋ Thêm khách
          </button>
        </div>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="🔍 Tìm tên, số điện thoại, địa chỉ..."
        style={{ width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", marginBottom:16, boxSizing:"border-box" }} />

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Đang tải...</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
          <div style={{ fontSize:40 }}>👤</div>
          <div style={{ marginTop:8 }}>Không tìm thấy khách hàng</div>
          <button onClick={openAdd} style={{ marginTop:12, padding:"10px 24px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, fontWeight:700, cursor:"pointer" }}>
            Thêm khách mới
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background:"#fff", borderRadius:14, padding:14, boxShadow:"0 2px 10px rgba(0,0,0,.06)", border:"1.5px solid #f3f4f6", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#eef2ff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>👤</div>
              <div style={{ flex:1, minWidth:140 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b" }}>{c.full_name}</div>
                <div style={{ fontSize:13, color:"#6b7280" }}>📞 {c.phone} {c.address ? `· 📍 ${c.address}` : ""}</div>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                {onSelectCustomer && (
                  <button onClick={() => onSelectCustomer(c)}
                    style={{ height:36, padding:"0 14px", borderRadius:10, border:"none", background:"#ecfdf5", color:"#065f46", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                    ✔ Chọn
                  </button>
                )}
                <button onClick={() => openDetail(c)}
                  style={{ height:36, padding:"0 14px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  📋 Lịch sử
                </button>
                <button onClick={() => openEdit(c)}
                  style={{ height:36, padding:"0 14px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  ✏️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal thêm/sửa */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e=>{ if(e.target===e.currentTarget) setModal(null); }}>
          <div style={{ background:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:440 }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#1e1b4b", marginBottom:20 }}>
              {modal.mode==="add" ? "➕ Thêm khách hàng" : "✏️ Sửa thông tin khách"}
            </div>
            {[
              { label:"Họ tên *", key:"full_name", placeholder:"Nguyễn Văn A" },
              { label:"Số điện thoại *", key:"phone", placeholder:"0901234567" },
              { label:"Địa chỉ", key:"address", placeholder:"123 Đường ABC, Q.1, TP.HCM" },
            ].map(f=>(
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>{f.label}</label>
                <input value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{ width:"100%", height:44, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Ghi chú</label>
              <textarea value={form.note||""} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
                rows={2} placeholder="VIP, hay trả chậm, v.v..."
                style={{ width:"100%", borderRadius:10, border:"1.5px solid #e5e7eb", padding:"10px 12px", fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
            </div>
            {err && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:16, fontWeight:600 }}>⚠️ {err}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setModal(null)} style={{ flex:1, height:46, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, fontSize:14, cursor:"pointer" }}>Hủy</button>
              <button onClick={save} disabled={saving} style={{ flex:2, height:46, borderRadius:12, border:"none", background:"#4f46e5", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                {saving ? "Đang lưu..." : modal.mode==="add" ? "Thêm khách" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lịch sử */}
      {detail && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e=>{ if(e.target===e.currentTarget) setDetail(null); }}>
          <div style={{ background:"#fff", borderRadius:20, padding:24, width:"100%", maxWidth:520, maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div style={{ fontSize:17, fontWeight:900, color:"#1e1b4b" }}>📋 {detail.full_name}</div>
                <div style={{ fontSize:13, color:"#6b7280" }}>📞 {detail.phone}</div>
              </div>
              <button onClick={()=>setDetail(null)} style={{ background:"#f3f4f6", border:"none", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:14 }}>✕</button>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:"#374151", marginBottom:10 }}>Lịch sử sửa chữa ({orders.length} đơn)</div>
            {orders.length===0 ? (
              <div style={{ textAlign:"center", padding:24, color:"#9ca3af" }}>Chưa có đơn nào</div>
            ) : orders.map(o => (
              <div key={o.id} style={{ background:"#f9fafb", borderRadius:12, padding:12, marginBottom:8, border:"1px solid #f3f4f6" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontWeight:800, color:"#4f46e5", fontSize:14 }}>{o.order_code}</span>
                  <span style={{ background: STATUS_COLOR[o.status]+"22", color:STATUS_COLOR[o.status], fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{o.status}</span>
                </div>
                <div style={{ fontSize:13, color:"#374151", marginTop:4 }}>{o.device_model} {o.imei ? `· ${o.imei}` : ""}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{o.issue_description}</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:12, color:"#9ca3af" }}>
                  <span>{o.received_date ? new Date(o.received_date).toLocaleDateString("vi-VN") : new Date(o.created_date).toLocaleDateString("vi-VN")}</span>
                  {o.final_cost > 0 && <span style={{ fontWeight:700, color:"#065f46" }}>{o.final_cost?.toLocaleString()}đ</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff", borderRadius:14, padding:"12px 24px", fontSize:14, fontWeight:700, zIndex:5000 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
