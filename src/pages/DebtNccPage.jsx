/* DebtNccPage.jsx — Công nợ NCC — HK One Touch
   Rewritten 2026-08-17: nguồn dữ liệu công nợ thực tế là 'debt_vouchers'
   (được tạo tự động khi nhập hàng còn nợ NCC ở WarehouseApp.jsx), KHÔNG phải
   Supplier.total_debt — field đó không hề được ghi ở bất kỳ đâu trong hệ thống.
*/
import React, { useState, useEffect, useCallback } from "react";
import { DebtVoucher, DebtPayment, CashJournal, logAction, getLocalDate } from "./pb.jsx";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

const STATUS = {
  open:      { label:"🔴 Chưa TT",    color:"#dc2626", bg:"#fee2e2" },
  partial:   { label:"🟡 TT 1 phần",  color:"#d97706", bg:"#fef3c7" },
  paid:      { label:"🟢 Đã TT",      color:"#059669", bg:"#dcfce7" },
  overdue:   { label:"⛔ Quá hạn",    color:"#7c2d12", bg:"#fee2e2" },
  cancelled: { label:"⚫ Đã hủy",     color:"#6b7280", bg:"#f3f4f6" },
};

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

// ── Ghi nhận thanh toán cho 1 phiếu công nợ (đồng bộ với DebtPage.jsx) ─────
async function recordPayment(voucher, amount, method, note, user) {
  await DebtPayment.create({
    voucher_id:      voucher.id,
    voucher_code:    voucher.voucher_code,
    party_name:      voucher.party_name,
    amount:          Number(amount),
    payment_method:  method,
    paid_at:         new Date().toISOString(),
    note,
    created_by_id:   user?.id || "",
    created_by_name: user?.full_name || user?.name || "",
  });
  const newPaid      = (voucher.paid_amount || 0) + Number(amount);
  const newRemaining = Math.max(0, (voucher.total_amount || 0) - newPaid);
  const newStatus     = newRemaining <= 0 ? "paid" : "partial";
  await DebtVoucher.update(voucher.id, { paid_amount:newPaid, remaining:newRemaining, status:newStatus });
  logAction(user, "pay_debt", "debt_voucher", voucher.id, `Trả nợ NCC ${voucher.party_name}: ${Number(amount).toLocaleString("vi-VN")}đ (${method})`);
  if (method === "cash" || method === "transfer") {
    await CashJournal.create({
      journal_date:    getLocalDate(),
      entry_type:      "payment", amount: Number(amount),
      ref_type:        "debt_payment", ref_id: voucher.id, ref_code: voucher.voucher_code,
      description:     "Trả nợ NCC: " + voucher.party_name,
      payment_method:  method,
      created_by_id:   user?.id || "",
      created_by_name: user?.full_name || user?.name || "",
    });
  }
}

