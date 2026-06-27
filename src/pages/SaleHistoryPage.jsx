/* SaleHistoryPage.jsx — Quản lý đơn bán hàng (nâng cấp đầy đủ) */
import React, { useState, useEffect } from "react";
import { SaleOrder, SaleOrderItem } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN")+"đ"; }
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear()
    +" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}

const PM_LABELS = { cash:"Tiền mặt", transfer:"Chuyển khoản", combo:"Kết hợp", credit:"Bán chịu" };
const PM_COLORS = { cash:"#059669", transfer:"#2563eb", combo:"#7c3aed", credit:"#dc2626" };

function statusBadge(status) {
  if (status === "completed") return { label:"Hoàn thành", bg:"#dcfce7", color:"#059669" };
  if (status === "credit")    return { label:"Bán chịu",   bg:"#fee2e2", color:"#dc2626" };
  return { label: status||"—", bg:"#f3f4f6", color:"#6b7280" };
}

async function reprintOrder(order, items) {
  try {
    await fetch("http://localhost:7979/print", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-token":"hk-print-2026" },
      body: JSON.stringify({
        type: "sale_receipt",
        order_code:     order.order_code,
        customer_name:  order.customer_name,
        customer_phone: order.customer_phone,
        cashier_name:   order.cashier_name,
        payment_method: order.payment_method,
        subtotal:       order.subtotal,
        discount:       order.discount,
        total:          order.total,
        items: items.map(it => ({
          part_name:   it.part_name,
          sku:         it.sku,
          qty:         it.qty,
          unit_price:  it.unit_price,
          total_price: it.total_price,
        })),
        created: order.created || order.created_date,
      }),
    });
  } catch(e) {
    alert("⚠️ Không kết nối được máy in. Kiểm tra Print Agent.");
  }
}

/* ─── Detail Panel / Modal content (dùng chung PC+Mobile) ─── */
function DetailContent({ detail, detailItems, onClose }) {
  const sb = statusBadge(detail.status);
  const subtotal = detail.subtotal ?? detailItems.reduce((s,i)=>s+(i.total_price||0),0);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontWeight:900, fontSize:17, color:"#1e1b4b" }}>{detail.order_code}</span>
            <span style={{ fontSize:11, fontWeight:700, borderRadius:99, padding:"2px 10px",
              background:(PM_COLORS[detail.payment_method]||"#9ca3af")+"20",
              color:PM_COLORS[detail.payment_method]||"#6b7280" }}>
              {PM_LABELS[detail.payment_method]||detail.payment_method||"?"}
            </span>
            <span style={{ fontSize:11, fontWeight:700, borderRadius:99, padding:"2px 10px",
              background:sb.bg, color:sb.color }}>
              {sb.label}
            </span>
          </div>
          <div style={{ fontSize:12, color:"#6b7280" }}>
            🕐 {fmtDateTime(detail.created||detail.created_date)}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:24, color:"#6b7280", lineHeight:1, flexShrink:0 }}>×</button>
        )}
      </div>

      {/* Block 2 — Thông tin giao dịch */}
      <div style={{ background:"#f9fafb", borderRadius:12, padding:"12px 14px", marginBottom:14, fontSize:13, display:"grid", gridTemplateColumns:"auto 1fr", gap:"6px 12px" }}>
        <span style={{ color:"#9ca3af", fontWeight:600 }}>Thu ngân</span>
        <span style={{ fontWeight:700 }}>{detail.cashier_name||"—"}</span>
        <span style={{ color:"#9ca3af", fontWeight:600 }}>Khách hàng</span>
        <span style={{ fontWeight:700 }}>
          {detail.customer_name||"Khách lẻ"}
          {detail.customer_phone ? <span style={{ color:"#6b7280", fontWeight:500 }}> — {detail.customer_phone}</span> : ""}
        </span>
        <span style={{ color:"#9ca3af", fontWeight:600 }}>HTTT</span>
        <span style={{ fontWeight:700 }}>{PM_LABELS[detail.payment_method]||detail.payment_method||"—"}</span>
        {detail.note && <>
          <span style={{ color:"#9ca3af", fontWeight:600 }}>Ghi chú</span>
          <span style={{ fontWeight:500, fontStyle:"italic", color:"#374151" }}>{detail.note}</span>
        </>}
      </div>

      {/* Block 3 — Danh sách sản phẩm */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontWeight:800, fontSize:13, marginBottom:8, color:"#374151" }}>📦 Sản phẩm</div>
        {detailItems.length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:13, textAlign:"center", padding:"16px 0" }}>⏳ Đang tải...</div>
        ) : (
          <div style={{ borderRadius:12, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"#f9fafb" }}>
                  <th style={{ textAlign:"left", padding:"8px 12px", fontWeight:700, color:"#6b7280" }}>Sản phẩm</th>
                  <th style={{ textAlign:"left", padding:"8px 6px", fontWeight:700, color:"#6b7280" }}>SKU</th>
                  <th style={{ textAlign:"right", padding:"8px 6px", fontWeight:700, color:"#6b7280" }}>Đ.Giá</th>
                  <th style={{ textAlign:"center", padding:"8px 6px", fontWeight:700, color:"#6b7280" }}>SL</th>
                  <th style={{ textAlign:"right", padding:"8px 12px", fontWeight:700, color:"#6b7280" }}>T.Tiền</th>
                </tr>
              </thead>
              <tbody>
                {detailItems.map((it,i) => (
                  <tr key={i} style={{ borderTop:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"10px 12px", fontWeight:700, fontSize:13 }}>{it.part_name}</td>
                    <td style={{ padding:"10px 6px", color:"#9ca3af", fontSize:11 }}>{it.sku||"—"}</td>
                    <td style={{ padding:"10px 6px", textAlign:"right", color:"#374151" }}>{fmtMoney(it.unit_price)}</td>
                    <td style={{ padding:"10px 6px", textAlign:"center", fontWeight:700 }}>{it.qty}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:800, color:"#059669" }}>{fmtMoney(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block 4 — Tổng kết */}
      <div style={{ background:"#f0fdf4", borderRadius:12, padding:"14px 16px", marginBottom:14, fontSize:13 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, color:"#6b7280" }}>
          <span>Tạm tính</span>
          <span style={{ fontWeight:700, color:"#374151" }}>{fmtMoney(subtotal)}</span>
        </div>
        {(detail.discount||0) > 0 && (
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, color:"#dc2626" }}>
            <span>Giảm giá</span>
            <span style={{ fontWeight:700 }}>-{fmtMoney(detail.discount)}</span>
          </div>
        )}
        <div style={{ borderTop:"1.5px solid #86efac", paddingTop:10, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontWeight:900, fontSize:15 }}>Tổng thanh toán</span>
          <span style={{ fontWeight:900, fontSize:18, color:"#059669" }}>{fmtMoney(detail.total)}</span>
        </div>
      </div>

      {/* Block 5 — Actions */}
      {detailItems.length > 0 && (
        <button onClick={()=>reprintOrder(detail, detailItems)}
          style={{ width:"100%", height:42, borderRadius:12, border:"1.5px solid #bfdbfe",
            background:"#eff6ff", color:"#1d4ed8", fontWeight:800, fontSize:13, cursor:"pointer" }}>
          🖨️ In lại hóa đơn
        </button>
      )}
    </div>
  );
}

