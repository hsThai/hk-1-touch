/* ExpensePage.jsx — Quản lý chi phí */
import React, { useState, useEffect } from "react";
import { Expense, CashJournal } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return String(d.getDate()).padStart(2,"0") + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
}
function todayISO() { return new Date().toISOString().split("T")[0]; }
function genCode() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
  return "CP-" + ymd + "-" + String(Math.floor(Math.random()*9999)).padStart(4,"0");
}

const CATEGORIES = [
  { value:"salary",  label:"Lương",          color:"#7c3aed" },
  { value:"rent",    label:"Thuê mặt bằng",  color:"#dc2626" },
  { value:"utility", label:"Điện nước",       color:"#2563eb" },
  { value:"supply",  label:"Vật tư",          color:"#d97706" },
  { value:"other",   label:"Khác",            color:"#6b7280" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c=>[c.value,c]));
const MGMT_ROLES    = ["manager","admin"];
const APPROVER_ROLES = ["owner","admin","manager"];

const STATUS_EXP = {
  pending:  { label:"🟡 Chờ duyệt", color:"#d97706", bg:"#fef3c7" },
  approved: { label:"🟢 Đã duyệt",  color:"#059669", bg:"#dcfce7" },
  rejected: { label:"🔴 Từ chối",   color:"#dc2626", bg:"#fee2e2" },
};

