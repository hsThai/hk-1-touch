// ── Nút thao tác có bong bóng chú thích: hover (PC) hoặc bấm giữ 2 giây (điện thoại) ──
function ActionBtn({ hint, onClick, children, fg = "#6366f1", bg = "#ede9fe", bd = "#e0e7ff", disabled = false }) {
  const btnRef = useRef(null);
  const pressTimer = useRef(null);
  const hideTimer = useRef(null);
  const [tip, setTip] = useState(null); // {top, left, above}

  function showTip() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 208;
    let left = r.left + r.width / 2 - W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8));
    const above = r.top > 74;
    setTip({ top: above ? r.top - 8 : r.bottom + 8, left, above });
  }
  function clearTimers() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }
  function hideTip() { clearTimers(); setTip(null); }

  return (
    <>
      <button ref={btnRef}
        onClick={() => { hideTip(); onClick && onClick(); }}
        disabled={disabled}
        aria-label={hint}
        onMouseEnter={() => { clearTimers(); hideTimer.current = setTimeout(showTip, 250); }}
        onMouseLeave={hideTip}
        onTouchStart={() => { clearTimers(); pressTimer.current = setTimeout(showTip, 2000); }}
        onTouchEnd={() => { if (pressTimer.current) clearTimeout(pressTimer.current); hideTimer.current = setTimeout(() => setTip(null), 1600); }}
        onTouchCancel={hideTip}
        onContextMenu={e => e.preventDefault()}
        style={{ width: 32, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1.5px solid ${bd}`, background: bg, color: fg,
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .5 : 1 }}>
        {children}
      </button>
      {tip && (
        <div style={{ position: "fixed", top: tip.top, left: tip.left, width: 208,
          transform: tip.above ? "translateY(-100%)" : "none", zIndex: 4000,
          background: "#1f2937", color: "#fff", borderRadius: 8, padding: "6px 10px",
          fontSize: 11.5, fontWeight: 700, lineHeight: 1.35, textAlign: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,.25)", pointerEvents: "none" }}>
          {hint}
        </div>
      )}
    </>
  );
}

/**
 * ProductManagerPage.jsx — Danh mục hàng hóa (CRUD)
 * Thêm / sửa / xóa / merge linh kiện — tham chiếu KiotViet Danh sách hàng hóa
 * @version 2026-08-18-v2 — danh mục động (ProductCategory entity) + quản lý danh mục
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { pbFetch, SparePart, ProductCategory, logAction, uploadFile, normalizePbUrl, ensureStockLedgerForPart } from "./pb.jsx";
import { usePermission } from "./PermissionContext.jsx";
import { refreshProductImages } from "./ProductThumb.jsx";
import CategoryManagerModal from "./CategoryManagerModal.jsx";
import ProductImportExportModal from "./ProductImportExportModal.jsx";
import { MediaViewer } from "./MediaViewer.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }

// Nén ảnh trước khi upload (1280px, 82%) — chuẩn chung hệ thống
function compressImageFile(file, maxW = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob ? new File([blob], file.name || "photo.jpg", { type: "image/jpeg" }) : file), "image/jpeg", quality);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const ADMIN_ROLES = ["owner","admin","manager"];

const UNIT_OPTIONS = ["Cái", "Bộ", "Hộp", "Cuộn", "Mét", "Kg", "Lít", "Chai", "Gói", "Dây"];

const INP = {
  width: "100%", height: 44, borderRadius: 10, border: "1.5px solid #e5e7eb",
  padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box",
};
const LBL = { fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" };

// ── Add/Edit Modal ──────────────────────────────────────────
// ── Thẻ kho nhanh: tồn theo từng kho + lịch sử nhập/xuất của 1 mặt hàng ──
function fmtDT(s) {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d)) return String(s);
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const MV_LABEL = {
  in: { t: "📥 Nhập", c: "#059669" }, import: { t: "📥 Nhập", c: "#059669" },
  out: { t: "📤 Xuất", c: "#dc2626" }, export: { t: "📤 Xuất", c: "#dc2626" },
  transfer: { t: "🔄 Chuyển kho", c: "#0284c7" },
  combo_pick: { t: "🎁 Ghép combo", c: "#7c3aed" }, combo_return: { t: "🧩 Tháo combo", c: "#c2410c" },
  count: { t: "⚖️ Kiểm kê", c: "#ca8a04" }, adjust: { t: "⚖️ Điều chỉnh", c: "#ca8a04" },
  return: { t: "↩️ Đổi trả", c: "#0891b2" }, sale: { t: "🛒 Bán hàng", c: "#dc2626" },
};
function StockCardModal({ item, onClose }) {
  const [ledgers, setLedgers] = useState([]);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("history");

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const f = encodeURIComponent(`part_id="${item.id}"`);
        const [l, m] = await Promise.all([
          pbFetch(`collections/stock_ledgers/records?perPage=100&filter=${f}`).catch(() => ({ items: [] })),
          pbFetch(`collections/stock_movements/records?perPage=60&sort=-id&filter=${f}`).catch(() => ({ items: [] })),
        ]);
        if (dead) return;
        setLedgers(l.items || []);
        setMoves(m.items || []);
      } catch { }
      if (!dead) setLoading(false);
    })();
    return () => { dead = true; };
  }, [item.id]);

  const total = ledgers.reduce((s, l) => s + (Number(l.qty_on_hand) || 0), 0);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3400, background: "rgba(15,23,42,.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(520px,96vw)", maxHeight: "90vh",
          display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ background: "linear-gradient(135deg,#0f172a,#334155)", padding: "14px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 14, lineHeight: 1.3 }}>📋 Thẻ kho</div>
            <div style={{ color: "rgba(255,255,255,.85)", fontSize: 12, marginTop: 2, lineHeight: 1.35 }}>{item.name}</div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11, marginTop: 1 }}>{item.sku || "—"} · Tổng tồn: <b style={{ color: "#fff" }}>{total}</b></div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none",
            background: "rgba(255,255,255,.2)", color: "#fff", cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 12px 0" }}>
          {[["history", "Lịch sử nhập/xuất"], ["stock", `Tồn theo kho (${ledgers.length})`]].map(([k, lb]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex: 1, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 800,
                border: `1.5px solid ${tab === k ? "#0f172a" : "#e5e7eb"}`,
                background: tab === k ? "#0f172a" : "#fff", color: tab === k ? "#fff" : "#6b7280" }}>
              {lb}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 16px" }}>
          {loading && <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>⏳ Đang tải...</div>}

          {!loading && tab === "stock" && (
            ledgers.length === 0
              ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>Chưa có tồn kho ở kho nào</div>
              : ledgers.map(l => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 10px", borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937" }}>{l.warehouse_name || "Kho"}</div>
                    {l.location_code && <div style={{ fontSize: 11, color: "#9ca3af" }}>Vị trí: {l.location_code}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: (Number(l.qty_on_hand) || 0) > 0 ? "#059669" : "#9ca3af" }}>
                      {Number(l.qty_on_hand) || 0}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#9ca3af" }}>
                      giữ {Number(l.qty_reserved) || 0} · bán được {Number(l.qty_available) || 0}
                    </div>
                  </div>
                </div>
              ))
          )}

          {!loading && tab === "history" && (
            moves.length === 0
              ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>Chưa có phát sinh nhập/xuất</div>
              : moves.map(mv => {
                const lb = MV_LABEL[mv.movement_type] || { t: mv.movement_type || "Biến động", c: "#6b7280" };
                const chg = Number(mv.qty_change) || 0;
                return (
                  <div key={mv.id} style={{ padding: "9px 10px", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: lb.c }}>{lb.t}</span>
                      <b style={{ fontSize: 13, color: chg >= 0 ? "#059669" : "#dc2626", flexShrink: 0 }}>
                        {chg >= 0 ? "+" : ""}{chg}
                      </b>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                      {fmtDT(mv.created_date)} · {mv.warehouse_name || "—"} · còn {Number(mv.qty_after) || 0}
                    </div>
                    {(mv.ref_code || mv.note) && (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                        {mv.ref_code ? `[${mv.ref_code}] ` : ""}{mv.note || ""}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

function ProductFormModal({ item, categories, onSave, onClose, user }) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    name: item?.name || "",
    sku: item?.sku || "",
    category: item?.category || (categories[0]?.code || "other"),
    unit: item?.unit || "Cái",
    price: item?.price || item?.retail_price || 0,
    wholesale_price: item?.wholesale_price || 0,
    cost_price: item?.cost_price || 0,
    stock_qty: item?.stock_qty || 0,
    is_active: item?.is_active ?? true,
    note: item?.note || "",
    serial_imei: item?.serial_imei || "",
  });
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState(item?.images || []);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [viewer, setViewer] = useState(null); // {items, startIndex}
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleImageFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingImg(true);
    try {
      const urls = [];
      for (const f of files) {
        const compressed = await compressImageFile(f);
        const url = await uploadFile(compressed);
        if (url) urls.push(url);
      }
      setImages(prev => [...prev, ...urls]);
    } catch (err) {
      alert("Lỗi tải ảnh: " + err.message);
    }
    setUploadingImg(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function removeImage(idx) {
    if (!window.confirm("Xóa ảnh này?")) return;
    setImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!form.name.trim()) { alert("Nhập tên hàng hóa!"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category,
        unit: form.unit,
        price: Number(form.price) || 0,
        retail_price: Number(form.price) || 0,
        wholesale_price: Number(form.wholesale_price) || 0,
        cost_price: Number(form.cost_price) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        is_active: form.is_active,
        note: form.note.trim(),
        serial_imei: form.serial_imei.trim(),
        images: images,
      };
      if (isEdit) {
        await SparePart.update(item.id, payload);
        logAction(user, "update", "spare_part", item.id,
          "Sửa hàng hóa: " + payload.name + " — SKU: " + (payload.sku || "—"));
        // Bù sổ kho nếu hàng chưa từng có ledger ở kho active nào (tồn > 0)
        await ensureStockLedgerForPart({ ...item, ...payload });
      } else {
        const rec = await SparePart.create(payload);
        logAction(user, "create", "spare_part", rec.id,
          "Tạo hàng hóa mới: " + payload.name + " — SKU: " + (payload.sku || "—"));
        // Ghi sổ kho mặc định (Kho 1) để xuất linh kiện không bị "không có trong kho này"
        await ensureStockLedgerForPart(rec);
      }
      refreshProductImages(); // cap nhat anh tren cac trang khac ngay lap tuc
      onSave();
      onClose();
    } catch (e) { alert("Lỗi: " + e.message); }
    setSaving(false);
  }

  const margin = Number(form.price) > 0 && Number(form.cost_price) > 0
    ? Math.round((Number(form.price) - Number(form.cost_price)) / Number(form.price) * 100)
    : null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"20px 0" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"min(560px,95vw)", margin:"20px 0" }}>
        <div style={{ fontWeight:900, fontSize:18, marginBottom:4, color:"#1e1b4b" }}>
          {isEdit ? "✏️ Sửa hàng hóa" : "➕ Thêm hàng hóa mới"}
        </div>
        <div style={{ fontSize:13, color:"#9ca3af", marginBottom:20 }}>
          {isEdit ? "Đang sửa: " + item.name : "Nhập thông tin để tạo danh mục mới"}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ gridColumn:"1 / -1" }}>
            <label style={LBL}>Tên hàng hóa *</label>
            <input value={form.name} onChange={e=>set("name", e.target.value)} placeholder="VD: Pin iPhone 14 Pro"
              style={{ ...INP, borderColor:"#c4b5fd" }} autoFocus />
          </div>

          <div>
            <label style={LBL}>Mã / SKU</label>
            <input value={form.sku} onChange={e=>set("sku", e.target.value)} placeholder="VD: PIN-IP14P"
              style={INP} />
          </div>

          <div>
            <label style={LBL}>IMEI / Serial (nếu có)</label>
            <input value={form.serial_imei} onChange={e=>set("serial_imei", e.target.value)} placeholder="Máy có IMEI"
              style={INP} />
          </div>

          <div>
            <label style={LBL}>Danh mục</label>
            <select value={form.category} onChange={e=>set("category", e.target.value)} style={INP}>
              {categories.map(c => (
                <option key={c.id} value={c.code}>{c.icon || "📦"} {c.name}</option>
              ))}
              {!categories.some(c => c.code === form.category) && form.category && (
                <option value={form.category}>📦 {form.category}</option>
              )}
            </select>
          </div>

          <div>
            <label style={LBL}>Đơn vị tính</label>
            <select value={form.unit} onChange={e=>set("unit", e.target.value)} style={INP}>
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label style={{ ...LBL, color:"#059669" }}>Giá bán lẻ (đ)</label>
            <input type="number" min={0} value={form.price} onChange={e=>set("price", e.target.value)}
              style={{ ...INP, borderColor:"#86efac" }} />
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{fmtMoney(Number(form.price))}</div>
          </div>

          <div>
            <label style={{ ...LBL, color:"#2563eb" }}>Giá bán sỉ (đ)</label>
            <input type="number" min={0} value={form.wholesale_price} onChange={e=>set("wholesale_price", e.target.value)}
              style={INP} />
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{fmtMoney(Number(form.wholesale_price))}</div>
          </div>

          <div>
            <label style={{ ...LBL, color:"#6b7280" }}>Giá vốn / nhập (đ)</label>
            <input type="number" min={0} value={form.cost_price} onChange={e=>set("cost_price", e.target.value)}
              style={INP} />
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{fmtMoney(Number(form.cost_price))}</div>
          </div>

          <div>
            <label style={LBL}>Tồn kho hiện tại</label>
            <input type="number" min={0} value={form.stock_qty} onChange={e=>set("stock_qty", e.target.value)}
              style={INP} disabled={isEdit}
              title={isEdit ? "Tồn kho tự động cập nhật khi nhập/xuất hàng" : ""} />
          </div>

          <div style={{ gridColumn:"1 / -1" }}>
            <label style={LBL}>📷 Hình ảnh hàng hóa</label>
            <div style={{ display:"flex", gap:8, marginBottom: images.length > 0 ? 8 : 0 }}>
              <button type="button" onClick={()=>cameraRef.current && cameraRef.current.click()} disabled={uploadingImg}
                style={{ flex:1, height:44, borderRadius:12, border:"2px dashed #cbd5e1", background:"#fff", color:"#334155", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                {uploadingImg ? "⏳ Đang tải..." : "📷 Chụp ảnh"}
              </button>
              <button type="button" onClick={()=>galleryRef.current && galleryRef.current.click()} disabled={uploadingImg}
                style={{ flex:1, height:44, borderRadius:12, border:"2px dashed #cbd5e1", background:"#fff", color:"#334155", fontWeight:800, fontSize:13, cursor:"pointer" }}>
                🖼️ Chọn từ máy
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={handleImageFiles} style={{ display:"none" }} />
              <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handleImageFiles} style={{ display:"none" }} />
            </div>
            {images.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {images.map((u, i) => (
                  <div key={i} style={{ position:"relative", width:76, height:76, borderRadius:10, overflow:"hidden", border:"1px solid #e5e7eb" }}>
                    <img src={normalizePbUrl(u)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", cursor:"pointer" }}
                      onClick={()=>setViewer({ items: images.map(x=>normalizePbUrl(x)), startIndex: i })} />
                    <button type="button" onClick={()=>removeImage(i)}
                      style={{ position:"absolute", top:2, right:2, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,.65)", color:"#fff", border:"none", fontSize:11, cursor:"pointer" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ gridColumn:"1 / -1" }}>
            <label style={LBL}>Ghi chú</label>
            <textarea value={form.note} onChange={e=>set("note", e.target.value)} rows={2}
              style={{ ...INP, height:"auto", paddingTop:10 }} placeholder="Mô tả, xuất xứ, bảo hành..." />
          </div>

          {margin != null && (
            <div style={{ gridColumn:"1 / -1", padding:"8px 14px", background:"#f0fdf4", borderRadius:10, fontSize:12 }}>
              💹 Biên lợi nhuận lẻ:{" "}
              <strong style={{ color: margin>=30 ? "#059669" : margin>=10 ? "#ca8a04" : "#dc2626" }}>{margin}%</strong>
              {" "}({fmtMoney(Number(form.price) - Number(form.cost_price))})
            </div>
          )}

          <div style={{ gridColumn:"1 / -1" }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
              <input type="checkbox" checked={form.is_active} onChange={e=>set("is_active", e.target.checked)}
                style={{ width:18, height:18, accentColor:"#6366f1" }} />
              <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>Kích hoạt (hiển thị khi bán / nhập)</span>
            </label>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, marginTop:24 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
          <button onClick={save} disabled={saving} style={{ flex:2, height:44, borderRadius:12, border:"none", background:"#6366f1", color:"#fff", fontWeight:800, cursor:"pointer", opacity: saving?0.6:1 }}>
            {saving ? "Đang lưu..." : "💾 Lưu"}
          </button>
        </div>
        {viewer && (
          <MediaViewer
            items={viewer.items}
            startIndex={viewer.startIndex}
            onClose={()=>setViewer(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Merge Modal ─────────────────────────────────────────────
function MergeModal({ source, items, onMerge, onClose, user }) {
  const [targetId, setTargetId] = useState("");
  const [merging, setMerging] = useState(false);
  const targets = items.filter(i => i.id !== source?.id);

  async function doMerge() {
    if (!targetId) { alert("Chọn hàng hóa đích!"); return; }
    const target = items.find(i => i.id === targetId);
    if (!window.confirm(
      "Gộp \"" + source.name + "\" vào \"" + target.name + "\"?\n\n" +
      "• Tồn kho: " + (source.stock_qty||0) + " + " + (target.stock_qty||0) + " = " + ((source.stock_qty||0)+(target.stock_qty||0)) + "\n" +
      "• Giá sẽ giữ nguyên của hàng đích\n" +
      "• Hàng nguồn sẽ bị XÓA (để tránh trùng lặp)"
    )) return;
    setMerging(true);
    try {
      await SparePart.update(target.id, {
        stock_qty: (Number(source.stock_qty) || 0) + (Number(target.stock_qty) || 0),
      });
      await SparePart.delete(source.id);
      logAction(user, "merge", "spare_part", target.id,
        "Gộp \"" + source.name + "\" (SKU: " + (source.sku||"—") + ") → \"" + target.name + "\" (SKU: " + (target.sku||"—") + ")");
      onMerge();
      onClose();
    } catch (e) { alert("Lỗi: " + e.message); }
    setMerging(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"min(480px,95vw)" }}>
        <div style={{ fontWeight:900, fontSize:16, marginBottom:4 }}>🔀 Gộp hàng hóa</div>
        <div style={{ fontSize:13, color:"#9ca3af", marginBottom:16 }}>
          Gộp <strong style={{ color:"#1f2937" }}>"{source?.name}"</strong> (SKU: {source?.sku || "—"}) vào hàng hóa khác để loại bỏ trùng lặp.
        </div>
        <label style={LBL}>Chọn hàng hóa đích (giữ lại):</label>
        <select value={targetId} onChange={e=>setTargetId(e.target.value)} style={{ ...INP, height:120 }} size={5}>
          <option value="">— Chọn hàng hóa đích —</option>
          {targets.map(t => (
            <option key={t.id} value={t.id}>{t.name} — SKU: {t.sku || "—"} — Tồn: {t.stock_qty || 0}</option>
          ))}
        </select>
        <div style={{ fontSize:12, color:"#dc2626", marginTop:12, padding:"8px 12px", background:"#fef2f2", borderRadius:8 }}>
          ⚠️ Hàng nguồn sẽ bị xóa. Tồn kho sẽ cộng sang hàng đích.
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
          <button onClick={doMerge} disabled={merging || !targetId} style={{ flex:2, height:44, borderRadius:12, border:"none", background:"#f59e0b", color:"#fff", fontWeight:800, cursor:"pointer", opacity: (merging || !targetId) ? 0.5 : 1 }}>
            {merging ? "Đang gộp..." : "🔀 Gộp"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function ProductManagerPage({ user }) {
  const [confirmToggle, setConfirmToggle] = useState(null); // hàng hóa chờ xác nhận ẩn/hiện
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [merging, setMerging] = useState(null);
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [tableViewer, setTableViewer] = useState(null);

  const { can } = usePermission();
  const isAdmin = !!can("product_mgr","edit"); // theo phan quyen
  // Thẻ kho: kế toán / quản lý xem nhanh
  const canStockCard = ["accountant","manager","admin","owner","supervisor"].includes(user?.role) || can("stock_card","view");
  const [stockCard, setStockCard] = useState(null);

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.code] = c; });
    return m;
  }, [categories]);

  function catLabel(code) {
    const c = catMap[code];
    return c ? ((c.icon || "📦") + " " + c.name) : (code || "—");
  }

  const PAGE_SIZE = 100;
  const [totalFound, setTotalFound] = useState(0);
  const [page, setPage] = useState(1);
  const [allStats, setAllStats] = useState({ total:0, active:0, outOfStock:0, totalValue:0 });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce ô tìm kiếm → tìm TRÊN SERVER toàn bộ catalog (12k+ hàng)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, category, showInactive, sortBy]);

  function buildFilter() {
    const parts = [];
    if (!showInactive) parts.push("is_active!=false");
    if (category !== "all") parts.push('category="' + String(category).replace(/\\/g,"\\\\").replace(/"/g,'\\"') + '"');
    if (debouncedSearch) {
      const q = debouncedSearch.replace(/\\/g,"\\\\").replace(/"/g,'\\"');
      parts.push('(name~"' + q + '" || sku~"' + q + '" || serial_imei~"' + q + '" || note~"' + q + '")');
    }
    return parts.join(" && ");
  }
  const SORT_MAP = { name:"name", stock:"-stock_qty", price:"-price", category:"category,name" };

  // Thống kê trên TOÀN BỘ catalog (chỉ tải 4 trường, không tải cả dòng)
  const loadStats = useCallback(async () => {
    try {
      const all = await SparePart.listAll({ fields: "id,stock_qty,cost_price,price,is_active" });
      let active = 0, out = 0, val = 0;
      all.forEach(i => {
        if (i.is_active !== false) active++;
        const q = Number(i.stock_qty) || 0;
        if (q <= 0) out++;
        val += (Number(i.cost_price) || Number(i.price) || 0) * q;
      });
      setAllStats({ total: all.length, active, outOfStock: out, totalValue: val });
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ perPage: PAGE_SIZE, page, sort: SORT_MAP[sortBy] || "name", skipTotal: "0" });
      const f = buildFilter();
      if (f) params.set("filter", f);
      const [res, catData] = await Promise.all([
        pbFetch("collections/product_catalog/records?" + params),
        ProductCategory.list({ limit: 200, sort: "sort_order,name" }),
      ]);
      setItems(res.items || []);
      setTotalFound(res.totalItems || 0);
      setCategories((catData || []).filter(c => c.is_active !== false));
    } catch { setItems([]); setTotalFound(0); setCategories([]); }
    setLoading(false);
    // eslint-disable-next-line
  }, [page, debouncedSearch, category, showInactive, sortBy]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // Danh sách ĐẦY ĐỦ (12k+) chỉ tải khi mở Gộp hàng / Nhập-Xuất file
  const [fullItems, setFullItems] = useState([]);
  const [fullLoading, setFullLoading] = useState(false);
  async function ensureFullItems() {
    if (fullItems.length > 0 || fullLoading) return;
    setFullLoading(true);
    try { setFullItems(await SparePart.listAll({ sort: "name" })); } catch {}
    setFullLoading(false);
  }

  const displayed = items;
  const stats = allStats;
  const totalPages = Math.max(1, Math.ceil(totalFound / PAGE_SIZE));

  async function handleDelete(item) {
    if (!window.confirm("Xóa \"" + item.name + "\"?\n\nTồn kho: " + (item.stock_qty || 0) + "\nThao tác này không thể hoàn tác!")) return;
    try {
      await SparePart.delete(item.id);
      logAction(user, "delete", "spare_part", item.id, "Xóa hàng hóa: " + item.name + " — SKU: " + (item.sku || "—"));
      load(); loadStats();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  // Bấm ẩn/hiện → hỏi xác nhận trước (tránh ẩn nhầm hàng đang bán)
  function askToggleActive(item) { setConfirmToggle(item); }

  async function toggleActive(item) {
    try {
      const newVal = !item.is_active;
      await SparePart.update(item.id, { is_active: newVal });
      logAction(user, newVal ? "activate" : "deactivate", "spare_part", item.id,
        (newVal ? "Kích hoạt" : "Vô hiệu hóa") + ": " + item.name);
      load();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  const CARD = {
    background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"14px 16px", minWidth:0,
    display:"flex", flexDirection:"column", gap:4,
  };
  const STAT_NUM = { fontSize:22, fontWeight:900, color:"#1e1b4b" };
  const STAT_LBL = { fontSize:12, color:"#9ca3af", fontWeight:600 };

  return (
    <div style={{ padding:"20px 16px 80px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:4 }}>📦 Danh mục hàng hóa</div>
          <div style={{ fontSize:13, color:"#9ca3af" }}>
            Quản lý sản phẩm / linh kiện / dịch vụ — thêm, sửa, xóa, ẩn/hiện hàng hóa
          </div>
        </div>
        {isAdmin && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={()=>setShowCatMgr(true)} style={{
              height:44, padding:"0 16px", borderRadius:12, border:"1.5px solid #e5e7eb",
              background:"#fff", color:"#374151", fontWeight:700, fontSize:13, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6,
            }}>
              🏷️ Quản lý danh mục
            </button>
            {can("product_mgr","export") && (
            <button onClick={()=>{ ensureFullItems(); setShowImportExport(true); }} style={{
              height:44, padding:"0 16px", borderRadius:12, border:"1.5px solid #e5e7eb",
              background:"#fff", color:"#374151", fontWeight:700, fontSize:13, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6,
            }}>
              📁 Nhập / Xuất file
            </button>
            )}
            <button onClick={()=>{ setEditing(null); setShowForm(true); }} style={{
              height:44, padding:"0 20px", borderRadius:12, border:"none",
              background:"#6366f1", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20 }}>add</span>
              Thêm hàng hóa
            </button>
          </div>
        )}
      </div>

      <style>{`.pm-stats{display:grid;grid-template-columns:1fr 1fr 1fr 1.9fr;gap:10px;margin-bottom:16px}@media(max-width:700px){.pm-stats{grid-template-columns:repeat(3,1fr)!important}.pm-stats>.pm-stat-wide{grid-column:1 / -1 !important}}`}</style>
      <div className="pm-stats">
        <div style={CARD}>
          <span style={STAT_NUM}>{stats.total}</span>
          <span style={STAT_LBL}>Tổng hàng hóa</span>
        </div>
        <div style={CARD}>
          <span style={STAT_NUM}>{stats.active}</span>
          <span style={STAT_LBL}>Đang hoạt động</span>
        </div>
        <div style={CARD}>
          <span style={{ ...STAT_NUM, color: stats.outOfStock > 0 ? "#dc2626" : "#1e1b4b" }}>{stats.outOfStock}</span>
          <span style={STAT_LBL}>Hết hàng</span>
        </div>
        <div className="pm-stat-wide" style={{ ...CARD, minWidth:0 }}>
          <span style={{ ...STAT_NUM, fontSize:"clamp(15px, 4.6vw, 22px)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"clip" }}>{fmtMoney(stats.totalValue)}</span>
          <span style={STAT_LBL}>Giá trị tồn kho</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Tìm tên, SKU, IMEI, ghi chú..."
          style={{ flex:1, minWidth:200, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 44px", fontSize:13, outline:"none" }} />
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ height:40, minWidth:180, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#fff" }}>
          <option value="all">Tất cả danh mục</option>
          {categories.map(c => (
            <option key={c.id} value={c.code}>{c.icon || "📦"} {c.name}</option>
          ))}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#fff" }}>
          <option value="name">Sắp xếp: Tên A-Z</option>
          <option value="stock">Sắp xếp: Tồn kho ↓</option>
          <option value="price">Sắp xếp: Giá ↓</option>
          <option value="category">Sắp xếp: Danh mục</option>
        </select>
        {isAdmin && (
          <label title="Bật để hiện cả những mặt hàng đã ẩn (ngừng bán) trong danh sách" style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", height:40, padding:"0 12px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff" }}>
            <input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}
              style={{ width:16, height:16, accentColor:"#6366f1" }} />
            <span style={{ fontSize:12, fontWeight:600, color:"#6b7280" }}>Hiện cả hàng đang ẩn</span>
          </label>
        )}
      </div>

      {loading && <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>
          <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:8 }}>inventory_2</span>
          <div>Không tìm thấy hàng hóa nào</div>
          {isAdmin && <div style={{ fontSize:13, marginTop:8 }}>Bấm "Thêm hàng hóa" để tạo mới</div>}
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                <th style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:"#374151" }}>Ảnh</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>Tên hàng hóa</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>SKU / IMEI</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>Danh mục</th>
                <th style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:"#374151" }}>ĐVT</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#9ca3af" }}>Giá vốn</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>Giá lẻ</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#374151" }}>Tồn</th>
                {(isAdmin || canStockCard) && <th style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:"#374151" }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {displayed.map(item => {
                const isActive = item.is_active !== false;
                const stock = Number(item.stock_qty) || 0;
                const cost = item.cost_price || 0;
                const retail = item.retail_price || item.price || 0;
                return (
                  <tr key={item.id} style={{
                    borderBottom:"1px solid #f3f4f6",
                    opacity: isActive ? 1 : 0.5,
                  }}>
                    <td style={{ padding:"10px 14px", textAlign:"center" }}>
                      {item.images && item.images.length > 0
                        ? <img src={normalizePbUrl(item.images[0])} alt=""
                            onClick={(e)=>{ e.stopPropagation(); setTableViewer({ items: item.images.map(normalizePbUrl), startIndex: 0 }); }}
                            style={{ width:40, height:40, borderRadius:8, objectFit:"cover", cursor:"pointer", border:"1px solid #e5e7eb" }}
                            title="Bấm để phóng to" />
                        : <span style={{ color:"#e5e7eb", fontSize:20 }}>▣</span>}
                    </td>
                    <td style={{ padding:"10px 14px", fontWeight:600, color:"#1f2937" }}>
                      {item.name}
                      {!isActive && <span style={{ marginLeft:6, fontSize:11, color:"#dc2626" }}>(ẩn)</span>}
                      {item.note && <div style={{ fontSize:11, color:"#9ca3af", fontWeight:400, marginTop:2 }}>{item.note}</div>}
                    </td>
                    <td style={{ padding:"10px 14px", color:"#9ca3af", fontFamily:"monospace", fontSize:12 }}>
                      {item.sku || "—"}
                      {item.serial_imei && <div style={{ fontSize:11 }}>{item.serial_imei}</div>}
                    </td>
                    <td style={{ padding:"10px 14px", color:"#6b7280" }}>
                      {catLabel(item.category)}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"center", color:"#6b7280" }}>{item.unit || "Cái"}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#9ca3af" }}>
                      {cost > 0 ? fmtMoney(cost) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>
                      {retail > 0 ? fmtMoney(retail) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700 }}>
                      <span style={{
                        padding:"2px 8px", borderRadius:8, fontSize:12,
                        background: stock === 0 ? "#fef2f2" : stock < 5 ? "#fef9c3" : "#f0fdf4",
                        color: stock === 0 ? "#dc2626" : stock < 5 ? "#ca8a04" : "#059669",
                      }}>
                        {stock}
                      </span>
                    </td>
                    {(isAdmin || canStockCard) && (
                      <td style={{ padding:"10px 14px", textAlign:"center" }}>
                        <div style={{ display:"flex", gap:4, justifyContent:"center", flexWrap:"wrap" }}>
                          {canStockCard && (
                            <ActionBtn hint="Xem thẻ kho (tồn từng kho + lịch sử nhập xuất)" fg="#0284c7" bg="#e0f2fe" bd="#bae6fd"
                              onClick={()=>setStockCard(item)}>
                              <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:16 }}>receipt_long</span>
                            </ActionBtn>
                          )}
                          {isAdmin && (<>
                          <ActionBtn hint="Sửa thông tin hàng hóa" fg="#6366f1" bg="#ede9fe" bd="#e0e7ff"
                            onClick={()=>{ setEditing(item); setShowForm(true); }}>
                            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:16 }}>edit</span>
                          </ActionBtn>
                          <ActionBtn hint={isActive ? "Đang bán — bấm để ẩn khỏi danh sách" : "Đang ẩn — bấm để hiện lại"}
                            fg={isActive ? "#059669" : "#9ca3af"} bg={isActive ? "#f0fdf4" : "#f9fafb"} bd={isActive ? "#bbf7d0" : "#e5e7eb"}
                            onClick={()=>askToggleActive(item)}>
                            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:16 }}>{isActive ? "visibility" : "visibility_off"}</span>
                          </ActionBtn>
                          <ActionBtn hint="Xóa hàng hóa khỏi danh mục" fg="#dc2626" bg="#fef2f2" bd="#fecaca"
                            onClick={()=>handleDelete(item)}>
                            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:16 }}>delete</span>
                          </ActionBtn>
                          </>)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalFound > 0 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap", margin:"14px 2px 4px" }}>
          <span style={{ fontSize:13, color:"#6b7280", fontWeight:600 }}>
            Hiển thị {(page-1)*PAGE_SIZE + 1}–{Math.min(page*PAGE_SIZE, totalFound)} / {totalFound.toLocaleString("vi-VN")} hàng hóa
          </span>
          {totalPages > 1 && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}
                style={{ height:38, padding:"0 14px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, fontSize:13, cursor:page<=1?"not-allowed":"pointer", opacity:page<=1?.45:1 }}>← Trước</button>
              <span style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{page} / {totalPages}</span>
              <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                style={{ height:38, padding:"0 14px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, fontSize:13, cursor:page>=totalPages?"not-allowed":"pointer", opacity:page>=totalPages?.45:1 }}>Sau →</button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <ProductFormModal
          item={editing}
          categories={categories}
          user={user}
          onSave={()=>{ load(); loadStats(); }}
          onClose={()=>{ setShowForm(false); setEditing(null); }}
        />
      )}
      {merging && (
        <MergeModal
          source={merging}
          items={fullItems.length ? fullItems : items}
          user={user}
          onMerge={()=>{ load(); loadStats(); setFullItems([]); }}
          onClose={()=>setMerging(null)}
        />
      )}
      {showCatMgr && (
        <CategoryManagerModal
          user={user}
          onClose={()=>setShowCatMgr(false)}
          onChanged={()=>load()}
        />
      )}

      {showImportExport && (
        <ProductImportExportModal
          user={user}
          items={fullItems.length ? fullItems : items}
          categories={categories}
          catMap={catMap}
          onClose={()=>setShowImportExport(false)}
          onImported={()=>{ load(); loadStats(); setFullItems([]); }}
        />
      )}

      {stockCard && <StockCardModal item={stockCard} onClose={()=>setStockCard(null)} />}

      {/* Xác nhận ẩn / hiện hàng hóa */}
      {confirmToggle && (() => {
        const willHide = !!confirmToggle.is_active;
        return (
          <div style={{ position:"fixed", inset:0, zIndex:3500, background:"rgba(15,23,42,.55)",
            display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div style={{ background:"#fff", borderRadius:16, width:"min(420px,94vw)", padding:"20px 18px 16px",
              boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
              <div style={{ fontSize:30, textAlign:"center", marginBottom:6 }}>{willHide ? "🙈" : "👁️"}</div>
              <div style={{ fontWeight:900, fontSize:15.5, textAlign:"center", color:"#1e1b4b", marginBottom:8 }}>
                {willHide ? "Ẩn hàng này khỏi danh sách bán?" : "Hiện lại hàng này?"}
              </div>
              <div style={{ fontSize:13.5, fontWeight:700, textAlign:"center", color:"#374151", marginBottom:10 }}>
                {confirmToggle.name}
              </div>
              {willHide ? (
                <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:12, padding:"10px 12px", marginBottom:14 }}>
                  <div style={{ fontSize:12.5, color:"#b91c1c", fontWeight:700, lineHeight:1.6 }}>
                    • Hàng sẽ không hiện khi tìm bán ở POS, báo giá sửa chữa.
                  </div>
                  <div style={{ fontSize:12.5, color:"#b91c1c", fontWeight:700, lineHeight:1.6 }}>
                    • Tồn kho và lịch sử bán vẫn giữ nguyên.
                  </div>
                  <div style={{ fontSize:12.5, color:"#b91c1c", fontWeight:700, lineHeight:1.6 }}>
                    • Có thể bật hiện lại bất cứ lúc nào.
                  </div>
                </div>
              ) : (
                <div style={{ background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:12, padding:"10px 12px", marginBottom:14, fontSize:12.5, color:"#15803d", fontWeight:700 }}>
                  Hàng sẽ hiện lại trong danh mục và khi tìm bán ở POS.
                </div>
              )}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>setConfirmToggle(null)}
                  style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #d1d5db", background:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                  Hủy
                </button>
                <button onClick={()=>{ const it=confirmToggle; setConfirmToggle(null); toggleActive(it); }}
                  style={{ flex:1.3, height:44, borderRadius:12, border:"none",
                    background: willHide ? "#dc2626" : "#059669", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                  {willHide ? "Ẩn hàng" : "Hiện lại"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {tableViewer && (
        <MediaViewer
          items={tableViewer.items}
          startIndex={tableViewer.startIndex}
          onClose={()=>setTableViewer(null)}
        />
      )}
    </div>
  );
}
