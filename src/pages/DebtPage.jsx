/**
 * DebtPage.jsx — Quản lý công nợ (phải thu + phải trả)
 * @version 2026-05-29-v1
 */
import React, { useState, useEffect } from "react";
import { DebtVoucher, DebtPayment, CashJournal, Supplier, SaleOrder, SaleOrderItem, getLocalDate } from "./pb.jsx";
import { printSaleReceiptA5 } from "../utils/printClient.js";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString("vi-VN");
}
function genCode(prefix) {
  const d = new Date();
  return prefix + String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0") + "-" + String(Math.floor(Math.random()*9999)).padStart(4,"0");
}

const STATUS = {
  open:      { label:"🔴 Chưa TT",    color:"#dc2626", bg:"#fee2e2" },
  partial:   { label:"🟡 TT 1 phần",  color:"#d97706", bg:"#fef3c7" },
  paid:      { label:"🟢 Đã TT",      color:"#059669", bg:"#dcfce7" },
  overdue:   { label:"⛔ Quá hạn",    color:"#7c2d12", bg:"#fee2e2" },
  cancelled: { label:"⚫ Đã hủy",     color:"#6b7280", bg:"#f3f4f6" },
};

// ── Hàm ghi thanh toán ───────────────────────────────────
async function recordPayment(voucher, amount, method, note, currentUser) {
  await DebtPayment.create({
    voucher_id:      voucher.id,
    voucher_code:    voucher.voucher_code,
    party_name:      voucher.party_name,
    amount:          Number(amount),
    payment_method:  method,
    paid_at:         new Date().toISOString(),
    note,
    created_by_id:   currentUser.id,
    created_by_name: currentUser.full_name || currentUser.name || "",
  });
  const newPaid      = (voucher.paid_amount || 0) + Number(amount);
  const newRemaining = Math.max(0, (voucher.total_amount || 0) - newPaid);
  const newStatus    = newRemaining <= 0 ? "paid" : "partial";
  await DebtVoucher.update(voucher.id, { paid_amount: newPaid, remaining: newRemaining, status: newStatus });
  // Nếu thanh toán hết và là đơn bán hàng → cập nhật paid_date vào SaleOrder
  if (newStatus === "paid" && voucher.origin_type === "sale_order" && voucher.origin_id) {
    try {
      await SaleOrder.update(voucher.origin_id, {
        paid_date: new Date().toISOString(),
        paid_method: method,
      });
    } catch {}
  }
  if (method === "cash" || method === "transfer") {
    await CashJournal.create({
      journal_date:    getLocalDate(),
      entry_type:      voucher.voucher_type === "receivable" ? "receipt" : "payment",
      amount:          Number(amount),
      ref_type:        "debt_payment",
      ref_id:          voucher.id,
      ref_code:        voucher.voucher_code,
      description:     (voucher.voucher_type === "receivable" ? "Thu nợ: " : "Trả nợ: ") + voucher.party_name,
      payment_method:  method,
      created_by_id:   currentUser.id,
      created_by_name: currentUser.full_name || currentUser.name || "",
    });
  }
}

