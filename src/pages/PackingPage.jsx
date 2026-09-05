/**
 * PackingPage.jsx — "Soạn hàng & Giao nhận" (theo QUYỀN, không theo role)
 *
 * 2 tài nguyên phân quyền:
 *   - pack_order (Soạn hàng): thấy hàng đợi "Chờ soạn" + picking theo SKU (quét mã, gạch chéo)
 *   - ship_order (Giao nhận): thấy "Chờ bàn giao / Đang giao / Hoàn tất / Lỗi"
 * Tài khoản có đủ 2 quyền → 1 hàng đợi gộp, làm tiếp tuyến trên cùng card.
 *
 * Mọi bước chuyển trạng thái đều:
 *   - Bắt buộc chụp ảnh xác thực (trừ "Tại quầy")
 *   - Ghi logHistory (order_history) + logAction (action_logs)
 *   - Gửi notification cho người bước tiếp theo
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  SaleOrder, SaleOrderItem, Staff, Notification, OrderHistory,
  logAction, logHistory, uploadFile, normalizePbUrl,
} from "./pb.jsx";
import { usePermission } from "./PermissionContext.jsx";
import { ScanCodeModal } from "./QRComponents.jsx";

/* ─────────────── Helpers ─────────────── */

const fmtVnd = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";

const fmtTimeShort = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const diff = Date.now() - dt.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}p`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}g`;
  return `${Math.floor(hrs / 24)}n`;
};

const fmtDateTime = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function vibrate(ms = 60) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }

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

async function uploadPhotos(files, orderId) {
  const urls = [];
  for (const f of files) {
    const compressed = await compressImageFile(f);
    const url = await uploadFile(compressed, orderId);
    if (url) urls.push(url);
  }
  return urls;
}

// Gửi notification cho các role (lấy staff active rồi lọc role)
async function notifyRoles(roles, { title, message, order }) {
  try {
    const staff = await Staff.filter({ is_active: true });
    const targets = (staff || []).filter(s => roles.includes(s.role));
    await Promise.all(targets.map(st => Notification.create({
      user_id: st.id, user_name: st.full_name,
      title, message,
      order_id: order?.id || "", order_code: order?.order_code || "",
      type: "pack_ship", is_read: false,
    }).catch(() => {})));
  } catch (e) { console.warn("[notifyRoles]", e.message); }
}

async function notifyUser(staffId, staffName, { title, message, order }) {
  if (!staffId) return;
  try {
    await Notification.create({
      user_id: staffId, user_name: staffName,
      title, message,
      order_id: order?.id || "", order_code: order?.order_code || "",
      type: "pack_ship", is_read: false,
    });
  } catch {}
}

function parsePackMedia(order) {
  try {
    const m = typeof order.pack_media === "string" ? JSON.parse(order.pack_media || "{}") : (order.pack_media || {});
    return { pack: [], handover: [], carrier: [], delivered: [], fail: [], ...(m || {}) };
  } catch { return { pack: [], handover: [], carrier: [], delivered: [], fail: [] }; }
}

const PK_STATUS = {
  "":            { label: "Chờ soạn",    color: "#d97706", bg: "#fffbeb", icon: "inventory" },
  to_pick:       { label: "Chờ soạn",    color: "#d97706", bg: "#fffbeb", icon: "inventory" },
  picking:       { label: "Đang soạn",   color: "#2563eb", bg: "#eff6ff", icon: "qr_code_scanner" },
  packed:        { label: "Đã đóng gói",  color: "#7c3aed", bg: "#f5f3ff", icon: "inventory_2" },
  shipped:       { label: "Đã gửi ĐVVC", color: "#0369a1", bg: "#e0f2fe", icon: "local_shipping" },
  carrier_received: { label: "ĐVVC đã nhận", color: "#0e7490", bg: "#ecfeff", icon: "airport_shuttle" },
  delivered:     { label: "Đã giao",     color: "#059669", bg: "#ecfdf5", icon: "check_circle" },
  counter:       { label: "Tại quầy",     color: "#6b7280", bg: "#f9fafb", icon: "storefront" },
  failed:        { label: "Giao lỗi",     color: "#dc2626", bg: "#fef2f2", icon: "error" },
};

/* ─────────────── Toast (helper, không phải component lồng) ─────────────── */
function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  };
  const toastEl = toast ? (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "err" ? "#dc2626" : toast.type === "ok" ? "#059669" : "#1e293b",
      color: "#fff", padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700,
      zIndex: 5000, boxShadow: "0 4px 16px rgba(0,0,0,.3)", maxWidth: "90vw", textAlign: "center",
    }}>{toast.msg}</div>
  ) : null;
  return { showToast, toastEl };
}

/* ════════════════════════════════════════════════════════════════
 * PickingModal — Soạn hàng theo SKU
 * Quy trình: quét mã phiếu đơn (nếu cần) → đến kệ quét mã từng món
 * → hệ thống gạch chéo món đủ số → chụp ảnh gói hàng → xác nhận.
 * ════════════════════════════════════════════════════════════════ */