const INP = { width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" };
const SEL = { width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#fff" };
const TH  = { padding:"10px 12px", background:"#f9fafb", fontWeight:800, fontSize:12, color:"#374151", textAlign:"left", borderBottom:"1.5px solid #e5e7eb" };
const TD  = { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f3f4f6", verticalAlign:"middle" };

export default function ExpensePage({ user }) {
  const [expenses,    setExpenses]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [toast,       setToast]       = useState("");
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0,7));
  const [filterCat,   setFilterCat]   = useState("");
  const [fCat,  setFCat]  = useState("salary");
  const [fAmt,  setFAmt]  = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDate, setFDate] = useState(todayISO());

  useEffect(() => { loadExpenses(); }, []);

  async function loadExpenses() {
    setLoading(true);
    try {
      const list = await Expense.list({ limit:500, sort:"-expense_date" });
      setExpenses(list||[]);
    } catch {}
    setLoading(false);
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""), 3000); }

  async function handleSubmit() {
    if (!fAmt || Number(fAmt)<=0) { showToast("⚠️ Vui lòng nhập số tiền hợp lệ"); return; }
    setSubmitting(true);
    try {
      await Expense.create({
        expense_code:    genCode(),
        category:        fCat,
        amount:          Number(fAmt),
        description:     fDesc,
        expense_date:    fDate,
        created_by:      user.id||"",
        created_by_name: user.full_name||user.name||"",
        status:          "pending",
      });
      showToast("✅ Đã thêm chi phí thành công!");
      setFAmt(""); setFDesc(""); setFDate(todayISO());
      loadExpenses();
    } catch(e) { showToast("❌ Lỗi: "+e.message); }
    setSubmitting(false);
  }

  async function handleApprove(exp) {
    setSaving(true);
    try {
      await Expense.update(exp.id, {
        status: "approved",
        approved_by_id:   user.id,
        approved_by_name: user.full_name || user.name || "",
        approved_at:      new Date().toISOString(),
      });
      if (exp.payment_method === "cash" || !exp.payment_method) {
        await CashJournal.create({
          journal_date:    exp.expense_date || new Date().toISOString().slice(0,10),
          entry_type:      "payment",
          amount:          exp.amount,
          ref_type:        "expense",
          ref_id:          exp.id,
          ref_code:        exp.expense_code,
          description:     "Chi phí: " + (exp.description || exp.category),
          payment_method:  "cash",
          created_by_id:   user.id,
          created_by_name: user.full_name || user.name || "",
        });
      }
      showToast("✅ Đã duyệt chi phí");
      loadExpenses();
    } catch(e) { showToast("❌ Lỗi: " + e.message); }
    setSaving(false);
  }

  async function handleReject(exp) {
    if (!window.confirm('Từ chối chi phí "' + (exp.description || exp.category) + '"?')) return;
    try {
      await Expense.update(exp.id, { status:"rejected" });
      showToast("❌ Đã từ chối chi phí");
      loadExpenses();
    } catch(e) { showToast("❌ Lỗi: " + e.message); }
  }

  async function handleDelete(exp) {
    const canDel = MGMT_ROLES.includes(user.role) || exp.created_by===user.id;
    if (!canDel) { showToast("❌ Bạn không có quyền xóa chi phí này"); return; }
    if (!window.confirm('Xóa chi phí "' + (exp.description||exp.category) + '"?')) return;
    try {
      await Expense.delete(exp.id);
      showToast("🗑️ Đã xóa chi phí");
      setExpenses(prev=>prev.filter(e=>e.id!==exp.id));
    } catch(e) { showToast("❌ Lỗi: "+e.message); }
  }

  const filtered = expenses.filter(e => {
    const dateStr = (e.expense_date||e.created||"").slice(0,7);
    return (!filterMonth||dateStr===filterMonth) && (!filterCat||e.category===filterCat);
  });
  const totalFiltered = filtered.reduce((s,e)=>s+(e.amount||0), 0);

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:20 }}>💸 Quản lý chi phí</div>

      {/* Form thêm */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px", marginBottom:20 }}>
        <div style={{ fontWeight:800, fontSize:15, color:"#374151", marginBottom:14 }}>➕ Thêm chi phí mới</div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Danh mục</label>
          <select value={fCat} onChange={e=>setFCat(e.target.value)} style={SEL}>
            {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Số tiền (đ)</label>
          <input type="number" min={0} value={fAmt} onChange={e=>setFAmt(e.target.value)} placeholder="500000" style={INP} />
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Mô tả</label>
          <input value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Tiền thuê tháng 6..." style={INP} />
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Ngày</label>
          <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={INP} />
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          style={{ width:"100%", height:44, background:"#059669", color:"#fff", border:"none",
            borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer", opacity:submitting?0.7:1 }}>
          {submitting ? "⏳ Đang lưu..." : "➕ Thêm chi phí"}
        </button>
      </div>

      {/* Filter */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Lọc theo tháng</label>
          <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={INP} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Danh mục</label>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={SEL}>
            <option value="">Tất cả</option>
            {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Total */}
      <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", borderRadius:14, padding:"14px 16px",
        marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>
            Tổng chi phí {filterMonth ? "tháng " + filterMonth.slice(5) + "/" + filterMonth.slice(0,4) : ""}
          </div>
          <div style={{ fontSize:24, fontWeight:900, color:"#dc2626" }}>{fmtMoney(totalFiltered)}</div>
        </div>
        <div style={{ fontSize:13, color:"#6b7280" }}>{filtered.length} khoản</div>
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:"#9ca3af" }}>⏳ Đang tải...</div>
        ) : filtered.length===0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:"#9ca3af", fontSize:13 }}>Không có chi phí nào</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Danh mục</th><th style={TH}>Mô tả</th>
                  <th style={{...TH,textAlign:"right"}}>Số tiền</th>
                  <th style={TH}>Ngày</th><th style={TH}>Người tạo</th>
                  <th style={TH}>Trạng thái</th>
                  <th style={{...TH,textAlign:"center"}}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const cat = CAT_MAP[e.category]||{label:e.category,color:"#6b7280"};
                  const canDel = MGMT_ROLES.includes(user.role)||e.created_by===user.id;
                  return (
                    <tr key={e.id}>
                      <td style={TD}>
                        <span style={{ background:cat.color+"22", color:cat.color,
                          borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
                          {cat.label}
                        </span>
                      </td>
                      <td style={TD}>{e.description||"-"}</td>
                      <td style={{...TD,textAlign:"right",fontWeight:800,color:"#dc2626"}}>{fmtMoney(e.amount)}</td>
                      <td style={TD}>{fmtDate(e.expense_date)}</td>
                      <td style={TD}>{e.created_by_name||"-"}</td>
                      <td style={TD}>
                        {(() => {
                          const st = STATUS_EXP[e.status] || STATUS_EXP.pending;
                          return <span style={{ background:st.bg, color:st.color, borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{st.label}</span>;
                        })()}
                      </td>
                      <td style={{...TD,textAlign:"center"}}>
                        <div style={{ display:"flex", gap:4, justifyContent:"center", flexWrap:"wrap" }}>
                        {APPROVER_ROLES.includes(user.role) && (e.status==="pending"||!e.status) && (<>
                          <button onClick={()=>handleApprove(e)}
                            style={{ background:"#dcfce7", color:"#059669", border:"none", borderRadius:8, padding:"3px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                            ✅
                          </button>
                          <button onClick={()=>handleReject(e)}
                            style={{ background:"#fee2e2", color:"#dc2626", border:"none", borderRadius:8, padding:"3px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                            ❌
                          </button>
                        </>)}
                        {canDel && (
                          <button onClick={()=>handleDelete(e)}
                            style={{ background:"#f3f4f6", color:"#6b7280", border:"none", borderRadius:8, padding:"3px 8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                            🗑️
                          </button>
                        )}
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
          background:"#1e1b4b", color:"#fff", borderRadius:14, padding:"12px 24px",
          fontSize:14, fontWeight:700, zIndex:500, whiteSpace:"nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
