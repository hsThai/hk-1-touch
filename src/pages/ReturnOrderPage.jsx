/**
 * ReturnOrderPage.jsx — Xử lý Đổi trả & Bảo hành đổi mới
 * @version 2026-06-01-v1
 */
import React, { useState, useEffect } from "react";
import { CashJournal } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("vi-VN");
}
function genCode() {
  const d = new Date();
  return "DT-" + String(d.getFullYear()).slice(2)
    + String(d.getMonth()+1).padStart(2,"0")
    + String(d.getDate()).padStart(2,"0")
    + "-" + String(Math.floor(Math.random()*9999)).padStart(4,"0");
}

const RETURN_TYPES = [
  { key:"refund",   label:"💸 Hoàn tiền"        },
  { key:"exchange", label:"🔄 Đổi sản phẩm mới" },
  { key:"warranty", label:"🛡️ Bảo hành đổi mới" },
  { key:"repair",   label:"🔧 Sửa lại miễn phí" },
];

const REASONS = [
  "Hàng lỗi / không đúng mô tả",
  "Khách đổi ý",
  "Sản phẩm hỏng trong thời gian bảo hành",
  "Không đúng model / màu sắc",
  "Khác",
];

const STATUS_COLORS = {
  pending:    { bg:"#fef9c3", color:"#ca8a04", label:"⏳ Chờ xử lý"  },
  processing: { bg:"#eff6ff", color:"#2563eb", label:"🔄 Đang xử lý" },
  done:       { bg:"#f0fdf4", color:"#059669", label:"✅ Hoàn thành"  },
  cancelled:  { bg:"#f3f4f6", color:"#9ca3af", label:"❌ Huỷ"         },
};

const ADMIN_ROLES = ["owner","admin","manager","team_leader","cashier"];