function PaymentModal({ voucher, onClose, onSaved, user }) {
  const [amount, setAmount] = useState(String(voucher.remaining || 0));
  const [method, setMethod] = useState("cash");
  const [note,   setNote]   = useState("");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  async function handlePay() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setErr("Nhập số tiền hợp lệ"); return; }
    if (amt > (voucher.remaining || 0)) { setErr("Số tiền vượt quá số còn lại của phiếu này"); return; }
    setSaving(true);
    try {
      await recordPayment(voucher, amt, method, note, user);
      onSaved?.();
      onClose();
    } catch(e) { setErr("Lỗi: " + e.message); }
    setSaving(false);
  }

  return (
    <div onClick={e => { if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:420,
        boxShadow:"0 20px 60px rgba(0,0,0,.25)", padding:24 }}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>💳 Ghi nhận thanh toán NCC</div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:4 }}>{voucher.party_name}</div>
        <div style={{ fontSize:12, color:"#9ca3af", marginBottom:18 }}>Phiếu {voucher.voucher_code} · {voucher.origin_code || ""}</div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#6b7280", display:"block", marginBottom:4 }}>Số tiền thanh toán *</label>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)}
            placeholder="0" min="0"
            style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e5e7eb",
              fontSize:15, fontWeight:700, boxSizing:"border-box" }} />
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:3 }}>
            Còn nợ phiếu này: {fmt(voucher.remaining)}
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

        {err && <div style={{ color:"#dc2626", fontSize:13, marginBottom:12 }}>⚠️ {err}</div>}

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
  const [vouchers,  setVouchers]  = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [expanded,  setExpanded]  = useState(null); // party_name đang mở rộng danh sách phiếu
  const [toast,     setToast]     = useState("");
  const [activeTab, setActiveTab] = useState("list");

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""), 3000); };

  const canManage = ["owner","admin","manager","supervisor","accountant"].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const vs = await DebtVoucher.filter({ voucher_type:"payable" }, { sort:"-id", limit:500 }).catch(()=>[]);
      setVouchers(vs || []);
      const ids = new Set((vs||[]).map(v=>v.id));
      const pays = await DebtPayment.list({ sort:"-id", limit:500 }).catch(()=>[]);
      setPayments((pays||[]).filter(p => ids.has(p.voucher_id)));
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Nhóm theo NCC (party_name) — chỉ tính các phiếu chưa hủy
  const bySupplier = {};
  vouchers.filter(v => v.status !== "cancelled").forEach(v => {
    const key = v.party_name || "—";
    if (!bySupplier[key]) bySupplier[key] = { name:key, vouchers:[], totalDebt:0, totalEver:0 };
    bySupplier[key].vouchers.push(v);
    bySupplier[key].totalDebt += Number(v.remaining || 0);
    bySupplier[key].totalEver += Number(v.total_amount || 0);
  });
  const supplierList = Object.values(bySupplier).sort((a,b) => b.totalDebt - a.totalDebt);
  const supplierListWithDebt = supplierList.filter(s => s.totalDebt > 0);

  const totalDebtEver = vouchers.filter(v=>v.status!=="cancelled").reduce((s,v) => s + Number(v.total_amount||0), 0);
  const remaining     = vouchers.filter(v=>v.status!=="cancelled").reduce((s,v) => s + Number(v.remaining||0), 0);
  const paidMonth = (() => {
    const now = new Date();
    const ym  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    return payments
      .filter(p => (p.paid_at||"").slice(0,7) === ym)
      .reduce((s,p) => s + Number(p.amount||0), 0);
  })();

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
        <StatCard icon="🏦" label="Tổng nợ NCC (lũy kế)" value={fmt(totalDebtEver)} color="#4f46e5" bg="#eef2ff" />
        <StatCard icon="✅" label="Đã trả tháng này"     value={fmt(paidMonth)}    color="#059669" bg="#f0fdf4" />
        <StatCard icon="⏳" label="Còn phải trả"         value={fmt(remaining)}    color="#d97706" bg="#fffbeb" />
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
        supplierListWithDebt.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
            <div style={{ fontWeight:600 }}>Không có công nợ NCC nào</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {supplierListWithDebt.map(s => {
              const openVouchers = s.vouchers.filter(v => (v.remaining||0) > 0).sort((a,b)=>(a.id>b.id?1:-1));
              const isOpen = expanded === s.name;
              return (
                <div key={s.name} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:14, overflow:"hidden" }}>
                  <div onClick={() => setExpanded(isOpen ? null : s.name)}
                    style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, cursor:"pointer" }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:"#1e1b4b" }}>{s.name}</div>
                      <div style={{ fontSize:12, color:"#6b7280" }}>{openVouchers.length} phiếu chưa trả hết</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:18, fontWeight:800, color:"#dc2626" }}>{fmt(s.totalDebt)}</div>
                      <div style={{ fontSize:11, color:"#9ca3af" }}>{isOpen ? "▲ Thu gọn" : "▼ Xem chi tiết"}</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop:"1px solid #f3f4f6" }}>
                      {openVouchers.map(v => {
                        const st = STATUS[v.status] || STATUS.open;
                        return (
                          <div key={v.id} style={{ padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between",
                            gap:10, borderBottom:"1px solid #f9fafb" }}>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700 }}>{v.voucher_code} {v.origin_code ? `· ${v.origin_code}` : ""}</div>
                              <div style={{ fontSize:11, color:"#9ca3af" }}>
                                Tổng {fmt(v.total_amount)} · Đã trả {fmt(v.paid_amount)} ·{" "}
                                <span style={{ color:st.color, fontWeight:700 }}>{st.label}</span>
                              </div>
                            </div>
                            <div style={{ textAlign:"right", display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ fontSize:14, fontWeight:800, color:"#dc2626" }}>{fmt(v.remaining)}</div>
                              {canManage && (
                                <button onClick={(e) => { e.stopPropagation(); setPayTarget(v); }}
                                  style={{ padding:"5px 12px", borderRadius:8, border:"none",
                                    background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff",
                                    fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                                  Trả
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        payments.length === 0 ? (
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
                {payments.map(p => (
                  <tr key={p.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"8px 10px", fontWeight:600 }}>{p.party_name || "—"}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:"#059669" }}>{fmt(p.amount)}</td>
                    <td style={{ padding:"8px 10px", color:"#6b7280" }}>
                      {p.payment_method === "cash" ? "💵 Tiền mặt" : p.payment_method === "transfer" ? "🏦 Chuyển khoản" : p.payment_method}
                    </td>
                    <td style={{ padding:"8px 10px", color:"#374151" }}>{fmtDate(p.paid_at)}</td>
                    <td style={{ padding:"8px 10px", color:"#374151" }}>{p.created_by_name || "—"}</td>
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
          voucher={payTarget}
          user={user}
          onClose={() => setPayTarget(null)}
          onSaved={() => { showToast("✅ Đã ghi nhận thanh toán"); load(); }}
        />
      )}
    </div>
  );
}
