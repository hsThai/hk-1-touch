/* SaleHistoryPage.jsx — Quản lý đơn bán hàng (lịch sử toàn bộ) */
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

export default function SaleHistoryPage({ user }) {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterPM, setFilterPM]   = useState("all");
  const [detail, setDetail]       = useState(null);
  const [detailItems, setDetailItems] = useState([]);

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
    try {
      const items = await SaleOrderItem.filter({ sale_order_id: o.id });
      setDetailItems(items || []);
    } catch { setDetailItems([]); }
  }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (o.order_code||"").toLowerCase().includes(q)
      || (o.customer_name||"").toLowerCase().includes(q)
      || (o.customer_phone||"").includes(q)
      || (o.cashier_name||"").toLowerCase().includes(q);
    const matchPM = filterPM === "all" || o.payment_method === filterPM;
    return matchSearch && matchPM;
  });

  const totalRevenue = filtered.reduce((s,o) => s+(o.total||0), 0);

  return (
    <div style={{ padding:"20px 24px 80px", maxWidth:900, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:4 }}>
        📋 Quản lý đơn bán hàng
      </div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
        Toàn bộ lịch sử đơn bán lẻ · {filtered.length} đơn · Tổng: {fmtMoney(totalRevenue)}
      </div>

      {/* Bộ lọc */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Mã đơn, tên KH, SĐT, thu ngân..."
          style={{ flex:1, minWidth:200, height:40, borderRadius:10, border:"1.5px solid #e5e7eb",
            padding:"0 14px", fontSize:13, outline:"none" }}
        />
        <select value={filterPM} onChange={e=>setFilterPM(e.target.value)}
          style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px",
            fontSize:13, outline:"none", background:"#fff" }}>
          <option value="all">Tất cả hình thức TT</option>
          <option value="cash">Tiền mặt</option>
          <option value="transfer">Chuyển khoản</option>
          <option value="combo">Kết hợp</option>
          <option value="credit">Bán chịu</option>
        </select>
        <button onClick={load}
          style={{ height:40, padding:"0 16px", borderRadius:10, border:"1.5px solid #e5e7eb",
            background:"#fff", cursor:"pointer", fontSize:13, fontWeight:700, color:"#374151" }}>
          🔄 Tải lại
        </button>
      </div>

      {/* Danh sách */}
      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>
          <div style={{ fontSize:40, marginBottom:8 }}>📭</div>
          <div>Không có đơn nào</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(o => (
            <div key={o.id} onClick={()=>openDetail(o)}
              style={{ background:"#fff", borderRadius:14, border:"1.5px solid #e5e7eb",
                padding:"14px 16px", cursor:"pointer", transition:"box-shadow .15s",
                display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                  <span style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{o.order_code}</span>
                  <span style={{ fontSize:11, fontWeight:700, borderRadius:99, padding:"2px 8px",
                    background: (PM_COLORS[o.payment_method]||"#9ca3af")+"20",
                    color: PM_COLORS[o.payment_method]||"#6b7280" }}>
                    {PM_LABELS[o.payment_method]||o.payment_method||"?"}
                  </span>
                </div>
                <div style={{ fontSize:13, color:"#374151", marginBottom:2 }}>
                  👤 {o.customer_name||"Khách lẻ"}{o.customer_phone?" · "+o.customer_phone:""}
                </div>
                <div style={{ fontSize:12, color:"#9ca3af" }}>
                  🕐 {fmtDateTime(o.created||o.created_date)}
                  {o.cashier_name ? " · 🧑‍💼 "+o.cashier_name : ""}
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                {o.discount>0 && (
                  <div style={{ fontSize:11, color:"#dc2626", marginBottom:2 }}>-{fmtMoney(o.discount)}</div>
                )}
                <div style={{ fontWeight:900, fontSize:17, color:"#059669" }}>{fmtMoney(o.total)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:4000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e=>{ if(e.target===e.currentTarget){setDetail(null);setDetailItems([]);} }}>
          <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:520,
            maxHeight:"85vh", overflowY:"auto", padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b" }}>{detail.order_code}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{fmtDateTime(detail.created||detail.created_date)}</div>
              </div>
              <button onClick={()=>{setDetail(null);setDetailItems([]);}}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#6b7280", lineHeight:1 }}>×</button>
            </div>

            <div style={{ background:"#f9fafb", borderRadius:12, padding:"12px 14px", marginBottom:14, fontSize:13 }}>
              <div><b>Khách hàng:</b> {detail.customer_name||"Khách lẻ"} {detail.customer_phone?"· "+detail.customer_phone:""}</div>
              <div><b>Thu ngân:</b> {detail.cashier_name||"—"}</div>
              <div><b>Thanh toán:</b> {PM_LABELS[detail.payment_method]||detail.payment_method}</div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:13, marginBottom:8, color:"#374151" }}>Sản phẩm</div>
              {detailItems.length === 0
                ? <div style={{ color:"#9ca3af", fontSize:13 }}>Đang tải...</div>
                : detailItems.map((it,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between",
                    padding:"8px 0", borderBottom:"1px solid #f3f4f6", fontSize:13 }}>
                    <div>
                      <div style={{ fontWeight:700 }}>{it.part_name}</div>
                      <div style={{ color:"#6b7280", fontSize:12 }}>{fmtMoney(it.unit_price)} × {it.qty}</div>
                    </div>
                    <div style={{ fontWeight:800, color:"#059669" }}>{fmtMoney(it.total_price)}</div>
                  </div>
                ))
              }
            </div>

            <div style={{ background:"#f0fdf4", borderRadius:12, padding:"12px 14px", fontSize:14 }}>
              {detail.discount>0 && (
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, color:"#dc2626" }}>
                  <span>Giảm giá</span><span>-{fmtMoney(detail.discount)}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", fontWeight:900, fontSize:16 }}>
                <span>Tổng thanh toán</span>
                <span style={{ color:"#059669" }}>{fmtMoney(detail.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
