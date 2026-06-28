/**
 * PrintSettingsTab.jsx — Tab chỉnh thông tin mẫu in + Template Editor
 * Lưu vào app_settings (PocketBase)
 */
import React, { useState, useEffect } from "react";
import { AppSettings } from "./pb.jsx";
import {
  previewReceiptForm, previewBill, previewSaleReceipt,
  previewWarrantyLabel, previewSparePartLabel,
  getDefaultTemplate,
} from "../utils/printClient.js";

/* ─── Config ─── */
const PRINT_FIELDS = [
  { group: "Thông tin cửa hàng", fields: [
    { key:"shop_name",     label:"Tên cửa hàng",       placeholder:"Hoàng Khánh Mobile" },
    { key:"shop_phone",    label:"Số điện thoại",       placeholder:"0901 234 567" },
    { key:"shop_address",  label:"Địa chỉ",             placeholder:"123 Đường ABC, Q.1, TP.HCM" },
    { key:"warranty_note", label:"Cam kết bảo hành",    placeholder:"Bảo hành linh kiện 30 ngày..." },
  ]},
  { group: "QR chuyển khoản (VietQR)", fields: [
    { key:"bank_name",    label:"Mã ngân hàng",       placeholder:"VCB, TCB, MB, ACB...",
      hint:"Nhập mã ngân hàng theo chuẩn VietQR: VCB, TCB, MB, ACB, BIDV, VTB, TPB..." },
    { key:"bank_account", label:"Số tài khoản",       placeholder:"0123456789" },
    { key:"bank_holder",  label:"Tên chủ tài khoản",  placeholder:"NGUYEN VAN A" },
  ]},
];

const TEMPLATES = [
  { key:"receipt_form", icon:"📋", label:"Phiếu tiếp nhận máy",          size:"A5" },
  { key:"bill",         icon:"🧾", label:"Hóa đơn sửa chữa",              size:"A5" },
  { key:"sale_receipt", icon:"🛒", label:"Hóa Đơn Bán Hàng",               size:"A5" },
  { key:"warranty",     icon:"🏷️", label:"Tem bảo hành",                 size:"50×30mm" },
  { key:"spare_label",  icon:"📦", label:"Tem linh kiện",                 size:"50×25mm" },
];

/* ─── Sample data preview ─── */
const SAMPLE_ORDER = {
  order_code:"HK-250628-001", received_date:new Date().toISOString(),
  customer_name:"Nguyễn Văn A", customer_phone:"0901234567",
  device_name:"iPhone 13 Pro Max", device_model:"iPhone 13 Pro Max 256GB",
  issue_description:"Màn hình vỡ, pin yếu", estimated_cost:1500000,
  deposit:300000, warranty_days:30, final_cost:1500000,
  done_date:new Date().toISOString(), payment_method:"cash",
};
const SAMPLE_PARTS = [
  { part_name:"Màn hình iPhone 13 Pro Max", qty_used:1, unit_price:950000, total_price:950000 },
  { part_name:"Pin iPhone 13 Pro Max",      qty_used:1, unit_price:350000, total_price:350000 },
];
const SAMPLE_SALE = {
  order_code:"BH-001", created:new Date().toISOString(),
  customer_name:"Trần Thị B", cashier_name:"Thu ngân Lan",
  payment_method:"transfer", subtotal:730000, discount:0, total:730000,
  items:[
    { part_name:"Cường lực iPhone 15", qty:1, unit_price:150000, total_price:150000 },
    { part_name:"Ốp lưng Samsung A55", qty:1, unit_price:180000, total_price:180000 },
    { part_name:"Cáp sạc Type-C",      qty:3, unit_price:85000,  total_price:255000 },
  ],
};