export default function SaleHistoryPage({ user }) {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterPM, setFilterPM]       = useState("all");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [detail, setDetail]           = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [isPC, setIsPC]               = React.useState(window.innerWidth >= 1024);

  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await SaleOrder.list({ sort: "-id", limit: 500 });
      setOrders(data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function openDetail(o) {
    setDetail(o);
    setDetailItems([]);
    try {
      // Ưu tiên field items (json snapshot) nếu có
      if (o.items && Array.isArray(o.items) && o.items.length > 0) {
        setDetailItems(o.items);
      } else {
        const items = await SaleOrderItem.filter({ sale_order_id: o.id });
        setDetailItems(items || []);
      }
    } catch { setDetailItems([]); }
  }

  function closeDetail() { setDetail(null); setDetailItems([]); }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (o.order_code||"").toLowerCase().includes(q)
      || (o.customer_name||"").toLowerCase().includes(q)
      || (o.customer_phone||"").includes(q)
      || (o.cashier_name||"").toLowerCase().includes(q);
    const matchPM = filterPM === "all" || o.payment_method === filterPM;
    const matchDate = (() => {
      if (!dateFrom && !dateTo) return true;
      const d = new Date(o.created || o.created_date);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo   && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    })();
    return matchSearch && matchPM && matchDate;
  });

  const totalRevenue = filtered.reduce((s,o) => s+(o.total||0), 0);

  /* ─── Card mỗi đơn ─── */
  function OrderCard({ o }) {
    const sb = statusBadge(o.status);
    const itemCount = Array.isArray(o.items) ? o.items.length : null;
    const isSelected = detail?.id === o.id;
    return (
      <div onClick={()=>openDetail(o)}
        style={{ background:"#fff", borderRadius:14,
          border: isSelected ? "2px solid #059669" : "1.5px solid #e5e7eb",
          padding:"14px 16px", cursor:"pointer", transition:"box-shadow .15s, border .15s",
          boxShadow: isSelected ? "0 0 0 3px #dcfce7" : "none" }}
        onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)"; }}
        onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.boxShadow="none"; }}>
        {/* Row 1 */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
          <span style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{o.order_code}</span>
          <span style={{ fontSize:11, fontWeight:700, borderRadius:99, padding:"2px 8px",
            background:(PM_COLORS[o.payment_method]||"#9ca3af")+"20",
            color:PM_COLORS[o.payment_method]||"#6b7280" }}>
            {PM_LABELS[o.payment_method]||o.payment_method||"?"}
          </span>
          <span style={{ fontSize:11, fontWeight:700, borderRadius:99, padding:"2px 8px",
            background:sb.bg, color:sb.color }}>
            {sb.label}
          </span>
        </div>
        {/* Row 2 */}
        <div style={{ fontSize:13, color:"#374151", marginBottom:3 }}>
          👤 {o.customer_name||"Khách lẻ"}{o.customer_phone?" · "+o.customer_phone:""}
        </div>
        {/* Row 3 */}
        <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>
          🕐 {fmtDateTime(o.created||o.created_date)}
          {o.cashier_name ? " · 🧑‍💼 "+o.cashier_name : ""}
        </div>
        {/* Row 4 */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:12, color:"#6b7280" }}>
            {itemCount !== null ? `📦 ${itemCount} sản phẩm` : ""}
          </span>
          <div style={{ textAlign:"right" }}>
            {(o.discount||0) > 0 && (
              <div style={{ fontSize:11, color:"#dc2626" }}>-{fmtMoney(o.discount)}</div>
            )}
            <div style={{ fontWeight:900, fontSize:17, color:"#059669" }}>{fmtMoney(o.total)}</div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Bộ lọc ─── */
  function FilterBar() {
    return (
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Mã đơn, tên KH, SĐT, thu ngân..."
          style={{ flex:"1 1 180px", height:40, borderRadius:10, border:"1.5px solid #e5e7eb",
            padding:"0 14px", fontSize:13, outline:"none" }}
        />
        <select value={filterPM} onChange={e=>setFilterPM(e.target.value)}
          style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px",
            fontSize:13, outline:"none", background:"#fff" }}>
          <option value="all">Tất cả HTTT</option>
          <option value="cash">Tiền mặt</option>
          <option value="transfer">Chuyển khoản</option>
          <option value="combo">Kết hợp</option>
          <option value="credit">Bán chịu</option>
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px",
            fontSize:13, outline:"none", background:"#fff" }} />
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px",
            fontSize:13, outline:"none", background:"#fff" }} />
        <button onClick={load}
          style={{ height:40, padding:"0 16px", borderRadius:10, border:"1.5px solid #e5e7eb",
            background:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, color:"#374151" }}>
          🔄
        </button>
      </div>
    );
  }

  /* ─── List ─── */
  function OrderList() {
    if (loading) return <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>⏳ Đang tải...</div>;
    if (filtered.length === 0) return (
      <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>
        <div style={{ fontSize:40, marginBottom:8 }}>📭</div>
        <div>Không có đơn nào</div>
      </div>
    );
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(o => <OrderCard key={o.id} o={o} />)}
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <div style={{ padding: isPC ? "20px 28px 40px" : "20px 16px 80px" }}>
      {/* Title + summary */}
      <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:4 }}>
        📋 Quản lý đơn bán hàng
      </div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
        Toàn bộ lịch sử đơn bán lẻ · {filtered.length} đơn · Tổng: {fmtMoney(totalRevenue)}
      </div>

      {/* Layout wrapper */}
      <div style={{
        display: isPC ? "grid" : "block",
        gridTemplateColumns: isPC ? "1fr 400px" : undefined,
        gap: isPC ? 24 : undefined,
        alignItems: "start",
      }}>
        {/* Cột trái: filter + list */}
        <div>
          {FilterBar()}
          {OrderList()}
        </div>

        {/* Cột phải: detail panel (PC only) */}
        {isPC && (
          <div style={{ position:"sticky", top:20 }}>
            {detail ? (
              <div style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:20,
                maxHeight:"calc(100vh - 60px)", overflowY:"auto" }}>
                <DetailContent detail={detail} detailItems={detailItems} onClose={closeDetail} />
              </div>
            ) : (
              <div style={{ background:"#f9fafb", borderRadius:16, border:"1.5px dashed #e5e7eb",
                padding:40, textAlign:"center", color:"#9ca3af", fontSize:14 }}>
                👆 Chọn một đơn để xem chi tiết
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: modal popup */}
      {!isPC && detail && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:4000,
          display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={e=>{ if(e.target===e.currentTarget) closeDetail(); }}>
          <div style={{ background:"#fff", borderRadius:"20px 20px 0 0", width:"100%",
            maxHeight:"90vh", overflowY:"auto" }}
            onClick={e=>e.stopPropagation()}>
            <DetailContent detail={detail} detailItems={detailItems} onClose={closeDetail} />
          </div>
        </div>
      )}
    </div>
  );
}
