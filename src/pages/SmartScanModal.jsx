/* SmartScanModal.jsx — Nút quét QR đa năng (toàn hệ thống)
 * Quét 1 lần → tự nhận diện:
 *  - Mã đơn bán hàng (HD...)   → mở chi tiết đơn bán + in lại hóa đơn
 *  - Mã đơn sửa (SC.../qr_code)→ mở drawer đơn sửa
 *  - QR dán trên máy (product_qr) → lịch sử sửa chữa của máy
 *  - SKU/IMEI hàng hóa ĐÃ BÁN  → chi tiết đơn bán chứa nó
 *  - SKU/IMEI linh kiện ĐÃ DÙNG SỬA → đơn sửa đã dùng nó
 *  - SKU/IMEI hàng trong kho (chưa bán) → chọn hành động: Bán / Chuyển kho / Trả hàng lỗi
 *  - Không tìm thấy            → gán QR cho đơn sửa mới
 */
import React, { useState, useCallback } from "react";
import { ScanCodeModal, normalizeScanCode } from "./QRComponents.jsx";
import { SaleOrder, SaleOrderItem, SparePart, SparePartUsage, RepairOrder, logAction } from "./pb.jsx";
import { printSaleReceiptA5 } from "../utils/printClient.js";

const PM_LABELS = { cash:"Tiền mặt", transfer:"Chuyển khoản", combo:"Kết hợp", credit:"Ghi nợ" };
const STATUS_LABELS = {
  completed:"Hoàn thành", credit:"Ghi nợ", pending_payment:"Chờ thu tiền",
  draft:"Báo giá / Tạm", cancelled:"Đã hủy",
};
const STATUS_COLORS = {
  completed:"#059669", credit:"#dc2626", pending_payment:"#ca8a04",
  draft:"#3b82f6", cancelled:"#6b7280",
};

