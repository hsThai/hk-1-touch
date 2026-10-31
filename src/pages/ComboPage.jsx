/* ComboPage.jsx — Combo sản phẩm (ghép combo → trừ kho linh kiện, combo có tồn riêng để bán) */
import React, { useEffect, useMemo, useState } from "react";
import { getPbUrl, getAuth, logAction, SparePart } from "./pb.jsx";
import { useUnsaved } from "../utils/unsavedGuard.jsx";
import { usePermission } from "./PermissionContext.jsx";

function fmtMoney(n) { return Number(n || 0).toLocaleString("vi-VN") + "đ"; }
function dVN(s) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d) ? "" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function hdr() {
  const a = getAuth() || {};
  return { "Content-Type": "application/json", ...(a.token ? { Authorization: a.token } : {}) };
}
async function pbList(col, qs = "") {
  const r = await fetch(`${getPbUrl()}/api/collections/${col}/records?${qs}`, { headers: hdr() });
  if (!r.ok) throw new Error("Không tải được " + col);
  return (await r.json()).items || [];
}
async function pbCreate(col, data) {
  const r = await fetch(`${getPbUrl()}/api/collections/${col}/records`, { method: "POST", headers: hdr(), body: JSON.stringify(data) });
  const j = await r.json(); if (!r.ok) throw new Error(j.message || "Lỗi lưu"); return j;
}
async function pbUpdate(col, id, data) {
  const r = await fetch(`${getPbUrl()}/api/collections/${col}/records/${id}`, { method: "PATCH", headers: hdr(), body: JSON.stringify(data) });
  const j = await r.json(); if (!r.ok) throw new Error(j.message || "Lỗi cập nhật"); return j;
}
async function pbDelete(col, id) {
  const r = await fetch(`${getPbUrl()}/api/collections/${col}/records/${id}`, { method: "DELETE", headers: hdr() });
  if (!r.ok && r.status !== 404) throw new Error("Lỗi xóa");
}

const EMPTY_FORM = { name: "", sku: "", unit: "Combo", price: "", note: "" };

