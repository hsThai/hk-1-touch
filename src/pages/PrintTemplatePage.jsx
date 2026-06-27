/**
 * PrintTemplatePage.jsx — Quản lý & xem trước mẫu in
 */
import React, { useState } from "react";
import {
  printReceiptA5, printBillA5, previewBill,
  printSaleReceiptA5, previewSaleReceipt,
  previewWarrantyLabel, previewSparePartLabel,
} from "../utils/printClient.js";

/* ─── Dữ liệu mẫu ─── */
const SAMPLE_ORDER = {
  order_code:        "HK-250628-001",
  received_date:     new Date().toISOString(),
  customer_name:     "Nguyễn Văn A",
  customer_phone:    "0901234567",
  device_name:       "iPhone 13 Pro Max",
  device_model:      "iPhone 13 Pro Max 256GB",
  imei:              "352800123456789",
  passcode:          "123456",
  issue_description: "Màn hình vỡ, pin yếu, loa ngoài rè",
  estimated_cost:    1500000,
  deposit:           300000,
  estimated_done_date: new Date(Date.now() + 2*86400000).toISOString(),
  assigned_to_name:  "Kỹ thuật viên Hùng",
  warranty_days:     30,
  final_cost:        1500000,
  done_date:         new Date().toISOString(),
  payment_method:    "cash",
};

const SAMPLE_PARTS = [
  { part_name: "Màn hình iPhone 13 Pro Max", qty_used: 1, unit_price: 950000, total_price: 950000 },
  { part_name: "Pin iPhone 13 Pro Max",      qty_used: 1, unit_price: 350000, total_price: 350000 },
  { part_name: "Loa ngoài iPhone 13",        qty_used: 1, unit_price: 200000, total_price: 200000 },
];

const SAMPLE_SALE = {
  order_code:     "HK-BL-250628-001",
  created:        new Date().toISOString(),
  customer_name:  "Trần Thị B",
  customer_phone: "0987654321",
  cashier_name:   "Thu ngân Lan",
  payment_method: "transfer",
  subtotal:       2500000,
  discount:       100000,
  total:          2400000,
  items: [
    { part_name: "Cường lực iPhone 15", qty: 2, unit_price: 150000, total_price: 300000 },
    { part_name: "Ốp lưng Samsung A55", qty: 1, unit_price: 180000, total_price: 180000 },
    { part_name: "Cáp sạc Type-C 1m",   qty: 3, unit_price: 85000,  total_price: 255000 },
  ],
};

const SAMPLE_PART = {
  name:           "Màn hình iPhone 13 Pro Max",
  sku:            "SCRN-IP13PM-001",
  price:          950000,
  warehouse_name: "Kho 1",
};

const SAMPLE_SHOP = {
  shop_name:    "Hoàng Khánh Mobile",
  shop_phone:   "0901 234 567",
  shop_address: "123 Nguyễn Huệ, Q.1, TP.HCM",
};

