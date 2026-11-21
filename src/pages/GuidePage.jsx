/* GuidePage.jsx — Hướng dẫn sử dụng (lọc theo quyền của từng vai trò) */
import React, { useMemo, useState } from "react";
import { usePermission } from "./PermissionContext.jsx";
import { PAGE_PERMS } from "./MainAppWidgets.jsx";
import { GUIDE_GROUPS, GUIDE_SECTIONS, visibleGuideSections } from "../content/guideContent.js";

export default function GuidePage({ user, onGoPage }) {
  const { can } = usePermission();
  const sections = useMemo(() => visibleGuideSections(can, PAGE_PERMS), [can]);
  const [activeId, setActiveId] = useState(sections[0]?.id || "");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = (q || "").toLowerCase().trim();
    if (!t) return sections;
    return sections.filter(s =>
      (s.title + " " + s.summary + " " + (s.steps || []).join(" ") + " " + (s.tips || []).join(" "))
        .toLowerCase().includes(t)
    );
  }, [q, sections]);

  const active = filtered.find(s => s.id === activeId) || filtered[0] || null;

  function openTab(sec) {
    if (!sec?.page) return;
    try {
      const u = new URL(window.location.href);
      const p = new URLSearchParams();
      p.set("p", sec.page);
      u.search = p.toString(); u.hash = "";
      window.open(u.toString(), "_blank", "noopener");
    } catch {}
  }

  return (
    <div style={{ display: "flex", gap: 16, padding: "0 0 24px", alignItems: "flex-start" }}>
      {/* ── Danh mục hướng dẫn ── */}
      <div style={{ width: 300, flexShrink: 0, position: "sticky", top: 8, alignSelf: "flex-start" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e5e7eb", padding: 12 }}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Tìm trong hướng dẫn..."
              style={{ width: "100%", height: 38, borderRadius: 10, border: "1.5px solid #e5e7eb",
                paddingLeft: 44, paddingRight: 10, fontSize: 13.5, outline: "none", boxSizing: "border-box" }} />
            <span className="material-icons"
              style={{ fontFamily: "Material Icons", position: "absolute", left: 14, top: "50%",
                transform: "translateY(-50%)", fontSize: 18, color: "#9ca3af" }}>search</span>
          </div>

          <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto", paddingRight: 2 }}>
            {GUIDE_GROUPS.map(g => {
              const items = filtered.filter(s => s.group === g.key);
              if (!items.length) return null;
              return (
                <div key={g.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px",
                    fontSize: 11, fontWeight: 900, letterSpacing: ".06em", textTransform: "uppercase", color: g.color }}>
                    <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 14 }}>{g.icon}</span>
                    {g.label}
                  </div>
                  {items.map(s => {
                    const on = active?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => setActiveId(s.id)}
                        style={{ width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9,
                          border: "none", cursor: "pointer", marginBottom: 2, fontSize: 13,
                          background: on ? "#eef2ff" : "transparent",
                          color: on ? "#3730a3" : "#374151", fontWeight: on ? 800 : 500 }}>
                        {s.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {!filtered.length && (
              <div style={{ padding: "16px 8px", fontSize: 13, color: "#9ca3af" }}>
                Không tìm thấy mục hướng dẫn phù hợp với quyền của bạn.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Nội dung hướng dẫn ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!active ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e5e7eb", padding: 28,
            textAlign: "center", color: "#6b7280" }}>
            Tài khoản của bạn chưa được cấp quyền xem chức năng nào, nên chưa có mục hướng dẫn.
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e5e7eb", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 19, color: "#1e1b4b" }}>{active.title}</div>
                <div style={{ fontSize: 13.5, color: "#6b7280", marginTop: 4, lineHeight: 1.55 }}>{active.summary}</div>
              </div>
              {active.page && (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => onGoPage?.(active.page)}
                    style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#4f46e5",
                      color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                    Mở trang này
                  </button>
                  <button onClick={() => openTab(active)}
                    title="Mở trong tab mới"
                    style={{ padding: "8px 10px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff",
                      color: "#4f46e5", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 16 }}>open_in_new</span>
                    Tab mới
                  </button>
                </div>
              )}
            </div>

            {/* Ảnh chụp thực tế */}
            {active.page && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6 }}>
                  Ảnh chụp màn hình thực tế
                </div>
                <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#f9fafb" }}>
                  <img src={`/guide/${active.page}.jpg`} alt={active.title}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    style={{ width: "100%", display: "block" }} />
                </div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 5, fontStyle: "italic" }}>
                  Các bước đánh số bên dưới tương ứng với các khu vực trên màn hình này.
                </div>
              </div>
            )}

            {/* Các bước */}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b", marginBottom: 8 }}>Các bước thực hiện</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(active.steps || []).map((st, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, background: "#eef2ff", color: "#4338ca",
                      fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center",
                      justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>{st}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lưu ý */}
            {(active.tips || []).length > 0 && (
              <div style={{ marginTop: 18, background: "#fffbeb", border: "1.5px solid #fde68a",
                borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#92400e", marginBottom: 6 }}>Lưu ý quan trọng</div>
                {active.tips.map((t, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6, marginBottom: 4 }}>
                    • {t}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
