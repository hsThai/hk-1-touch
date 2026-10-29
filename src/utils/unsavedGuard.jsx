/* unsavedGuard.jsx — Chặn rời trang / đóng tab khi đang làm dở mà chưa lưu.
   Cách dùng trong từng trang:
     useUnsaved("sale_order", cart.length > 0, "Đơn bán hàng chưa lưu");
   MainApp hiển thị hộp thoại xác nhận trước khi đổi trang. */
import React, { useEffect, useState } from "react";

const registry = new Map();     // key -> nhãn công việc đang dở
const listeners = new Set();

function notify() {
  listeners.forEach(fn => { try { fn(); } catch { } });
}

export function markUnsaved(key, label) {
  if (registry.get(key) === label) return;
  registry.set(key, label);
  notify();
}
export function clearUnsaved(key) {
  if (registry.delete(key)) notify();
}
export function getUnsavedList() {
  return [...registry.values()];
}

/** Đánh dấu một công việc đang làm dở. active=false → tự xóa dấu. */
export function useUnsaved(key, active, label) {
  useEffect(() => {
    if (active) markUnsaved(key, label || "Công việc chưa lưu");
    else clearUnsaved(key);
    return () => clearUnsaved(key);
  }, [key, active, label]);
}

export function useUnsavedList() {
  const [list, setList] = useState(getUnsavedList());
  useEffect(() => {
    const fn = () => setList(getUnsavedList());
    listeners.add(fn);
    fn();
    return () => listeners.delete(fn);
  }, []);
  return list;
}

/** Danh sách việc đang dở + cảnh báo khi đóng/refresh tab */
export function useBeforeUnloadGuard() {
  const list = useUnsavedList();
  useEffect(() => {
    const handler = (e) => {
      if (list.length > 0) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [list.length]);
  return list;
}

/** Hộp thoại xác nhận khi rời trang lúc đang làm dở */
export function LeaveConfirm({ items, onStay, onLeave }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 18, width: "min(440px,94vw)",
        padding: "22px 20px 18px", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 4 }}>⚠️</div>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#1e1b4b", textAlign: "center", marginBottom: 6 }}>
          Bạn đang làm dở việc chưa lưu
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 10, lineHeight: 1.4 }}>
          Nếu rời trang bây giờ, các nội dung sau sẽ bị mất:
        </div>
        <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12,
          padding: "10px 12px", marginBottom: 16 }}>
          {items.map((lb, i) => (
            <div key={i} style={{ fontSize: 13, color: "#b91c1c", fontWeight: 700, lineHeight: 1.6 }}>• {lb}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onStay}
            style={{ flex: 1, height: 46, borderRadius: 12, border: "1.5px solid #d1d5db",
              background: "#fff", color: "#374151", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            Ở lại làm tiếp
          </button>
          <button onClick={onLeave}
            style={{ flex: 1, height: 46, borderRadius: 12, border: "none",
              background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            Rời trang (bỏ)
          </button>
        </div>
      </div>
    </div>
  );
}