export default function ComboPage({ user }) {
  const { can } = usePermission();
  const canEdit = !can || can("product_mgr", "edit") || can("product_mgr", "create");
  const [isPC, setIsPC] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const [combos, setCombos] = useState([]);
  const [itemsByCombo, setItemsByCombo] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const [openId, setOpenId] = useState("");           // combo đang xổ chi tiết
  const [form, setForm] = useState(null);             // modal tạo/sửa
  const [lines, setLines] = useState([]);             // thành phần trong form
  const [partQ, setPartQ] = useState("");
  const [partRes, setPartRes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [assemble, setAssemble] = useState(null);     // { combo } modal ghép
  const [asmQty, setAsmQty] = useState(1);
  const [asmWh, setAsmWh] = useState("");
  const [asmBusy, setAsmBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  useUnsaved("combo_form", !!form && !!(form.name || "").trim(), "Combo đang tạo (chưa lưu)");

  function showToast(m) { setToast(m); setTimeout(() => setToast(""), 3200); }

  async function load() {
    setLoading(true);
    try {
      const [cs, its, whs] = await Promise.all([
        pbList("product_combos", "perPage=300&sort=-id"),
        pbList("product_combo_items", "perPage=1000&sort=-id"),
        pbList("warehouses", "perPage=50"),
      ]);
      setCombos(cs);
      const map = {};
      its.forEach(it => { (map[it.combo_id] = map[it.combo_id] || []).push(it); });
      setItemsByCombo(map);
      setWarehouses(whs.filter(w => w.is_active !== false));
      if (!asmWh) {
        const k16 = whs.find(w => (w.code || "").toLowerCase().startsWith("kho16"));
        setAsmWh(k16?.id || whs[0]?.id || "");
      }
    } catch (e) { showToast("❌ " + e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Tìm linh kiện để thêm vào combo
  useEffect(() => {
    if (!partQ.trim()) { setPartRes([]); return; }
    const t = setTimeout(async () => {
      try {
        const s = partQ.trim().replace(/"/g, '\\"');
        const r = await SparePart.list({ filter: `is_active=true && (name~"${s}" || sku~"${s}")`, sort: "-stock_qty", limit: 20 });
        setPartRes(r || []);
      } catch { setPartRes([]); }
    }, 280);
    return () => clearTimeout(t);
  }, [partQ]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, sku: "CB" + Date.now().toString().slice(-6) });
    setLines([]); setPartQ(""); setPartRes([]);
  }
  function openEdit(c) {
    setForm({ id: c.id, name: c.name || "", sku: c.sku || "", unit: c.unit || "Combo", price: c.price || "", note: c.note || "" });
    setLines((itemsByCombo[c.id] || []).map(it => ({
      part_id: it.part_id, part_name: it.part_name, sku: it.sku,
      unit_price: it.unit_price || 0, qty: it.qty || 1, itemId: it.id,
    })));
    setPartQ(""); setPartRes([]);
  }
  function addLine(p) {
    if (lines.some(l => l.part_id === p.id)) { showToast("Mặt hàng đã có trong combo"); return; }
    setLines(prev => [...prev, { part_id: p.id, part_name: p.name, sku: p.sku || "", unit_price: p.price || 0, qty: 1 }]);
    setPartQ(""); setPartRes([]);
  }
  function setLineQty(i, v) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, qty: Math.max(1, Number(v) || 1) } : l));
  }
  function removeLine(i) { setLines(prev => prev.filter((_, idx) => idx !== i)); }

  const formCost = useMemo(() => lines.reduce((s, l) => s + (l.unit_price || 0) * (l.qty || 1), 0), [lines]);

  async function saveCombo() {
    if (!form.name.trim()) { showToast("⚠️ Nhập tên combo"); return; }
    if (lines.length === 0) { showToast("⚠️ Combo phải có ít nhất 1 mặt hàng"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), sku: form.sku.trim(), unit: form.unit || "Combo",
        price: Number(form.price) || 0, note: form.note || "",
        cost_price: formCost, components_count: lines.length, is_active: true,
      };
      let comboId = form.id;
      if (form.id) {
        await pbUpdate("product_combos", form.id, payload);
        // xoá items cũ rồi tạo lại
        for (const it of (itemsByCombo[form.id] || [])) await pbDelete("product_combo_items", it.id).catch(() => { });
      } else {
        const created = await pbCreate("product_combos", { ...payload, stock_qty: 0 });
        comboId = created.id;
      }
      for (const l of lines) {
        await pbCreate("product_combo_items", {
          combo_id: comboId, combo_name: payload.name,
          part_id: l.part_id, part_name: l.part_name, sku: l.sku,
          qty: Number(l.qty) || 1, unit_price: l.unit_price || 0,
        });
      }
      logAction(user, form.id ? "update" : "create", "product_combo", comboId, `${form.id ? "Cập nhật" : "Tạo"} combo ${payload.name} (${lines.length} thành phần)`);
      showToast(form.id ? "✅ Đã cập nhật combo" : "✅ Đã tạo combo — bấm Ghép để nhập kho combo");
      setForm(null);
      await load();
    } catch (e) { showToast("❌ " + e.message); }
    setSaving(false);
  }

  async function doAssemble() {
    const c = assemble?.combo;
    if (!c || !asmWh) return;
    const its = itemsByCombo[c.id] || [];
    if (its.length === 0) { showToast("⚠️ Combo chưa có thành phần"); return; }
    setAsmBusy(true);
    try {
      const ledgers = await pbList("stock_ledgers", `perPage=500&filter=${encodeURIComponent(`(warehouse_id="${asmWh}")`)}`);
      const byPart = {};
      ledgers.forEach(l => { byPart[l.part_id] = l; });
      const whName = warehouses.find(w => w.id === asmWh)?.name || "";
      // kiểm tra đủ hàng
      const shortage = [];
      for (const it of its) {
        const need = (Number(it.qty) || 1) * Number(asmQty);
        const have = Number(byPart[it.part_id]?.qty_on_hand || 0);
        if (have < need) shortage.push(`${it.part_name || it.sku}: cần ${need}, còn ${have}`);
      }
      if (shortage.length) { showToast("⛔ Thiếu hàng: " + shortage.slice(0, 3).join(" · ")); setAsmBusy(false); return; }
      // trừ kho từng linh kiện + ghi thẻ kho
      for (const it of its) {
        const need = (Number(it.qty) || 1) * Number(asmQty);
        const led = byPart[it.part_id];
        const before = Number(led.qty_on_hand || 0);
        const after = Math.max(0, before - need);
        await pbUpdate("stock_ledgers", led.id, {
          qty_on_hand: after, qty_available: Math.max(0, after - Number(led.qty_reserved || 0)),
          last_movement_at: new Date().toISOString(),
        });
        await pbCreate("stock_movements", {
          movement_code: "MV" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90),
          movement_type: "combo_pick",
          warehouse_id: asmWh, warehouse_name: whName,
          part_id: it.part_id, part_name: it.part_name, sku: it.sku,
          qty_before: before, qty_change: -need, qty_after: after,
          unit_price: it.unit_price || 0,
          ref_type: "combo", ref_id: c.id, ref_code: c.sku || c.name,
          note: `Ghép ${asmQty} combo ${c.name}`,
          created_by_id: user?.id || "", created_by_name: user?.full_name || user?.name || "",
          created_date: new Date().toISOString().replace("T", " ").split(".")[0],
        }).catch(() => { });
      }
      await pbUpdate("product_combos", c.id, {
        stock_qty: Number(c.stock_qty || 0) + Number(asmQty),
        last_assembled_at: new Date().toISOString(),
      });
      logAction(user, "update", "product_combo", c.id, `Ghép ${asmQty} combo ${c.name} tại ${whName} — trừ ${its.length} loại linh kiện`);
      showToast(`✅ Đã ghép ${asmQty} combo ${c.name}`);
      setAssemble(null);
      await load();
    } catch (e) { showToast("❌ " + e.message); }
    setAsmBusy(false);
  }

  async function deleteCombo(c) {
    try {
      for (const it of (itemsByCombo[c.id] || [])) await pbDelete("product_combo_items", it.id).catch(() => { });
      await pbDelete("product_combos", c.id);
      logAction(user, "delete", "product_combo", c.id, `Xóa combo ${c.name}`);
      showToast("Đã xóa combo");
      setConfirmDel(null);
      await load();
    } catch (e) { showToast("❌ " + e.message); }
  }

  const filtered = combos.filter(c => !q.trim() || (c.name || "").toLowerCase().includes(q.trim().toLowerCase()) || (c.sku || "").toLowerCase().includes(q.trim().toLowerCase()));

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#9ca3af" }}>⏳ Đang tải combo...</div>;

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#1e1b4b" }}>🎁 Combo sản phẩm</div>
          <div style={{ fontSize: 12.5, color: "#6b7280" }}>Ghép combo sẽ trừ tồn linh kiện · bán combo trừ tồn combo</div>
        </div>
        {canEdit && (
          <button onClick={openCreate}
            style={{ height: 42, padding: "0 16px", borderRadius: 12, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            + Tạo combo
          </button>
        )}
      </div>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <span className="material-icons" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 20 }}>search</span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm combo theo tên hoặc mã..."
          style={{ width: "100%", height: 44, borderRadius: 12, border: "1.5px solid #e5e7eb", paddingLeft: 44, paddingRight: 12, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎁</div>
          Chưa có combo nào. Bấm "Tạo combo" để bắt đầu.
        </div>
      ) : filtered.map(c => {
        const its = itemsByCombo[c.id] || [];
        const open = openId === c.id;
        const stock = Number(c.stock_qty || 0);
        return (
          <div key={c.id} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => setOpenId(open ? "" : c.id)}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: "#1f2937" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {c.sku || "—"} · {fmtMoney(c.price)} · {its.length} thành phần
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: stock > 0 ? "#059669" : "#dc2626" }}>{stock}</div>
                <div style={{ fontSize: 10.5, color: "#9ca3af" }}>combo sẵn</div>
              </div>
              {canEdit && (
                <>
                  <button onClick={() => { setAssemble({ combo: c }); setAsmQty(1); }}
                    style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>
                    Ghép
                  </button>
                  <button onClick={() => openEdit(c)} title="Sửa"
                    style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}>✏️</button>
                  <button onClick={() => setConfirmDel(c)} title="Xóa"
                    style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", cursor: "pointer" }}>🗑</button>
                </>
              )}
            </div>
            {open && (
              <div style={{ borderTop: "1px dashed #e5e7eb", padding: "10px 14px", background: "#fafafa" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#6b7280", marginBottom: 6 }}>THÀNH PHẦN ({its.length})</div>
                {its.map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#374151", padding: "3px 0" }}>
                    <span>• {it.part_name} {it.sku ? `(${it.sku})` : ""}</span>
                    <b>x{it.qty}</b>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                  Giá vốn linh kiện: <b>{fmtMoney(c.cost_price)}</b> · Giá bán: <b style={{ color: "#059669" }}>{fmtMoney(c.price)}</b>
                  {c.last_assembled_at ? ` · Ghép gần nhất ${dVN(c.last_assembled_at)}` : ""}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal tạo/sửa combo */}
      {form && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,.55)", display: "flex", alignItems: isPC ? "center" : "flex-end", justifyContent: "center", padding: isPC ? 16 : 0 }}>
          <div style={{ background: "#fff", width: isPC ? "min(720px,94vw)" : "100%", maxHeight: isPC ? "90vh" : "88vh", borderRadius: isPC ? 18 : "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>{form.id ? "✏️ Sửa combo" : "🎁 Tạo combo sản phẩm"}</div>
              <button onClick={() => setForm(null)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.2)", color: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: isPC ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 10 }}>
                <div style={{ gridColumn: isPC ? "1 / -1" : "auto" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Tên combo *</div>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: Combo dán màn hình"
                    style={{ width: "100%", height: 42, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Mã combo</div>
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    style={{ width: "100%", height: 42, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Giá bán combo (đ)</div>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0"
                    style={{ width: "100%", height: 42, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 800, margin: "14px 0 6px", color: "#374151" }}>Thành phần combo</div>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={partQ} onChange={e => setPartQ(e.target.value)} placeholder="Tìm linh kiện để thêm..."
                  style={{ width: "100%", height: 42, borderRadius: 10, border: "1.5px solid #e5e7eb", paddingLeft: 44, paddingRight: 12, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                <span className="material-icons" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 20 }}>search</span>
                {partRes.length > 0 && (
                  <div style={{ position: "absolute", top: 46, left: 0, right: 0, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, zIndex: 20, maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
                    {partRes.map(p => (
                      <div key={p.id} onClick={() => addLine(p)} style={{ padding: "9px 12px", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: "#6b7280" }}>{p.sku} · {fmtMoney(p.price)} · tồn {p.stock_qty || 0}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lines.length === 0 ? (
                <div style={{ textAlign: "center", padding: "18px 10px", color: "#9ca3af", border: "1.5px dashed #e5e7eb", borderRadius: 12, fontSize: 13 }}>
                  Chưa có thành phần — tìm và bấm để thêm
                </div>
              ) : (
                <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                  {lines.map((l, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: i < lines.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{l.part_name}</div>
                        <div style={{ fontSize: 11.5, color: "#6b7280" }}>{l.sku} · {fmtMoney(l.unit_price)}</div>
                      </div>
                      <input type="number" min={1} value={l.qty} onChange={e => setLineQty(i, e.target.value)}
                        style={{ width: 60, height: 34, borderRadius: 8, border: "1.5px solid #e5e7eb", textAlign: "center", fontSize: 13 }} />
                      <button onClick={() => removeLine(i)} style={{ border: "none", background: "none", color: "#dc2626", fontSize: 18, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 12.5, color: "#374151" }}>
                Giá vốn linh kiện: <b>{fmtMoney(formCost)}</b>
                {Number(form.price) > 0 && (
                  <span style={{ marginLeft: 10, color: Number(form.price) - formCost >= 0 ? "#059669" : "#dc2626" }}>
                    · Lãi gộp {fmtMoney(Number(form.price) - formCost)}
                  </span>
                )}
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Ghi chú</div>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Tuỳ chọn..."
                  style={{ width: "100%", height: 42, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6" }}>
              <button onClick={saveCombo} disabled={saving}
                style={{ width: "100%", height: 46, borderRadius: 12, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}>
                {saving ? "⏳ Đang lưu..." : "Lưu combo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ghép combo */}
      {assemble && (() => {
        const c = assemble.combo;
        const its = itemsByCombo[c.id] || [];
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 1600, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 18, width: "min(460px,94vw)", padding: "18px 18px 16px", maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: "#1e1b4b" }}>🔧 Ghép combo</div>
                <button onClick={() => setAssemble(null)} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#f3f4f6", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 2 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Tồn combo hiện tại: <b>{c.stock_qty || 0}</b></div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Lấy linh kiện từ kho</div>
                <select value={asmWh} onChange={e => setAsmWh(e.target.value)}
                  style={{ width: "100%", height: 42, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 10px", fontSize: 14, background: "#fff" }}>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Số combo muốn ghép</div>
                <input type="number" min={1} value={asmQty} onChange={e => setAsmQty(Math.max(1, Number(e.target.value) || 1))}
                  style={{ width: "100%", height: 42, borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>

              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#6b7280", marginBottom: 5 }}>LINH KIỆN SẼ TRỪ</div>
                {its.map((it, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#374151", padding: "2px 0" }}>
                    <span>{it.part_name}</span>
                    <b>-{(Number(it.qty) || 1) * asmQty}</b>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setAssemble(null)} style={{ flex: 1, height: 44, borderRadius: 12, border: "1.5px solid #d1d5db", background: "#fff", fontWeight: 700, cursor: "pointer" }}>Hủy</button>
                <button onClick={doAssemble} disabled={asmBusy}
                  style={{ flex: 1.4, height: 44, borderRadius: 12, border: "none", background: "#059669", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                  {asmBusy ? "⏳ Đang ghép..." : `Xác nhận ghép ${asmQty}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Xác nhận xóa */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "min(400px,94vw)", padding: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 8 }}>Xóa combo?</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>{confirmDel.name} — thành phần trong combo sẽ bị xóa theo. Tồn kho linh kiện đã trừ trước đó không tự hoàn lại.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ flex: 1, height: 42, borderRadius: 12, border: "1.5px solid #d1d5db", background: "#fff", cursor: "pointer", fontWeight: 700 }}>Hủy</button>
              <button onClick={() => deleteCombo(confirmDel)} style={{ flex: 1, height: 42, borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Xóa</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1e1b4b", color: "#fff", borderRadius: 14, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, zIndex: 2000, maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
