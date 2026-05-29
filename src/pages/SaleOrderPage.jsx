/* SaleOrderPage.jsx — POS bán hàng lẻ */
import React, { useState, useEffect, useRef } from "react";
import { SparePart, SaleOrder, SaleOrderItem, StockMovement, AppSettings, Customer , DebtVoucher, CashJournal } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function padZ(n) { return String(n).padStart(4,"0"); }
function genCode() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
  return "BL-" + ymd + "-" + padZ(Math.floor(Math.random()*9999));
}
function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr); const now = new Date();
  return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
}
function fmtTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}
function fmtDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return String(d.getDate()).padStart(2,"0") + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear() + " " + fmtTime(dateStr);
}

const PM_LABELS = { cash:"Tiền mặt", transfer:"Chuyển khoản", combo:"Kết hợp", credit:"Bán chịu" };
const PM_COLORS = { cash:"#059669", transfer:"#2563eb", combo:"#7c3aed", credit:"#dc2626" };

const RECEIPT_STYLE = `
@media print {
  body > *:not(.print-receipt) { display: none !important; }
  .print-receipt { display: block !important; }
  @page { size: A5; margin: 10mm; }
  .print-receipt { font-size: 12px; font-family: monospace; color: #000; }
}
.print-receipt { display: none; }
`;