export default function PrintSettingsTab({ user }) {
  const [settings,    setSettings]    = useState({});
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  /* Template editor states */
  const [editKey,     setEditKey]     = useState(null);
  const [editHtml,    setEditHtml]    = useState("");
  const [tplStatus,   setTplStatus]   = useState({});
  const [loadingTpl,  setLoadingTpl]  = useState(true);

  /* ─── Load settings + template status ─── */
  useEffect(() => {
    (async () => {
      try {
        const list = await AppSettings.list({ limit:200 });
        const map  = {};
        (list || []).forEach(r => { map[r.key] = r.value; });
        setSettings(map);

        const status = {};
        TEMPLATES.forEach(t => {
          if (map[`print_tpl_${t.key}_disabled`] === "1") status[t.key] = "disabled";
          else if (map[`print_tpl_${t.key}`])              status[t.key] = "custom";
          else                                              status[t.key] = "default";
        });
        setTplStatus(status);
      } catch {}
      setLoading(false);
      setLoadingTpl(false);
    })();
  }, []);

  /* ─── Save helpers ─── */
  async function saveSetting(key, value) {
    try {
      const list = await AppSettings.filter({ key });
      if (list && list.length > 0) await AppSettings.update(list[0].id, { value });
      else await AppSettings.create({ key, value, label:key, group:"print" });
    } catch(e) { console.error("Lỗi lưu setting", key, e); }
  }

  async function handleSaveAll() {
    setSaving(true);
    for (const g of PRINT_FIELDS)
      for (const f of g.fields)
        await saveSetting(f.key, settings[f.key] || "");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function buildShopInfo() {
    return {
      shop_name:     settings.shop_name     || "Hoàng Khánh Mobile",
      shop_phone:    settings.shop_phone    || "",
      shop_address:  settings.shop_address  || "",
      warranty_note: settings.warranty_note || "",
      bank_name:     settings.bank_name     || "",
      bank_account:  settings.bank_account  || "",
      bank_holder:   settings.bank_holder   || "",
    };
  }

  /* ─── Template editor helpers ─── */
  async function openEditor(tplKey) {
    try {
      const list = await AppSettings.filter({ key:`print_tpl_${tplKey}` });
      if (list && list.length > 0 && list[0].value && !list[0].value.startsWith("<!--")) {
        // Đã có bản custom → load bản custom
        setEditHtml(list[0].value);
      } else {
        // Chưa custom → load HTML gốc từ printClient để user thấy và chỉnh
        const defaultHtml = getDefaultTemplate(tplKey, {
          shop_name:    settings.shop_name,
          shop_phone:   settings.shop_phone,
          shop_address: settings.shop_address,
          warranty_note:settings.warranty_note,
          bank_name:    settings.bank_name,
          bank_account: settings.bank_account,
        });
        setEditHtml(defaultHtml || "<!-- Không tìm thấy template mặc định -->");
      }
    } catch { setEditHtml(""); }
    setEditKey(tplKey);
  }

  async function saveTemplate() {
    if (!editKey) return;
    setSaving(true);
    try {
      const list = await AppSettings.filter({ key:`print_tpl_${editKey}` });
      if (list && list.length > 0) await AppSettings.update(list[0].id, { value:editHtml });
      else await AppSettings.create({ key:`print_tpl_${editKey}`, value:editHtml, label:`Template ${editKey}`, group:"print" });
      setTplStatus(p => ({ ...p, [editKey]:"custom" }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) { alert("Lỗi lưu: " + e.message); }
    setSaving(false);
  }

  async function resetTemplate(tplKey) {
    if (!window.confirm(`Reset mẫu về mặc định? Template tùy chỉnh sẽ bị xóa.`)) return;
    try {
      const list = await AppSettings.filter({ key:`print_tpl_${tplKey}` });
      if (list && list.length > 0) await AppSettings.update(list[0].id, { value:"" });
      setTplStatus(p => ({ ...p, [tplKey]:"default" }));
      if (editKey === tplKey) setEditKey(null);
    } catch(e) { alert("Lỗi: " + e.message); }
  }

  async function toggleDisable(tplKey) {
    const isDisabled = tplStatus[tplKey] === "disabled";
    const newVal = isDisabled ? "0" : "1";
    try {
      const list = await AppSettings.filter({ key:`print_tpl_${tplKey}_disabled` });
      if (list && list.length > 0) await AppSettings.update(list[0].id, { value:newVal });
      else await AppSettings.create({ key:`print_tpl_${tplKey}_disabled`, value:newVal, label:`Disable ${tplKey}`, group:"print" });
      setTplStatus(p => ({ ...p, [tplKey]: isDisabled ? (p[tplKey] === "disabled" ? "default" : "default") : "disabled" }));
    } catch(e) { alert("Lỗi: " + e.message); }
  }

  if (loading) return (
    <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>⏳ Đang tải...</div>
  );

  const INP = {
    width:"100%", height:38, borderRadius:10,
    border:"1.5px solid #e5e7eb", padding:"0 12px",
    fontSize:14, outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ maxWidth:760, margin:"0 auto", padding:"24px 16px 100px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:4 }}>🖨️ Cài đặt mẫu in</div>
        <div style={{ fontSize:13, color:"#6b7280" }}>
          Thông tin in trên tất cả mẫu. Bấm <b>Lưu</b> rồi <b>Xem trước</b> để kiểm tra.
        </div>
      </div>

      {/* ── Form nhóm thông tin shop ── */}
      {PRINT_FIELDS.map(group => (
        <div key={group.group} style={{
          background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:14,
          padding:"18px 20px", marginBottom:16,
        }}>
          <div style={{ fontWeight:800, fontSize:13, color:"#374151", marginBottom:14,
            paddingBottom:10, borderBottom:"1px solid #f3f4f6" }}>{group.group}</div>
          {group.fields.map(f => (
            <div key={f.key} style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#6b7280", marginBottom:5 }}>
                {f.label}
              </label>
              <input
                value={settings[f.key] || ""}
                onChange={e => setSettings(p => ({ ...p, [f.key]:e.target.value }))}
                placeholder={f.placeholder}
                style={INP}
                onFocus={e => e.target.style.borderColor="#4f46e5"}
                onBlur={e  => e.target.style.borderColor="#e5e7eb"}
              />
              {f.hint && <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>{f.hint}</div>}
            </div>
          ))}
        </div>
      ))}

      {/* ── Nút lưu thông tin ── */}
      <button onClick={handleSaveAll} disabled={saving} style={{
        width:"100%", height:46, borderRadius:12, border:"none",
        background: saving ? "#d1d5db" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
        color:"#fff", fontWeight:900, fontSize:15,
        cursor: saving ? "not-allowed" : "pointer",
        marginBottom:24,
        boxShadow: saving ? "none" : "0 4px 14px rgba(79,70,229,.3)",
      }}>
        {saving ? "⏳ Đang lưu..." : saved ? "✅ Đã lưu!" : "💾 Lưu cài đặt"}
      </button>

      {/* ── Xem trước ── */}
      <div style={{ background:"#f9fafb", border:"1.5px solid #e5e7eb", borderRadius:14, padding:"18px 20px", marginBottom:24 }}>
        <div style={{ fontWeight:800, fontSize:13, color:"#374151", marginBottom:14 }}>
          👁️ Xem trước mẫu in (dùng thông tin đang nhập)
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { label:"📋 Phiếu tiếp nhận máy",
              fn: () => previewReceiptForm(SAMPLE_ORDER, SAMPLE_PARTS, buildShopInfo()) },
            { label:"🧾 Hóa đơn SC / Phiếu thanh toán",
              fn: () => previewBill(SAMPLE_ORDER, SAMPLE_PARTS, buildShopInfo()) },
            { label:"🛒 Hóa Đơn Bán Hàng",
              fn: () => previewSaleReceipt(SAMPLE_SALE, buildShopInfo()) },
            { label:"🏷️ Tem bảo hành 50×30mm",
              fn: () => previewWarrantyLabel(SAMPLE_ORDER, buildShopInfo()) },
            { label:"📦 Tem linh kiện 50×25mm",
              fn: () => previewSparePartLabel({ name:"Màn hình iPhone 13", sku:"SCRN-IP13-001", price:950000, warehouse_name:"Kho 1" }, 1) },
          ].map(btn => (
            <button key={btn.label} onClick={btn.fn} style={{
              padding:"10px 12px", borderRadius:10, border:"1.5px solid #e5e7eb",
              background:"#fff", color:"#374151", fontSize:12, fontWeight:700,
              cursor:"pointer", textAlign:"left", lineHeight:1.5,
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#4f46e5"}
              onMouseLeave={e => e.currentTarget.style.borderColor="#e5e7eb"}
            >{btn.label}</button>
          ))}
        </div>
        <div style={{ fontSize:11, color:"#9ca3af", marginTop:10 }}>
          💡 Mẫu xem trước mở tab mới. Bấm <b>Ctrl+P</b> để in.
        </div>
      </div>

      {/* ── Section: Chỉnh sửa mẫu in ── */}
      <div>
        <div style={{ fontWeight:900, fontSize:16, color:"#1e1b4b", marginBottom:4 }}>
          ✏️ Chỉnh sửa & quản lý mẫu in
        </div>
        <div style={{ fontSize:12, color:"#6b7280", marginBottom:16 }}>
          Tùy chỉnh HTML của từng mẫu. <b>Reset</b> để về mặc định. <b>Tắt</b> để không in mẫu đó.
        </div>

        {TEMPLATES.map(t => {
          const st = tplStatus[t.key] || "default";
          const statusLabel = st==="custom" ? "✏️ Đã tùy chỉnh" : st==="disabled" ? "🔴 Đã tắt" : "✅ Mặc định";
          const statusColor = st==="custom" ? "#7c3aed" : st==="disabled" ? "#dc2626" : "#059669";
          return (
            <div key={t.key} style={{
              background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:12,
              padding:"12px 16px", marginBottom:10,
              display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
            }}>
              <span style={{ fontSize:22 }}>{t.icon}</span>
              <div style={{ flex:1, minWidth:120 }}>
                <div style={{ fontWeight:800, fontSize:13, color:"#1e1b4b" }}>{t.label}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>
                  {t.size} · <span style={{ color:statusColor, fontWeight:700 }}>{statusLabel}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button
                  onClick={() => openEditor(t.key)}
                  disabled={st === "disabled"}
                  style={{
                    padding:"6px 14px", borderRadius:8, border:"1.5px solid #c7d2fe",
                    background:"#eef2ff", color:"#4f46e5", fontSize:12, fontWeight:700,
                    cursor: st==="disabled" ? "not-allowed" : "pointer",
                    opacity: st==="disabled" ? 0.5 : 1,
                  }}>✏️ Chỉnh</button>

                {st === "custom" && (
                  <button onClick={() => resetTemplate(t.key)} style={{
                    padding:"6px 14px", borderRadius:8, border:"1.5px solid #fed7aa",
                    background:"#fff7ed", color:"#ea580c", fontSize:12, fontWeight:700, cursor:"pointer",
                  }}>🔄 Reset</button>
                )}

                <button onClick={() => toggleDisable(t.key)} style={{
                  padding:"6px 14px", borderRadius:8,
                  border: st==="disabled" ? "1.5px solid #bbf7d0" : "1.5px solid #fecaca",
                  background: st==="disabled" ? "#f0fdf4" : "#fff1f2",
                  color: st==="disabled" ? "#059669" : "#dc2626",
                  fontSize:12, fontWeight:700, cursor:"pointer",
                }}>{st==="disabled" ? "✅ Bật lại" : "🔴 Tắt"}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Editor Modal ── */}
      {editKey && (
        <div style={{
          position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,.55)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:16,
        }}>
          <div style={{
            background:"#fff", borderRadius:16, width:"100%", maxWidth:820,
            maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden",
            boxShadow:"0 20px 60px rgba(0,0,0,.3)",
          }}>
            {/* Modal header */}
            <div style={{
              padding:"16px 20px", borderBottom:"1px solid #e5e7eb",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", borderRadius:"16px 16px 0 0",
            }}>
              <div>
                <div style={{ fontWeight:900, fontSize:15, color:"#fff" }}>
                  ✏️ Chỉnh mẫu: {TEMPLATES.find(t => t.key===editKey)?.label}
                </div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:2 }}>
                  Chỉnh HTML rồi bấm Lưu · Bấm Xem trước để kiểm tra trực tiếp
                </div>
              </div>
              <button onClick={() => setEditKey(null)} style={{
                background:"rgba(255,255,255,.2)", border:"none", color:"#fff",
                width:34, height:34, borderRadius:"50%", fontSize:20, cursor:"pointer", fontWeight:700,
              }}>×</button>
            </div>

            {/* Textarea */}
            <div style={{ flex:1, overflow:"hidden", padding:"14px 16px" }}>
              <textarea
                value={editHtml}
                onChange={e => setEditHtml(e.target.value)}
                spellCheck={false}
                style={{
                  width:"100%", height:"100%", minHeight:380,
                  fontFamily:"'Courier New',Consolas,monospace", fontSize:12,
                  border:"1.5px solid #e5e7eb", borderRadius:10, padding:"12px",
                  resize:"vertical", outline:"none", lineHeight:1.65,
                  boxSizing:"border-box", color:"#1e1b4b",
                }}
                placeholder="Dán HTML template vào đây..."
              />
            </div>

            {/* Modal footer */}
            <div style={{
              padding:"12px 16px", borderTop:"1px solid #e5e7eb",
              display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap",
              background:"#f9fafb",
            }}>
              <button
                onClick={() => {
                  if (!editHtml.trim()) return;
                  const blob = new Blob([editHtml], { type:"text/html" });
                  window.open(URL.createObjectURL(blob), "_blank");
                }}
                style={{
                  padding:"8px 18px", borderRadius:10, border:"1.5px solid #bfdbfe",
                  background:"#eff6ff", color:"#1d4ed8", fontWeight:700, fontSize:13, cursor:"pointer",
                }}>👁️ Xem trước</button>

              <button onClick={() => setEditKey(null)} style={{
                padding:"8px 18px", borderRadius:10, border:"1.5px solid #e5e7eb",
                background:"#fff", color:"#374151", fontWeight:700, fontSize:13, cursor:"pointer",
              }}>Hủy</button>

              <button onClick={saveTemplate} disabled={saving} style={{
                padding:"8px 24px", borderRadius:10, border:"none",
                background: saving ? "#d1d5db" : saved ? "#059669" : "#4f46e5",
                color:"#fff", fontWeight:800, fontSize:13,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 4px 12px rgba(79,70,229,.3)",
              }}>
                {saving ? "⏳ Đang lưu..." : saved ? "✅ Đã lưu!" : "💾 Lưu template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