export default function PrintTemplatePage({ user }) {
  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  const [labelQty, setLabelQty] = useState(1);

  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const TEMPLATES = [
    {
      key:         "receipt",
      icon:        "📋",
      label:       "Phiếu tiếp nhận",
      desc:        "In khi khách mang thiết bị đến sửa chữa. Ghi rõ thông tin thiết bị, vấn đề, giá dự kiến và ngày hẹn trả.",
      bg:          "#eff6ff",
      color:       "#2563eb",
      border:      "#bfdbfe",
      actionLabel: "🖨️ Xem trước phiếu tiếp nhận",
      action:      () => previewBill(SAMPLE_ORDER, SAMPLE_PARTS, SAMPLE_SHOP),
    },
    {
      key:         "bill",
      icon:        "🧾",
      label:       "Hóa đơn sửa chữa",
      desc:        "In khi hoàn thành sửa chữa và bàn giao. Hiển thị linh kiện đã dùng, tổng tiền, còn lại, QR chuyển khoản.",
      bg:          "#f0fdf4",
      color:       "#059669",
      border:      "#86efac",
      actionLabel: "🖨️ Xem trước hóa đơn SC",
      action:      () => previewBill(SAMPLE_ORDER, SAMPLE_PARTS, SAMPLE_SHOP),
    },
    {
      key:         "sale_receipt",
      icon:        "🛒",
      label:       "Hóa đơn bán lẻ",
      desc:        "In sau khi hoàn thành giao dịch bán hàng tại quầy. Hiển thị danh sách sản phẩm, giảm giá, tổng thanh toán.",
      bg:          "#fdf4ff",
      color:       "#7c3aed",
      border:      "#e9d5ff",
      actionLabel: "🖨️ Xem trước hóa đơn bán lẻ",
      action:      () => previewSaleReceipt(SAMPLE_SALE, SAMPLE_SHOP),
    },
    {
      key:         "warranty",
      icon:        "🏷️",
      label:       "Tem bảo hành",
      desc:        "In tem dán lên thiết bị sau sửa chữa. Kích thước 50×30mm. Ghi mã đơn, ngày BH, hạn BH.",
      bg:          "#fff7ed",
      color:       "#ea580c",
      border:      "#fed7aa",
      actionLabel: "🖨️ Xem trước tem bảo hành",
      action:      () => previewWarrantyLabel(SAMPLE_ORDER, SAMPLE_SHOP),
    },
    {
      key:         "spare_label",
      icon:        "📦",
      label:       "Tem linh kiện",
      desc:        "In tem dán lên linh kiện trong kho. Kích thước 50×25mm. Ghi tên, SKU, giá, kho.",
      bg:          "#f0f9ff",
      color:       "#0284c7",
      border:      "#bae6fd",
      actionLabel: "🖨️ Xem trước tem linh kiện",
      action:      () => previewSparePartLabel(SAMPLE_PART, labelQty),
    },
  ];

  return (
    <div style={{
      padding: isPC ? "24px 32px 40px" : "16px 14px 80px",
      maxWidth: isPC ? 1100 : "100%",
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 900, fontSize: 20, color: "#1e1b4b", marginBottom: 4 }}>
          🖨️ Quản lý mẫu in
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          Xem trước và in thử từng mẫu. Mẫu sẽ mở trong tab mới — bấm Ctrl+P để in.
        </div>
      </div>

      {/* Banner hướng dẫn Print Agent */}
      <div style={{
        background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
        border: "1.5px solid #bfdbfe",
        borderRadius: 14, padding: "14px 18px", marginBottom: 24,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.7 }}>
          <strong>Print Agent (tùy chọn):</strong> Cài Print Agent trên PC để in trực tiếp không qua tab preview.
          Nếu chưa cài, hệ thống tự động mở tab preview → Bấm <strong>Ctrl+P</strong> để in.
        </div>
      </div>

      {/* Grid mẫu in */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPC ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr",
        gap: 16,
        marginBottom: 32,
      }}>
        {TEMPLATES.map(t => (
          <div key={t.key} style={{
            background: "#fff",
            borderRadius: 16,
            border: `1.5px solid ${t.border}`,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            {/* Icon + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, background: t.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>
                {t.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#1e1b4b" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: t.color, fontWeight: 700, marginTop: 2 }}>
                  {t.key === "receipt"      ? "Khổ A5 · Phiếu tiếp nhận" :
                   t.key === "bill"         ? "Khổ A5 · Hóa đơn SC" :
                   t.key === "sale_receipt" ? "Khổ A5 · Hóa đơn bán lẻ" :
                   t.key === "warranty"     ? "Tem 50×30mm · Bảo hành" :
                                             "Tem 50×25mm · Kho linh kiện"}
                </div>
              </div>
            </div>

            {/* Mô tả */}
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{t.desc}</div>

            {/* Input số lượng tem linh kiện */}
            {t.key === "spare_label" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Số tem thử:</span>
                <input
                  type="number" min={1} max={20} value={labelQty}
                  onChange={e => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: 64, height: 32, borderRadius: 8, border: "1.5px solid #e5e7eb",
                    padding: "0 10px", fontSize: 13, outline: "none", textAlign: "center",
                  }}
                />
              </div>
            )}

            {/* Nút xem trước */}
            <button
              onClick={t.action}
              style={{
                width: "100%", height: 40, borderRadius: 10,
                background: t.bg, color: t.color,
                border: `1.5px solid ${t.border}`,
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                marginTop: "auto", transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.color; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = t.bg; e.currentTarget.style.color = t.color; }}
            >
              {t.actionLabel}
            </button>
          </div>
        ))}
      </div>

      {/* Hướng dẫn in tem linh kiện hàng loạt */}
      <div style={{
        background: "#f9fafb", borderRadius: 14,
        border: "1.5px solid #e5e7eb", padding: "18px 20px",
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#374151", marginBottom: 12 }}>
          📌 Cách in tem linh kiện hàng loạt
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.9 }}>
          1. Vào <strong>Kho & Vật tư → Quản lý vật tư</strong><br />
          2. Chọn linh kiện → Click nút <strong>🖨️ In tem</strong> → Chọn số lượng tem<br />
          3. Tab preview mở ra → Bấm <strong>Ctrl+P</strong> → Chọn máy in tem, khổ <strong>50×25mm</strong><br />
          4. Bỏ chọn "Scale to fit page" → In
        </div>
      </div>
    </div>
  );
}