// ── Summary cards ─────────────────────────────────────────
function SummaryCards({ list, vtype }) {
  const total    = list.reduce((s,v) => s + (v.total_amount||0), 0);
  const paid     = list.reduce((s,v) => s + (v.paid_amount||0), 0);
  const remain   = list.reduce((s,v) => s + (v.remaining||0), 0);
  const overdue  = list.filter(v => v.status === "overdue").reduce((s,v) => s + (v.remaining||0), 0);
  const isRec    = vtype === "receivable";
  const cards = [
    { label: isRec ? "Tổng phát sinh" : "Tổng nợ NCC", val: total,   color:"#4f46e5", bg:"#eef2ff" },
    { label: isRec ? "Đã thu"         : "Đã trả",       val: paid,    color:"#059669", bg:"#dcfce7" },
    { label: isRec ? "Còn lại"        : "Còn phải trả", val: remain,  color:"#d97706", bg:"#fef3c7" },
    { label: "Quá hạn",               val: overdue,  color:"#dc2626", bg:"#fee2e2" },
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px,1fr))", gap:10, marginBottom:16 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background:c.bg, borderRadius:14, padding:"12px 14px" }}>
          <div style={{ fontSize:11, color:c.color, fontWeight:700 }}>{c.label}</div>
          <div style={{ fontSize:16, fontWeight:900, color:c.color, marginTop:2 }}>{fmtMoney(c.val)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────
function PaymentModal({ voucher, user, onDone, onClose }) {
  const [amount, setAmount] = useState(String(voucher.remaining || 0));
  const [method, setMethod] = useState("cash");
  const [note,   setNote]   = useState("");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  async function submit() {
    if (!amount || Number(amount) <= 0) { setErr("Nhập số tiền hợp lệ"); return; }
    if (Number(amount) > (voucher.remaining || 0)) { setErr("Số tiền vượt quá số còn lại"); return; }
    setSaving(true);
    try {
      await recordPayment(voucher, amount, method, note, user);
      onDone();
    } catch(e) { setErr(e.message || "Lỗi lưu"); }
    setSaving(false);
  }

  const isRec = voucher.voucher_type === "receivable";
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"24px 16px 40px", width:"100%", maxWidth:480, maxHeight:"80vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:6 }}>{isRec ? "💵 Thu tiền" : "💸 Thanh toán"}</div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:18 }}>
          {voucher.party_name} · Còn: <b style={{ color:"#dc2626" }}>{fmtMoney(voucher.remaining)}</b>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Số tiền (đ) *</label>
          <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
            style={{ width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:16, fontWeight:700, outline:"none", boxSizing:"border-box" }} />
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Hình thức</label>
          <div style={{ display:"flex", gap:8 }}>
            {[["cash","💵 Tiền mặt"],["transfer","🏦 Chuyển khoản"],["other","📦 Khác"]].map(([k,l]) => (
              <button key={k} onClick={() => setMethod(k)}
                style={{ flex:1, height:40, borderRadius:10, border:"1.5px solid", borderColor:method===k?"#4f46e5":"#e5e7eb",
                  background:method===k?"#eef2ff":"#fff", color:method===k?"#4f46e5":"#6b7280", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Ghi chú</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="..."
            style={{ width:"100%", height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
        </div>
        {err && <div style={{ color:"#dc2626", fontSize:13, marginBottom:10 }}>⚠️ {err}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontSize:14, fontWeight:700, cursor:"pointer" }}>Hủy</button>
          <button onClick={submit} disabled={saving}
            style={{ flex:2, height:44, borderRadius:12, border:"none", background:saving?"#c7d2fe":"#4f46e5", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer" }}>
            {saving ? "Đang lưu..." : isRec ? "✅ Xác nhận thu" : "✅ Xác nhận trả"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────
function DetailModal({ voucher, user, onClose, onRefresh }) {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showPay,  setShowPay]  = useState(false);

  useEffect(() => {
    DebtPayment.filter({ voucher_id: voucher.id }).then(d => { setPayments(d||[]); setLoading(false); }).catch(() => setLoading(false));
  }, [voucher.id]);

  const st = STATUS[voucher.status] || STATUS.open;
  const isRec = voucher.voucher_type === "receivable";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:9998, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"24px 16px 40px", width:"100%", maxWidth:540, maxHeight:"80vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:15 }}>{voucher.voucher_code}</div>
            <div style={{ fontSize:13, color:"#6b7280" }}>{voucher.party_name}</div>
          </div>
          <span style={{ background:st.bg, color:st.color, borderRadius:99, padding:"3px 10px", fontSize:12, fontWeight:700 }}>{st.label}</span>
        </div>

        <div style={{ background:"#f8fafc", borderRadius:12, padding:"12px 14px", marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div><div style={{ fontSize:11, color:"#9ca3af" }}>Tổng</div><div style={{ fontWeight:800, fontSize:14 }}>{fmtMoney(voucher.total_amount)}</div></div>
          <div><div style={{ fontSize:11, color:"#9ca3af" }}>Đã {isRec?"thu":"trả"}</div><div style={{ fontWeight:800, fontSize:14, color:"#059669" }}>{fmtMoney(voucher.paid_amount)}</div></div>
          <div><div style={{ fontSize:11, color:"#9ca3af" }}>Còn lại</div><div style={{ fontWeight:800, fontSize:14, color:"#dc2626" }}>{fmtMoney(voucher.remaining)}</div></div>
          <div><div style={{ fontSize:11, color:"#9ca3af" }}>Hạn</div><div style={{ fontWeight:800, fontSize:14 }}>{fmtDate(voucher.due_date)}</div></div>
        </div>

        {voucher.origin_code && (
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:12 }}>🔗 Đơn gốc: <b>{voucher.origin_code}</b></div>
        )}

        <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>📋 Lịch sử thanh toán</div>
        {loading ? <div style={{ color:"#9ca3af", fontSize:13 }}>⏳ Đang tải...</div>
        : payments.length === 0 ? <div style={{ color:"#9ca3af", fontSize:13 }}>Chưa có thanh toán nào</div>
        : payments.map(p => (
          <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f3f4f6" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700 }}>{fmtMoney(p.amount)}</div>
              <div style={{ fontSize:11, color:"#9ca3af" }}>{p.payment_method === "cash" ? "💵 Tiền mặt" : p.payment_method === "transfer" ? "🏦 CK" : "📦 Khác"} · {fmtDate(p.paid_at)}</div>
            </div>
            <div style={{ fontSize:11, color:"#9ca3af", textAlign:"right" }}>{p.created_by_name}</div>
          </div>
        ))}

        {(voucher.remaining || 0) > 0 && voucher.status !== "cancelled" && (
          <button onClick={() => setShowPay(true)}
            style={{ width:"100%", height:44, marginTop:16, background:"#4f46e5", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer" }}>
            {isRec ? "💵 Thu tiền" : "💸 Thanh toán"}
          </button>
        )}
        {voucher.status === "paid" && voucher.origin_type === "sale_order" && (
          <button onClick={async () => {
            try {
              const so = await SaleOrder.get(voucher.origin_id);
              const its = await SaleOrderItem.list({ filter: `sale_order_id="${voucher.origin_id}"`, limit: 50 });
              const allPays = await DebtPayment.list({ filter: `voucher_id="${voucher.id}"`, limit: 50 });
              await printSaleReceiptA5({
                ...so,
                payment_method: "credit",
                paid_date: so.paid_date || new Date().toISOString(),
                paid_method: so.paid_method || (allPays[0] && allPays[0].payment_method) || "cash",
                debt_payments: allPays || [],
                items: its,
              });
            } catch(e) { alert("Lỗi in phiếu: " + e.message); }
          }}
            style={{ width:"100%", height:44, marginTop:12, background:"#059669", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer" }}>
            🖨️ In phiếu thanh toán
          </button>
        )}
      </div>

      {showPay && (
        <PaymentModal voucher={voucher} user={user}
          onDone={() => { setShowPay(false); onRefresh(); onClose(); }}
          onClose={() => setShowPay(false)} />
      )}
    </div>
  );
}

// ── Voucher row ───────────────────────────────────────────
function VoucherRow({ v, onClick }) {
  const st = STATUS[v.status] || STATUS.open;
  const pct = v.total_amount > 0 ? Math.round((v.paid_amount||0) / v.total_amount * 100) : 0;
  return (
    <div onClick={onClick} style={{
      background:"#fff", borderRadius:14, padding:"12px 14px", marginBottom:8,
      border:"1.5px solid #e5e7eb", cursor:"pointer",
      boxShadow:"0 1px 6px rgba(0,0,0,.04)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:13, color:"#1e1b4b" }}>{v.voucher_code}</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>{v.party_name} {v.origin_code ? "· " + v.origin_code : ""}</div>
        </div>
        <span style={{ background:st.bg, color:st.color, borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{st.label}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
        <span>Tổng: <b>{fmtMoney(v.total_amount)}</b></span>
        <span style={{ color:"#dc2626" }}>Còn: <b>{fmtMoney(v.remaining)}</b></span>
        {v.due_date && <span style={{ color:"#9ca3af" }}>Hạn: {fmtDate(v.due_date)}</span>}
      </div>
      {/* Progress bar */}
      <div style={{ height:4, background:"#f3f4f6", borderRadius:99, overflow:"hidden" }}>
        <div style={{ height:"100%", width:pct+"%", background:pct>=100?"#059669":"#4f46e5", borderRadius:99, transition:"width .3s" }} />
      </div>
    </div>
  );
}

// ── Tab content ───────────────────────────────────────────
function TabContent({ vtype, user }) {
  const [list,      setList]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [detail,    setDetail]    = useState(null);
  const [filter,    setFilter]    = useState("all");
  const [suppliers, setSuppliers] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const data = await DebtVoucher.filter({ voucher_type: vtype });
      setList((data||[]).sort((a,b) => (b.id > a.id ? 1 : -1)));
    } catch {}
    if (vtype === "payable") {
      try {
        const sups = await Supplier.list({ limit:200 });
        setSuppliers(sups || []);
      } catch {}
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [vtype]);

  const filtered = filter === "all" ? list : list.filter(v => v.status === filter);
  const suppliersWithDebt = suppliers.filter(s => (s.total_debt||0) > 0);

  return (
    <div style={{ padding:"12px 0 80px" }}>
      <SummaryCards list={list} vtype={vtype} />

      {/* Bảng tổng nợ NCC — chỉ hiện ở tab payable */}
      {vtype === "payable" && suppliersWithDebt.length > 0 && (
        <div style={{ marginBottom:16, background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", background:"#fef3c7", borderBottom:"1px solid #fde68a", fontWeight:700, fontSize:14, color:"#92400e" }}>
            📊 Tổng hợp công nợ Nhà cung cấp
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#fafafa" }}>
                  <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:700 }}>Nhà cung cấp</th>
                  <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:700 }}>Loại</th>
                  <th style={{ padding:"8px 12px", textAlign:"right", fontWeight:700 }}>Tổng nợ</th>
                  <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:700 }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {suppliersWithDebt.map(s => (
                  <tr key={s.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"8px 12px", fontWeight:600 }}>{s.name}</td>
                    <td style={{ padding:"8px 12px", color:"#6b7280" }}>{s.supplier_type || "—"}</td>
                    <td style={{ padding:"8px 12px", textAlign:"right", fontWeight:800, color:"#dc2626" }}>
                      {(s.total_debt||0).toLocaleString("vi-VN")}đ
                    </td>
                    <td style={{ padding:"8px 12px", textAlign:"center" }}>
                      <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:"#fee2e2", color:"#dc2626" }}>
                        Còn nợ
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Không có nợ NCC */}
      {vtype === "payable" && !loading && list.length === 0 && suppliersWithDebt.length === 0 && (
        <div style={{ textAlign:"center", padding:40, color:"#22c55e", marginBottom:16 }}>
          <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:8 }}>check_circle</span>
          <div style={{ fontWeight:700, fontSize:15 }}>Không có công nợ NCC</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Tất cả đã thanh toán đúng hạn</div>
        </div>
      )}

      {/* Status filter */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:14, WebkitOverflowScrolling:"touch" }}>
        {[["all","Tất cả"],...Object.entries(STATUS).map(([k,s])=>[k,s.label])].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding:"4px 12px", borderRadius:99, border:"1.5px solid", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
              borderColor:filter===k?"#4f46e5":"#e5e7eb", background:filter===k?"#eef2ff":"#fff", color:filter===k?"#4f46e5":"#6b7280" }}>
            {l} {k!=="all" ? `(${list.filter(v=>v.status===k).length})` : `(${list.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:32, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : filtered.length === 0 && !(vtype==="payable") ? (
        <div style={{ textAlign:"center", padding:32, color:"#9ca3af" }}>Không có phiếu nào</div>
      ) : filtered.map(v => (
        <VoucherRow key={v.id} v={v} onClick={() => setDetail(v)} />
      ))}

      {detail && (
        <DetailModal voucher={detail} user={user}
          onClose={() => setDetail(null)}
          onRefresh={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
}


// ── Tab Quá hạn ──────────────────────────────────────────
function OverdueTab({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await DebtVoucher.filter({ status_neq: "paid" }, { sort: "due_date", limit: 500 });
        // Lọc thêm due_date < today ở frontend (filter API không hỗ trợ date compare đầy đủ)
        const overdue = (data || []).filter(i =>
          i.due_date && i.due_date < today && i.status !== "paid"
        );
        setItems(overdue);
      } catch(e) { setItems([]); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>⏳ Đang tải...</div>;
  if (!items.length) return (
    <div style={{textAlign:"center",padding:60}}>
      <div style={{fontSize:40,marginBottom:8}}>✅</div>
      <div style={{color:"#6b7280",fontSize:15,fontWeight:600}}>Không có khoản nợ quá hạn</div>
    </div>
  );

  const totalOverdue = items.reduce((a, i) => a + (i.amount||0) - (i.paid_amount||0), 0);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{background:"#fee2e2",borderRadius:12,padding:"12px 16px",marginBottom:16,
        display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>⚠️</span>
        <div>
          <div style={{fontWeight:800,color:"#dc2626",fontSize:14}}>{items.length} khoản nợ quá hạn</div>
          <div style={{fontSize:12,color:"#991b1b"}}>
            Tổng còn lại: {totalOverdue.toLocaleString("vi-VN")}đ
          </div>
        </div>
      </div>
      {items.map(it => {
        const daysOver = it.due_date
          ? Math.floor((new Date() - new Date(it.due_date)) / (1000*60*60*24))
          : 0;
        const remain = (it.amount||0) - (it.paid_amount||0);
        return (
          <div key={it.id} style={{background:"#fff",borderRadius:12,padding:"14px 16px",
            marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,.08)",
            borderLeft:"4px solid #dc2626"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:14,color:"#1e1b4b"}}>
                  {it.partner_name || it.partner_id || "—"}
                </div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>
                  {it.voucher_type==="receivable" ? "📥 Phải thu" : "📤 Phải trả"} ·{" "}
                  Hạn: {it.due_date ? new Date(it.due_date).toLocaleDateString("vi-VN") : "—"}
                </div>
                {it.note && <div style={{fontSize:12,color:"#374151",marginTop:4}}>{it.note}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontWeight:900,fontSize:16,color:"#dc2626"}}>
                  {remain.toLocaleString("vi-VN")}đ
                </div>
                <div style={{fontSize:11,color:"#dc2626",background:"#fee2e2",
                  borderRadius:6,padding:"2px 8px",marginTop:4,fontWeight:700,display:"inline-block"}}>
                  Trễ {daysOver} ngày
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function DebtPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);  const [tab, setTab] = useState("receivable");
  const TABS = [
    { key:"receivable", icon:"south_west", label:"Phải thu" },
    { key:"payable",    icon:"north_east", label:"Phải trả" },
    { key:"overdue",    icon:"warning",    label:"Quá hạn" },
  ];
  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:16 }}>Quản lý công nợ</div>

      {/* Windows-style tabs */}
      <div style={{ display:"flex", background:"#eef2ff", padding:"8px 8px 0", gap:4, marginBottom:16 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
                padding:"7px 4px 8px", cursor:"pointer",
                border: active ? "1.5px solid #c7d2fe" : "1.5px solid transparent",
                borderBottom: active ? "2px solid #fff" : "1.5px solid #c7d2fe",
                borderRadius:"10px 10px 0 0",
                background: active ? "#fff" : "transparent",
                color: active ? "#4f46e5" : "#6b7280",
                fontWeight: active ? 800 : 500, fontSize:11, lineHeight:1.2,
                marginBottom: active ? "-1px" : 0, zIndex: active ? 2 : 1, position:"relative",
              }}>
              <span className="material-icons" style={{fontSize:20,lineHeight:1,fontFamily:"Material Icons",color:active?"#4f46e5":"#9ca3af"}}>{t.icon}</span>
              <span style={{whiteSpace:"nowrap",fontSize:11}}>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{height:1,background:"#c7d2fe",marginBottom:16}} />

      {tab !== "overdue" && <TabContent key={tab} vtype={tab} user={user} />}
      {tab === "overdue" && <OverdueTab user={user} />}
    </div>
  );
}
