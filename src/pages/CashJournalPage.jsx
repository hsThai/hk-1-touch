/**
 * CashJournalPage.jsx — Sổ quỹ tiền mặt đầy đủ cho kế toán
 * @version 2026-05-29-v1
 */
import React, { useState, useEffect, useMemo } from "react";
import { CashJournal, logAction } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("vi-VN");
}
function genCode() { return "TT-" + new Date().getFullYear().toString().slice(2) + String(Date.now()).slice(-6); }

const ALLOWED = ["owner","admin","manager","accountant","cashier"];

// ── Modal ghi thủ công ────────────────────────────────────
function ManualEntryModal({ user, onSave, onClose }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({
    journal_date: today, entry_type:"receipt",
    amount:"", description:"", payment_method:"cash",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) { setErr("Nhập số tiền hợp lệ"); return; }
    if (!form.description.trim()) { setErr("Nhập mô tả"); return; }
    setSaving(true);
    try {
      await CashJournal.create({
        journal_date:    form.journal_date,
        entry_type:      form.entry_type,
        amount:          Number(form.amount),
        ref_type:        "other",
        ref_code:        form.ref_code || "",
        description:     form.description,
        payment_method:  form.payment_method,
        created_by_id:   user.id,
        created_by_name: user.full_name || user.name || "",
      });
      logAction(user, form.entry_type==="receipt"?"add_receipt":"add_payment", "cash_journal", "",
        `${form.entry_type==="receipt"?"Thu":"Chi"}: ${Number(form.amount).toLocaleString("vi-VN")}đ — ${form.description}`);
      onSave();
    } catch(e) { setErr(e.message || "Lỗi lưu"); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"24px 16px 40px", width:"100%", maxWidth:480, maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:18 }}>➕ Ghi thủ công</div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Ngày</label>
          <input type="date" value={form.journal_date} onChange={e=>setForm(f=>({...f,journal_date:e.target.value}))}
            style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Loại</label>
          <div style={{ display:"flex", gap:8 }}>
            {[["receipt","🟢 Thu"],["payment","🔴 Chi"]].map(([k,l])=>(
              <button key={k} onClick={()=>setForm(f=>({...f,entry_type:k}))}
                style={{ flex:1, height:40, borderRadius:10, border:"1.5px solid", fontWeight:700, fontSize:13, cursor:"pointer",
                  borderColor:form.entry_type===k?k==="receipt"?"#059669":"#dc2626":"#e5e7eb",
                  background:form.entry_type===k?k==="receipt"?"#dcfce7":"#fee2e2":"#fff",
                  color:form.entry_type===k?k==="receipt"?"#059669":"#dc2626":"#6b7280",
                }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Số tiền (đ) *</label>
          <input type="number" min={1} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
            placeholder="0" style={{ width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:16, fontWeight:700, outline:"none", boxSizing:"border-box" }}/>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Mô tả *</label>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            placeholder="Ghi chú nội dung..." style={{ width:"100%", height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:4 }}>Hình thức</label>
          <select value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}
            style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#fff" }}>
            <option value="cash">💵 Tiền mặt</option>
            <option value="transfer">🏦 Chuyển khoản</option>
          </select>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#6b7280", display:"block", marginBottom:4 }}>Mã đơn liên kết (tùy chọn)</label>
          <input
            placeholder="VD: SC-001 hoặc BH-001"
            value={form.ref_code || ""}
            onChange={e => setForm(f=>({...f, ref_code: e.target.value}))}
            style={{ width:"100%", height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:13, outline:"none", boxSizing:"border-box", marginTop:0 }}
          />
        </div>

        {err && <div style={{ color:"#dc2626", fontSize:13, marginBottom:10 }}>⚠️ {err}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontSize:14, fontWeight:700, cursor:"pointer" }}>Hủy</button>
          <button onClick={save} disabled={saving}
            style={{ flex:2, height:44, borderRadius:12, border:"none", background:saving?"#c7d2fe":"#4f46e5", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer" }}>
            {saving ? "Đang lưu..." : "💾 Ghi sổ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function CashJournalPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);  const canManage = ALLOWED.includes(user?.role);
  const [month,   setMonth]   = useState(new Date().toISOString().slice(0,7));
  const [all,     setAll]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [toast,   setToast]   = useState("");
  const [mainTab, setMainTab] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const d = await CashJournal.list({ limit:2000, sort:"-journal_date" });
      setAll(d||[]);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""),3000); }

  const monthData = useMemo(()=>
    all.filter(j=>(j.journal_date||"").startsWith(month))
      .sort((a,b)=> new Date(b.journal_date||0) - new Date(a.journal_date||0) || new Date(b.created||0) - new Date(a.created||0)),
    [all, month]);

  const totalIn  = monthData.filter(j=>j.entry_type==="receipt").reduce((s,j)=>s+(j.amount||0),0);
  const totalOut = monthData.filter(j=>j.entry_type==="payment").reduce((s,j)=>s+(j.amount||0),0);
  const balance  = totalIn - totalOut;

  // Tính số dư lũy kế
  // Filter theo tab
  const displayData = useMemo(() => {
    if (mainTab === "thu") return monthData.filter(j => j.entry_type === "receipt");
    if (mainTab === "chi") return monthData.filter(j => j.entry_type === "payment");
    return monthData;
  }, [monthData, mainTab]);

  const rowsWithBalance = useMemo(()=>{
    let running = 0;
    // Sort asc để tính lũy kế
    const asc = [...monthData].reverse();
    const res = asc.map(j=>{
      if (j.entry_type==="receipt") running += (j.amount||0);
      else running -= (j.amount||0);
      return { ...j, balance: running };
    });
    return res.reverse(); // hiện mới nhất lên trên
  }, [monthData]);

  function exportCSV() {
    const BOM = "\uFEFF";
    const rows = [
      ["SỔ QUỸ TIỀN MẶT — " + month],
      ["Tổng thu", totalIn, "Tổng chi", totalOut, "Tồn quỹ", balance],
      [],
      ["STT","Ngày","Loại","Mô tả","Đơn gốc","Hình thức","Số tiền","Số dư"],
      ...rowsWithBalance.map((j,i)=>[
        i+1, j.journal_date||"", j.entry_type==="receipt"?"Thu":"Chi",
        j.description||"", j.ref_code||"",
        j.payment_method==="cash"?"Tiền mặt":"Chuyển khoản",
        j.entry_type==="receipt"?j.amount:-(j.amount||0),
        j.balance,
      ]),
    ];
    const blob = new Blob([BOM+rows.map(r=>r.join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "SoQuy_"+month+".csv"; a.click();
  }

  if (!canManage) return (
    <div style={{ padding:48, textAlign:"center", color:"#6b7280" }}>
      <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
      <div style={{ fontWeight:700, color:"#dc2626" }}>Không có quyền truy cập</div>
    </div>
  );

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth:1100, margin:"0 auto" }}>
      {/* Card số dư tiền mặt live */}
      <div style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",borderRadius:16,
        padding:"18px 20px",marginBottom:16,color:"#fff"}}>
        <div style={{fontSize:13,opacity:.85,marginBottom:4}}>💰 Số dư hiện tại (tháng {month})</div>
        <div style={{fontWeight:900,fontSize:28,letterSpacing:".5px",lineHeight:1}}>
          {balance >= 0
            ? balance.toLocaleString("vi-VN") + "đ"
            : "−" + Math.abs(balance).toLocaleString("vi-VN") + "đ"
          }
        </div>
        <div style={{display:"flex",gap:16,marginTop:8}}>
          <div style={{fontSize:12,opacity:.8}}>
            ↑ Thu: {totalIn.toLocaleString("vi-VN")}đ
          </div>
          <div style={{fontSize:12,opacity:.8}}>
            ↓ Chi: {totalOut.toLocaleString("vi-VN")}đ
          </div>
        </div>
        <div style={{fontSize:10,opacity:.6,marginTop:6}}>Tổng thu − Tổng chi · Chưa đối soát ngân hàng</div>
      </div>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>📒 Sổ quỹ tiền mặt</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>{monthData.length} bút toán</div>
        </div>
        {["owner","admin","manager","accountant"].includes(user?.role) && (
          <button onClick={()=>setModal(true)}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, padding:"8px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            ➕ Ghi thủ công
          </button>
        )}
      </div>

      {/* Month picker + CSV — cùng hàng */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
          lang="vi"
          style={{ border:"1.5px solid #e5e7eb", borderRadius:10, padding:"6px 10px", fontSize:12, flex:1, boxSizing:"border-box" }}/>
        <button onClick={exportCSV}
          style={{ background:"#f3f4f6", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
          ⬇️ CSV
        </button>
      </div>

      {/* Windows-style tabs */}
      <div style={{ display:"flex", background:"#eef2ff", padding:"8px 8px 0", gap:4, marginBottom:16 }}>
        {[
          { key:"all", icon:"account_balance_wallet", label:"Sổ quỹ"   },
          { key:"thu", icon:"south_west",              label:"Phiếu Thu" },
          { key:"chi", icon:"north_east",              label:"Phiếu Chi" },
        ].map(t => {
          const active = mainTab === t.key;
          return (
            <button key={t.key} onClick={() => setMainTab(t.key)} style={{
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

      {/* Tổng kết riêng cho tab Thu/Chi */}
      {mainTab !== "all" && (
        <div style={{
          padding:"12px 16px", marginBottom:16, borderRadius:12,
          background: mainTab==="thu" ? "#f0fdf4" : "#fef2f2",
          border: `1.5px solid ${mainTab==="thu" ? "#86efac" : "#fca5a5"}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <div style={{ fontWeight:700, color: mainTab==="thu"?"#059669":"#dc2626" }}>
            {mainTab==="thu" ? "📥 Tổng thu tháng này" : "📤 Tổng chi tháng này"}
          </div>
          <div style={{ fontWeight:900, fontSize:18, color: mainTab==="thu"?"#059669":"#dc2626" }}>
            {displayData.reduce((s,j)=>s+(j.amount||0),0).toLocaleString("vi-VN")}đ
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
        {[
          { label:"Tổng thu",  val:totalIn,  color:"#059669", bg:"#f0fdf4" },
          { label:"Tổng chi",  val:totalOut, color:"#dc2626", bg:"#fef2f2" },
          { label:"Tồn quỹ",  val:balance,  color:balance>=0?"#4f46e5":"#dc2626", bg:balance>=0?"#eef2ff":"#fee2e2" },
        ].map(c=>(
          <div key={c.label} style={{ background:c.bg, borderRadius:14, padding:"12px 10px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:c.color, fontWeight:700 }}>{c.label}</div>
            <div style={{ fontSize:14, fontWeight:900, color:c.color, marginTop:2 }}>{fmtMoney(c.val)}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : displayData.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
          {mainTab==="thu" ? "Chưa có phiếu thu nào trong tháng" : mainTab==="chi" ? "Chưa có phiếu chi nào trong tháng" : "Chưa có bút toán nào trong tháng"}
        </div>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:14, border:"1.5px solid #e5e7eb" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["#","Ngày","Loại","Mô tả","Đơn gốc","H.thức","Số tiền","Số dư"].map(h=>(
                  <th key={h} style={{ padding:"10px 8px", textAlign:["Số tiền","Số dư"].includes(h)?"right":"left",
                    fontWeight:700, color:"#374151", borderBottom:"2px solid #e5e7eb", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(mainTab==="all" ? rowsWithBalance : displayData.map((j,i2)=>({...j, balance:null}))).map((j,i)=>(
                <tr key={j.id||i} style={{ background:j.entry_type==="receipt"?"#f0fdf408":"#fef2f208" }}>
                  <td style={{ padding:"8px", color:"#9ca3af", borderBottom:"1px solid #f3f4f6" }}>{i+1}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #f3f4f6", whiteSpace:"nowrap" }}>{j.journal_date||"—"}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #f3f4f6" }}>
                    {j.entry_type==="receipt"
                      ? <span style={{background:"#dcfce7",color:"#059669",borderRadius:99,padding:"2px 6px",fontSize:10,fontWeight:700}}>🟢 Thu</span>
                      : <span style={{background:"#fee2e2",color:"#dc2626",borderRadius:99,padding:"2px 6px",fontSize:10,fontWeight:700}}>🔴 Chi</span>}
                  </td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #f3f4f6", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{j.description||"—"}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #f3f4f6", color:"#6b7280" }}>{j.ref_code||"—"}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #f3f4f6" }}>{j.payment_method==="cash"?"💵":"🏦"}</td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #f3f4f6", textAlign:"right", fontWeight:800,
                    color:j.entry_type==="receipt"?"#059669":"#dc2626", whiteSpace:"nowrap" }}>
                    {j.entry_type==="receipt"?"+":"-"}{fmtMoney(j.amount)}
                  </td>
                  <td style={{ padding:"8px", borderBottom:"1px solid #f3f4f6", textAlign:"right", fontWeight:700,
                    color:j.balance>=0?"#1e1b4b":"#dc2626", whiteSpace:"nowrap" }}>
                    {fmtMoney(j.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:"#f8fafc", fontWeight:800 }}>
                <td colSpan={6} style={{ padding:"10px 8px", fontSize:13, color:"#1e1b4b" }}>Tổng kỳ</td>
                <td style={{ padding:"10px 8px", textAlign:"right", color:balance>=0?"#059669":"#dc2626", fontSize:13 }}>
                  {balance>=0?"+":""}{fmtMoney(balance)}
                </td>
                <td style={{ padding:"10px 8px", textAlign:"right", color:balance>=0?"#059669":"#dc2626", fontSize:13 }}>
                  {fmtMoney(balance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {modal && (
        <ManualEntryModal
          user={user}
          onSave={() => { setModal(false); load(); showToast("✅ Đã ghi sổ"); }}
          onClose={() => setModal(false)}
        />
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff",
          borderRadius:14, padding:"12px 24px", fontSize:14, fontWeight:700, zIndex:9999, boxShadow:"0 8px 24px rgba(0,0,0,.3)", whiteSpace:"nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