function PickingModal({ order, user, onDone, onClose, showToast }) {
  const [rows, setRows] = useState([]);          // [{part_id, part_name, sku, qty, picked, picked_at}]
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);            // 1 = picking, 2 = ảnh + xác nhận
  const [scanOn, setScanOn] = useState(false);
  const [flash, setFlash] = useState(null);      // {idx, ok}
  const [photos, setPhotos] = useState([]);      // [{url}]
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState(order.pack_note || "");
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const lastScanRef = useRef({ code: "", at: 0 });
  const fileRef = useRef(null);

  // Load danh sách mặt hàng cần soạn (ưu tiên sale_order_items, fallback items JSON)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let items = [];
      try {
        items = await SaleOrderItem.filter({ sale_order_id: order.id });
      } catch {}
      if (!items || items.length === 0) {
        let raw = order.items;
        if (typeof raw === "string") { try { raw = JSON.parse(raw || "[]"); } catch { raw = []; } }
        items = Array.isArray(raw) ? raw : [];
      }
      // Khôi phục trạng thái picking dở (nếu có)
      let saved = order.pick_items;
      if (typeof saved === "string") { try { saved = JSON.parse(saved || "[]"); } catch { saved = []; } }
      const map = new Map((Array.isArray(saved) ? saved : []).map(s => [s.part_id || s.sku, s]));
      const init = items.map(it => {
        const s = map.get(it.part_id || it.sku) || {};
        return {
          part_id: it.part_id || "",
          part_name: it.part_name || it.name || "",
          sku: it.sku || "",
          qty: Number(it.qty) || 1,
          picked: Number(s.picked) || 0,
          picked_at: s.picked_at || "",
        };
      });
      if (!cancelled) { setRows(init); setLoading(false); }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [order.id]);

  const pickedDone = rows.filter(r => r.picked >= r.qty).length;
  const allDone = rows.length > 0 && pickedDone === rows.length;

  function stopCamera() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setScanOn(false);
  }

  async function toggleScan() {
    if (scanOn) { stopCamera(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      }, 100);
      setScanOn(true);
      if ("BarcodeDetector" in window) {
        const bd = new BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "ean_8", "code_39", "itf", "data_matrix"] });
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await bd.detect(videoRef.current);
            if (codes.length > 0) processScan(codes[0].rawValue);
          } catch {}
        }, 600);
      } else {
        showToast("⚠️ Thiết bị không hỗ trợ quét tự động — dùng nút +/- thủ công", "err");
      }
    } catch (e) {
      showToast("Không mở được camera: " + e.message, "err");
    }
  }

  // Xử lý mã quét được: khớp SKU → gạch chéo tự động
  function processScan(raw) {
    const code = String(raw || "").trim();
    if (!code) return;
    const now = Date.now();
    // Chống quét trùng liên tiếp (cùng mã trong 1.2s)
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < 1200) return;
    lastScanRef.current = { code, at: now };

    // QR phiếu đơn (in trên hóa đơn) — không phải mã món hàng
    if (/order=/.test(code)) { showToast("📄 Đây là mã phiếu đơn — quét mã trên từng món hàng", "info"); return; }

    const norm = code.toLowerCase();
    const idx = rows.findIndex(r => (r.sku || "").toLowerCase() === norm);
    if (idx === -1) {
      vibrate([60, 40, 60]);
      showToast(`❌ Mã "${code}" không khớp món nào trong đơn`, "err");
      return;
    }
    const row = rows[idx];
    if (row.picked >= row.qty) {
      vibrate(150);
      showToast(`⚠️ ${row.sku || row.part_name} đã đủ ${row.qty}`, "info");
      return;
    }
    setRows(prev => prev.map((r, i) => i === idx
      ? { ...r, picked: r.picked + 1, picked_at: new Date().toISOString() } : r));
    setFlash(idx);
    setTimeout(() => setFlash(null), 600);
    vibrate();
    showToast(`✅ ${row.sku || row.part_name}: ${row.picked + 1}/${row.qty}`, "ok");
  }

  function adjust(idx, delta) {
    setRows(prev => prev.map((r, i) => i === idx
      ? { ...r, picked: Math.max(0, Math.min(r.qty, r.picked + delta)), picked_at: new Date().toISOString() } : r));
  }

  // Lưu tạm — đóng modal, đơn về trạng thái "đang soạn dở"
  async function savePause() {
    try {
      const updates = { pack_status: "picking", pick_items: JSON.stringify(rows) };
      await SaleOrder.update(order.id, updates);
      showToast("💾 Đã lưu tạm tiến độ soạn hàng", "ok");
      onDone({ ...order, ...updates });
    } catch (e) { showToast("Lỗi lưu tạm: " + e.message, "err"); }
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadPhotos(files, order.id);
      setPhotos(prev => [...prev, ...urls.map(u => ({ url: u }))]);
    } catch (err) { showToast("Lỗi upload ảnh: " + err.message, "err"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmPacked() {
    if (photos.length === 0) { showToast("⚠️ Phải chụp ít nhất 1 ảnh gói hàng để xác nhận", "err"); return; }
    setSubmitting(true);
    try {
      const media = parsePackMedia(order);
      media.pack = photos.map(p => p.url);
      const updates = {
        pack_status: "packed",
        pick_items: JSON.stringify(rows),
        packed_by_id: user.id || "",
        packed_by_name: user.full_name || user.name || "",
        packed_at: new Date().toISOString(),
        pack_media: JSON.stringify(media),
        pack_note: note || "",
      };
      await SaleOrder.update(order.id, updates);
      await logHistory({
        order_id: order.id, order_code: order.order_code,
        action_type: "pack", action_label: "📦 Đóng gói xong",
        changed_by_id: user.id, changed_by_name: user.full_name || user.name || "", changed_by_role: user.role || "",
        old_value: order.pack_status || "", new_value: "packed",
        note: `${rows.length} món — ${photos.length} ảnh${note ? " — " + note : ""}`,
      });
      logAction(user, "pack_order", "sale_order", order.id, `Đóng gói xong đơn ${order.order_code} (${rows.length} món)`);
      await notifyRoles(["delivery", "warehouse", "manager", "admin", "owner"], {
        title: `📦 Đơn ${order.order_code} đã đóng gói`,
        message: `${user.full_name || user.name || ""} đã đóng gói xong — sẵn sàng bàn giao ĐVVC`,
        order: { id: order.id, order_code: order.order_code },
      });
      showToast("✅ Đã xác nhận đóng gói", "ok");
      onDone({ ...order, ...updates });
    } catch (e) {
      showToast("Lỗi: " + e.message, "err");
    }
    setSubmitting(false);
  }

  const pct = rows.length ? Math.round(pickedDone / rows.length * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4400, background: "#f8fafc", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1e1b4b,#4f46e5)", padding: "16px 18px", color: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>🧺 Soạn hàng — {order.order_code}</div>
            <div style={{ fontSize: 12, opacity: .85, marginTop: 2 }}>{order.customer_name || ""} {order.customer_phone ? "· " + order.customer_phone : ""}</div>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }}
            style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: "50%", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        {/* Progress */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: .9, marginBottom: 4 }}>
            <span>{step === 1 ? "Bước 1/2 — Lấy hàng theo mã" : "Bước 2/2 — Chụp ảnh & xác nhận"}</span>
            <span>{rows.length ? `${pickedDone}/${rows.length} món` : ""}</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,.25)", borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#34d399", borderRadius: 99, transition: "width .3s" }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>⏳ Đang tải danh sách món...</div>
      ) : step === 1 ? (
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {/* Camera quét liên tục */}
          {scanOn && (
            <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", marginBottom: 12 }}>
              <video ref={videoRef} muted playsInline style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ width: "80%", height: 64, border: "2.5px solid #fbbf24", borderRadius: 8, boxShadow: "0 0 0 2000px rgba(0,0,0,.35)" }} />
              </div>
            </div>
          )}

          <button onClick={toggleScan}
            style={{
              width: "100%", padding: "14px", borderRadius: 14, border: "none", marginBottom: 14,
              background: scanOn ? "#ef4444" : "#0f766e", color: "#fff", fontWeight: 900, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
            }}>
            <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 22 }}>{scanOn ? "videocam_off" : "qr_code_scanner"}</span>
            {scanOn ? "TẮT CAMERA" : "BẬT CAMERA QUÉT LIÊN TỤC"}
          </button>

          {/* Danh sách món — gạch chéo tự động */}
          {rows.map((r, i) => {
            const done = r.picked >= r.qty;
            return (
              <div key={i} style={{
                background: flash === i ? "#d1fae5" : done ? "#f0fdf4" : "#fff",
                border: done ? "2px solid #6ee7b7" : "1px solid #e5e7eb",
                borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                opacity: done ? 0.85 : 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: done ? "#059669" : "#e5e7eb", color: done ? "#fff" : "#9ca3af",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14,
                  }}>{done ? "✓" : i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 14, color: "#1f2937",
                      textDecoration: done ? "line-through" : "none",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{r.part_name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {r.sku ? `SKU: ${r.sku} · ` : ""}Cần: {r.qty} — Đã lấy: <b style={{ color: done ? "#059669" : "#d97706" }}>{r.picked}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => adjust(i, -1)}
                      style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", fontSize: 18, fontWeight: 900, color: "#6b7280", cursor: "pointer" }}>−</button>
                    <button onClick={() => adjust(i, +1)}
                      style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #d1d5db", background: done ? "#ecfdf5" : "#fff", fontSize: 18, fontWeight: 900, color: "#059669", cursor: "pointer" }}>+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Step 2 — ảnh + xác nhận */
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 13, color: "#1e40af" }}>
            ✅ Đã lấy đủ <b>{rows.length}</b> món hàng. Chụp ảnh gói hàng đã đóng để xác nhận hoàn tất.
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} style={{ display: "none" }} />
          <button onClick={() => fileRef.current && fileRef.current.click()}
            disabled={uploading}
            style={{
              width: "100%", padding: "18px", borderRadius: 14, border: "2px dashed #cbd5e1",
              background: "#fff", color: "#334155", fontWeight: 800, fontSize: 15, marginBottom: 12, cursor: "pointer",
            }}>
            {uploading ? "⏳ Đang upload..." : "📷 CHỤP ẢNH GÓI HÀNG (bắt buộc)"}
          </button>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: "relative", width: 76, height: 76, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                  <img src={normalizePbUrl(p.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.65)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú (tùy chọn): vỏ hộp, phụ kiện kèm theo..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 14, marginBottom: 12, boxSizing: "border-box", minHeight: 70 }} />
        </div>
      )}

      {/* Footer actions */}
      <div style={{ padding: "12px 14px calc(14px + env(safe-area-inset-bottom))", background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, flexShrink: 0 }}>
        {step === 1 ? (
          <>
            <button onClick={savePause}
              style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff", fontWeight: 800, fontSize: 14, color: "#475569", cursor: "pointer" }}>💾 Lưu tạm</button>
            <button disabled={!allDone} onClick={() => setStep(2)}
              style={{
                flex: 1, padding: "14px", borderRadius: 12, border: "none", fontWeight: 900, fontSize: 15,
                background: allDone ? "#4f46e5" : "#e5e7eb", color: allDone ? "#fff" : "#9ca3af", cursor: allDone ? "pointer" : "not-allowed",
              }}>
              {allDone ? "TIẾP TỤC ĐÓNG GÓI →" : `CÒN ${rows.length - pickedDone} MÓN`}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setStep(1)}
              style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #d1d5db", background: "#fff", fontWeight: 800, fontSize: 14, color: "#475569", cursor: "pointer" }}>← Quay lại</button>
            <button disabled={submitting || photos.length === 0} onClick={confirmPacked}
              style={{
                flex: 1, padding: "14px", borderRadius: 12, border: "none", fontWeight: 900, fontSize: 15,
                background: photos.length ? "#059669" : "#e5e7eb", color: photos.length ? "#fff" : "#9ca3af",
                cursor: photos.length ? "pointer" : "not-allowed",
              }}>
              {submitting ? "⏳ Đang lưu..." : "✅ XÁC NHẬN ĐÓNG GÓI"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Style dùng chung modal ─────────────── */
const labelStyle = { display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 };
const inputStyle = { padding: "12px 14px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", width: "100%", outline: "none" };

const SHIP_UNITS = ["GHN", "GHTK", "Ninja Van", "Viettel Post", "JT Express", "Ahamove", "Grab", "Be", "Khác"];

/* ════════════════════════════════════════════════════════════════
 * HandoverModal — Bàn giao ĐVVC (chọn đơn vị + mã vận đơn + ảnh)
 * ════════════════════════════════════════════════════════════════ */
function HandoverModal({ order, user, onDone, onClose, showToast }) {
  const [unit, setUnit] = useState(order.shipping_unit || "GHN");
  const [customUnit, setCustomUnit] = useState("");
  const [tracking, setTracking] = useState(order.tracking_code || "");
  const [note, setNote] = useState(order.shipping_note || "");
  const [scanOpen, setScanOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadPhotos(files, order.id);
      setPhotos(prev => [...prev, ...urls.map(u => ({ url: u }))]);
    } catch (err) { showToast("Lỗi upload ảnh: " + err.message, "err"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirm() {
    if (photos.length === 0) { showToast("⚠️ Phải chụp ảnh bàn giao (kèm mã vận đơn)", "err"); return; }
    setSubmitting(true);
    try {
      const finalUnit = unit === "Khác" ? (customUnit.trim() || "Khác") : unit;
      const media = parsePackMedia(order);
      media.handover = photos.map(p => p.url);
      const updates = {
        pack_status: "shipped",
        ship_status: "shipped",
        shipping_unit: finalUnit,
        tracking_code: tracking.trim(),
        shipping_note: note || "",
        handover_by_name: user.full_name || user.name || "",
        handover_at: new Date().toISOString(),
        pack_media: JSON.stringify(media),
      };
      await SaleOrder.update(order.id, updates);
      await logHistory({
        order_id: order.id, order_code: order.order_code,
        action_type: "ship", action_label: "🚚 Bàn giao ĐVVC",
        changed_by_id: user.id, changed_by_name: user.full_name || user.name || "", changed_by_role: user.role || "",
        old_value: "packed", new_value: "shipped",
        note: `${finalUnit} — VĐ ${tracking.trim() || "(chưa có)"} — ${photos.length} ảnh`,
      });
      logAction(user, "ship_order", "sale_order", order.id, `Bàn giao ${finalUnit} VĐ ${tracking.trim()} đơn ${order.order_code}`);
      await notifyUser(order.seller_id, order.seller_name, {
        title: `🚚 Đơn ${order.order_code} đã gửi ${finalUnit}`,
        message: `Mã vận đơn: ${tracking.trim() || "(chưa có)"} — theo dõi trạng thái trong Giao nhận`,
        order: { id: order.id, order_code: order.order_code },
      });
      showToast("✅ Đã bàn giao đơn vị vận chuyển", "ok");
      onDone({ ...order, ...updates });
    } catch (e) { showToast("Lỗi: " + e.message, "err"); }
    setSubmitting(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4400, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 17, color: "#1e293b", marginBottom: 2 }}>🚚 Bàn giao đơn vị vận chuyển</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Đơn {order.order_code} — {order.customer_name}</div>

        <label style={labelStyle}>Đơn vị vận chuyển</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {SHIP_UNITS.map(u => (
            <button key={u} onClick={() => setUnit(u)}
              style={{
                padding: "8px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: unit === u ? "2px solid #0369a1" : "1px solid #d1d5db",
                background: unit === u ? "#e0f2fe" : "#fff", color: unit === u ? "#0369a1" : "#475569",
              }}>{u}</button>
          ))}
        </div>
        {unit === "Khác" && (
          <input value={customUnit} onChange={e => setCustomUnit(e.target.value)} placeholder="Tên đơn vị vận chuyển"
            style={{ ...inputStyle, marginBottom: 12 }} />
        )}

        <label style={labelStyle}>Mã vận đơn</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="VD: GHN123456789"
            style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => setScanOpen(true)}
            style={{ padding: "0 16px", borderRadius: 12, border: "1px solid #d1d5db", background: "#f8fafc", cursor: "pointer" }}>
            <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 22, color: "#0369a1" }}>qr_code_scanner</span>
          </button>
        </div>
        {scanOpen && (
          <ScanCodeModal title="Quét mã vận đơn" hint="Quét mã vạch trên phiếu của ĐVVC"
            onFound={code => { setTracking(code); setScanOpen(false); }}
            onClose={() => setScanOpen(false)} />
        )}

        <label style={labelStyle}>Ghi chú</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Tùy chọn..." style={{ ...inputStyle, marginBottom: 14 }} />

        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} style={{ display: "none" }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}
          style={{ width: "100%", padding: "16px", borderRadius: 14, border: "2px dashed #cbd5e1", background: "#fff", color: "#334155", fontWeight: 800, fontSize: 14, marginBottom: 10, cursor: "pointer" }}>
          {uploading ? "⏳ Đang upload..." : "📷 CHỤP ẢNH BÀN GIAO (bắt buộc)"}
        </button>
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                <img src={normalizePbUrl(p.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.65)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 12, border: "1px solid #d1d5db", background: "#fff", fontWeight: 800, fontSize: 14, color: "#475569", cursor: "pointer" }}>Hủy</button>
          <button onClick={confirm} disabled={submitting}
            style={{ flex: 2, padding: 14, borderRadius: 12, border: "none", background: "#0369a1", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: submitting ? .6 : 1 }}>
            {submitting ? "⏳ Đang lưu..." : "✅ XÁC NHẬN ĐÃ GỬI ĐVVC"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 * StepPhotoModal — modal 1 bước chụp ảnh (ĐVVC đã nhận / Đã giao xong / Giao lỗi)
 * ════════════════════════════════════════════════════════════════ */
function StepPhotoModal({ order, user, title, subtitle, noteLabel, notePlaceholder, onDone, onClose, showToast }) {
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadPhotos(files, order.id);
      setPhotos(prev => [...prev, ...urls.map(u => ({ url: u }))]);
    } catch (err) { showToast("Lỗi upload ảnh: " + err.message, "err"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4400, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 17, color: "#1e293b", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{subtitle}</div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFiles} style={{ display: "none" }} />
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}
          style={{ width: "100%", padding: "16px", borderRadius: 14, border: "2px dashed #cbd5e1", background: "#fff", color: "#334155", fontWeight: 800, fontSize: 14, marginBottom: 10, cursor: "pointer" }}>
          {uploading ? "⏳ Đang upload..." : "📷 CHỤP ẢNH XÁC THỰC (bắt buộc)"}
        </button>
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                <img src={normalizePbUrl(p.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.65)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {noteLabel && (
          <>
            <label style={labelStyle}>{noteLabel}</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder={notePlaceholder || ""} style={inputStyle} />
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 12, border: "1px solid #d1d5db", background: "#fff", fontWeight: 800, fontSize: 14, color: "#475569", cursor: "pointer" }}>Hủy</button>
          <button onClick={() => onDone({ photos: photos.map(p => p.url), note, setSubmitting })} disabled={submitting || photos.length === 0}
            style={{ flex: 2, padding: 14, borderRadius: 12, border: "none", background: photos.length ? "#059669" : "#e5e7eb", color: photos.length ? "#fff" : "#9ca3af", fontWeight: 900, fontSize: 15, cursor: photos.length ? "pointer" : "not-allowed" }}>
            {submitting ? "⏳ Đang lưu..." : "✅ XÁC NHẬN"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Card đơn ─────────────── */
function PkCard({ order, meta, children, onExpand, expanded, timeline }) {
  const st = PK_STATUS[meta] || PK_STATUS[""];
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
      <div onClick={onExpand} style={{ padding: "12px 14px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 26, color: st.color, flexShrink: 0 }}>{st.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 14, color: "#1f2937" }}>{order.order_code}</span>
              <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, flexShrink: 0 }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {order.customer_name || "Khách lẻ"}{order.customer_phone ? " · " + order.customer_phone : ""} · {fmtVnd(order.total)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, textAlign: "right" }}>
            {order.tracking_code ? <div style={{ color: "#0369a1", fontWeight: 700, fontSize: 11 }}>📦 {order.shipping_unit}<br />{order.tracking_code}</div> : fmtTimeShort(order.created_date)}
          </div>
        </div>
      </div>
      {children}
      {expanded && timeline}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
 * MAIN — PackingPage
 * ════════════════════════════════════════════════════════════════ */
export default function PackingPage({ user, onBack }) {
  const { can } = usePermission();
  const canViewPack = can("pack_order", "view");
  const canEditPack = can("pack_order", "edit");
  const canViewShip = can("ship_order", "view");
  const canEditShip = can("ship_order", "edit");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(canViewPack ? "pick" : "handover");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null); // order id
  const [modal, setModal] = useState(null); // {type, order}
  const { showToast, toastEl } = useToast();

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const list = await SaleOrder.list({ limit: 200, sort: "-id" });
      setOrders((list || []).filter(o => o.status !== "cancelled"));
    } catch (e) { showToast("Lỗi tải đơn: " + e.message, "err"); }
    setLoading(false);
  }

  // ── Hàng đợi theo quyền (KHÔNG theo role) ──
  const queues = useMemo(() => {
    const q = {
      pick: [],       // chờ soạn hàng (pack_order)
      handover: [],   // đã đóng gói, chờ bàn giao ĐVVC (ship_order)
      transit: [],    // đã gửi / ĐVVC đã nhận (ship_order)
      done: [],       // đã giao / tại quầy
      failed: [],     // giao lỗi
    };
    for (const o of orders) {
      const st = o.pack_status || "";
      if (st === "delivered" || st === "counter") q.done.push(o);
      else if (st === "failed") q.failed.push(o);
      else if (st === "packed") q.handover.push(o);
      else if (st === "shipped" || st === "carrier_received") q.transit.push(o);
      else if (st === "" || st === "to_pick" || st === "picking") q.pick.push(o);
    }
    // FIFO: đơn cũ lên trước
    const byOldest = (a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0);
    q.pick.sort(byOldest);
    q.handover.sort(byOldest);
    q.transit.sort(byOldest);
    q.done.sort((a, b) => new Date(b.delivered_at || 0) - new Date(a.delivered_at || 0));
    return q;
  }, [orders]);

  const filtered = (arr) => {
    const q = search.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter(o =>
      (o.order_code || "").toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").includes(q) ||
      (o.tracking_code || "").toLowerCase().includes(q));
  };

  function applyUpdate(orderId, updates) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
  }

  // ── Actions ──

  // Đánh dấu bán tại quầy (không cần soạn/giao)
  async function markCounter(order) {
    if (!window.confirm(`Đơn ${order.order_code} bàn giao trực tiếp tại quầy (không cần soạn hàng)?`)) return;
    try {
      const updates = {
        pack_status: "counter",
        delivered_at: new Date().toISOString(),
        packed_by_name: user.full_name || user.name || "",
        pack_note: "Bán trực tiếp tại quầy",
      };
      await SaleOrder.update(order.id, updates);
      await logHistory({
        order_id: order.id, order_code: order.order_code,
        action_type: "pack", action_label: "🏪 Bàn giao tại quầy",
        changed_by_id: user.id, changed_by_name: user.full_name || user.name || "", changed_by_role: user.role || "",
        old_value: order.pack_status || "", new_value: "counter", note: "",
      });
      logAction(user, "pack_order", "sale_order", order.id, `Đánh dấu bán tại quầy ${order.order_code}`);
      showToast("✅ Đã đánh dấu tại quầy", "ok");
      applyUpdate(order.id, updates);
    } catch (e) { showToast("Lỗi: " + e.message, "err"); }
  }

  // ĐVVC đã nhận
  async function carrierReceived(order, { photos, note, setSubmitting }) {
    setSubmitting(true);
    try {
      const media = parsePackMedia(order);
      media.carrier = photos;
      const updates = {
        pack_status: "carrier_received",
        carrier_received_at: new Date().toISOString(),
        pack_media: JSON.stringify(media),
      };
      await SaleOrder.update(order.id, updates);
      await logHistory({
        order_id: order.id, order_code: order.order_code,
        action_type: "ship", action_label: "📬 ĐVVC đã nhận hàng",
        changed_by_id: user.id, changed_by_name: user.full_name || user.name || "", changed_by_role: user.role || "",
        old_value: "shipped", new_value: "carrier_received",
        note: `${order.shipping_unit || ""} — ${photos.length} ảnh${note ? " — " + note : ""}`,
      });
      logAction(user, "ship_order", "sale_order", order.id, `ĐVVC đã nhận đơn ${order.order_code}`);
      showToast("✅ Đã ghi nhận ĐVVC nhận hàng", "ok");
      setModal(null);
      applyUpdate(order.id, updates);
    } catch (e) { showToast("Lỗi: " + e.message, "err"); setSubmitting(false); }
  }

  // Đã giao xong
  async function delivered(order, { photos, note, setSubmitting }) {
    setSubmitting(true);
    try {
      const media = parsePackMedia(order);
      media.delivered = photos;
      const updates = {
        pack_status: "delivered",
        ship_status: "delivered",
        delivered_at: new Date().toISOString(),
        delivery_note: note || "",
        pack_media: JSON.stringify(media),
      };
      await SaleOrder.update(order.id, updates);
      await logHistory({
        order_id: order.id, order_code: order.order_code,
        action_type: "ship", action_label: "✅ Đã giao xong",
        changed_by_id: user.id, changed_by_name: user.full_name || user.name || "", changed_by_role: user.role || "",
        old_value: order.pack_status, new_value: "delivered",
        note: `POD ${photos.length} ảnh${note ? " — " + note : ""}`,
      });
      logAction(user, "ship_order", "sale_order", order.id, `Giao xong đơn ${order.order_code}`);
      await notifyUser(order.seller_id, order.seller_name, {
        title: `✅ Đơn ${order.order_code} đã giao xong`,
        message: `Khách đã nhận hàng — ${order.tracking_code || ""}`,
        order: { id: order.id, order_code: order.order_code },
      });
      showToast("🎉 Đơn đã giao xong!", "ok");
      setModal(null);
      applyUpdate(order.id, updates);
    } catch (e) { showToast("Lỗi: " + e.message, "err"); setSubmitting(false); }
  }

  // Giao lỗi
  async function failDelivery(order, { photos, note, setSubmitting }) {
    setSubmitting(true);
    try {
      const media = parsePackMedia(order);
      media.fail = photos;
      const updates = {
        pack_status: "failed",
        ship_status: "failed",
        delivery_fail_reason: note || "",
        delivery_fail_at: new Date().toISOString(),
        pack_media: JSON.stringify(media),
      };
      await SaleOrder.update(order.id, updates);
      await logHistory({
        order_id: order.id, order_code: order.order_code,
        action_type: "ship", action_label: "❌ Giao thất bại",
        changed_by_id: user.id, changed_by_name: user.full_name || user.name || "", changed_by_role: user.role || "",
        old_value: order.pack_status, new_value: "failed",
        note: `${note || ""} — ${photos.length} ảnh`,
      });
      logAction(user, "ship_order", "sale_order", order.id, `Giao lỗi đơn ${order.order_code}: ${note}`);
      await notifyUser(order.seller_id, order.seller_name, {
        title: `❌ Đơn ${order.order_code} giao lỗi`,
        message: note || "Xem chi tiết trong Soạn hàng & Giao nhận",
        order: { id: order.id, order_code: order.order_code },
      });
      await notifyRoles(["manager", "admin", "owner"], {
        title: `❌ Đơn ${order.order_code} giao lỗi`,
        message: `${note || ""} — cần xử lý`,
        order: { id: order.id, order_code: order.order_code },
      });
      showToast("Đã ghi nhận giao lỗi", "err");
      setModal(null);
      applyUpdate(order.id, updates);
    } catch (e) { showToast("Lỗi: " + e.message, "err"); setSubmitting(false); }
  }

  // Bàn giao lại (đơn lỗi → quay lại chờ bàn giao)
  async function retryHandover(order) {
    if (!window.confirm(`Chuyển đơn ${order.order_code} về "Chờ bàn giao" để gửi lại?`)) return;
    try {
      const updates = { pack_status: "packed", ship_status: "" };
      await SaleOrder.update(order.id, updates);
      await logHistory({
        order_id: order.id, order_code: order.order_code,
        action_type: "ship", action_label: "🔄 Bàn giao lại",
        changed_by_id: user.id, changed_by_name: user.full_name || user.name || "", changed_by_role: user.role || "",
        old_value: "failed", new_value: "packed", note: "",
      });
      logAction(user, "ship_order", "sale_order", order.id, `Bàn giao lại đơn ${order.order_code}`);
      showToast("✅ Đã chuyển về chờ bàn giao", "ok");
      applyUpdate(order.id, updates);
    } catch (e) { showToast("Lỗi: " + e.message, "err"); }
  }

  // ── Quét mã phiếu đơn để mở nhanh ──
  const [scanOrder, setScanOrder] = useState(false);
  async function handleOrderScan(raw) {
    setScanOrder(false);
    const m = String(raw).match(/order=([^&\s]+)/);
    const code = m ? decodeURIComponent(m[1]) : String(raw).trim();
    const found = orders.find(o => o.order_code === code || o.id === code);
    if (!found) { showToast(`❌ Không tìm thấy đơn ${code}`, "err"); return; }
    const st = found.pack_status || "";
    if (canEditPack && (st === "" || st === "to_pick" || st === "picking")) setModal({ type: "picking", order: found });
    else if (canEditShip && st === "packed") setModal({ type: "handover", order: found });
    else setExpanded(found.id);
  }

  // ── Tabs theo quyền ──
  const TABS = [];
  if (canViewPack) TABS.push({ key: "pick", label: "🧺 Chờ soạn", count: queues.pick.length });
  if (canViewShip) {
    TABS.push({ key: "handover", label: "📦 Chờ bàn giao", count: queues.handover.length });
    TABS.push({ key: "transit", label: "🚚 Đang giao", count: queues.transit.length });
    TABS.push({ key: "failed", label: "❌ Lỗi", count: queues.failed.length });
  }
  TABS.push({ key: "done", label: "✅ Hoàn tất", count: queues.done.length });

  const currentList = tab === "pick" ? queues.pick
    : tab === "handover" ? queues.handover
    : tab === "transit" ? queues.transit
    : tab === "failed" ? queues.failed
    : queues.done;

  const items = filtered(currentList);

  /* ── Timeline cho card mở rộng ── */
  function renderTimeline(o) {
    const media = parsePackMedia(o);
    const rows = [];
    if (o.pack_status === "picking") rows.push({ icon: "qr_code_scanner", label: "Đang soạn dở", at: "", by: "" });
    if (o.packed_at) rows.push({ icon: "inventory_2", label: "Đóng gói xong", at: o.packed_at, by: o.packed_by_name, media: media.pack });
    if (o.handover_at) rows.push({ icon: "local_shipping", label: `Bàn giao ${o.shipping_unit || "ĐVVC"}`, at: o.handover_at, by: o.handover_by_name, media: media.handover, extra: o.tracking_code ? "VĐ: " + o.tracking_code : "" });
    if (o.carrier_received_at) rows.push({ icon: "airport_shuttle", label: "ĐVVC đã nhận", at: o.carrier_received_at, by: "", media: media.carrier });
    if (o.delivered_at) rows.push({ icon: "check_circle", label: o.pack_status === "counter" ? "Tại quầy" : "Đã giao xong", at: o.delivered_at, by: "", media: media.delivered, extra: o.delivery_note });
    if (o.delivery_fail_at) rows.push({ icon: "error", label: "Giao lỗi", at: o.delivery_fail_at, by: "", media: media.fail, extra: o.delivery_fail_reason });
    if (rows.length === 0) return <div style={{ padding: "0 14px 12px", fontSize: 12, color: "#9ca3af" }}>Chưa có bước nào được thực hiện.</div>;
    return (
      <div style={{ borderTop: "1px dashed #e5e7eb", padding: "10px 14px 12px", background: "#fafafa" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 18, color: "#64748b", flexShrink: 0 }}>{r.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{r.label} {r.extra ? <span style={{ fontWeight: 400, color: "#0369a1" }}>· {r.extra}</span> : ""}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDateTime(r.at)} {r.by ? "· " + r.by : ""}</div>
              {r.media && r.media.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {r.media.map((u, j) => (
                    <a key={j} href={normalizePbUrl(u)} target="_blank" rel="noreferrer">
                      <img src={normalizePbUrl(u)} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ── Nút hành động theo trạng thái + quyền ── */
  function renderActions(o) {
    const st = o.pack_status || "";
    const btn = (label, color, bg, onClick, disabled) => (
      <button onClick={onClick} disabled={disabled}
        style={{
          flex: 1, padding: "12px 10px", borderRadius: 10, border: "none",
          background: disabled ? "#e5e7eb" : bg, color: disabled ? "#9ca3af" : color,
          fontWeight: 900, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
        }}>{label}</button>
    );
    return (
      <div style={{ display: "flex", gap: 8, padding: "0 14px 12px" }}>
        {/* Soạn hàng — cần quyền edit pack_order */}
        {canEditPack && (st === "" || st === "to_pick" || st === "picking") && (
          <>
            {btn(st === "picking" ? "▶ TIẾP TỤC SOẠN" : "🧺 SOẠN HÀNG", "#fff", "#4f46e5", () => setModal({ type: "picking", order: o }))}
            {btn("🏪 TẠI QUẦY", "#475569", "#f1f5f9", () => markCounter(o))}
          </>
        )}
        {/* Bàn giao — cần quyền edit ship_order */}
        {canEditShip && st === "packed" && (
          btn("🚚 BÀN GIAO ĐVVC", "#fff", "#0369a1", () => setModal({ type: "handover", order: o }))
        )}
        {canEditShip && (st === "shipped" || st === "carrier_received") && (
          <>
            {st === "shipped" && btn("📬 ĐVVC ĐÃ NHẬN", "#fff", "#0e7490", () => setModal({ type: "carrier", order: o }))}
            {btn("✅ ĐÃ GIAO XONG", "#fff", "#059669", () => setModal({ type: "delivered", order: o }))}
            {btn("❌ GIAO LỖI", "#dc2626", "#fef2f2", () => setModal({ type: "fail", order: o }))}
          </>
        )}
        {canEditShip && st === "failed" && (
          btn("🔄 BÀN GIAO LẠI", "#fff", "#d97706", () => retryHandover(o))
        )}
        {/* Chỉ xem → không có nút */}
        {st === "" && !canEditPack && <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 2px" }}>Chỉ xem — không có quyền soạn</div>}
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 14px 100px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg,#0c4a6e,#0369a1)", borderRadius: 20,
        padding: "18px 20px", marginBottom: 14, color: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900 }}>📦 Soạn hàng & Giao nhận</div>
          <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>
            {canEditPack && canEditShip ? "Soạn hàng · Bàn giao · Xác nhận giao" : canEditPack ? "Soạn & đóng gói hàng" : canEditShip ? "Bàn giao & xác nhận giao" : "Chỉ xem tiến độ"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setScanOrder(true)}
            style={{ background: "rgba(255,255,255,.18)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: 12, cursor: "pointer" }}>
            <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 22 }}>qr_code_scanner</span>
          </button>
          {onBack && (
            <button onClick={onBack}
              style={{ background: "rgba(255,255,255,.18)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: 12, cursor: "pointer" }}>
              <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 22 }}>arrow_back</span>
            </button>
          )}
        </div>
      </div>

      {scanOrder && (
        <ScanCodeModal title="Quét phiếu đơn hàng" hint="Quét mã QR trên hóa đơn A5 in từ hệ thống"
          onFound={handleOrderScan} onClose={() => setScanOrder(false)} />
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "10px 14px", borderRadius: 12, border: "none", flexShrink: 0, cursor: "pointer",
              background: tab === t.key ? "#1e293b" : "#f1f5f9",
              color: tab === t.key ? "#fff" : "#475569",
              fontWeight: 800, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6,
            }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: tab === t.key ? "#4f46e5" : "#e2e8f0", color: tab === t.key ? "#fff" : "#334155", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 900 }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search — padding-left 44px chuẩn icon kính lúp */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span className="material-icons" style={{ fontFamily: "Material Icons", position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 20 }}>search</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã đơn, khách, SĐT, mã vận đơn..."
          style={{ width: "100%", padding: "12px 14px", paddingLeft: 44, borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 50, color: "#9ca3af" }}>⏳ Đang tải đơn hàng...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50, color: "#9ca3af" }}>
          <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 56, display: "block", marginBottom: 10, color: "#d1d5db" }}>task_alt</span>
          {tab === "done" ? "Chưa có đơn hoàn tất" : tab === "pick" ? "Không có đơn chờ soạn — Thật tuyệt!" : "Không có đơn nào ở trạng thái này"}
        </div>
      ) : (
        items.map(o => (
          <PkCard key={o.id} order={o} meta={o.pack_status || ""}
            onExpand={() => setExpanded(expanded === o.id ? null : o.id)}
            expanded={expanded === o.id} timeline={renderTimeline(o)}>
            {renderActions(o)}
          </PkCard>
        ))
      )}

      {/* Modals */}
      {modal?.type === "picking" && (
        <PickingModal order={modal.order} user={user} showToast={showToast}
          onDone={(updated) => { setModal(null); applyUpdate(modal.order.id, updated); }}
          onClose={() => { setModal(null); loadOrders(); }} />
      )}
      {modal?.type === "handover" && (
        <HandoverModal order={modal.order} user={user} showToast={showToast}
          onDone={(updated) => { setModal(null); applyUpdate(modal.order.id, updated); }}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "carrier" && (
        <StepPhotoModal order={modal.order} user={user} showToast={showToast}
          title="📬 Xác nhận ĐVVC đã nhận hàng"
          subtitle={`Đơn ${modal.order.order_code} — ${modal.order.shipping_unit || ""} ${modal.order.tracking_code || ""}`}
          noteLabel="Ghi chú (tùy chọn)" notePlaceholder="VD: ĐVVC xác nhận lấy hàng..."
          onDone={(data) => carrierReceived(modal.order, data)}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "delivered" && (
        <StepPhotoModal order={modal.order} user={user} showToast={showToast}
          title="✅ Xác nhận đã giao xong"
          subtitle={`Đơn ${modal.order.order_code} — chụp ảnh POD (bằng chứng giao hàng)`}
          noteLabel="Ghi chú (tùy chọn)" notePlaceholder="VD: Khách đã nhận, máy nguyên vẹn..."
          onDone={(data) => delivered(modal.order, data)}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "fail" && (
        <StepPhotoModal order={modal.order} user={user} showToast={showToast}
          title="❌ Giao thất bại"
          subtitle={`Đơn ${modal.order.order_code} — lý do: Khách từ chối / Sai địa chỉ / Không liên hệ được / Hư hỏng...`}
          noteLabel="Lý do giao lỗi" notePlaceholder="VD: Khách hẹn giao lại sau 2 ngày"
          onDone={(data) => failDelivery(modal.order, data)}
          onClose={() => setModal(null)} />
      )}

      {toastEl}
    </div>
  );
}
