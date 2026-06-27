/* DebtNccPage.jsx — Công nợ NCC — HK One Touch */
import React, { useState, useEffect, useCallback } from "react";
import { Supplier, DebtVoucher, DebtPayment, CashJournal } from "./pb.jsx";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ background: bg||"#fff", border:`1.5px solid ${color}30`, borderRadius:14,
      padding:"16px 18px", flex:1, minWidth:150 }}>
      <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:12, color:"#6b7280", marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:19, fontWeight:800, color }}>{value}</div>
    </div>
  );
}

function PaymentModal({ supplier, onClose, onSaved, user }) {
  const [amount,  setAmount]  = useState("");
  const [method,  setMethod]  = useState("cash");
  const [note,    setNote]    = useState("");
  const [saving,  setSaving]  = useState(false);

  async function handlePay() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { alert("Nhập số tiền hợp lệ"); return; }
    setSaving(true);
    try {
      // Tạo debt_payment
      await DebtPayment.create({
        supplier_id:   supplier.id,
        supplier_name: supplier.name,
        amount:        amt,
        payment_method: method,
        type:          "payable",
        note,
        paid_by:       user?.id || "",
        paid_by_name:  user?.full_name || "",
        paid_at:       new Date().toISOString().slice(0,10),
      });
      // Cập nhật total_debt của NCC
      const newDebt = Math.max(0, (Number(supplier.total_debt)||0) - amt);
      await Supplier.update(supplier.id, { total_debt: newDebt });
      // Ghi sổ quỹ
      if (method === "cash") {
        await CashJournal.create({
          type:        "expense",
          category:    "Trả nợ NCC",
          amount:      amt,
          note:        `Thanh toán nợ NCC: ${supplier.name}. ${note}`,
          ref_type:    "debt_payment",
          created_by:  user?.id || "",
          created_by_name: user?.full_name || "",
        });
      }
      onSaved?.();
      onClose();
    } catch(e) { alert("Lỗi: " + e.message); }
    setSaving(false);
  }

  return (
    <div onClick={e => { if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:420,
        boxShadow:"0 20px 60px rgba(0,0,0,.25)", padding:24 }}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>💳 Ghi nhận thanh toán NCC</div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:18 }}>{supplier.name}</div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#6b7280", display:"block", marginBottom:4 }}>Số tiền thanh toán *</label>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
            placeholder="0" min="0"
            style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e5e7eb",
              fontSize:15, fontWeight:700, boxSizing:"border-box" }} />
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:3 }}>
            Còn nợ: {fmt(supplier.total_debt)}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#6b7280", display:"block", marginBottom:4 }}>Phương thức</label>
          <select value={method} onChange={e=>setMethod(e.target.value)}
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e5e7eb", fontSize:14 }}>
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản</option>
            <option value="other">Khác</option>
          </select>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#6b7280", display:"block", marginBottom:4 }}>Ghi chú</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Ghi chú..." rows={2}
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e5e7eb",
              fontSize:14, resize:"vertical", boxSizing:"border-box" }} />
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding:"10px 18px", borderRadius:10, border:"1.5px solid #e5e7eb",
              background:"#f9fafb", color:"#374151", fontSize:14, fontWeight:600, cursor:"pointer" }}>
            Huỷ
          </button>
          <button onClick={handlePay} disabled={saving}
            style={{ padding:"10px 22px", borderRadius:10, border:"none",
              background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff",
              fontSize:14, fontWeight:700, cursor:"pointer" }}>
            {saving ? "⏳..." : "✅ Xác nhận thanh toán"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DebtNccPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const [suppliers, setSuppliers] = useState([]);
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [toast,     setToast]     = useState("");
  const [activeTab, setActiveTab] = useState("list"); // list | history

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""), 3000); };

  const canManage = ["owner","admin","manager","supervisor","accountant"].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sups, pays] = await Promise.all([
        Supplier.list({ sort:"-total_debt", limit:200 }).catch(()=>[]),
        DebtPayment.list({ filter:'type="payable"', sort:"-id", limit:100 }).catch(()=>[]),
      ]);
      setSuppliers(sups || []);
      setHistory(pays || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalDebt   = suppliers.reduce((s,x) => s + Number(x.total_debt||0), 0);
  const paidMonth   = (() => {
    const now = new Date();
    const ym  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    return history
      .filter(p => p.paid_at?.startsWith(ym))
      .reduce((s,p) => s + Number(p.amount||0), 0);
  })();
  const remaining = Math.max(0, totalDebt - paidMonth);

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth:1100, margin:"0 auto" }}>
      {toast && (
        <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
          background:"#1e293b", color:"#fff", padding:"10px 20px", borderRadius:12,
          fontSize:14, fontWeight:600, zIndex:9999, pointerEvents:"none" }}>{toast}</div>
      )}

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:20, fontWeight:800, color:"#1e1b4b" }}>💳 Công nợ NCC</div>
        <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>Quản lý công nợ với nhà cung cấp</div>
      </div>

      {/* Stat cards */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <StatCard icon="🏦" label="Tổng nợ NCC"         value={fmt(totalDebt)}   color="#dc2626" bg="#fef2f2" />
        <StatCard icon="✅" label="Đã trả tháng này"     value={fmt(paidMonth)}   color="#059669" bg="#f0fdf4" />
        <StatCard icon="⏳" label="Còn phải trả"         value={fmt(remaining)}   color="#d97706" bg="#fffbeb" />
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[["list","Danh sách NCC"],["history","Lịch sử thanh toán"]].map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{ padding:"8px 18px", borderRadius:8,
              border: activeTab===k?"none":"1.5px solid #e5e7eb",
              background: activeTab===k?"#4f46e5":"#fff",
              color: activeTab===k?"#fff":"#374151",
              fontWeight:600, fontSize:13, cursor:"pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : activeTab === "list" ? (
        suppliers.filter(s => Number(s.total_debt||0) > 0).length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
            <div style={{ fontWeight:600 }}>Không có công nợ NCC nào</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {suppliers.filter(s => Number(s.total_debt||0) > 0).map(s => (
              <div key={s.id} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:14, padding:"14px 16px",
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:"#1e1b4b" }}>{s.name}</div>
                  {s.phone && <div style={{ fontSize:12, color:"#6b7280" }}>{s.phone}</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:"#dc2626" }}>{fmt(s.total_debt)}</div>
                  {canManage && (
                    <button onClick={() => setPayTarget(s)}
                      style={{ marginTop:6, padding:"5px 14px", borderRadius:8, border:"none",
                        background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff",
                        fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      Thanh toán
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        history.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Chưa có lịch sử thanh toán</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f9fafb" }}>
                  {["NCC","Số tiền","Phương thức","Ngày trả","Người trả","Ghi chú"].map(h => (
                    <th key={h} style={{ padding:"9px 10px", textAlign:h==="Số tiền"?"right":"left",
                      fontWeight:600, color:"#6b7280", borderBottom:"1.5px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"8px 10px", fontWeight:600 }}>{p.supplier_name || "—"}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:"#059669" }}>{fmt(p.amount)}</td>
                    <td style={{ padding:"8px 10px", color:"#6b7280" }}>
                      {p.payment_method === "cash" ? "💵 Tiền mặt" : p.payment_method === "transfer" ? "🏦 Chuyển khoản" : p.payment_method}
                    </td>
                    <td style={{ padding:"8px 10px", color:"#374151" }}>{fmtDate(p.paid_at)}</td>
                    <td style={{ padding:"8px 10px", color:"#374151" }}>{p.paid_by_name || "—"}</td>
                    <td style={{ padding:"8px 10px", color:"#6b7280", fontStyle:"italic" }}>{p.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {payTarget && (
        <PaymentModal
          supplier={payTarget}
          user={user}
          onClose={() => setPayTarget(null)}
          onSaved={() => { showToast("✅ Đã ghi nhận thanh toán"); load(); }}
        />
      )}
    </div>
  );
}
