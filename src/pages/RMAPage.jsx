/**
 * RMAPage.jsx — Trả hàng NCC (RMA)
 * @version 2026-11-05-v2
 * Theo mô hình KiotViet "Trả hàng nhập": mỗi lần trả NCC là MỘT phiếu (rma_tickets) có
 *  - liên kết phiếu nhập gốc để lấy đúng giá vốn (hoặc "trả nhanh" khi không rõ phiếu)
 *  - giảm tồn kho + ghi thẻ kho (stock_movements)
 *  - giảm công nợ phải trả NCC bằng chứng từ giảm trừ (debt_vouchers, total_amount âm)
 *  - hủy phiếu = đảo tồn kho + hủy chứng từ công nợ (không xóa dữ liệu)
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  SparePart, StockLedger, StockMovement, Supplier, StockImport, StockImportItem,
  DebtVoucher, RMATicket, logAction,
} from "./pb.jsx";
import { usePermission } from "./PermissionContext.jsx";

function fmtMoney(n) { return (Number(n) || 0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d) ? "—" : d.toLocaleDateString("vi-VN");
}
function nowStamp() { return new Date().toISOString().replace("T", " ").split(".")[0]; }

// Lấy dòng tồn kho của 1 linh kiện — truy vấn server-side theo part_id HOẶC sku
async function fetchLedgerRows(part) {
  const esc = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const conds = [];
  if (part?.id)  conds.push(`part_id="${esc(part.id)}"`);
  if (part?.sku) conds.push(`sku="${esc(part.sku)}"`);
  if (!conds.length) return [];
  const rows = await StockLedger.filter(conds.join(" || "), { limit: 300 }).catch(() => []);
  return rows || [];
}

// Tên NCC của 1 nguồn nhập (chịu được dữ liệu cũ thiếu trường)
const originName = (o) => String(o?.supplier_name || o?.name || "");

function pickLedger(rows, warehouseId) {
  const list = rows || [];
  const inWh = warehouseId ? list.filter(l => l.warehouse_id === warehouseId) : [];
  const positive = inWh.find(l => Number(l.qty_on_hand) > 0)
    || list.find(l => Number(l.qty_on_hand) > 0)
    || inWh[0] || list[0] || null;
  const qty = (inWh.length ? inWh : (positive ? [positive] : []))
    .reduce((a, l) => a + (Number(l.qty_on_hand) || 0), 0);
  return { row: positive, qty };
}

const STATUS = {
  sent:      { bg:"#dbeafe", color:"#2563eb", label:"📦 Đã gửi NCC" },
  settled:   { bg:"#d1fae5", color:"#059669", label:"✅ NCC đã xử lý" },
  cancelled: { bg:"#f3f4f6", color:"#6b7280", label:"❌ Đã hủy" },
};

const REASONS = [
  { key:"doa",     label:"DOA — hàng chết khi nhận" },
  { key:"wrong",   label:"Sai linh kiện / model" },
  { key:"defect",  label:"Lỗi sản xuất" },
  { key:"expired", label:"Hết hạn bảo hành" },
  { key:"other",   label:"Lý do khác" },
];

// ── Modal tạo phiếu RMA ────────────────────────────────────────────────
export function CreateRMAModal({ user, suppliers, spareParts, prefill, warehouseId, defectMovementId, onClose, onCreated }) {
  const [supplierId, setSupplierId] = useState(prefill?.supplier_id || "");
  const [partId,     setPartId]     = useState(prefill?.part_id || "");
  const [importId,   setImportId]   = useState("");
  const [qty,        setQty]        = useState(prefill?.qty || 1);
  const [reason,     setReason]     = useState(prefill?.reason || "doa");
  const [note,       setNote]       = useState("");
  const [imports,    setImports]    = useState([]);
  const [importItems,setImportItems]= useState([]);
  const [saving,     setSaving]     = useState(false);
  const [stockNow,   setStockNow]   = useState(null);
  const [err,        setErr]        = useState("");

  // Ghép NCC / LK theo tên khi được điền sẵn từ dòng "LK lỗi"
  useEffect(() => {
    if (!prefill) return;
    setSupplierId(s => s || (suppliers || []).find(x => (x.name||"").trim().toLowerCase() === String(prefill.supplier_name||"").trim().toLowerCase())?.id || "");
    setPartId(p => p || (spareParts || []).find(x => (x.name||"").trim().toLowerCase() === String(prefill.part_name||"").trim().toLowerCase())?.id || "");
  }, [prefill, suppliers, spareParts]);

  // Tồn kho hiện có của linh kiện (để hiện ngay trên form)
  useEffect(() => {
    let alive = true;
    if (!partId) { setStockNow(null); return; }
    const p = (spareParts || []).find(x => x.id === partId);
    fetchLedgerRows(p).then(rows => { if (alive) setStockNow(pickLedger(rows, warehouseId).qty); }).catch(() => {});
    return () => { alive = false; };
  }, [partId, warehouseId, spareParts]);

  const supplier = (suppliers || []).find(s => s.id === supplierId);
  const part     = (spareParts || []).find(p => p.id === partId);

  // Nạp 1 lần toàn bộ phiếu nhập + dòng hàng: để truy "linh kiện này nhập từ NCC nào"
  const [allImports, setAllImports] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [imps, its] = await Promise.all([
          StockImport.list({ sort:"-id", limit:300 }).catch(()=>[]),
          StockImportItem.list({ sort:"-id", limit:1000 }).catch(()=>[]),
        ]);
        if (!alive) return;
        setAllImports((imps||[]).map(i => ({ ...i, _items: (its||[]).filter(t => t.import_id === i.id) })));
      } catch { if (alive) setAllImports([]); }
    })();
    return () => { alive = false; };
  }, []);

  // Nguồn nhập của linh kiện đang chọn (NCC nào · phiếu nào · giá vốn bao nhiêu)
  const partOrigins = (() => {
    if (!part) return [];
    const skuKey  = String(part.sku||"").trim().toLowerCase();
    const nameKey = String(part.name||"").trim().toLowerCase();
    const rows = (allImports||[]).map(im => {
      const line = (im._items||[]).find(t => {
        const s2 = String(t.sku||"").trim().toLowerCase();
        const n2 = String(t.name||"").trim().toLowerCase();
        return (skuKey && s2 && s2 === skuKey) || (nameKey && n2 && n2 === nameKey);
      });
      if (!line) return null;
      return { import_id: im.id, import_code: im.import_code, supplier_name: im.supplier_name || "",
        received_date: im.received_date || "", qty: Number(line.qty)||0, unit_price: Number(line.unit_price)||0 };
    }).filter(Boolean);
    return rows.sort((a,b) => String(b.received_date||"").localeCompare(String(a.received_date||"")));
  })();

  // Danh sách NCC gợi ý = NCC đã thực sự nhập linh kiện này (mới nhất trước)
  const originSuppliers = (() => {
    const seen = new Set(); const out = [];
    partOrigins.forEach(o => {
      const k = originName(o).trim().toLowerCase();
      if (!k || seen.has(k)) return; seen.add(k);
      out.push({ name: o.supplier_name || "", supplier_name: o.supplier_name || "",
        import_code: o.import_code || "", received_date: o.received_date || "" });
    });
    return out;
  })();

  // Danh sách phiếu nhập khả dụng: ưu tiên phiếu CÓ linh kiện này
  useEffect(() => {
    if (part) {
      setImports(partOrigins.map(o => ({ id: o.import_id, import_code: o.import_code,
        received_date: o.received_date, total_value: 0, supplier_name: o.supplier_name })));
    } else if (supplier) {
      setImports((allImports||[]).filter(i =>
        (i.supplier_name||"").trim().toLowerCase() === (supplier.name||"").trim().toLowerCase() || i.supplier_id === supplier.id));
    } else {
      setImports([]);
    }
  }, [part?.id, supplier?.id, allImports.length]);

  // Khi đã biết nguồn nhập: tự chọn NCC + phiếu nhập mới nhất (tránh trả nhầm NCC)
  useEffect(() => {
    if (!part || !partOrigins.length) return;
    const top = partOrigins[0];
    setSupplierId(id => id || (originSuppliers.length === 1
      ? ((suppliers||[]).find(x => (x.name||"").trim().toLowerCase() === originName(top).trim().toLowerCase())?.id || "")
      : id));
  }, [part?.id, allImports.length]);

  // Chọn phiếu nhập gốc từ prefill (dòng LK lỗi đã ghi rõ phiếu)
  useEffect(() => {
    if (importId || !prefill?.import_code) return;
    const hit = partOrigins.find(o => o.import_code === prefill.import_code);
    if (hit) { setImportId(hit.import_id); setSupplierId(s => s || ((suppliers||[]).find(x => x.name === hit.supplier_name)?.id || s)); }
  }, [prefill?.import_code, allImports.length]);

  // Chọn phiếu nhập → lấy dòng hàng tương ứng để biết giá vốn
  useEffect(() => {
    let alive = true;
    setImportItems([]);
    if (!importId) return;
    (async () => {
      try {
        const its = await StockImportItem.filter(`import_id="${importId}"`, { limit:500 });
        if (alive) setImportItems(its || []);
      } catch { if (alive) setImportItems([]); }
    })();
    return () => { alive = false; };
  }, [importId]);

  const importLine = importItems.find(it =>
    (part && it.sku && part.sku && String(it.sku).toLowerCase() === String(part.sku).toLowerCase())
    || (part && (it.name||"").trim().toLowerCase() === (part.name||"").trim().toLowerCase()));

  const unitPrice = Number(importLine?.unit_price) || Number(part?.cost_price) || Number(part?.price) || 0;
  const totalValue = unitPrice * (Number(qty) || 0);

  async function handleSave() {
    if (!supplier) { setErr("Chọn nhà cung cấp"); return; }
    if (!part)     { setErr("Chọn linh kiện trả lại"); return; }
    if (!qty || Number(qty) < 1) { setErr("Số lượng phải ≥ 1"); return; }
    setSaving(true); setErr("");
    try {
      const q = Math.abs(Number(qty));
      const reasonLabel = REASONS.find(r => r.key === reason)?.label || reason;
      const code = "RMA-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + String(Date.now()).slice(-4);

      // 1) Tồn kho hiện tại của linh kiện (ưu tiên kho của dòng LK lỗi)
      const { row: ledger, qty: stockQty } = pickLedger(await fetchLedgerRows(part), warehouseId);
      const before = stockQty;
      if (q > before) {
        if (!confirm(`⚠️ Số lượng trả (${q}) lớn hơn tồn hiện có (${before}) của "${part.name}".\nVẫn tiếp tục ghi phiếu?`)) {
          setSaving(false); return;
        }
      }

      // 2) Phiếu RMA
      const ticket = await RMATicket.create({
        ticket_code: code,
        status: "sent",
        warehouse_id: ledger?.warehouse_id || warehouseId || "",
        warehouse_name: ledger?.warehouse_name || "",
        supplier_id: supplier.id, supplier_name: supplier.name || "",
        import_id: importId || "", import_code: imports.find(i=>i.id===importId)?.import_code || "",
        part_id: part.id, part_name: part.name || "", sku: part.sku || "", unit: part.unit || "",
        qty: q,
        unit_price: unitPrice,
        total_value: totalValue,
        reason: reasonLabel,
        note: note.trim(),
        defect_movement_id: defectMovementId || "",
        sent_at: nowStamp(),
        created_by_id: user?.id || "", created_by_name: user?.full_name || user?.name || "",
      });

      // 3) Giảm tồn + thẻ kho
      if (ledger) {
        await StockMovement.create({
          movement_code: code, movement_type: "rma_out",
          warehouse_id: ledger.warehouse_id || "", warehouse_name: ledger.warehouse_name || "",
          part_id: part.id, part_name: part.name || "", sku: part.sku || "",
          qty_before: before, qty_change: -q, qty_after: Math.max(0, before - q),
          unit_price: unitPrice,
          ref_type: "rma", ref_id: ticket.id, ref_code: code,
          note: `Trả NCC ${supplier.name||""} — ${reasonLabel}${note ? ". " + note.trim() : ""}`,
          created_by_id: user?.id || "", created_by_name: user?.full_name || user?.name || "",
          created_date: nowStamp(),
        }).catch(e => console.warn("movement:", e.message));
        await StockLedger.update(ledger.id, {
          qty_on_hand:   Math.max(0, before - q),
          qty_available: Math.max(0, (Number(ledger.qty_available) || 0) - q),
          last_movement_at: nowStamp(),
        }).catch(e => console.warn("ledger:", e.message));
      }

      // 4) Giảm công nợ phải trả NCC (chứng từ giảm trừ, số âm)
      if (totalValue > 0) {
        const voucher = await DebtVoucher.create({
          voucher_code: "GN-" + code,
          voucher_type: "payable", party_type: "supplier",
          party_id: supplier.id, party_name: supplier.name || "",
          origin_type: "rma", origin_id: ticket.id, origin_code: code,
          total_amount: -Math.abs(totalValue), paid_amount: 0, remaining: 0, status: "open",
          note: `Giảm trừ công nợ — trả ${part.name} x${q} (${reasonLabel}) · phiếu ${code}`,
          created_by_id: user?.id || "", created_by_name: user?.full_name || user?.name || "",
        });
        await RMATicket.update(ticket.id, {
          credit_voucher_id: voucher.id, credit_voucher_code: voucher.voucher_code,
        }).catch(()=>{});
      }

      logAction(user, "create_rma", "rma_tickets", ticket.id,
        `Trả NCC ${part.name} x${q} (${fmtMoney(totalValue)}) → ${supplier.name||""}${importId ? " · theo phiếu nhập " + (imports.find(i=>i.id===importId)?.import_code||"") : " · trả nhanh"}`);

      onCreated?.(ticket);
      onClose();
    } catch (e) {
      setErr(e.message || "Lỗi tạo phiếu RMA");
    }
    setSaving(false);
  }

  const INP = {
    width:"100%", border:"1.5px solid #e5e7eb", borderRadius:8, padding:"9px 10px",
    fontSize:14, marginBottom:10, outline:"none", boxSizing:"border-box", background:"#fff",
  };
  const LBL = { fontSize:12, fontWeight:700, color:"#374151", marginBottom:4, display:"block" };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:3300, background:"rgba(15,23,42,.55)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:16,
        width:"min(560px,96vw)", maxHeight:"90vh", overflowY:"auto", padding:18,
        boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b" }}>📤 Phiếu trả hàng NCC</div>
          <button onClick={onClose} style={{ border:"none", background:"#f3f4f6", width:30, height:30,
            borderRadius:"50%", cursor:"pointer" }}>✕</button>
        </div>

        <label style={LBL}>Nhà cung cấp *</label>
        <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setImportId(""); }} style={INP}>
          <option value="">— Chọn NCC —</option>
          {originSuppliers.length > 0 && (
            <optgroup label="✅ NCC đã nhập linh kiện này">
              {originSuppliers.map(o => {
                const sp = (suppliers||[]).find(x => (x.name||"").trim().toLowerCase() === originName(o).trim().toLowerCase());
                if (!sp) return null;
                return <option key={"o"+sp.id} value={sp.id}>{sp.name} · {o.import_code}{o.received_date ? " · " + fmtDate(o.received_date) : ""}</option>;
              })}
            </optgroup>
          )}
          <optgroup label="Tất cả nhà cung cấp">
            {(suppliers||[]).filter(s => !originSuppliers.some(o => originName(o).trim().toLowerCase() === (s.name||"").trim().toLowerCase()))
              .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        </select>
        {part && originSuppliers.length === 0 && (
          <div style={{ fontSize:12, color:"#d97706", marginTop:-4, marginBottom:10 }}>
            Linh kiện này chưa có lịch sử nhập — kiểm tra lại NCC cho đúng.
          </div>
        )}

        <label style={LBL}>Linh kiện trả lại *</label>
        <select value={partId} onChange={e => setPartId(e.target.value)} style={INP}>
          <option value="">— Chọn linh kiện —</option>
          {(spareParts||[]).map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? " · " + p.sku : ""}</option>)}
        </select>

        <label style={LBL}>Phiếu nhập gốc (để đúng giá vốn &amp; công nợ)</label>
        <select value={importId} onChange={e => setImportId(e.target.value)} style={INP}>
          <option value="">⚡ Trả nhanh — không theo phiếu nhập</option>
          {imports.map(i => (
            <option key={i.id} value={i.id}>
              {i.import_code}{i.supplier_name ? " · " + i.supplier_name : ""} · {fmtDate(i.received_date || i.created)}
            </option>
          ))}
        </select>
        {importId && (
          <div style={{ fontSize:12, marginTop:-4, marginBottom:10,
            color: importLine ? "#059669" : "#d97706" }}>
            {importLine
              ? `Giá vốn theo phiếu nhập: ${fmtMoney(importLine.unit_price)} / ${importLine.name}`
              : "Linh kiện này không có trong phiếu nhập đã chọn — dùng giá vốn trong danh mục."}
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <div style={{ flex:1 }}>
            <label style={LBL}>
              Số lượng *
              {stockNow !== null && (
                <span style={{ marginLeft:8, fontSize:11.5, fontWeight:700,
                  color: stockNow > 0 ? "#059669" : "#dc2626" }}>· tồn kho: {stockNow}</span>
              )}
            </label>
            <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} style={INP} />
          </div>
          <div style={{ flex:1 }}>
            <label style={LBL}>Lý do</label>
            <select value={reason} onChange={e => setReason(e.target.value)} style={INP}>
              {REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <label style={LBL}>Ghi chú</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: NCC hẹn đổi hàng trong 7 ngày..." style={INP} />

        <div style={{ background:"#eef2ff", border:"1.5px solid #c7d2fe", borderRadius:12,
          padding:"10px 14px", marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
            <span style={{ color:"#3730a3" }}>Giá vốn / cái</span>
            <b style={{ color:"#1e1b4b" }}>{fmtMoney(unitPrice)}</b>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, marginTop:4 }}>
            <span style={{ color:"#3730a3" }}>Giảm công nợ NCC</span>
            <b style={{ color:"#dc2626" }}>{fmtMoney(totalValue)}</b>
          </div>
        </div>

        {err && <div style={{ color:"#dc2626", fontSize:13, marginBottom:10 }}>⚠️ {err}</div>}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex:1, height:44, borderRadius:11, border:"none", background:"#4f46e5",
              color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", opacity: saving?0.6:1 }}>
            {saving ? "⏳ Đang lưu..." : "✅ Tạo phiếu trả NCC"}
          </button>
          <button onClick={onClose}
            style={{ height:44, padding:"0 18px", borderRadius:11, border:"1.5px solid #e5e7eb",
              background:"#fff", fontWeight:700, cursor:"pointer" }}>Hủy</button>
        </div>
      </div>
    </div>
  );
}

// ── Trang danh sách phiếu trả NCC ─────────────────────────────────────
export default function RMAPage({ user, readOnly = false }) {
  const { can } = usePermission();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [parts,     setParts]     = useState([]);
  const [cancelling, setCancelling] = useState(null); // {ticket, reason}

  const canCreate = !readOnly && !!can("wh_defect", "create");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tk, sup, prt] = await Promise.all([
        RMATicket.list({ sort:"-id", limit:300 }).catch(()=>[]),
        Supplier.list({ sort:"name", limit:300 }).catch(()=>[]),
        SparePart.list({ sort:"name", limit:500 }).catch(()=>[]),
      ]);
      setTickets(tk || []); setSuppliers(sup || []); setParts(prt || []);
    } catch (e) { console.error("RMAPage load:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = tickets.filter(t => t.status !== "cancelled");
  const stats = {
    total: active.length,
    qty:   active.reduce((a, t) => a + (Number(t.qty) || 0), 0),
    value: active.reduce((a, t) => a + (Number(t.total_value) || 0), 0),
  };

  const filtered = tickets.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.part_name||"").toLowerCase().includes(q)
        || (t.supplier_name||"").toLowerCase().includes(q)
        || (t.ticket_code||"").toLowerCase().includes(q)
        || (t.sku||"").toLowerCase().includes(q)
        || (t.note||"").toLowerCase().includes(q);
  });

  async function cancelTicket(ticket, reason) {
    try {
      const q = Number(ticket.qty) || 0;
      // Cộng lại tồn kho
      const { row: ledger } = pickLedger(await fetchLedgerRows({ id: ticket.part_id, sku: ticket.sku }), ticket.warehouse_id);
      if (ledger) {
        const before = Number(ledger.qty_on_hand) || 0;
        await StockMovement.create({
          movement_code: "RMAX-" + String(Date.now()).slice(-8), movement_type: "rma_cancel",
          warehouse_id: ledger.warehouse_id || "", warehouse_name: ledger.warehouse_name || "",
          part_id: ticket.part_id, part_name: ticket.part_name || "", sku: ticket.sku || "",
          qty_before: before, qty_change: q, qty_after: before + q,
          unit_price: Number(ticket.unit_price) || 0,
          ref_type: "rma_cancel", ref_id: ticket.id, ref_code: ticket.ticket_code,
          note: `Hủy phiếu trả NCC ${ticket.ticket_code}${reason ? " — " + reason : ""}`,
          created_by_id: user?.id || "", created_by_name: user?.full_name || user?.name || "",
          created_date: nowStamp(),
        }).catch(()=>{});
        await StockLedger.update(ledger.id, {
          qty_on_hand:   before + q,
          qty_available: (Number(ledger.qty_available) || 0) + q,
          last_movement_at: nowStamp(),
        }).catch(()=>{});
      }
      // Hủy chứng từ giảm công nợ
      if (ticket.credit_voucher_id) {
        await DebtVoucher.update(ticket.credit_voucher_id, { status: "cancelled" }).catch(()=>{});
      }
      await RMATicket.update(ticket.id, {
        status: "cancelled", cancelled_at: nowStamp(),
        cancelled_by_id: user?.id || "", cancelled_by_name: user?.full_name || user?.name || "",
        cancel_reason: reason || "",
      });
      logAction(user, "cancel_rma", "rma_tickets", ticket.id,
        `Hủy phiếu trả NCC ${ticket.ticket_code} (${ticket.part_name} x${ticket.qty}) — hoàn tồn & hoàn công nợ${reason ? ": " + reason : ""}`);
      setCancelling(null);
      load();
    } catch (e) { alert("Lỗi hủy phiếu: " + e.message); }
  }

  return (
    <div style={{ padding:"16px 14px 80px", maxWidth:960, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:19, color:"#1e1b4b" }}>📤 Trả hàng NCC (RMA)</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>
            {readOnly
              ? "Phiếu trả NCC được tạo từ màn LK lỗi — bấm “Trả NCC” trên từng linh kiện lỗi"
              : "Trả linh kiện lỗi cho NCC: giảm tồn kho và giảm công nợ phải trả"}
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:12,
              padding:"10px 20px", fontWeight:700, cursor:"pointer" }}>
            + Phiếu trả NCC
          </button>
        )}
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { label:"Phiếu đang trả", val:stats.total, icon:"receipt_long", color:"#4f46e5", bg:"#eef2ff" },
          { label:"Tổng SL trả", val:stats.qty + " cái", icon:"inventory_2", color:"#dc2626", bg:"#fee2e2" },
          { label:"Giảm công nợ", val:fmtMoney(stats.value), icon:"account_balance_wallet", color:"#059669", bg:"#d1fae5" },
        ].map(s => (
          <div key={s.label} style={{ flex:"1 1 140px", background:s.bg, borderRadius:14, padding:"12px 14px",
            border:"1.5px solid #e5e7eb", minWidth:120 }}>
            <span className="material-icons" style={{ fontSize:20, color:s.color, fontFamily:"Material Icons" }}>{s.icon}</span>
            <div style={{ fontWeight:900, fontSize:17, color:s.color, marginTop:2 }}>{s.val}</div>
            <div style={{ fontSize:11.5, color:s.color, opacity:.85 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <input placeholder="🔍 Tìm mã phiếu, linh kiện, NCC, ghi chú..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"9px 14px",
          fontSize:14, marginBottom:14, outline:"none", boxSizing:"border-box", paddingLeft:44 }} />

      {loading ? (
        <div style={{ textAlign:"center", padding:50, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:50, color:"#6b7280" }}>
          <div style={{ fontSize:44, marginBottom:10 }}>📭</div>
          {search ? "Không tìm thấy phiếu nào" : "Chưa có phiếu trả NCC nào"}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(t => {
            const st = STATUS[t.status] || STATUS.sent;
            const done = t.status === "cancelled";
            return (
              <div key={t.id} style={{ background:"#fff", borderRadius:12, padding:"12px 14px",
                border:"1.5px solid #e5e7eb", opacity: done ? .72 : 1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>
                      {t.ticket_code} · {t.part_name} <span style={{ color:"#dc2626" }}>x{t.qty}</span>
                    </div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>
                      NCC: <b>{t.supplier_name || "—"}</b>
                      {t.import_code ? ` · phiếu nhập ${t.import_code}` : " · trả nhanh"}
                    </div>
                    <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:2 }}>
                      {fmtDate(t.sent_at || t.created)} · {t.reason || "—"}
                      {t.note ? " · " + t.note : ""}
                    </div>
                    {done && t.cancel_reason && (
                      <div style={{ fontSize:11.5, color:"#dc2626", marginTop:2 }}>Hủy: {t.cancel_reason}</div>
                    )}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:"#059669" }}>-{fmtMoney(t.total_value)}</div>
                    <span style={{ display:"inline-block", marginTop:6, fontSize:11, fontWeight:800,
                      background:st.bg, color:st.color, borderRadius:99, padding:"2px 9px" }}>{st.label}</span>
                    {!done && !readOnly && (
                      <div style={{ marginTop:6 }}>
                        <button onClick={() => setCancelling({ ticket: t, reason: "" })}
                          style={{ fontSize:12, fontWeight:700, color:"#dc2626", background:"#fef2f2",
                            border:"1.5px solid #fecaca", borderRadius:9, padding:"4px 10px", cursor:"pointer" }}>
                          Hủy phiếu
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateRMAModal user={user} suppliers={suppliers} spareParts={parts}
          onClose={() => setShowCreate(false)} onCreated={() => load()} />
      )}

      {cancelling && (
        <div onClick={() => setCancelling(null)} style={{ position:"fixed", inset:0, zIndex:3300,
          background:"rgba(15,23,42,.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:16, padding:18,
            width:"min(440px,96vw)", boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ fontWeight:900, fontSize:16, color:"#1e1b4b", marginBottom:6 }}>Hủy phiếu trả NCC?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:12 }}>
              Phiếu <b>{cancelling.ticket.ticket_code}</b> ({cancelling.ticket.part_name} x{cancelling.ticket.qty}).
              Hủy sẽ <b>cộng lại tồn kho</b> và <b>hoàn nguyên công nợ NCC</b>. Dữ liệu phiếu vẫn được lưu để tra cứu.
            </div>
            <input placeholder="Lý do hủy (bắt buộc)" value={cancelling.reason}
              onChange={e => setCancelling(c => ({ ...c, reason: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:9, padding:"9px 10px",
                fontSize:14, marginBottom:12, outline:"none", boxSizing:"border-box" }} />
            <div style={{ display:"flex", gap:8 }}>
              <button disabled={!cancelling.reason.trim()}
                onClick={() => cancelTicket(cancelling.ticket, cancelling.reason.trim())}
                style={{ flex:1, height:42, borderRadius:10, border:"none", background:"#dc2626",
                  color:"#fff", fontWeight:800, cursor: cancelling.reason.trim() ? "pointer" : "not-allowed",
                  opacity: cancelling.reason.trim() ? 1 : .5 }}>Xác nhận hủy</button>
              <button onClick={() => setCancelling(null)}
                style={{ height:42, padding:"0 16px", borderRadius:10, border:"1.5px solid #e5e7eb",
                  background:"#fff", fontWeight:700, cursor:"pointer" }}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
