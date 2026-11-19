/**
 * ViDate.jsx — Ô chọn ngày / tháng hiển thị tiếng Việt
 *
 * Dùng thay cho <input type="date"> và <input type="month"> của trình duyệt
 * (trình duyệt hiện mm/dd/yyyy và "November" theo ngôn ngữ hệ thống).
 *
 * Giữ nguyên cách dùng cũ: onChange nhận một object giống event
 * ({ target: { value } }) với value dạng "YYYY-MM-DD" hoặc "YYYY-MM",
 * nên chỉ cần đổi tên thẻ, không phải sửa hàm xử lý.
 */
import React, { useEffect, useRef, useState } from "react";

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const THANG = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
               "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

const pad = (n) => String(n).padStart(2, "0");

function toDisplayDate(v) {
  if (!v) return "";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}
function toDisplayMonth(v) {
  if (!v) return "";
  const m = String(v).match(/^(\d{4})-(\d{2})/);
  return m ? `${THANG[Number(m[2]) - 1]}/${m[1]}` : String(v);
}
function parseTypedDate(txt) {
  const t = String(txt || "").replace(/[^\d]/g, "");
  if (t.length < 8) return "";
  const d = t.slice(0, 2), mo = t.slice(2, 4), y = t.slice(4, 8);
  if (Number(d) < 1 || Number(d) > 31 || Number(mo) < 1 || Number(mo) > 12) return "";
  return `${y}-${mo}-${d}`;
}
function maskDateInput(txt) {
  const t = String(txt || "").replace(/[^\d]/g, "").slice(0, 8);
  const p1 = t.slice(0, 2), p2 = t.slice(2, 4), p3 = t.slice(4, 8);
  return [p1, p2, p3].filter(Boolean).join("/");
}

function Pop({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300,
      background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14,
      boxShadow: "0 12px 32px rgba(0,0,0,.16)", padding: 12, width: 280 }}>
      {children}
    </div>
  );
}

/** Ô chọn ngày: gõ dd/mm/yyyy hoặc chọn trên lịch tiếng Việt */
export function ViDateInput({ value, onChange, style, placeholder = "dd/mm/yyyy", disabled, ...rest }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(toDisplayDate(value));
  const [viewY, setViewY] = useState(() => Number((value || "").slice(0, 4)) || new Date().getFullYear());
  const [viewM, setViewM] = useState(() => Number((value || "").slice(5, 7)) - 1 || new Date().getMonth());

  useEffect(() => { setText(toDisplayDate(value)); }, [value]);

  const emit = (v) => onChange && onChange({ target: { value: v } });
  const pick = (d) => { emit(d); setOpen(false); };

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const firstDow = (new Date(viewY, viewM, 1).getDay() + 6) % 7; // T2 = 0
  const sel = value || "";

  return (
    <div style={{ position: "relative", ...(style && style.display === "inline-block" ? {} : {}) }}>
      <div style={{ position: "relative" }}>
        <input
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          onChange={(e) => {
            const masked = maskDateInput(e.target.value);
            setText(masked);
            const iso = parseTypedDate(masked);
            if (iso) emit(iso);
            if (!masked) emit("");
          }}
          onBlur={() => { const iso = parseTypedDate(text); if (iso) { emit(iso); setText(toDisplayDate(iso)); } }}
          style={{ ...(style || {}), paddingRight: 34 }}
        />
        <button type="button" onClick={() => !disabled && setOpen(o => !o)}
          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
            background: "transparent", border: "none", cursor: disabled ? "default" : "pointer",
            color: "#6b7280", padding: 4, lineHeight: 1 }}>
          <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 18 }}>calendar_month</span>
        </button>
      </div>

      {open && (
        <Pop onClose={() => setOpen(false)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" onClick={() => { if (viewM === 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(viewM - 1); }}
              style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#1e1b4b" }}>{THANG[viewM]}/{viewY}</div>
            <button type="button" onClick={() => { if (viewM === 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(viewM + 1); }}
              style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {THU.map(t => (
              <div key={t} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9ca3af", padding: "2px 0" }}>{t}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const iso = `${viewY}-${pad(viewM + 1)}-${pad(d)}`;
              const active = sel === iso;
              const today = new Date();
              const isToday = today.getFullYear() === viewY && today.getMonth() === viewM && today.getDate() === d;
              return (
                <button key={d} type="button" onClick={() => pick(iso)}
                  style={{ height: 32, borderRadius: 8, cursor: "pointer", fontSize: 13,
                    fontWeight: active ? 900 : (isToday ? 800 : 500),
                    border: isToday && !active ? "1px solid #a7f3d0" : "1px solid transparent",
                    background: active ? "#059669" : "transparent",
                    color: active ? "#fff" : isToday ? "#059669" : "#374151" }}>
                  {d}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <button type="button" onClick={() => { emit(""); setOpen(false); }}
              style={{ border: "none", background: "transparent", color: "#dc2626", fontSize: 12.5, cursor: "pointer" }}>Xoá</button>
            <button type="button"
              onClick={() => {
                const t = new Date();
                pick(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
              }}
              style={{ border: "none", background: "transparent", color: "#059669", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Hôm nay
            </button>
          </div>
        </Pop>
      )}
    </div>
  );
}

/** Ô chọn tháng: hiện "Tháng 11/2026", chọn trên lưới 12 tháng */
export function ViMonthInput({ value, onChange, style, disabled, placeholder = "Chọn tháng" }) {
  const [open, setOpen] = useState(false);
  const [viewY, setViewY] = useState(() => Number((value || "").slice(0, 4)) || new Date().getFullYear());
  const emit = (v) => onChange && onChange({ target: { value: v } });

  return (
    <div style={{ position: "relative" }}>
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{ ...(style || {}), display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, cursor: disabled ? "default" : "pointer", textAlign: "left" }}>
        <span style={{ color: value ? "inherit" : "#9ca3af" }}>{value ? toDisplayMonth(value) : placeholder}</span>
        <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 18, color: "#6b7280" }}>calendar_month</span>
      </button>

      {open && (
        <Pop onClose={() => setOpen(false)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" onClick={() => setViewY(viewY - 1)}
              style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>‹</button>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#1e1b4b" }}>{viewY}</div>
            <button type="button" onClick={() => setViewY(viewY + 1)}
              style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {THANG.map((label, i) => {
              const iso = `${viewY}-${pad(i + 1)}`;
              const active = value === iso;
              return (
                <button key={label} type="button" onClick={() => { emit(iso); setOpen(false); }}
                  style={{ padding: "9px 0", borderRadius: 9, cursor: "pointer", fontSize: 12.5,
                    fontWeight: active ? 900 : 600,
                    border: active ? "1.5px solid #059669" : "1px solid #e5e7eb",
                    background: active ? "#dcfce7" : "#fff",
                    color: active ? "#047857" : "#374151" }}>
                  {label.replace("Tháng ", "Th")}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <button type="button" onClick={() => { emit(""); setOpen(false); }}
              style={{ border: "none", background: "transparent", color: "#dc2626", fontSize: 12.5, cursor: "pointer" }}>Xoá</button>
            <button type="button"
              onClick={() => {
                const t = new Date();
                emit(`${t.getFullYear()}-${pad(t.getMonth() + 1)}`);
                setOpen(false);
              }}
              style={{ border: "none", background: "transparent", color: "#059669", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Tháng này
            </button>
          </div>
        </Pop>
      )}
    </div>
  );
}

export default ViDateInput;
