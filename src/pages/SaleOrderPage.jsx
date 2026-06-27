/* SaleOrderPage.jsx — POS bán hàng lẻ */
import React, { useState, useEffect, useRef } from "react";
import { SparePart, SaleOrder, SaleOrderItem, StockMovement, AppSettings, Customer , DebtVoucher, CashJournal } from "./pb.jsx";
import { previewSaleReceipt } from "../utils/printClient.js";

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
  const [shopInfo,    setShopInfo]    = useState({});
  React.useEffect(() => {
    AppSettings.filter({}).then(settings => {
      const map = {};
      (settings||[]).forEach(s => { map[s.key] = s.value; });
      setShopInfo({ shop_name: map.shop_name||"", shop_phone: map.shop_phone||"", shop_address: map.shop_address||"" });
    }).catch(()=>{});
  }, []);
  const [toast,       setToast]       = useState("");
  const [todayOrders, setTodayOrders] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null);
  const [lastOrder,   setLastOrder]   = useState(null);
  const [shopName,    setShopName]    = useState("HK One Touch");
  const [shopPhone,   setShopPhone]   = useState("");
  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
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
      const list = await SaleOrder.list({ limit:100, sort:"-id" });
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
      const itemsPayload = cart.map(i => ({
        part_id:i.part_id, part_name:i.part_name, sku:i.sku||"",
        qty:i.qty, unit_price:i.unit_price, total_price:i.qty*i.unit_price,
      }));

      // Bước 1: Tạo sale_order (KHÔNG truyền field items)
      let so;
      try {
        console.log("🔵 Đang tạo sale_order...", { orderCode, custName, payMethod, subtotal, discount, total });
        so = await SaleOrder.create({
          order_code:     orderCode,
          customer_name:  custName || "Khách lẻ",
          customer_phone: custPhone || "",
          subtotal,
          discount:       discount || 0,
          total,
          payment_method: payMethod,
          cashier_id:     user.id || "",
          cashier_name:   user.full_name || user.name || "",
          status:         "completed",
        });
        console.log("✅ Tạo sale_order thành công:", so);
      } catch(e) {
        console.error("❌ Lỗi tạo sale_order:", e);
        showToast("❌ Lỗi tạo đơn: " + (e?.message || e?.data?.message || JSON.stringify(e)));
        setSubmitting(false); return;
      }

      // Bước 2: Tạo sale_order_items
      try {
        await Promise.all(itemsPayload.map(item => SaleOrderItem.create({
          sale_order_id:   so.id,
          sale_order_code: orderCode,
          part_id:         item.part_id,
          part_name:       item.part_name,
          sku:             item.sku,
          qty:             item.qty,
          unit_price:      item.unit_price,
          total_price:     item.total_price,
        })));
      } catch(e) { console.warn("Lỗi tạo items:", e.message); }

      // Bước 3: Trừ stock + tạo movement
      for (const item of cart) {
        try { await SparePart.update(item.part_id, { stock_qty: Math.max(0, item.stock_max - item.qty) }); } catch {}
        try {
          await StockMovement.create({
            movement_type: "sale",
            part_id:       item.part_id,
            part_name:     item.part_name,
            sku:           item.sku || "",
            qty_change:    -item.qty,
            unit_price:    item.unit_price,
            ref_type:      "sale_order",
            ref_code:      orderCode,
            created_by_name: user.full_name || user.name || "",
          });
        } catch(e) { console.warn("Lỗi trừ stock:", e.message); }
      }

      // Bước 4: Ghi kế toán
      try {
        if (payMethod === "credit") {
          await DebtVoucher.create({
            voucher_code:  "PT-BL-" + String(Date.now()).slice(-6),
            voucher_type:  "receivable",
            party_type:    "customer",
            party_name:    custName || "Khách lẻ",
            origin_type:   "sale_order",
            origin_id:     so.id,
            origin_code:   orderCode,
            total_amount:  total,
            paid_amount:   0,
            remaining:     total,
            status:        "open",
            created_by_id:   user.id,
            created_by_name: user.full_name || user.name || "",
          });
        }
        if (payMethod === "cash" || payMethod === "transfer") {
          await CashJournal.create({
            journal_date:    new Date().toISOString().slice(0, 10),
            entry_type:      "receipt",
            amount:          total,
            ref_type:        "sale_order",
            ref_id:          so.id,
            ref_code:        orderCode,
            description:     "Bán lẻ: " + (custName || "Khách lẻ"),
            payment_method:  payMethod,
            created_by_id:   user.id,
            created_by_name: user.full_name || user.name || "",
          });
        }
      } catch(e) { console.warn("Lỗi ghi kế toán:", e.message); }

      // Reset form
      setLastOrder({ ...so, order_code: orderCode, items: itemsPayload, subtotal, discount: discount||0, total,
        payment_method: payMethod, customer_name: custName, customer_phone: custPhone });
      setCart([]); setCustName(""); setCustPhone(""); setDiscount(0); setPayMethod(""); setCashAmt(0); setTransferAmt(0);
      showToast("✅ Bán hàng thành công!");
      loadTodayOrders();
    } catch(e) {
      showToast("❌ Lỗi không xác định: " + e.message);
    }
    setSubmitting(false);
  }

  return (
    <div style={{ padding: isPC ? "20px 28px 40px" : "16px 14px 100px" }}>
      
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

      <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:16 }}>
        🛒 Bán hàng lẻ
      </div>

      {/* ── LAYOUT WRAPPER 2 cột (PC) / 1 cột (Mobile) ── */}
      <div style={{
        display: isPC ? "grid" : "block",
        gridTemplateColumns: isPC ? "1fr 420px" : undefined,
        gap: isPC ? 24 : undefined,
        alignItems: "start",
      }}>

      {/* ═══ CỘT TRÁI — Search + Giỏ hàng + Đơn hôm nay ═══ */}
      <div>

      {/* ─── Banner thành công ─── */}
      {lastOrder && (
        <div style={{
          background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",
          border:"2px solid #86efac", borderRadius:16,
          padding:"16px 20px", marginBottom:16,
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontWeight:900, fontSize:16, color:"#065f46", marginBottom:4 }}>
                ✅ Bán hàng thành công!
              </div>
              <div style={{ fontSize:13, color:"#047857", fontWeight:700 }}>
                {lastOrder.order_code} · {PM_LABELS[lastOrder.payment_method]||lastOrder.payment_method}
              </div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>
                {lastOrder.customer_name && lastOrder.customer_name !== "Khách lẻ"
                  ? "👤 " + lastOrder.customer_name
                  : "👤 Khách lẻ"}
                {lastOrder.customer_phone ? " · " + lastOrder.customer_phone : ""}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontWeight:900, fontSize:22, color:"#059669" }}>
                {fmtMoney(lastOrder.total)}
              </div>
              {lastOrder.discount > 0 && (
                <div style={{ fontSize:11, color:"#dc2626" }}>Giảm: -{fmtMoney(lastOrder.discount)}</div>
              )}
            </div>
          </div>
          <div style={{ marginTop:12, paddingTop:12, borderTop:"1px dashed #86efac" }}>
            {(lastOrder.items||[]).map((it,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                fontSize:12, color:"#374151", padding:"3px 0" }}>
                <span>{it.part_name} × {it.qty}</span>
                <span style={{ fontWeight:700 }}>{fmtMoney(it.total_price)}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button onClick={() => { if (lastOrder) previewSaleReceipt(lastOrder, shopInfo); }}
              style={{ flex:1, height:40, borderRadius:10, border:"none",
                background:"#059669", color:"#fff",
                fontWeight:800, fontSize:13, cursor:"pointer" }}>
              🖨️ In hóa đơn
            </button>
            <button onClick={()=>setLastOrder(null)}
              style={{ flex:1, height:40, borderRadius:10,
                border:"1.5px solid #059669", background:"#fff",
                color:"#059669", fontWeight:800, fontSize:13, cursor:"pointer" }}>
              + Đơn mới
            </button>
          </div>
        </div>
      )}

      {/* ─── Placeholder giỏ trống ─── */}
      {cart.length === 0 && !lastOrder && (
        <div style={{
          background:"#fff", borderRadius:16, border:"1.5px dashed #e5e7eb",
          padding:"32px 20px", textAlign:"center", color:"#9ca3af",
          marginBottom:16,
        }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🛒</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#6b7280", marginBottom:4 }}>
            Giỏ hàng trống
          </div>
          <div style={{ fontSize:12 }}>Tìm linh kiện / phụ kiện bên trên để thêm vào đơn</div>
        </div>
      )}

      {/* ─── 1. Search sản phẩm ─── */}
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

      {/* ─── 5. Giỏ hàng — chỉ hiện khi có sản phẩm ─── */}
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
        </div>
      )}


      {/* ─── 8. Danh sách đơn hôm nay ─── */}
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


      </div>{/* end cột trái */}

      {/* ═══ CỘT PHẢI — Khách hàng + Giảm giá + HTTT + Summary + Nút XN ═══ */}
      <div style={{
        background: isPC ? "#fff" : "transparent",
        border: isPC ? "1.5px solid #e5e7eb" : "none",
        borderRadius: isPC ? 20 : 0,
        padding: isPC ? "20px 20px" : 0,
        position: isPC ? "sticky" : undefined,
        top: isPC ? 20 : undefined,
      }}>

      {/* ─── 2. Khách hàng — luôn hiển thị ─── */}
      <div style={{ marginBottom:16 }}>
        <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Khách hàng (tuỳ chọn)</label>
        {custName ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
            background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:12 }}>
            <span style={{ fontSize:14, fontWeight:700, color:"#059669", flex:1 }}>
              ✅ {custName}{custPhone ? " — " + custPhone : ""}
            </span>
            <button onClick={()=>{ setCustName(""); setCustPhone(""); setCustSearch(""); setCustSuggestions([]); }}
              style={{ background:"none", border:"none", color:"#dc2626", fontWeight:800, fontSize:18, cursor:"pointer", lineHeight:1 }}>×</button>
          </div>
        ) : (
          <div style={{ position:"relative" }}>
            <input value={custSearch} onChange={e=>setCustSearch(e.target.value)}
              placeholder="Tên hoặc SĐT khách..." style={INP} />
            {custSuggestions.length > 0 && (
              <div style={{ position:"absolute", top:48, left:0, right:0, background:"#fff",
                border:"1.5px solid #e5e7eb", borderRadius:12, zIndex:50,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:220, overflowY:"auto" }}>
                {custSuggestions.map(c => (
                  <div key={c.id} onClick={()=>{ setCustName(c.full_name||c.name||""); setCustPhone(c.phone||""); setCustSearch(""); setCustSuggestions([]); }}
                    style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6",
                      display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{c.full_name||c.name}</div>
                      <div style={{ fontSize:12, color:"#6b7280" }}>{c.phone}</div>
                    </div>
                    {c.total_orders > 0 && (
                      <span style={{ fontSize:11, color:"#4f46e5", background:"#eef2ff", borderRadius:99, padding:"2px 8px", fontWeight:700 }}>
                        {c.total_orders} đơn
                      </span>
                    )}
                  </div>
                ))}
                <div onClick={()=>{ setCustName(custSearch); setCustPhone(""); setCustSearch(""); setCustSuggestions([]); }}
                  style={{ padding:"10px 14px", cursor:"pointer", color:"#4f46e5", fontWeight:700, fontSize:13,
                    borderTop:"1.5px solid #e5e7eb", background:"#f5f3ff" }}>
                  + Dùng "{custSearch}" (khách mới)
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. Giảm giá — luôn hiển thị ─── */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"12px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <span style={{ fontWeight:700, fontSize:14, color:"#374151" }}>Giảm giá</span>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input
              type="number"
              value={discount || ""}
              min={0}
              max={subtotal || 0}
              placeholder="0"
              onChange={e => setDiscount(Math.min(subtotal || 0, Number(e.target.value) || 0))}
              style={{ width:140, height:40, borderRadius:10, border:"1.5px solid #e5e7eb",
                padding:"0 12px", fontSize:14, textAlign:"right", outline:"none" }}
            />
            <span style={{ fontSize:13, color:"#6b7280", fontWeight:600 }}>đ</span>
          </div>
        </div>
        {discount > 0 && (
          <div style={{ fontSize:12, color:"#059669", fontWeight:600, textAlign:"right" }}>
            Tiết kiệm: -{fmtMoney(discount)}
          </div>
        )}
      </div>

      {/* ─── 4. Hình thức thanh toán — luôn hiển thị ─── */}
      <div style={{ marginBottom:16 }}>
        <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:8 }}>Hình thức thanh toán</label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {["cash","transfer","combo","credit"].map(pm => (
            <button key={pm} onClick={()=>setPayMethod(pm)}
              style={{
                height:44, borderRadius:12,
                border:"2px solid " + (payMethod===pm ? PM_COLORS[pm] : "#e5e7eb"),
                background: payMethod===pm ? PM_COLORS[pm] : "#f9fafb",
                color: payMethod===pm ? "#fff" : "#374151",
                fontWeight:800, fontSize:13, cursor:"pointer",
              }}>
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

      {/* ─── 6. Summary — luôn hiển thị ─── */}
      <div style={{ background:"#f0fdf4", borderRadius:16, border:"1.5px solid #86efac", padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"#6b7280", fontSize:13 }}>Tạm tính</span>
          <span style={{ fontWeight:700 }}>{fmtMoney(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ color:"#6b7280", fontSize:13 }}>Giảm giá</span>
            <span style={{ fontWeight:700, color:"#dc2626" }}>-{fmtMoney(discount)}</span>
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", paddingTop:8, borderTop:"1.5px solid #86efac" }}>
          <span style={{ fontWeight:900, fontSize:16 }}>Tổng thanh toán</span>
          <span style={{ fontWeight:900, fontSize:22, color:"#059669" }}>{fmtMoney(total)}</span>
        </div>
      </div>

      {/* ─── 7. Nút xác nhận + In ─── */}
      <div style={{ display:"flex", gap:12, marginBottom:28 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0 || !payMethod}
          style={{
            flex:2, height:52, borderRadius:14, border:"none",
            background: (submitting || cart.length === 0 || !payMethod) ? "#e5e7eb" : "linear-gradient(135deg,#059669,#047857)",
            color: (submitting || cart.length === 0 || !payMethod) ? "#9ca3af" : "#fff",
            fontWeight:900, fontSize:16,
            cursor: (submitting || cart.length === 0 || !payMethod) ? "not-allowed" : "pointer",
          }}>
          {submitting ? "⏳ Đang lưu..." : cart.length === 0 ? "Chưa có sản phẩm" : !payMethod ? "Chọn hình thức TT" : "✅ Xác nhận bán"}
        </button>

      </div>

      </div>{/* end cột phải */}
      </div>{/* end layout wrapper */}

      {/* ─── 9. Detail modal ─── */}
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