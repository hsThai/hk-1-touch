/**
 * PrintSettingsTab.jsx — Tab chỉnh thông tin mẫu in
 * Lưu vào app_settings (PocketBase), load bởi printClient.js khi in
 */
import React, { useState, useEffect } from "react";
import { AppSettings } from "./pb.jsx";
import {
  previewBill, previewSaleReceipt,
  previewWarrantyLabel, previewSparePartLabel,
} from "../utils/printClient.js";

/* ─── Field config ─── */
const PRINT_FIELDS = [
  { group: "Thông tin cửa hàng", fields: [
    { key:"shop_name",     label:"Tên cửa hàng",        placeholder:"Hoàng Khánh Mobile",             type:"text" },
    { key:"shop_phone",    label:"Số điện thoại",        placeholder:"0901 234 567",                   type:"text" },
    { key:"shop_address",  label:"Địa chỉ",              placeholder:"123 Đường ABC, Q.1, TP.HCM",     type:"text" },
    { key:"warranty_note", label:"Cam kết bảo hành",     placeholder:"Bảo hành linh kiện 30 ngày...",  type:"text" },
  ]},
  { group: "QR chuyển khoản (VietQR)", fields: [
    { key:"bank_name",    label:"Mã ngân hàng",       placeholder:"VCB, TCB, MB, ACB, BIDV...", type:"text",
      hint:"Nhập mã ngân hàng theo chuẩn VietQR: VCB, TCB, MB, ACB, BIDV, VTB, TPB..." },
    { key:"bank_account", label:"Số tài khoản",       placeholder:"0123456789",                 type:"text" },
    { key:"bank_holder",  label:"Tên chủ tài khoản",  placeholder:"NGUYEN VAN A",              type:"text" },
  ]},
];

/* ─── Sample data cho preview ─── */
const SAMPLE_ORDER = {
  order_code:"HK-250628-001", received_date: new Date().toISOString(),
  customer_name:"Nguyễn Văn A", customer_phone:"0901234567",
  device_name:"iPhone 13 Pro Max", device_model:"iPhone 13 Pro Max 256GB",
  issue_description:"Màn hình vỡ, pin yếu", estimated_cost:1500000,
  deposit:300000, warranty_days:30, final_cost:1500000,
  done_date: new Date().toISOString(), payment_method:"cash",
};
const SAMPLE_PARTS = [
  { part_name:"Màn hình iPhone 13 Pro Max", qty_used:1, unit_price:950000, total_price:950000 },
  { part_name:"Pin iPhone 13 Pro Max",      qty_used:1, unit_price:350000, total_price:350000 },
];
const SAMPLE_SALE = {
  order_code:"BH-001", created: new Date().toISOString(),
  customer_name:"Trần Thị B", cashier_name:"Thu ngân Lan",
  payment_method:"transfer", subtotal:730000, discount:0, total:730000,
  items:[
    { part_name:"Cường lực iPhone 15", qty:1, unit_price:150000, total_price:150000 },
    { part_name:"Ốp lưng Samsung A55", qty:1, unit_price:180000, total_price:180000 },
    { part_name:"Cáp sạc Type-C",      qty:3, unit_price:85000,  total_price:255000 },
  ],
};