function withTimeout(promise, ms = 6000) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("Hết thời gian chờ")), ms))]);
}
function fmtMoney(n) { return (n||0).toLocaleString("vi-VN")+"đ"; }
function fmtDT(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear()
    +" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}
function statusPill(status) {
  return (
    <span style={{ background:(STATUS_COLORS[status]||"#6b7280")+"1a", color:STATUS_COLORS[status]||"#6b7280",
      borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:800 }}>
      {STATUS_LABELS[status]||status||"—"}
    </span>
  );
}

/* ═══ UI helpers — định nghĩa ở cấp module (không lồng trong component) ═══ */
function Card({ icon, tint, title, sub, children }) {
  return (
    <div style={{ background:"#fff", borderRadius:20, width:"100%", maxWidth:440, overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
      <div style={{ background:`linear-gradient(135deg,${tint[0]},${tint[1]})`, padding:"18px 20px 14px", textAlign:"center" }}>
        <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:44, color:"#fff", display:"block", marginBottom:6 }}>{icon}</span>
        <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>{title}</div>
        {sub && <div style={{ color:"rgba(255,255,255,.85)", fontSize:12, marginTop:3 }}>{sub}</div>}
      </div>
      <div style={{ padding:"16px 20px 20px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"7px 0", borderBottom:"1px dashed #f0f0f0", fontSize:13 }}>
      <span style={{ color:"#9ca3af" }}>{label}</span>
      <span style={{ fontWeight:700, textAlign:"right", wordBreak:"break-all" }}>{value}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * SmartScanModal
 * Callback props (từ MainApp):
 *  onOpenRepairOrder(order)  → mở OrderDrawer
 *  onOpenProductHistory(qr, orders) → mở ProductHistoryModal
 *  onCreateRepairWithQR(qr)  → mở form tạo đơn + gán QR
 *  onGoPOS()                 → sang trang Thu ngân
 *  onGoTransfer()            → sang tab Chuyển kho
 *  onGoDefect()              → sang trang LK lỗi / RMA
 *  onGoSaleHistory()         → sang Lịch sử bán hàng
 * orders: danh sách repair orders đã load trong MainApp
 * ───────────────────────────────────────────────────────── */
export default function SmartScanModal({ user, orders = [], onClose,
  onOpenRepairOrder, onOpenProductHistory, onCreateRepairWithQR,
  onGoPOS, onGoTransfer, onGoDefect, onGoSaleHistory }) {

  const [phase, setPhase]   = useState("scan"); // scan | resolving | result
  const [res, setRes]       = useState(null);
  const [printing, setPrinting] = useState(false);
  const lastRawRef = React.useRef("");
  const [step, setStep]     = useState("");   // bước đang chạy (chẩn đoán)
  const [waited, setWaited] = useState(0);    // số giây đã chờ

  // Đếm giây chờ; quá 8s mà vẫn "resolving" → ép sang kết quả "không tìm thấy" (không bao giờ treo)
  React.useEffect(() => {
    if (phase !== "resolving") { setWaited(0); return; }
    const t0 = Date.now();
    const iv = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setWaited(s);
      if (s >= 8) {
        clearInterval(iv);
        setRes({ kind:"unknown", qr: lastRawRef.current, timeout:true, step });
        setPhase("result");
      }
    }, 500);
    return () => clearInterval(iv);
  }, [phase]);

  /* ── Phân loại mã quét ── */
  async function resolve(rawIn) {
    lastRawRef.current = normalizeScanCode(rawIn).code;
    setStep("bắt đầu");
    setRes(null);
    setPhase("resolving");
    // Bảo hiểm: tra cứu kẹt quá 8s → báo "không tìm thấy" thay vì treo mãi
    let finished = false;
    const guard = setTimeout(() => {
      if (finished) return;
      finished = true;
      setRes({ kind:"unknown", qr: normalizeScanCode(rawIn).code, timeout:true });
      setPhase("result");
    }, 8000);
    try {
      await resolveInner(rawIn);
      finished = true;
    } catch (e) {
      console.error("[SmartScan] resolve lỗi:", e);
      if (!finished) {
        finished = true;
        setRes({ kind:"unknown", qr: normalizeScanCode(rawIn).code, error: String(e && e.message || e) });
        setPhase("result");
      }
    } finally { clearTimeout(guard); }
  }
  function logScan(kind, target) {
    try { logAction(user, "scan", "qr_scan", target, `Quét QR đa năng → ${kind}`); } catch {}
  }

  async function resolveInner(rawIn) {
    // QR in trên phiếu là URL (?sale=… / ?order=…) → tách mã trần
    const norm = normalizeScanCode(rawIn);
    const raw = norm.code;
    const esc = String(raw).replace(/"/g, '\\"');
    setStep("tra đơn sửa");

    let ro = norm.kind === "sale" ? null : (orders||[]).find(o => o.order_code === raw || o.id === raw || o.qr_code === raw);
    if (!ro && norm.kind !== "sale") {
      try {
        const found = await withTimeout(RepairOrder.list({ filter: `order_code="${esc}"`, limit: 1 }));
        ro = found && found[0];
      } catch {}
    }
    if (ro) { logScan("repair_order", ro.order_code || ro.id); setRes({ kind:"repair", order:ro }); setPhase("result"); return; }

    setStep("tra đơn bán");
    try {
      const so = await withTimeout(SaleOrder.list({ filter: `order_code="${esc}"`, limit: 1 }));
      if (so && so[0]) {
        setStep("tải chi tiết đơn bán");
        const detail = await loadSaleDetail(so[0]);
        logScan("sale_order", so[0].order_code);
        setRes({ kind:"sale", order:so[0], items:detail, topSale:so[0], topItems:detail });
        setPhase("result"); return;
      }
    } catch {}

    const byQR = (orders||[]).filter(o => o.product_qr && o.product_qr === raw);
    if (byQR.length > 0) { logScan("product_history", raw); setRes({ kind:"history", qr:raw, orders:byQR }); setPhase("result"); return; }

    setStep("tra hàng hóa");
    let part = null;
    try {
      const parts = await withTimeout(SparePart.filter({ sku: raw }));
      if (parts && parts[0]) part = parts[0];
    } catch {}
    if (part) {
      let usages = [];
      try { usages = await withTimeout(SparePartUsage.filter({ sku: raw })); } catch {}
      const repairIds = [...new Set((usages||[]).map(u => u.order_id).filter(Boolean))];
      let repairOrders = (orders||[]).filter(o => repairIds.includes(o.id));
      if (repairIds.length > repairOrders.length) {
        try {
          const idList = repairIds.map(id => '"' + String(id).replace(/"/g, '\\"') + '"').join(",");
          const extra = await RepairOrder.list({ filter: `id in (${idList})`, limit: 50 });
          (extra||[]).forEach(o => { if (!repairOrders.find(x => x.id === o.id)) repairOrders.push(o); });
        } catch {}
      }
      let saleItems = [];
      try { saleItems = await withTimeout(SaleOrderItem.filter({ sku: raw })); } catch {}
      const saleIds = [...new Set((saleItems||[]).map(i => i.sale_order_id).filter(Boolean))];
      let saleOrders = [];
      for (const sid of saleIds.slice(0, 5)) {
        try {
          const so = await SaleOrder.list({ filter: `id="${sid}"`, limit: 1 });
          if (so && so[0]) saleOrders.push(so[0]);
        } catch {}
      }
      saleOrders.sort((a,b) => String(b.created_date||"").localeCompare(String(a.created_date||"")));
      if (saleOrders.length > 0) {
        logScan("sold_item", raw);
        const detail = saleOrders[0].items || await loadSaleItems(saleOrders[0]);
        setRes({ kind:"sold", part, saleOrders, saleItems, repairOrders, topSale:saleOrders[0], topItems:detail });
        setPhase("result"); return;
      }
      if (repairOrders.length > 0) {
        logScan("used_repair", raw);
        setRes({ kind:"used_repair", part, repairOrders });
        setPhase("result"); return;
      }
      logScan("in_stock", raw);
      setRes({ kind:"stock", part });
      setPhase("result"); return;
    }

    logScan("unknown", raw);
    setRes({ kind:"unknown", qr:raw });
    setPhase("result");
  }

  async function loadSaleItems(order) {
    if (order.items && Array.isArray(order.items) && order.items.length > 0) return order.items;
    try { return (await withTimeout(SaleOrderItem.filter({ sale_order_id: order.id }))) || []; } catch { return []; }
  }
  async function loadSaleDetail(order) {
    return await loadSaleItems(order);
  }

  async function reprint(order, items) {
    setPrinting(true);
    try {
      await printSaleReceiptA5({ ...order,
        items: (items||[]).map(it => ({ part_name:it.part_name, sku:it.sku, qty:it.qty, unit_price:it.unit_price, total_price:it.total_price })) });
    } catch (e) { alert("Lỗi in: " + e.message); }
    setPrinting(false);
  }

  /* ═══ UI ═══ */
  const BTN = { borderRadius:12, border:"none", height:44, fontWeight:800, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 };
  const BTN2 = { ...BTN, background:"#f3f4f6", color:"#374151" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:4600, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>

      {/* ── GIAI ĐOẠN 1: quét ── */}
      {phase === "scan" && (
        <ScanCodeModal
          title="Quét đa năng"
          hint="Mã đơn bán · Mã đơn sửa · SKU/IMEI hàng hóa · QR trên máy"
          frame="square"
          onFound={raw => resolve(String(raw).trim())}
          onClose={onClose}
        />
      )}

      {/* ── GIAI ĐOẠN 2: đang tra cứu ── */}
      {phase === "resolving" && (
        <div style={{ background:"#fff", borderRadius:20, padding:"40px 50px", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
          <div style={{ fontSize:34, marginBottom:10 }}>⏳</div>
          <div style={{ fontWeight:800, color:"#4f46e5" }}>Đang tra cứu mã...</div>
          <div style={{ fontSize:11, color:"#9ca3af", marginTop:6 }}>{step} · {waited}s</div>
          <button onClick={onClose} style={{ marginTop:18, padding:"10px 22px", borderRadius:12, border:"none", background:"#f3f4f6", color:"#374151", fontWeight:800, fontSize:14, cursor:"pointer" }}>Đóng</button>
        </div>
      )}

      {/* ── GIAI ĐOẠN 3: kết quả ── */}
      {phase === "result" && res && (
        <div style={{ width:"100%", maxWidth:440, maxHeight:"92vh", overflowY:"auto" }}>

          {/* Đơn sửa */}
          {res.kind === "repair" && (
            <Card icon="build" tint={["#4f46e5","#7c3aed"]} title="Đơn sửa chữa"
              sub={res.order.order_code || res.order.id}>
              <div style={{ background:"#eef2ff", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#312e81" }}>{res.order.customer_name} · {res.order.device_model||res.order.device_name}</div>
                <div style={{ fontSize:12, color:"#4f46e5", marginTop:4 }}>Trạng thái: {res.order.status} · KTV: {res.order.assigned_to_name||"—"}</div>
                <div style={{ fontSize:12, color:"#4f46e5", marginTop:2 }}>Tiếp nhận: {fmtDT(res.order.received_date)}</div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...BTN2, flex:1 }} onClick={onClose}>Đóng</button>
                <button style={{ ...BTN, flex:2, background:"#4f46e5", color:"#fff" }}
                  onClick={() => onOpenRepairOrder(res.order)}>Mở đơn sửa</button>
              </div>
            </Card>
          )}

          {/* Đơn bán hàng (quét mã đơn hoặc hàng đã bán) */}
          {(res.kind === "sale" || res.kind === "sold") && res.topSale && (
            <Card icon="receipt_long" tint={["#059669","#0d9488"]}
              title={res.kind === "sold" ? "Hàng đã bán" : "Đơn bán hàng"}
              sub={res.topSale.order_code}>
              {res.kind === "sold" && (
                <div style={{ background:"#ecfdf5", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:"#065f46" }}>{res.part.name}</div>
                  <div style={{ fontSize:12, color:"#059669", marginTop:3 }}>SKU/IMEI: {res.part.sku}</div>
                </div>
              )}
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"10px 14px", marginBottom:10 }}>
                <Row label="Khách hàng" value={res.topSale.customer_name||"—"} />
                <Row label="Ngày bán" value={fmtDT(res.topSale.created_date)} />
                <Row label="Thanh toán" value={PM_LABELS[res.topSale.payment_method]||res.topSale.payment_method||"—"} />
                <Row label="Tổng tiền" value={fmtMoney(res.topSale.total)} />
              </div>
              <div style={{ fontSize:12, color:"#9ca3af", marginBottom:10, fontWeight:700 }}>Sản phẩm trong đơn:</div>
              {(res.topItems||[]).slice(0,6).map((it,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"5px 10px", background:"#f9fafb", borderRadius:8, marginBottom:4 }}>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.part_name} ×{it.qty}</span>
                  <span style={{ fontWeight:700, flexShrink:0, marginLeft:8 }}>{fmtMoney(it.total_price)}</span>
                </div>
              ))}
              {res.topItems && res.topItems.length > 6 && <div style={{ fontSize:11, color:"#9ca3af", textAlign:"center", margin:"4px 0 10px" }}>+{res.topItems.length - 6} sản phẩm khác...</div>}
              <div style={{ marginTop:12, display:"flex", gap:8, flexDirection:"column" }}>
                <button style={{ ...BTN, background:"#059669", color:"#fff" }}
                  onClick={() => reprint(res.topSale, res.topItems)} disabled={printing}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18}}>print</span> {printing ? "Đang in..." : "In lại hóa đơn A5"}
                </button>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ ...BTN2, flex:1 }} onClick={onClose}>Đóng</button>
                  <button style={{ ...BTN2, flex:1 }} onClick={() => { onClose(); onGoSaleHistory && onGoSaleHistory(); }}>
                    Lịch sử bán hàng
                  </button>
                </div>
              </div>
              {/* Đơn bán khác chứa cùng SKU */}
              {res.kind === "sold" && res.saleOrders.length > 1 && (
                <div style={{ marginTop:10, fontSize:12, color:"#9ca3af" }}>
                  +{res.saleOrders.length - 1} đơn bán khác chứa sản phẩm này (xem trong Lịch sử bán hàng)
                </div>
              )}
            </Card>
          )}

          {/* Hàng đã dùng để sửa */}
          {res.kind === "used_repair" && (
            <Card icon="build_circle" tint={["#4f46e5","#7c3aed"]} title="Linh kiện đã dùng sửa"
              sub={res.part.name}>
              <div style={{ background:"#eef2ff", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#312e81" }}>{res.part.name}</div>
                <div style={{ fontSize:12, color:"#4f46e5", marginTop:3 }}>SKU: {res.part.sku}</div>
              </div>
              <div style={{ fontSize:12, color:"#9ca3af", fontWeight:700, marginBottom:6 }}>Đã dùng trong {res.repairOrders.length} đơn sửa:</div>
              {res.repairOrders.slice(0,4).map(o => (
                <button key={o.id} onClick={() => onOpenRepairOrder(o)}
                  style={{ width:"100%", textAlign:"left", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:10, padding:"9px 12px", marginBottom:6, cursor:"pointer" }}>
                  <div style={{ fontWeight:800, fontSize:13 }}>{o.order_code} · {o.customer_name}</div>
                  <div style={{ fontSize:11, color:"#9ca3af" }}>{o.device_model||o.device_name} · {o.status}</div>
                </button>
              ))}
              <button style={{ ...BTN2, width:"100%", marginTop:6 }} onClick={onClose}>Đóng</button>
            </Card>
          )}

          {/* QR máy → lịch sử sửa */}
          {res.kind === "history" && (
            <Card icon="history" tint={["#4f46e5","#7c3aed"]} title="Máy có lịch sử sửa"
              sub={`QR: ${res.qr}`}>
              <div style={{ fontSize:13, color:"#6b7280", marginBottom:14, textAlign:"center" }}>
                Tìm thấy {res.orders.length} đơn sửa của máy này
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...BTN2, flex:1 }} onClick={onClose}>Đóng</button>
                <button style={{ ...BTN, flex:2, background:"#4f46e5", color:"#fff" }}
                  onClick={() => onOpenProductHistory(res.qr, res.orders)}>Xem lịch sử sửa</button>
              </div>
            </Card>
          )}

          {/* Hàng trong kho, chưa bán → chọn hành động */}
          {res.kind === "stock" && (
            <Card icon="inventory_2" tint={["#0369a1","#0284c7"]} title="Hàng trong kho" sub="Chưa bán — chọn hành động">
              <div style={{ background:"#e0f2fe", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#0369a1", marginBottom:4 }}>{res.part.name}</div>
                <div style={{ fontSize:12, color:"#0369a1" }}>SKU/IMEI: {res.part.sku}</div>
                <div style={{ fontSize:12, color:"#0369a1", marginTop:2 }}>Tồn: {res.part.stock_qty||0} · Giá: {fmtMoney(res.part.price)}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <button style={{ ...BTN, background:"#059669", color:"#fff" }}
                  onClick={() => { onClose(); onGoPOS && onGoPOS(); }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18}}>point_of_sale</span> Bán hàng
                </button>
                <button style={{ ...BTN, background:"#0284c7", color:"#fff" }}
                  onClick={() => { onClose(); onGoTransfer && onGoTransfer(); }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18}}>sync_alt</span> Chuyển kho
                </button>
                <button style={{ ...BTN, background:"#ea580c", color:"#fff" }}
                  onClick={() => { onClose(); onGoDefect && onGoDefect(); }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18}}>warning</span> Trả hàng lỗi / RMA
                </button>
                <button style={{ ...BTN2, height:38, fontSize:13 }} onClick={onClose}>Đóng</button>
              </div>
            </Card>
          )}

          {/* Không tìm thấy */}
          {res.kind === "unknown" && (
            <Card icon="qr_code_2" tint={["#6b7280","#4b5563"]} title="Không tìm thấy mã"
              sub={res.qr}>
              <div style={{ background:"#fef9c3", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12.5, color:"#854d0e" }}>
                {res.timeout ? "Tra cứu quá lâu (kẹt ở bước: " + (res.step || "?") + "). Bấm Quét lại để thử lại." : res.error ? "Lỗi tra cứu: " + res.error : "Mã này không thuộc đơn bán, đơn sửa hay hàng hóa nào. Nếu là QR dán trên máy cần tạo đơn sửa, hãy gán nó cho đơn mới."}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...BTN2, flex:1 }} onClick={() => { setRes(null); setPhase("scan"); }}>Quét lại</button>
                <button style={{ ...BTN, flex:2, background:"#4f46e5", color:"#fff" }}
                  onClick={() => { onClose(); onCreateRepairWithQR && onCreateRepairWithQR(res.qr); }}>Gán QR cho đơn sửa mới</button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