// ── Form tạo đơn đổi trả ─────────────────────────────────
function ReturnForm({ user, onSave, onClose }) {
  const [form, setForm] = useState({
    code:           genCode(),
    return_type:    "refund",
    reason:         REASONS[0],
    customer_name:  "",
    customer_phone: "",
    ref_code:       "",
    product_name:   "",
    refund_amount:  0,
    note:           "",
    status:         "pending",
    return_date:    new Date().toISOString().slice(0,10),
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function save() {
    if (!form.customer_name.trim()) { alert("Nhập tên khách hàng"); return; }
    if (!form.product_name.trim())  { alert("Nhập tên sản phẩm/dịch vụ"); return; }
    setSaving(true);
    try {
      const { getPbUrl, getAuth } = await import("./pb.jsx");
      const { token } = getAuth();
      const res = await fetch(`${getPbUrl()}/api/collections/return_orders/records`, {
        method: "POST",
        headers: { "Content-Type":"application/json", ...(token ? { Authorization:token } : {}) },
        body: JSON.stringify({ ...form, created_by: user?.id }),
      });
      if (!res.ok) throw new Error("Lỗi lưu đơn (collection return_orders chưa tồn tại?)");

      // Nếu hoàn tiền → ghi sổ quỹ
      if (form.return_type === "refund" && form.refund_amount > 0) {
        const ok = window.confirm(`Ghi hoàn tiền ${fmtMoney(form.refund_amount)} vào Sổ quỹ?`);
        if (ok) {
          CashJournal.create({
            entry_type:   "payment",
            amount:        form.refund_amount,
            description:  `Hoàn tiền đổi trả — ${form.customer_name} — ${form.ref_code||form.code}`,
            journal_date:  form.return_date,
            ref_code:      form.code,
            ref_type:      "return",
          }).catch(()=>{});
        }
      }
      onSave();
    } catch(e) { alert("Lỗi: " + e.message); }
    setSaving(false);
  }

  const INP = {
    width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb",
    padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"min(520px,95vw)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontWeight:900, fontSize:17 }}>🔄 Tạo đơn Đổi trả / Bảo hành</div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", border:"none", background:"#f3f4f6", cursor:"pointer", fontSize:16 }}>✕</button>
        </div>

        {/* Mã đơn */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Mã đơn đổi trả</label>
          <input value={form.code} disabled style={{ ...INP, background:"#f9fafb", color:"#6b7280", marginTop:4 }} />
        </div>

        {/* Loại đổi trả */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Hình thức xử lý *</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
            {RETURN_TYPES.map(t => (
              <button key={t.key} onClick={() => set("return_type", t.key)} style={{
                padding:"6px 14px", borderRadius:20, border:"1.5px solid",
                borderColor: form.return_type===t.key ? "#6366f1" : "#e5e7eb",
                background:  form.return_type===t.key ? "#ede9fe" : "#fff",
                color:       form.return_type===t.key ? "#6366f1" : "#374151",
                fontWeight:700, fontSize:12, cursor:"pointer",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Thông tin khách */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Tên khách hàng *</label>
            <input value={form.customer_name} onChange={e=>set("customer_name",e.target.value)}
              placeholder="Nguyễn Văn A" style={{ ...INP, marginTop:4 }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>SĐT</label>
            <input value={form.customer_phone} onChange={e=>set("customer_phone",e.target.value)}
              placeholder="0909..." style={{ ...INP, marginTop:4 }} />
          </div>
        </div>

        {/* Mã đơn gốc + Ngày */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Mã đơn gốc (BL-/SC-)</label>
            <input value={form.ref_code} onChange={e=>set("ref_code",e.target.value)}
              placeholder="BL-260601-0001" style={{ ...INP, marginTop:4 }} />
          </div>
          <div>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Ngày đổi trả</label>
            <input type="date" value={form.return_date} onChange={e=>set("return_date",e.target.value)}
              style={{ ...INP, marginTop:4 }} />
          </div>
        </div>

        {/* Sản phẩm */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Tên sản phẩm / dịch vụ *</label>
          <input value={form.product_name} onChange={e=>set("product_name",e.target.value)}
            placeholder="iPhone 13 Pro Max / Thay màn hình..." style={{ ...INP, marginTop:4 }} />
        </div>

        {/* Lý do */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Lý do</label>
          <select value={form.reason} onChange={e=>set("reason",e.target.value)}
            style={{ ...INP, marginTop:4, background:"#fff" }}>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Số tiền hoàn — chỉ khi refund */}
        {form.return_type === "refund" && (
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:"#dc2626", fontWeight:600 }}>Số tiền hoàn lại (đ)</label>
            <input type="number" min={0} value={form.refund_amount}
              onChange={e=>set("refund_amount",Number(e.target.value))}
              style={{ ...INP, marginTop:4, borderColor:"#fca5a5" }} />
          </div>
        )}

        {/* Ghi chú */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Ghi chú</label>
          <textarea value={form.note} onChange={e=>set("note",e.target.value)} rows={2}
            style={{ ...INP, height:"auto", padding:"10px 12px", resize:"vertical", marginTop:4 }} />
        </div>

        <div style={{ display:"flex", gap:12 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", color:"#374151", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
          <button onClick={save} disabled={saving} style={{ flex:2, height:44, borderRadius:12, border:"none", background:"#6366f1", color:"#fff", fontWeight:800, cursor:"pointer", fontSize:15 }}>
            {saving ? "Đang lưu..." : "✅ Lưu đơn đổi trả"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function ReturnOrderPage({ user }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");

  const isAdmin = ADMIN_ROLES.includes(user?.role);

  async function load() {
    setLoading(true);
    try {
      const { getPbUrl, getAuth } = await import("./pb.jsx");
      const { token } = getAuth();
      const res = await fetch(
        `${getPbUrl()}/api/collections/return_orders/records?sort=-created&perPage=200`,
        { headers: token ? { Authorization: token } : {} }
      );
      if (res.ok) {
        const data = await res.json();
        setList(data.items || []);
      } else {
        setList([]);
      }
    } catch { setList([]); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const displayed = list.filter(r => {
    const matchSearch = !search || [r.customer_name, r.customer_phone, r.code, r.ref_code, r.product_name]
      .some(v => (v||"").toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === "all" || r.status === filter;
    return matchSearch && matchFilter;
  });

  const totalRefund = list.filter(r=>r.return_type==="refund").reduce((s,r)=>s+(r.refund_amount||0),0);

  return (
    <div style={{ padding:"20px 16px 80px", maxWidth:1200, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b" }}>🔄 Đổi trả & Bảo hành</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>Quản lý hoàn tiền, đổi sản phẩm, bảo hành đổi mới</div>
        </div>
        {isAdmin && (
          <button onClick={() => setModal(true)} style={{
            padding:"10px 20px", borderRadius:12, border:"none", background:"#6366f1",
            color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6,
          }}>
            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:18 }}>add</span>
            Tạo đơn đổi trả
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
        {[
          { label:"Tổng đơn",       val: list.length + " đơn",                                         color:"#4f46e5", bg:"#eff6ff" },
          { label:"Chờ xử lý",      val: list.filter(r=>r.status==="pending").length + " đơn",          color:"#ca8a04", bg:"#fef9c3" },
          { label:"Hoàn thành",     val: list.filter(r=>r.status==="done").length + " đơn",             color:"#059669", bg:"#f0fdf4" },
          { label:"Tổng hoàn tiền", val: fmtMoney(totalRefund),                                         color:"#dc2626", bg:"#fef2f2" },
        ].map((c,i) => (
          <div key={i} style={{ background:c.bg, borderRadius:14, padding:"14px 16px", border:"1.5px solid #e5e7eb" }}>
            <div style={{ fontSize:11, color:"#6b7280", fontWeight:600, marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:18, fontWeight:900, color:c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Tìm theo tên KH, mã đơn, sản phẩm..."
          style={{ flex:1, minWidth:200, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:13, outline:"none" }} />
        {["all","pending","processing","done","cancelled"].map(k => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding:"0 14px", height:40, borderRadius:10, border:"1.5px solid",
            borderColor: filter===k ? "#6366f1" : "#e5e7eb",
            background:  filter===k ? "#ede9fe" : "#fff",
            color:       filter===k ? "#6366f1" : "#6b7280",
            fontWeight:700, fontSize:12, cursor:"pointer",
          }}>
            {k==="all" ? "Tất cả" : (STATUS_COLORS[k]?.label || k)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div style={{ textAlign:"center", padding:40, color:"#6b7280" }}>⏳ Đang tải...</div>}

      {/* Empty state */}
      {!loading && displayed.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>
          <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:8 }}>swap_horiz</span>
          <div style={{ fontWeight:600 }}>
            {search || filter!=="all" ? "Không tìm thấy kết quả" : "Chưa có đơn đổi trả nào"}
          </div>
          {!search && filter==="all" && isAdmin && (
            <button onClick={() => setModal(true)} style={{ marginTop:12, padding:"8px 20px", borderRadius:10, border:"none", background:"#6366f1", color:"#fff", fontWeight:700, cursor:"pointer" }}>
              + Tạo đơn đầu tiên
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && displayed.length > 0 && (
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {[
                  ["Mã đơn","left"],["Khách hàng","left"],["Sản phẩm","left"],
                  ["Hình thức","left"],["Hoàn tiền","right"],["Ngày","left"],["Trạng thái","center"],
                ].map(([h,a]) => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:a, fontWeight:700, color:"#374151", borderBottom:"1.5px solid #e5e7eb", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(r => {
                const st = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                return (
                  <tr key={r.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"10px 14px", fontWeight:700, color:"#6366f1", whiteSpace:"nowrap" }}>{r.code}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ fontWeight:600 }}>{r.customer_name || "—"}</div>
                      {r.customer_phone && <div style={{ fontSize:11, color:"#9ca3af" }}>{r.customer_phone}</div>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div>{r.product_name || "—"}</div>
                      {r.ref_code && <div style={{ fontSize:11, color:"#6366f1" }}>📎 {r.ref_code}</div>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      {RETURN_TYPES.find(t=>t.key===r.return_type)?.label || r.return_type || "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700,
                      color: r.refund_amount>0 ? "#dc2626" : "#9ca3af" }}>
                      {r.refund_amount>0 ? fmtMoney(r.refund_amount) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", color:"#6b7280", whiteSpace:"nowrap" }}>
                      {fmtDate(r.return_date || r.created)}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"center" }}>
                      <span style={{ padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:st.bg, color:st.color }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ReturnForm
          user={user}
          onSave={() => { setModal(false); load(); }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