export default function PrintSettingsTab({ user }) {
  const [settings, setSettings] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  /* Load settings từ PocketBase */
  useEffect(() => {
    (async () => {
      try {
        const list = await AppSettings.list({ limit: 200 });
        const map  = {};
        (list || []).forEach(r => { map[r.key] = r.value; });
        setSettings(map);
      } catch {}
      setLoading(false);
    })();
  }, []);

  /* Lưu 1 field */
  async function saveSetting(key, value) {
    try {
      const list = await AppSettings.filter({ key });
      if (list && list.length > 0) {
        await AppSettings.update(list[0].id, { value });
      } else {
        await AppSettings.create({ key, value, label: key, group: "print" });
      }
    } catch(e) { console.error("Lỗi lưu setting", key, e); }
  }

  /* Lưu tất cả */
  async function handleSaveAll() {
    setSaving(true);
    const allFields = PRINT_FIELDS.flatMap(g => g.fields);
    for (const f of allFields) {
      await saveSetting(f.key, settings[f.key] || "");
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  /* Build shopInfo object từ state hiện tại */
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

  if (loading) return (
    <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>⏳ Đang tải...</div>
  );

  return (
    <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 16px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:4 }}>🖨️ Cài đặt mẫu in</div>
        <div style={{ fontSize:13, color:"#6b7280" }}>
          Thông tin này sẽ in trên tất cả mẫu (phiếu tiếp nhận, hóa đơn, tem bảo hành).
          Bấm <b>Lưu</b> rồi <b>Xem trước</b> để kiểm tra.
        </div>
      </div>

      {/* Form nhóm */}
      {PRINT_FIELDS.map(group => (
        <div key={group.group} style={{
          background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:14,
          padding:"18px 20px", marginBottom:16,
        }}>
          <div style={{ fontWeight:800, fontSize:13, color:"#374151", marginBottom:14,
            paddingBottom:10, borderBottom:"1px solid #f3f4f6" }}>
            {group.group}
          </div>
          {group.fields.map(f => (
            <div key={f.key} style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#6b7280", marginBottom:5 }}>
                {f.label}
              </label>
              <input
                value={settings[f.key] || ""}
                onChange={e => setSettings(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{
                  width:"100%", height:38, borderRadius:10,
                  border:"1.5px solid #e5e7eb", padding:"0 12px",
                  fontSize:14, outline:"none", boxSizing:"border-box",
                }}
                onFocus={e  => e.target.style.borderColor="#4f46e5"}
                onBlur={e   => e.target.style.borderColor="#e5e7eb"}
              />
              {f.hint && (
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>{f.hint}</div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Nút lưu */}
      <button
        onClick={handleSaveAll}
        disabled={saving}
        style={{
          width:"100%", height:46, borderRadius:12, border:"none",
          background: saving ? "#d1d5db" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
          color:"#fff", fontWeight:900, fontSize:15,
          cursor: saving ? "not-allowed" : "pointer",
          marginBottom:20,
          boxShadow: saving ? "none" : "0 4px 14px rgba(79,70,229,.3)",
        }}>
        {saving ? "⏳ Đang lưu..." : saved ? "✅ Đã lưu!" : "💾 Lưu cài đặt"}
      </button>

      {/* Preview section */}
      <div style={{ background:"#f9fafb", border:"1.5px solid #e5e7eb", borderRadius:14, padding:"18px 20px" }}>
        <div style={{ fontWeight:800, fontSize:13, color:"#374151", marginBottom:14 }}>
          👁️ Xem trước mẫu in (dùng thông tin đang nhập)
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { label:"📋 Phiếu tiếp nhận / Hóa đơn SC",
              fn: () => previewBill(SAMPLE_ORDER, SAMPLE_PARTS, buildShopInfo()) },
            { label:"🛒 Hóa đơn bán lẻ",
              fn: () => previewSaleReceipt(SAMPLE_SALE, buildShopInfo()) },
            { label:"🏷️ Tem bảo hành 50×30mm",
              fn: () => previewWarrantyLabel(SAMPLE_ORDER, buildShopInfo()) },
            { label:"📦 Tem linh kiện 50×25mm",
              fn: () => previewSparePartLabel({ name:"Màn hình iPhone 13", sku:"SCRN-IP13-001", price:950000, warehouse_name:"Kho 1" }, 1) },
          ].map(btn => (
            <button key={btn.label}
              onClick={btn.fn}
              style={{
                padding:"10px 12px", borderRadius:10, border:"1.5px solid #e5e7eb",
                background:"#fff", color:"#374151", fontSize:12, fontWeight:700,
                cursor:"pointer", textAlign:"left", lineHeight:1.5,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#4f46e5"}
              onMouseLeave={e => e.currentTarget.style.borderColor="#e5e7eb"}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, color:"#9ca3af", marginTop:10 }}>
          💡 Mẫu xem trước mở tab mới. Bấm <b>Ctrl+P</b> để in hoặc <b>In qua Print Agent</b>.
        </div>
      </div>
    </div>
  );
}