const INP = { width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" };

export default function SaleOrderPage({ user }) {
  const [search,      setSearch]      = useState("");
  const [searchRes,   setSearchRes]   = useState([]);
  const [cart,        setCart]        = useState([]);
  const [custName,       setCustName]       = useState("");
  const [custPhone,      setCustPhone]      = useState("");
  const [custSearch,     setCustSearch]     = useState("");
  const [custSuggestions,setCustSuggestions]= useState([]);
  const [discount,    setDiscount]    = useState(0);
  const [payMethod,   setPayMethod]   = useState("");
  const [cashAmt,     setCashAmt]     = useState(0);
  const [transferAmt, setTransferAmt] = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [toast,       setToast]       = useState("");
  const [todayOrders, setTodayOrders] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null);
  const [lastOrder,   setLastOrder]   = useState(null);
  const [shopName,    setShopName]    = useState("HK One Touch");
  const [shopPhone,   setShopPhone]   = useState("");
  const searchTimer = useRef(null);

  useEffect(() => {
    loadTodayOrders();
    AppSettings.list({ limit:200 }).then(list => {
      const m = {}; (list||[]).forEach(s => { m[s.key] = s.value; });
      if (m.shop_name)  setShopName(m.shop_name);
      if (m.shop_phone) setShopPhone(m.shop_phone);
    }).catch(()=>{});
  }, []);

  // Autocomplete khách hàng
  useEffect(() => {
    if (custSearch.length < 2) { setCustSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const q = custSearch.toLowerCase();
        const all = await Customer.list({ limit:300 });
        setCustSuggestions(
          (all||[]).filter(c =>
            (c.full_name||"").toLowerCase().includes(q) ||
            (c.phone||"").includes(custSearch)
          ).slice(0, 6)
        );
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch]);

  async function loadTodayOrders() {
    try {
      const list = await SaleOrder.list({ limit:100, sort:"-created" });
      setTodayOrders((list||[]).filter(o => isToday(o.created || o.created_date)));
    } catch {}
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) { setSearchRes([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const all = await SparePart.list({ limit:200 });
        const q = search.toLowerCase();
        const found = (all||[]).filter(p =>
          p.is_active !== false &&
          ((p.name||"").toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q))
        ).slice(0,8);
        setSearchRes(found);
      } catch {}
    }, 300);
  }, [search]);

  function addToCart(part) {
    if (!(part.stock_qty > 0)) return;
    setCart(prev => {
      const ex = prev.find(i => i.part_id === part.id);
      if (ex) return prev.map(i => i.part_id===part.id ? {...i, qty:Math.min(i.qty+1,i.stock_max)} : i);
      return [...prev, { part_id:part.id, part_name:part.name, sku:part.sku||"",
        unit_price:part.price||0, qty:1, stock_max:part.stock_qty||0 }];
    });
    setSearch(""); setSearchRes([]);
  }

  function updateQty(idx, delta) {
    setCart(prev => prev.map((item,i) => {
      if (i!==idx) return item;
      return {...item, qty: Math.max(1, Math.min(item.qty+delta, item.stock_max))};
    }));
  }
  function updatePrice(idx, val) {
    setCart(prev => prev.map((item,i) => i===idx ? {...item, unit_price:Number(val)||0} : item));
  }
  function removeItem(idx) { setCart(prev => prev.filter((_,i)=>i!==idx)); }

  const subtotal = cart.reduce((s,i) => s + i.qty*i.unit_price, 0);
  const total    = Math.max(0, subtotal - (discount||0));

  async function handleSubmit() {
    if (cart.length===0) { showToast("⚠️ Giỏ hàng trống!"); return; }
    if (!payMethod)       { showToast("⚠️ Chưa chọn hình thức thanh toán!"); return; }
    setSubmitting(true);
    try {
      const orderCode = genCode();
      const items = cart.map(i => ({
        part_id:i.part_id, part_name:i.part_name, sku:i.sku,
        qty:i.qty, unit_price:i.unit_price, total_price:i.qty*i.unit_price,
      }));
      // 1. Tạo sale_order
      const so = await SaleOrder.create({
        order_code:orderCode, customer_name:custName, customer_phone:custPhone,
        items, subtotal, discount:discount||0, total, payment_method:payMethod,
        cashier_id:user.id||"", cashier_name:user.full_name||user.name||"", status:"paid",
      });
      // 2. Tạo sale_order_items
      await Promise.all(items.map(item => SaleOrderItem.create({
        sale_order_id:so.id, sale_order_code:orderCode,
        part_id:item.part_id, part_name:item.part_name, sku:item.sku,
        qty:item.qty, unit_price:item.unit_price, total_price:item.total_price,
      })));
      // 3. Trừ stock + tạo movement
      await Promise.all(cart.map(async item => {
        try { await SparePart.update(item.part_id, { stock_qty:Math.max(0, item.stock_max-item.qty) }); } catch {}
        try {
          await StockMovement.create({
            movement_type:"sale", part_id:item.part_id, part_name:item.part_name, sku:item.sku,
            qty_change:-item.qty, unit_price:item.unit_price,
            ref_type:"sale_order", ref_code:orderCode, created_by_name:user.full_name||user.name||"",
          });
        } catch {}
      }));
      // KT-2: auto ghi debt_voucher / cash_journal
      try {
        if (payMethod === "credit") {
          await DebtVoucher.create({
            voucher_code:  "PT-BL-" + String(Date.now()).slice(-6),
            voucher_type:  "receivable", party_type: "customer",
            party_id:      custPhone || "",
            party_name:    custName  || "Khách lẻ",
            origin_type:   "sale_order", origin_id: so.id, origin_code: orderCode,
            total_amount:  total, paid_amount: 0, remaining: total, status: "open",
            created_by_id: user.id, created_by_name: user.full_name || user.name || "",
          });
        }
        if (payMethod === "cash") {
          await CashJournal.create({
            journal_date:    new Date().toISOString().slice(0,10),
            entry_type:      "receipt", amount: total,
            ref_type:        "sale_order", ref_id: so.id, ref_code: orderCode,
            description:     "Bán lẻ: " + (custName || "Khách lẻ"),
            payment_method:  "cash",
            created_by_id:   user.id, created_by_name: user.full_name || user.name || "",
          });
        }
      } catch(e) { console.error("KT-2 sale debt/cash:", e); }
      setLastOrder({...so, order_code:orderCode, items, subtotal, discount:discount||0, total,
        payment_method:payMethod, customer_name:custName, customer_phone:custPhone});
      setCart([]); setCustName(""); setCustPhone(""); setDiscount(0); setPayMethod(""); setCashAmt(0); setTransferAmt(0);
      showToast("✅ Bán hàng thành công!");
      loadTodayOrders();
    } catch(e) { showToast("❌ Lỗi: "+e.message); }
    setSubmitting(false);
  }

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <style>{RECEIPT_STYLE}</style>

      {lastOrder && (
        <div className="print-receipt">
          <div style={{ textAlign:"center", marginBottom:8 }}>
            <b style={{ fontSize:16 }}>{shopName}</b><br/>
            {shopPhone && <span>SĐT: {shopPhone}</span>}
          </div>
          <div style={{ borderTop:"1px dashed #000", margin:"8px 0" }} />
          <div>Mã đơn: {lastOrder.order_code}</div>
          <div>Ngày: {fmtDateTime(new Date().toISOString())}</div>
          {lastOrder.customer_name  && <div>Khách: {lastOrder.customer_name}</div>}
          {lastOrder.customer_phone && <div>SĐT: {lastOrder.customer_phone}</div>}
          <div style={{ borderTop:"1px dashed #000", margin:"8px 0" }} />
          <table style={{ width:"100%", fontSize:11 }}>
            <thead><tr><th style={{ textAlign:"left" }}>Sản phẩm</th><th>SL</th><th style={{ textAlign:"right" }}>T.Tiền</th></tr></thead>
            <tbody>{(lastOrder.items||[]).map((it,i)=>(
              <tr key={i}><td>{it.part_name}</td><td style={{ textAlign:"center" }}>{it.qty}</td><td style={{ textAlign:"right" }}>{fmtMoney(it.total_price)}</td></tr>
            ))}</tbody>
          </table>
          <div style={{ borderTop:"1px dashed #000", margin:"8px 0" }} />
          {lastOrder.discount>0 && <div>Giảm giá: -{fmtMoney(lastOrder.discount)}</div>}
          <div><b>Tổng thanh toán: {fmtMoney(lastOrder.total)}</b></div>
          <div>HTTT: {PM_LABELS[lastOrder.payment_method]||lastOrder.payment_method}</div>
          <div style={{ textAlign:"center", marginTop:8, borderTop:"1px dashed #000", paddingTop:8 }}>Cảm ơn quý khách! 🙏</div>
        </div>
      )}

      <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:20 }}>💰 Bán hàng lẻ</div>

      {/* Search */}
      <div style={{ marginBottom:16, position:"relative" }}>
        <div style={{ position:"relative" }}>
          <span className="material-icons" style={{ fontFamily:"Material Icons", position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9ca3af", fontSize:20 }}>search</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Tìm linh kiện theo tên hoặc SKU..." style={{...INP, paddingLeft:40}} />
        </div>
        {searchRes.length > 0 && (
          <div style={{ position:"absolute", top:48, left:0, right:0, background:"#fff", border:"1.5px solid #e5e7eb",
            borderRadius:12, zIndex:50, boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:320, overflowY:"auto" }}>
            {searchRes.map(p => (
              <div key={p.id} onClick={()=>addToCart(p)}
                style={{ padding:"12px 16px", cursor:p.stock_qty>0?"pointer":"not-allowed",
                  borderBottom:"1px solid #f3f4f6", opacity:p.stock_qty>0?1:0.5,
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:"#6b7280" }}>{p.sku} · {fmtMoney(p.price)}</div>
                </div>
                {p.stock_qty>0
                  ? <span style={{ fontSize:12, background:"#dcfce7", color:"#059669", borderRadius:99, padding:"2px 10px", fontWeight:700 }}>Còn {p.stock_qty}</span>
                  : <span style={{ fontSize:12, background:"#fee2e2", color:"#dc2626", borderRadius:99, padding:"2px 10px", fontWeight:700 }}>Hết hàng</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", marginBottom:16, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", fontWeight:800, fontSize:14 }}>
            🛒 Giỏ hàng ({cart.length} SP)
          </div>
          {cart.map((item,idx) => (
            <div key={idx} style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6",
              display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{item.part_name}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <input type="number" value={item.unit_price} min={0}
                    onChange={e=>updatePrice(idx,e.target.value)}
                    style={{ width:100, height:32, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 8px", fontSize:13 }} />
                  <span style={{ fontSize:12, color:"#6b7280" }}>đ/cái</span>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <button onClick={()=>updateQty(idx,-1)} style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #e5e7eb", background:"#f9fafb", cursor:"pointer", fontWeight:900, fontSize:16 }}>−</button>
                <span style={{ fontWeight:800, fontSize:15, minWidth:24, textAlign:"center" }}>{item.qty}</span>
                <button onClick={()=>updateQty(idx,+1)} style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #e5e7eb", background:"#f9fafb", cursor:"pointer", fontWeight:900, fontSize:16 }}>+</button>
              </div>
              <div style={{ fontWeight:800, fontSize:14, color:"#059669", minWidth:72, textAlign:"right" }}>{fmtMoney(item.qty*item.unit_price)}</div>
              <button onClick={()=>removeItem(idx)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:22, padding:2 }}>×</button>
            </div>
          ))}
          <div style={{ padding:"12px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ color:"#6b7280" }}>Tạm tính</span>
              <span style={{ fontWeight:700 }}>{fmtMoney(subtotal)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ color:"#6b7280" }}>Giảm giá</span>
              <input type="number" value={discount} min={0} onChange={e=>setDiscount(Number(e.target.value)||0)}
                style={{ width:130, height:36, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, textAlign:"right" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", paddingTop:8, borderTop:"1.5px solid #e5e7eb" }}>
              <span style={{ fontWeight:900, fontSize:16 }}>Tổng thanh toán</span>
              <span style={{ fontWeight:900, fontSize:20, color:"#059669" }}>{fmtMoney(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* KH info — autocomplete */}
      <div style={{ marginBottom:16 }}>
        <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Khách hàng (tuỳ chọn)</label>

        {/* Chip khi đã chọn */}
        {custName ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
            background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:12 }}>
            <span style={{ fontSize:14, fontWeight:700, color:"#059669", flex:1 }}>
              ✅ {custName}{custPhone ? " — " + custPhone : ""}
            </span>
            <button onClick={()=>{ setCustName(""); setCustPhone(""); setCustSearch(""); setCustSuggestions([]); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:"#6b7280", fontSize:18, lineHeight:1, padding:"0 4px" }}>×</button>
          </div>
        ) : (
          <div style={{ position:"relative" }}>
            <input value={custSearch}
              onChange={e=>{ setCustSearch(e.target.value); if (!e.target.value) { setCustName(""); setCustPhone(""); } }}
              placeholder="Tìm tên hoặc SĐT khách..."
              style={INP} />

            {/* Dropdown gợi ý */}
            {custSuggestions.length > 0 && (
              <div style={{ position:"absolute", top:46, left:0, right:0, background:"#fff",
                border:"1.5px solid #e5e7eb", borderRadius:12, zIndex:100,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:240, overflowY:"auto" }}>
                {custSuggestions.map(c => (
                  <div key={c.id}
                    onClick={()=>{ setCustName(c.full_name||""); setCustPhone(c.phone||""); setCustSearch((c.full_name||"")+(c.phone?" — "+c.phone:"")); setCustSuggestions([]); }}
                    style={{ padding:"11px 16px", cursor:"pointer", borderBottom:"1px solid #f3f4f6",
                      display:"flex", justifyContent:"space-between", alignItems:"center" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{c.full_name}</span>
                    <span style={{ fontSize:12, color:"#6b7280" }}>{c.phone||""}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Khách mới: hiện 2 input nhập tay */}
            {custSearch.length >= 2 && custSuggestions.length === 0 && !custName && (
              <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:"#6b7280", display:"block", marginBottom:4 }}>Tên khách mới</label>
                  <input value={custName} onChange={e=>setCustName(e.target.value)}
                    placeholder="Nguyễn Văn A" style={INP} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:"#6b7280", display:"block", marginBottom:4 }}>SĐT</label>
                  <input value={custPhone} onChange={e=>setCustPhone(e.target.value)}
                    placeholder="0901234567" type="tel" style={INP} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HTTT */}
      <div style={{ marginBottom:16 }}>
        <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:8 }}>Hình thức thanh toán</label>
        <div style={{ display:"flex", gap:8 }}>
          {["cash","transfer","combo","credit"].map(pm => (
            <button key={pm} onClick={()=>setPayMethod(pm)}
              style={{ flex:1, height:44, borderRadius:12,
                border:"2px solid " + (payMethod===pm ? PM_COLORS[pm] : "#e5e7eb"),
                background: payMethod===pm ? PM_COLORS[pm] : "#f9fafb",
                color: payMethod===pm ? "#fff" : "#374151",
                fontWeight:800, fontSize:13, cursor:"pointer" }}>
              {PM_LABELS[pm]}
            </button>
          ))}
        </div>
        {payMethod==="combo" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Tiền mặt</label>
              <input type="number" value={cashAmt} onChange={e=>setCashAmt(Number(e.target.value)||0)} style={INP} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Chuyển khoản</label>
              <input type="number" value={transferAmt} onChange={e=>setTransferAmt(Number(e.target.value)||0)} style={INP} />
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display:"flex", gap:12, marginBottom:28 }}>
        <button onClick={handleSubmit} disabled={submitting||cart.length===0}
          style={{ flex:2, height:44, background:"#059669", color:"#fff", border:"none", borderRadius:12,
            fontWeight:800, fontSize:14, cursor:"pointer", opacity:(submitting||cart.length===0)?0.6:1 }}>
          {submitting ? "⏳ Đang xử lý..." : "✅ Xác nhận bán"}
        </button>
        {lastOrder && (
          <button onClick={()=>window.print()} style={{ flex:1, height:44, background:"#374151", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer" }}>
            🖨️ In HĐ
          </button>
        )}
      </div>

      {/* Today orders */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", fontWeight:800, fontSize:14 }}>
          📋 Đơn bán hôm nay ({todayOrders.length})
        </div>
        {todayOrders.length===0
          ? <div style={{ textAlign:"center", padding:"24px 0", color:"#9ca3af", fontSize:13 }}>Chưa có đơn bán nào hôm nay</div>
          : todayOrders.map(o => (
            <div key={o.id} onClick={()=>setDetailOrder(o)}
              style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", cursor:"pointer",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{o.order_code}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{fmtTime(o.created||o.created_date)} · {o.customer_name||"Khách lẻ"}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:800, color:"#059669" }}>{fmtMoney(o.total)}</div>
                <span style={{ fontSize:11, background:(PM_COLORS[o.payment_method]||"#9ca3af")+"22",
                  color:PM_COLORS[o.payment_method]||"#9ca3af", borderRadius:99, padding:"2px 8px", fontWeight:700 }}>
                  {PM_LABELS[o.payment_method]||o.payment_method}
                </span>
              </div>
            </div>
          ))
        }
      </div>

      {/* Detail modal */}
      {detailOrder && (
        <div onClick={()=>setDetailOrder(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:"#fff", borderRadius:"20px 20px 0 0", padding:"20px 16px 40px",
              width:"100%", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ fontWeight:900, fontSize:16, marginBottom:4 }}>{detailOrder.order_code}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:16 }}>{fmtDateTime(detailOrder.created||detailOrder.created_date)}</div>
            {(detailOrder.items||[]).map((it,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f3f4f6" }}>
                <span style={{ fontSize:13 }}>{it.part_name} × {it.qty}</span>
                <span style={{ fontWeight:700, fontSize:13 }}>{fmtMoney(it.total_price)}</span>
              </div>
            ))}
            <div style={{ marginTop:12, display:"flex", justifyContent:"space-between", fontWeight:900, fontSize:15 }}>
              <span>Tổng</span><span style={{ color:"#059669" }}>{fmtMoney(detailOrder.total)}</span>
            </div>
            <div style={{ marginTop:6, fontSize:12, color:"#6b7280" }}>HTTT: {PM_LABELS[detailOrder.payment_method]||detailOrder.payment_method}</div>
            <button onClick={()=>setDetailOrder(null)}
              style={{ marginTop:16, width:"100%", height:44, background:"#f3f4f6", border:"none", borderRadius:12, fontWeight:700, cursor:"pointer" }}>
              Đóng
            </button>
          </div>
        </div>
      )}

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
