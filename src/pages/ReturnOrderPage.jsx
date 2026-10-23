/**
 * ReturnOrderPage.jsx — Xử lý Đổi trả & Bảo hành đổi mới
 * @version 2026-06-01-v1
 */
import React, { useState, useEffect } from "react";
import { CashJournal, getPbUrl, getAuth, logAction, notifyRoles, Notification, Staff } from "./pb.jsx";
import { usePermission } from "./PermissionContext.jsx";

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
export function ReturnForm({ user, onSave, onClose, initialData, orderItems, editRecord }) {
  const items = orderItems || [];
  const multiItem = items.length > 1; // chỉ hiện checklist khi đơn có NHIỀU hàng
  const [form, setForm] = useState(() => {
    const base = {
      code:           genCode(),
      return_type:    "refund",
      reason:         REASONS[0],
      customer_name:  "",
      customer_phone: "",
      ref_code:       "",
      product_name:   "",
      refund_amount:  0,
      refund_method:  "cash",
      new_product_name: "",
      price_diff:     0,
      warranty_end_date: "",
      assigned_tech:  "",
      promise_date:   "",
      origin_total:   0,
      note:           "",
      status:         "pending",
      return_date:    new Date().toISOString().slice(0,10),
      items:          [],
      ...(editRecord || initialData || {}),
    };
    // Đơn nhiều hàng: bắt KH chọn thủ công, không tự điền sẵn tên/số tiền
    if (multiItem) { base.product_name = ""; base.refund_amount = 0; base.items = []; }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [custSearch,   setCustSearch]   = useState("");
  const [custSuggs,    setCustSuggs]    = useState([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [partSearch,   setPartSearch]   = useState("");
  const [partSuggs,   setPartSuggs]    = useState([]);
  const [showPartDrop, setShowPartDrop] = useState(false);
  const [originOrder, setOriginOrder] = useState(null);
  const [originItems, setOriginItems] = useState([]); // sản phẩm của ĐƠN GỐC tra cứu được → chọn hàng đổi trả
  const [pasteMsg, setPasteMsg] = useState("");
  const [refSearch,   setRefSearch]   = useState(false);
  const [techs, setTechs] = useState([]);
  const partField = React.useRef("product_name");

  useEffect(() => {
    fetch(`${getPbUrl()}/api/collections/staff/records?perPage=200&sort=-id`)
      .then(r => r.ok ? r.json() : {items:[]})
      .then(j => setTechs((j.items||[]).filter(st => st.role === "technician")))
      .catch(()=>{});
  }, []);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // ── Checklist chọn hàng (chỉ khi đơn có nhiều sản phẩm) ──
  const [picked, setPicked] = useState(() => {
    const init = {};
    items.forEach((it, i) => { init[i] = { checked:false, qty: it.qty || 1 }; });
    return init;
  });

  const allItems = originItems.length ? originItems : items; // ưu tiên sản phẩm từ đơn gốc tra cứu

  function applyPickedToForm(nextPicked) {
    const chosen = allItems
      .map((it,i) => ({ it, sel: nextPicked[i] }))
      .filter(x => x.sel?.checked);
    const names = chosen.map(x => `${x.it.part_name}${x.it.qty>1 ? ` (x${x.sel.qty})` : ""}`).join(", ");
    const amount = chosen.reduce((s,x) => s + (x.it.unit_price||0) * (x.sel.qty||0), 0);
    const itemsPayload = chosen.map(x => ({
      sku: x.it.sku||"", part_name: x.it.part_name||"",
      qty: x.sel.qty, unit_price: x.it.unit_price||0,
      total_price: (x.it.unit_price||0)*(x.sel.qty||0),
    }));
    setForm(f => ({ ...f, product_name: names, refund_amount: amount, items: itemsPayload }));
  }

  function toggleItem(i) {
    setPicked(p => {
      const next = { ...p, [i]: { ...p[i], checked: !p[i].checked } };
      applyPickedToForm(next);
      return next;
    });
  }
  function changeQty(i, qty) {
    const max = allItems[i]?.qty || 1;
    const q = Math.max(1, Math.min(max, Number(qty)||1));
    setPicked(p => {
      const next = { ...p, [i]: { ...p[i], qty: q } };
      applyPickedToForm(next);
      return next;
    });
  }

  // Autocomplete sản phẩm / dịch vụ (linh kiện + dịch vụ)
  useEffect(() => {
    const q = partSearch.trim();
    if (q.length < 1) { setPartSuggs([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { token } = getAuth();
        const res = await fetch(
          `${getPbUrl()}/api/collections/product_catalog/records?perPage=500&sort=-id`,
          { headers: token ? { Authorization: token } : {} }
        );
        if (!res.ok) return;
        const json = await res.json();
        const arr = json.items || [];
        const filtered = arr.filter(pt =>
          (pt.name||"").toLowerCase().includes(q.toLowerCase()) ||
          (pt.sku||"").toLowerCase().includes(q.toLowerCase())
        ).slice(0, 6);
        setPartSuggs(filtered);
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [partSearch]);

  // ── Tra cứu đơn gốc theo mã (BL-… → đơn bán, SC-… → đơn sửa) ──
  useEffect(() => {
    const code = (form.ref_code || "").trim();
    if (!/^(BL|SC)[-\d]/i.test(code) || code.length < 6) { setOriginOrder(null); setOriginItems([]); return; }
    const timer = setTimeout(async () => {
      setRefSearch(true);
      try {
        const { token } = getAuth();
        const esc = code.replace(/"/g, '\\"');
        const isSale = /^BL/i.test(code);
        const col = isSale ? "sale_orders" : "repair_orders";
        const res = await fetch(`${getPbUrl()}/api/collections/${col}/records?perPage=1&filter=(order_code="${esc}")`,
          { headers: token ? { Authorization: token } : {} });
        const json = res.ok ? await res.json() : null;
        const o = json?.items?.[0];
        if (!o) { setOriginOrder(null); setOriginItems([]); return; }
        let total = 0, products = "";
        if (isSale) {
          total = Number(o.total || o.subtotal || 0);
          products = (Array.isArray(o.items) ? o.items : []).map(it => it.part_name).filter(Boolean).join(", ");
        } else {
          total = Number(o.final_cost || o.estimated_cost || 0);
          products = [o.device_model || o.device_name, o.issue_description].filter(Boolean).join(" — ");
        }
        let wEnd = "";
        if (!isSale && o.done_date && o.warranty_days) {
          const d = new Date(o.done_date); d.setDate(d.getDate() + Number(o.warranty_days||0));
          wEnd = d.toISOString().slice(0,10);
        }
        // Lấy danh sách sản phẩm của đơn gốc để hiển thị chọn hàng đổi trả
        let oItems = [];
        if (isSale) {
          if (Array.isArray(o.items) && o.items.length > 0) {
            oItems = o.items.map(it => ({ sku: it.sku||"", part_name: it.part_name||"", qty: it.qty||1, unit_price: it.unit_price||0 }));
          } else {
            try {
              const ires = await fetch(`${getPbUrl()}/api/collections/sale_order_items/records?perPage=100&filter=(sale_order_id="${o.id}")`,
                { headers: token ? { Authorization: token } : {} });
              const ijson = ires.ok ? await ires.json() : { items: [] };
              oItems = (ijson.items || []).map(it => ({ sku: it.sku||"", part_name: it.part_name||"", qty: it.qty||1, unit_price: it.unit_price||0 }));
            } catch {}
          }
        } else {
          oItems = [{ sku:"", part_name: products || (o.device_model||o.device_name||""), qty:1, unit_price: total }];
        }
        setOriginItems(oItems);
        setPicked(oItems.reduce((acc, _, i2) => { acc[i2] = { checked:false, qty: oItems[i2].qty || 1 }; return acc; }, {}));
        setOriginOrder({ type: isSale ? "sale" : "repair", code: o.order_code, status: o.status,
          customer_name: o.customer_name, customer_phone: o.customer_phone, total, products, warranty_end: wEnd });
        setForm(f => {
          const next = { ...f, origin_total: total };
          if (!f.customer_name.trim())  next.customer_name  = o.customer_name || "";
          if (!f.customer_phone.trim()) next.customer_phone = o.customer_phone || "";
          // Có danh sách sản phẩm → để checklist quyết định tên hàng & số tiền;
          // không có (đơn cũ thiếu items) mới tự điền dạng text
          if (oItems.length === 0) {
            if (!f.product_name.trim())  next.product_name   = products || "";
            if (f.refund_amount === 0 && f.return_type === "refund") next.refund_amount = total;
          }
          if (!f.warranty_end_date && wEnd) next.warranty_end_date = wEnd;
          return next;
        });
      } catch {}
      setRefSearch(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.ref_code]);

  // Autocomplete khách hàng
  useEffect(() => {
    const q = custSearch.trim();
    if (q.length < 1) { setCustSuggs([]); return; }
    const timer = setTimeout(async () => {
      try {
        // Fix: dùng helper chuẩn getPbUrl/getAuth — trước đây đọc nhầm key localStorage nên gợi ý không bao giờ chạy
        const { token } = getAuth();
        const res = await fetch(
          `${getPbUrl()}/api/collections/customers/records?perPage=200&sort=-id`,
          { headers: token ? { Authorization: token } : {} }
        );
        if (!res.ok) return;
        const json = await res.json();
        const items = json.items || [];
        const filtered = items.filter(c =>
          (c.full_name||"").toLowerCase().includes(q.toLowerCase()) ||
          (c.phone||"").includes(q)
        ).slice(0, 6);
        setCustSuggs(filtered);
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [custSearch]);

  async function save() {
    if (!form.customer_name.trim()) { alert("Nhập tên khách hàng"); return; }
    if (!form.product_name.trim())  { alert("Nhập tên sản phẩm/dịch vụ"); return; }
    setSaving(true);
    try {
      const { token } = getAuth();
      if (editRecord) {
        // CHE DO SUA: PATCH bản ghi hiện có, bỏ các field hệ thống, KHÔNG ghi sổ quỹ lại
        const { id, collectionId, collectionName, created, updated, ...payload } = form;
        const res = await fetch(`${getPbUrl()}/api/collections/return_orders/records/${editRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type":"application/json", ...(token ? { Authorization:token } : {}) },
          body: JSON.stringify({ ...payload, status: editRecord.status }), // giữ nguyên trạng thái, chỉ sửa nội dung
        });
        if (!res.ok) throw new Error("Lỗi cập nhật đơn đổi trả");
        logAction(user, "update_return", "return_order", editRecord.id, "Sua don doi tra: " + (form.code||""));
        onSave();
        onClose();
        setSaving(false);
        return;
      }
      const res = await fetch(`${getPbUrl()}/api/collections/return_orders/records`, {
        method: "POST",
        headers: { "Content-Type":"application/json", ...(token ? { Authorization:token } : {}) },
        body: JSON.stringify({ ...form, created_by: user?.id }),
      });
      if (!res.ok) throw new Error("Lỗi lưu đơn (collection return_orders chưa tồn tại?)");
      logAction(user, "create_return", "return_order", "", "Tao don doi tra: " + (form.code||"") + " - " + (form.customer_name||""));

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
            payment_method: form.refund_method || "cash",
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
          <div style={{ fontWeight:900, fontSize:17 }}>{editRecord ? "🔄 Sửa đơn Đổi trả / Bảo hành" : "🔄 Tạo đơn Đổi trả / Bảo hành"}</div>
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
          <div style={{ position:"relative" }}>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Tên khách hàng *</label>
            <input
              value={custSearch || form.customer_name}
              onChange={e => {
                setCustSearch(e.target.value);
                set("customer_name", e.target.value);
                set("customer_phone", "");
                setShowCustDrop(true);
              }}
              onFocus={() => setShowCustDrop(true)}
              onBlur={() => setTimeout(() => setShowCustDrop(false), 180)}
              placeholder="Nguyễn Văn A..."
              style={{ ...INP, marginTop:4 }}
            />
            {showCustDrop && custSuggs.length > 0 && (
              <div style={{
                position:"absolute", top:"100%", left:0, right:0, zIndex:100,
                background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)", overflow:"hidden", marginTop:2,
              }}>
                {custSuggs.map(c => (
                  <div key={c.id}
                    onMouseDown={() => {
                      set("customer_name",  c.full_name || "");
                      set("customer_phone", c.phone || "");
                      setCustSearch(c.full_name || "");
                      setCustSuggs([]);
                      setShowCustDrop(false);
                    }}
                    style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6" }}
                    onMouseEnter={e => e.currentTarget.style.background="#f5f3ff"}
                    onMouseLeave={e => e.currentTarget.style.background="#fff"}
                  >
                    <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{c.full_name}</div>
                    {c.phone && <div style={{ fontSize:11, color:"#6b7280" }}>{c.phone}</div>}
                  </div>
                ))}
              </div>
            )}
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
            <div style={{ position:"relative" }}>
              <input value={form.ref_code} onChange={e=>set("ref_code",e.target.value)}
                placeholder="BL-260601-0001" style={{ ...INP, marginTop:4, paddingRight:44 }} />
              <button type="button" onClick={async () => {
                try {
                  const txt = (await navigator.clipboard.readText() || "").trim();
                  if (txt) { set("ref_code", txt); setPasteMsg(""); }
                  else setPasteMsg("Clipboard trống");
                } catch { setPasteMsg("Không đọc được clipboard — bấm giữ ô rồi chọn Dán"); }
              }}
                title="Dán từ clipboard"
                style={{ position:"absolute", right:6, top:"calc(4px + 4px)", height:34, width:34,
                  borderRadius:8, border:"1.5px solid #e5e7eb", background:"#f5f3ff", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📋</button>
              {pasteMsg && <div style={{ fontSize:11, color:"#d97706", marginTop:3 }}>{pasteMsg}</div>}
            </div>
          </div>
            {refSearch && <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>⏳ Đang tra cứu đơn…</div>}
            {originOrder && (
              <div style={{ marginTop:6, background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:10, padding:"8px 10px" }}>
                <div style={{ fontSize:12, fontWeight:800, color:"#059669" }}>
                  ✓ Đơn gốc: {originOrder.code} · {originOrder.type === "sale" ? "Bán lẻ" : "Sửa chữa"}
                </div>
                <div style={{ fontSize:11.5, color:"#374151", marginTop:2 }}>
                  👤 {originOrder.customer_name}{originOrder.customer_phone ? ` · ${originOrder.customer_phone}` : ""} · 💰 {fmtMoney(originOrder.total)}
                </div>
                {originOrder.products && <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>📦 {originOrder.products}</div>}
              </div>
            )}
            {form.ref_code && !refSearch && !originOrder && /^(BL|SC)/i.test(form.ref_code) && (
              <div style={{ fontSize:11, color:"#d97706", marginTop:4 }}>⚠️ Chưa tìm thấy đơn “{form.ref_code}”</div>
            )}
          <div>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Ngày đổi trả</label>
            <input type="date" value={form.return_date} onChange={e=>set("return_date",e.target.value)}
              style={{ ...INP, marginTop:4 }} />
          </div>
        </div>

        {/* Sản phẩm */}
        {(multiItem || originItems.length > 0) ? (
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Chọn sản phẩm cần đổi trả * {originItems.length ? `(${originItems.length} sản phẩm từ đơn gốc ${originOrder?.code || ""})` : ""}</label>
            <div style={{ marginTop:6, border:"1.5px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
              {allItems.map((it, i) => {
                const sel = picked[i] || { checked:false, qty: it.qty||1 };
                return (
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                    borderBottom: i < items.length-1 ? "1px solid #f3f4f6" : "none",
                    background: sel.checked ? "#fffbeb" : "#fff",
                  }}>
                    <input type="checkbox" checked={sel.checked} onChange={() => toggleItem(i)}
                      style={{ width:18, height:18, cursor:"pointer", flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{it.part_name}</div>
                      <div style={{ fontSize:11, color:"#9ca3af" }}>
                        {it.sku && `SKU: ${it.sku} · `}Đã bán: {it.qty} · {fmtMoney(it.unit_price)}
                      </div>
                    </div>
                    {sel.checked && (
                      <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                        <label style={{ fontSize:11, color:"#6b7280" }}>SL:</label>
                        <input type="number" min={1} max={it.qty||1} value={sel.qty}
                          onChange={e => changeQty(i, e.target.value)}
                          style={{ width:52, height:32, borderRadius:8, border:"1.5px solid #fde68a",
                            textAlign:"center", fontSize:13, fontWeight:700 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!form.product_name && (
              <div style={{ fontSize:11, color:"#dc2626", marginTop:4 }}>Chưa chọn sản phẩm nào</div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom:12, position:"relative" }}>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Tên sản phẩm / dịch vụ *</label>
            <input
              value={partSearch || form.product_name}
              onChange={e => { partField.current = "product_name"; setPartSearch(e.target.value); set("product_name", e.target.value); setShowPartDrop(true); }}
              onFocus={() => { partField.current = "product_name"; setShowPartDrop(true); }}
              onBlur={() => setTimeout(() => setShowPartDrop(false), 180)}
              placeholder="Nhập tên linh kiện / dịch vụ để gợi ý..."
              style={{ ...INP, marginTop:4 }} />
            {showPartDrop && partSuggs.length > 0 && (
              <div style={{
                position:"absolute", top:"100%", left:0, right:0, zIndex:100,
                background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)", overflow:"hidden", marginTop:2,
              }}>
                {partSuggs.map(pt => (
                  <div key={pt.id}
                    onMouseDown={() => {
                      set("product_name", pt.name || "");
                      setPartSearch(pt.name || "");
                      setPartSuggs([]);
                      setShowPartDrop(false);
                    }}
                    style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6" }}
                    onMouseEnter={e => e.currentTarget.style.background="#f5f3ff"}
                    onMouseLeave={e => e.currentTarget.style.background="#fff"}
                  >
                    <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{pt.name}</div>
                    <div style={{ fontSize:11, color:"#6b7280" }}>
                      {pt.sku && `SKU: ${pt.sku} · `}{pt.category || "LK"}{pt.price ? ` · ${fmtMoney(pt.price)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lý do */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Lý do</label>
          <select value={form.reason} onChange={e=>set("reason",e.target.value)}
            style={{ ...INP, marginTop:4, background:"#fff" }}>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Đổi sản phẩm mới / Bảo hành đổi mới */}
        {(form.return_type === "exchange" || form.return_type === "warranty") && (
          <div style={{ marginBottom:12, position:"relative" }}>
            <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>
              {form.return_type === "exchange" ? "Sản phẩm đổi mới *" : "Sản phẩm bảo hành đổi mới *"}
            </label>
            <input
              value={form.new_product_name}
              onChange={e => { partField.current = "new_product_name"; setPartSearch(e.target.value); set("new_product_name", e.target.value); setShowPartDrop(true); }}
              onFocus={() => { partField.current = "new_product_name"; }}
              onBlur={() => setTimeout(() => setShowPartDrop(false), 180)}
              placeholder="Nhập tên linh kiện / dịch vụ để gợi ý..."
              style={{ ...INP, marginTop:4 }} />
            {showPartDrop && partSuggs.length > 0 && partField.current === "new_product_name" && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:100, background:"#fff",
                border:"1.5px solid #e5e7eb", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,.12)", overflow:"hidden", marginTop:2 }}>
                {partSuggs.map(pt => (
                  <div key={pt.id} onMouseDown={() => { set("new_product_name", pt.name||""); setPartSearch(pt.name||""); setPartSuggs([]); setShowPartDrop(false); }}
                    style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6" }}>
                    <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{pt.name}</div>
                    <div style={{ fontSize:11, color:"#6b7280" }}>{pt.sku && `SKU: ${pt.sku} · `}{pt.price ? fmtMoney(pt.price) : ""}</div>
                  </div>
                ))}
              </div>
            )}
            {form.return_type === "exchange" && (
              <div style={{ marginTop:10 }}>
                <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Chênh lệch giá khách trả thêm (đ) — âm nếu hoàn tiền lại</label>
                <input type="number" value={form.price_diff}
                  onChange={e=>set("price_diff", Number(e.target.value)||0)}
                  style={{ ...INP, marginTop:4 }} />
              </div>
            )}
            {form.return_type === "warranty" && (
              <div style={{ marginTop:10 }}>
                <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Ngày hết hạn bảo hành</label>
                <input type="date" value={form.warranty_end_date}
                  onChange={e=>set("warranty_end_date", e.target.value)}
                  style={{ ...INP, marginTop:4 }} />
                {originOrder?.warranty_end && <div style={{ fontSize:11, color:"#059669", marginTop:3 }}>✓ Theo đơn gốc: bảo hành đến {originOrder.warranty_end}</div>}
              </div>
            )}
          </div>
        )}

        {/* Sửa lại miễn phí — KTV phụ trách + ngày hẹn xong */}
        {form.return_type === "repair_free" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>KTV phụ trách</label>
              <select value={form.assigned_tech} onChange={e=>set("assigned_tech", e.target.value)}
                style={{ ...INP, marginTop:4, background:"#fff" }}>
                <option value="">— Chọn KTV —</option>
                {techs.map(t => <option key={t.id} value={t.full_name}>{t.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Ngày hẹn xong</label>
              <input type="date" value={form.promise_date}
                onChange={e=>set("promise_date", e.target.value)}
                style={{ ...INP, marginTop:4 }} />
            </div>
          </div>
        )}

        {/* Số tiền hoàn — chỉ khi refund */}
        {form.return_type === "refund" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, color:"#dc2626", fontWeight:600 }}>Số tiền hoàn lại (đ)</label>
              <input type="number" min={0} value={form.refund_amount}
                onChange={e=>set("refund_amount",Number(e.target.value))}
                style={{ ...INP, marginTop:4, borderColor:"#fca5a5" }} />
              {originOrder && originOrder.total > 0 && (
                <div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>Giá trị đơn gốc: {fmtMoney(originOrder.total)}</div>
              )}
            </div>
            <div>
              <label style={{ fontSize:12, color:"#6b7280", fontWeight:600 }}>Hình thức hoàn tiền</label>
              <select value={form.refund_method} onChange={e=>set("refund_method", e.target.value)}
                style={{ ...INP, marginTop:4, background:"#fff" }}>
                <option value="cash">💵 Tiền mặt</option>
                <option value="transfer">🏦 Chuyển khoản</option>
              </select>
            </div>
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
  const [search,  setSearch]  = useState(() => {
    // Từ "Việc của tôi": lọc sẵn đúng phiếu đổi trả cần xử lý
    const nav = window.__hkNavFocus;
    if (nav && nav.type === "return_order" && nav.code) { window.__hkNavFocus = null; return nav.code; }
    return "";
  });
  const [filter,  setFilter]  = useState("all");
  const [detail,  setDetail]  = useState(null);   // đơn đang xem chi tiết
  const [editRecord, setEditRecord] = useState(null); // đơn đang sửa

  const { can } = usePermission();
  // Nut "Tao don doi tra" theo quyen phan quyen (return_order: Xem/Tao), khong khoa cung role nua
  const isAdmin = !!can("return_order","create");

  async function load() {
    setLoading(true);
    try {
      const { token } = getAuth();
      const res = await fetch(
        `${getPbUrl()}/api/collections/return_orders/records?sort=-id&perPage=200`,
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

  // Chuyển thu ngân chi tiền (hoàn tiền)
  async function sendToCashier(r) {
    if (!window.confirm(`Chuyển đơn ${r.code} cho THU NGÂN chi tiền hoàn ${fmtMoney(r.refund_amount)}? Thu ngân sẽ thấy phiếu chi trong app Thu ngân.`)) return;
    try {
      await notifyRoles(["cashier"], {
        title: "💵 Phiếu chi hoàn tiền",
        message: `Đơn ${r.code} — hoàn ${fmtMoney(r.refund_amount)} cho ${r.customer_name||"khách"}${r.customer_phone?" ("+r.customer_phone+")":""} — chờ thu ngân chi tiền`,
        order: { id: r.id, order_code: r.code },
        type: "return_pay",
      });
      logAction(user, "return_to_cashier", "return_order", r.id, `Chuyển thu ngân chi tiền đơn ${r.code}`);
      alert("✅ Đã gửi cho thu ngân. Thu ngân vào app Thu ngân → tab 'Chi đổi trả' để chi tiền.");
    } catch(e) { alert("Lỗi: " + e.message); }
  }

  // Sửa lại miễn phí → tạo đơn sửa chữa cho KTV
  async function createRepairOrder(r) {
    if (!window.confirm(`Tạo đơn SỬA CHỮA MIỄN PHÍ cho ${r.customer_name||"khách"} (liên kết đơn ${r.code})?`)) return;
    try {
      const { token } = getAuth();
      const d = new Date();
      const scCode = "SC" + String(d.getFullYear()).slice(2)
        + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0")
        + "-" + String(d.getHours()).padStart(2,"0") + String(d.getMinutes()).padStart(2,"0")
        + String(d.getSeconds()).padStart(2,"0");
      // Tìm staff id theo tên KTV đã chọn
      let tech = null;
      if (r.assigned_tech) {
        try {
          const stf = await Staff.filter({ is_active: true }).catch(()=>[]);
          tech = (stf||[]).find(st => st.full_name === r.assigned_tech) || null;
        } catch {}
      }
      const payload = {
        order_code: scCode,
        customer_name: r.customer_name || "",
        customer_phone: r.customer_phone || "",
        device_name: r.product_name || "",
        device_model: r.product_name || "",
        issue_description: `Sửa lại miễn phí theo đơn đổi trả ${r.code}${r.reason ? " — " + r.reason : ""}`,
        status: tech ? "Đang Sửa" : "Chờ KTV Sửa",
        priority: "Thường",
        estimated_cost: 0, final_cost: 0, deposit: 0,
        received_date: d.toISOString(),
        note: (r.note||"") + (r.note ? " | " : "") + `Miễn phí theo đổi trả ${r.code}`,
      };
      if (tech) {
        payload.assigned_to = tech.id;
        payload.assigned_to_name = tech.full_name;
        payload.assigned_at = d.toISOString();
      }
      const res = await fetch(`${getPbUrl()}/api/collections/repair_orders/records`, {
        method: "POST",
        headers: { "Content-Type":"application/json", ...(token ? { Authorization:token } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Lỗi tạo đơn sửa chữa");
      const created = await res.json();
      // Lưu liên kết + thông báo KTV
      await fetch(`${getPbUrl()}/api/collections/return_orders/records/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", ...(token ? { Authorization:token } : {}) },
        body: JSON.stringify({ sc_order_code: created.order_code || scCode }),
      });
      if (tech) {
        await Notification.create({
          user_id: tech.id, user_name: tech.full_name,
          title: "🔧 Sửa lại miễn phí (đổi trả)",
          message: `Đơn ${created.order_code || scCode} — ${r.product_name||""} của ${r.customer_name||"khách"} — sửa lại miễn phí theo đơn ${r.code}`,
          order_id: created.id, order_code: created.order_code || scCode,
          type: "assign", is_read: false,
        }).catch(()=>{});
      }
      logAction(user, "return_create_repair", "return_order", r.id, `Tạo đơn sửa miễn phí ${created.order_code || scCode} từ đơn đổi trả ${r.code}`);
      alert(`✅ Đã tạo đơn sửa ${created.order_code || scCode}${tech ? " — đã gán cho " + tech.full_name : " — chờ phân công KTV"}`);
      setDetail({ ...r, sc_order_code: created.order_code || scCode });
      load();
    } catch(e) { alert("Lỗi: " + e.message); }
  }

  // Đổi SP / Bảo hành → báo kho soạn hàng đổi
  async function notifyWarehouse(r) {
    if (!window.confirm(`Gửi yêu cầu SOẠN HÀNG ĐỔI cho kho (đơn ${r.code}${r.new_product_name ? " — đổi sang: " + r.new_product_name : ""})?`)) return;
    try {
      await notifyRoles(["warehouse","packer"], {
        title: "📦 Soạn hàng đổi trả",
        message: `Đơn ${r.code} — đổi hàng cho ${r.customer_name||"khách"}${r.new_product_name ? " — lấy hàng: " + r.new_product_name : ""}`,
        order: { id: r.id, order_code: r.code },
        type: "return_exchange",
      });
      logAction(user, "return_notify_warehouse", "return_order", r.id, `Báo kho soạn hàng đổi — đơn ${r.code}`);
      alert("✅ Đã gửi yêu cầu cho kho.");
    } catch(e) { alert("Lỗi: " + e.message); }
  }

  // Đổi trạng thái đơn đổi trả (pending → processing → done / cancelled)
  async function updateReturnStatus(r, newStatus) {
    if (!window.confirm(`Đổi trạng thái đơn ${r.code} → "${STATUS_COLORS[newStatus]?.label || newStatus}"?`)) return;
    try {
      const { token } = getAuth();
      const res = await fetch(`${getPbUrl()}/api/collections/return_orders/records/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", ...(token ? { Authorization:token } : {}) },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Lỗi cập nhật trạng thái");
      logAction(user, "update_return_status", "return_order", r.id, `Đổi trạng thái ${r.code}: ${r.status} → ${newStatus}`);

      // Hoàn thành đơn HOÀN TIỀN → ghi sổ quỹ chi (nếu chưa có bút toán nào cho đơn này)
      if (newStatus === "done" && r.return_type === "refund" && (r.refund_amount||0) > 0) {
        try {
          const jres = await fetch(`${getPbUrl()}/api/collections/cash_journal/records?perPage=1&filter=(ref_code="${r.code}")`,
            { headers: token ? { Authorization:token } : {} });
          const jjson = jres.ok ? await jres.json() : { items: [] };
          const already = (jjson.items || []).length > 0;
          if (!already) {
            if (window.confirm(`Ghi hoàn tiền ${fmtMoney(r.refund_amount)} vào Sổ quỹ?`)) {
              await CashJournal.create({
                entry_type:   "payment",
                amount:        r.refund_amount,
                description:  `Hoàn tiền đổi trả — ${r.customer_name} — ${r.code}`,
                journal_date:  new Date().toISOString().slice(0,10),
                ref_code:      r.code,
                ref_type:      "return",
                payment_method: r.refund_method || "cash",
              });
            }
          }
        } catch {}
      }
      setDetail(null);
      load();
    } catch(e) { alert("Lỗi: " + e.message); }
  }

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
                  <tr key={r.id} onClick={() => setDetail(r)}
                    style={{ borderBottom:"1px solid #f3f4f6", cursor:"pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f5f3ff"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>
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

      {editRecord && (
        <ReturnForm
          user={user}
          editRecord={editRecord}
          onSave={() => { setEditRecord(null); setDetail(null); load(); }}
          onClose={() => setEditRecord(null)}
        />
      )}

      {/* Modal chi tiết + xử lý đơn đổi trả */}
      {detail && (() => {
        const st = STATUS_COLORS[detail.status] || STATUS_COLORS.pending;
        const tLabel = RETURN_TYPES.find(t=>t.key===detail.return_type)?.label || detail.return_type;
        const Row = ({ l, v }) => (
          <div style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px dashed #f1f5f9", fontSize:13 }}>
            <div style={{ width:130, color:"#6b7280", flexShrink:0 }}>{l}</div>
            <div style={{ fontWeight:600, color:"#1f2937" }}>{v || "—"}</div>
          </div>
        );
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
            onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
            <div style={{ background:"#fff", borderRadius:20, padding:24, width:"min(560px,95vw)", maxHeight:"90vh", overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b" }}>{detail.code}</div>
                  <span style={{ padding:"3px 12px", borderRadius:20, fontSize:11, fontWeight:700, background:st.bg, color:st.color }}>{st.label}</span>
                </div>
                <button onClick={()=>setDetail(null)} style={{ width:32, height:32, borderRadius:"50%", border:"none", background:"#f3f4f6", cursor:"pointer", fontSize:16 }}>✕</button>
              </div>
              <Row l="Khách hàng" v={`${detail.customer_name || ""}${detail.customer_phone ? " · " + detail.customer_phone : ""}`} />
              <Row l="Hình thức xử lý" v={tLabel} />
              <Row l="Đơn gốc" v={detail.ref_code} />
              <Row l="Sản phẩm đổi trả" v={detail.product_name} />
              {detail.new_product_name && <Row l={detail.return_type === "warranty" ? "SP bảo hành đổi mới" : "SP đổi mới"} v={detail.new_product_name} />}
              {detail.return_type === "exchange" && <Row l="Chênh lệch giá" v={detail.price_diff ? fmtMoney(detail.price_diff) : "0đ"} />}
              {detail.warranty_end_date && <Row l="BH hết hạn" v={fmtDate(detail.warranty_end_date)} />}
              {detail.return_type === "repair_free" && <Row l="KTV phụ trách" v={detail.assigned_tech} />}
              {detail.promise_date && <Row l="Hẹn xong" v={fmtDate(detail.promise_date)} />}
              {detail.return_type === "refund" && <Row l="Số tiền hoàn" v={detail.refund_amount>0 ? fmtMoney(detail.refund_amount) + (detail.refund_method === "transfer" ? " (chuyển khoản)" : " (tiền mặt)") : "—"} />}
              <Row l="Lý do" v={detail.reason} />
              <Row l="Ngày đổi trả" v={fmtDate(detail.return_date || detail.created)} />
              {detail.note && <Row l="Ghi chú" v={detail.note} />}

              {detail.sc_order_code && <Row l="Đơn sửa liên kết" v={`🔗 ${detail.sc_order_code}`} />}

              {/* Nút nối luồng theo hình thức xử lý */}
              {isAdmin && detail.status === "processing" && (
                <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
                  {detail.return_type === "refund" && (detail.refund_amount||0) > 0 && !detail.sc_order_code && (
                    <button onClick={() => sendToCashier(detail)}
                      style={{ flex:1, height:44, borderRadius:12, border:"none", background:"#7c3aed", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                      💵 Chuyển thu ngân chi tiền
                    </button>
                  )}
                  {detail.return_type === "repair_free" && !detail.sc_order_code && (
                    <button onClick={() => createRepairOrder(detail)}
                      style={{ flex:1, height:44, borderRadius:12, border:"none", background:"#ea580c", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                      🔧 Tạo đơn sửa miễn phí
                    </button>
                  )}
                  {(detail.return_type === "exchange" || detail.return_type === "warranty") && (
                    <button onClick={() => notifyWarehouse(detail)}
                      style={{ flex:1, height:44, borderRadius:12, border:"none", background:"#0284c7", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                      📦 Báo kho soạn hàng đổi
                    </button>
                  )}
                </div>
              )}

              {/* Nút xử lý theo trạng thái */}
              {isAdmin && detail.status !== "done" && detail.status !== "cancelled" && (
                <div style={{ display:"flex", gap:8, marginTop:18, flexWrap:"wrap" }}>
                  {detail.status === "pending" && (
                    <button onClick={() => updateReturnStatus(detail, "processing")}
                      style={{ flex:1, height:44, borderRadius:12, border:"none", background:"#2563eb", color:"#fff", fontWeight:800, fontSize:13.5, cursor:"pointer" }}>
                      ▶️ Bắt đầu xử lý
                    </button>
                  )}
                  <button onClick={() => updateReturnStatus(detail, "done")}
                    style={{ flex:1, height:44, borderRadius:12, border:"none", background:"#059669", color:"#fff", fontWeight:800, fontSize:13.5, cursor:"pointer" }}>
                    ✅ Hoàn thành
                  </button>
                  <button onClick={() => { setEditRecord(detail); setDetail(null); }}
                    style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", color:"#374151", fontWeight:800, fontSize:13.5, cursor:"pointer" }}>
                    ✏️ Sửa đơn
                  </button>
                  <button onClick={() => updateReturnStatus(detail, "cancelled")}
                    style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontWeight:800, fontSize:13.5, cursor:"pointer" }}>
                    ❌ Huỷ đơn
                    </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
