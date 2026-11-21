/* GuidePage.jsx — Hướng dẫn sử dụng (lọc theo quyền, responsive PC/tablet/mobile, ảnh thu nhỏ bấm để phóng to) */
import React, { useEffect, useMemo, useState } from "react";
import { usePermission } from "./PermissionContext.jsx";
import { PAGE_PERMS } from "./MainAppWidgets.jsx";
import { GUIDE_GROUPS, GUIDE_SECTIONS, visibleGuideSections } from "../content/guideContent.js";

/** Bề rộng màn hình: pc (>=1200), tablet (768-1199), mobile (<768) */
function useScreen() {
  const calc = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    return { w, mode: w >= 1200 ? "pc" : w >= 768 ? "tablet" : "mobile" };
  };
  const [s, setS] = useState(calc);
  useEffect(() => {
    const fn = () => setS(calc());
    window.addEventListener("resize", fn);
    window.addEventListener("orientationchange", fn);
    return () => { window.removeEventListener("resize", fn); window.removeEventListener("orientationchange", fn); };
  }, []);
  return s;
}

export default function GuidePage({ user, onGoPage }) {
  const { can } = usePermission();
  const { mode } = useScreen();
  const isPC = mode === "pc";

  const sections = useMemo(() => visibleGuideSections(can, PAGE_PERMS), [can]);
  const [activeId, setActiveId] = useState(sections[0]?.id || "");
  const [q, setQ] = useState("");
  const [listOpen, setListOpen] = useState(true);   // trên điện thoại: mở/đóng danh mục
  const [zoom, setZoom] = useState(null);           // {src, caption, scale}

  const filtered = useMemo(() => {
    const t = (q || "").toLowerCase().trim();
    if (!t) return sections;
    return sections.filter(s =>
      (s.title + " " + s.summary + " " + (s.steps || []).join(" ") + " " + (s.tips || []).join(" "))
        .toLowerCase().includes(t)
    );
  }, [q, sections]);

  const active = filtered.find(s => s.id === activeId) || filtered[0] || null;

  function pickSection(id) {
    setActiveId(id);
    if (!isPC) { setListOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

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

  const images = active
    ? (active.images && active.images.length
        ? active.images
        : (active.page ? [{ src: `/guide/${active.page}.jpg`, caption: "Các bước đánh số bên dưới tương ứng với các khu vực trên màn hình này." }] : []))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: isPC ? "row" : "column", gap: 14, padding: "0 0 24px", alignItems: "flex-start" }}>

      {/* ── Danh mục hướng dẫn ── */}
      <div style={{ width: isPC ? 300 : "100%", flexShrink: 0,
        position: isPC ? "sticky" : "static", top: 8, alignSelf: "flex-start" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e5e7eb", padding: 12 }}>

          {!isPC && (
            <button onClick={() => setListOpen(o => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", marginBottom: listOpen ? 10 : 0, borderRadius: 10,
                border: "1.5px solid #e5e7eb", background: "#f9fafb", cursor: "pointer",
                fontSize: 13.5, fontWeight: 800, color: "#1e1b4b" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 18 }}>menu_book</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {active ? active.title : "Chọn mục hướng dẫn"}
                </span>
              </span>
              <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 20, color: "#6b7280" }}>
                {listOpen ? "expand_less" : "expand_more"}
              </span>
            </button>
          )}

          {(isPC || listOpen) && (
            <>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Tìm trong hướng dẫn..."
                  style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb",
                    paddingLeft: 44, paddingRight: 10, fontSize: 13.5, outline: "none", boxSizing: "border-box" }} />
                <span className="material-icons"
                  style={{ fontFamily: "Material Icons", position: "absolute", left: 14, top: "50%",
                    transform: "translateY(-50%)", fontSize: 18, color: "#9ca3af" }}>search</span>
              </div>

              <div style={{ maxHeight: isPC ? "calc(100vh - 220px)" : "45vh", overflowY: "auto", paddingRight: 2 }}>
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
                          <button key={s.id} onClick={() => pickSection(s.id)}
                            style={{ width: "100%", textAlign: "left", padding: "11px 10px", borderRadius: 9,
                              border: "none", cursor: "pointer", marginBottom: 2, fontSize: 13.5,
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
            </>
          )}
        </div>
      </div>

      {/* ── Nội dung hướng dẫn ── */}
      <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
        {!active ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e5e7eb", padding: 28,
            textAlign: "center", color: "#6b7280" }}>
            Tài khoản của bạn chưa được cấp quyền xem chức năng nào, nên chưa có mục hướng dẫn.
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e5e7eb", padding: isPC ? 20 : 14 }}>
            <div style={{ display: "flex", flexDirection: isPC ? "row" : "column",
              alignItems: isPC ? "flex-start" : "stretch", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: isPC ? 19 : 17, color: "#1e1b4b", lineHeight: 1.35 }}>{active.title}</div>
                <div style={{ fontSize: 13.5, color: "#6b7280", marginTop: 4, lineHeight: 1.55 }}>{active.summary}</div>
              </div>
              {active.page && (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => onGoPage?.(active.page)}
                    style={{ flex: isPC ? "none" : 1, padding: "10px 14px", borderRadius: 10, border: "none", background: "#4f46e5",
                      color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    Mở trang này
                  </button>
                  <button onClick={() => openTab(active)}
                    title="Mở trong tab mới"
                    style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff",
                      color: "#4f46e5", fontSize: 13, fontWeight: 800, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 16 }}>open_in_new</span>
                    Tab mới
                  </button>
                </div>
              )}
            </div>

            {/* Ảnh chụp thực tế — thu nhỏ, bấm để phóng to */}
            {images.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Ảnh chụp màn hình thực tế</div>
                  <div style={{ fontSize: 11.5, color: "#9ca3af" }}>Bấm vào ảnh để phóng to</div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {images.map((img, idx) => (
                    <div key={idx} style={{ width: isPC ? "100%" : "calc(50% - 6px)", marginBottom: 4 }}>
                      <div onClick={() => setZoom({ ...img, scale: 1 })}
                        style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden",
                          background: "#f9fafb", cursor: "zoom-in", position: "relative" }}>
                        <img src={img.src} alt={img.caption || active.title}
                          onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
                          style={{ width: "100%", display: "block" }} />
                        <span className="material-icons"
                          style={{ fontFamily: "Material Icons", position: "absolute", right: 6, bottom: 6,
                            fontSize: 18, color: "#fff", background: "rgba(0,0,0,.45)",
                            borderRadius: 8, padding: 3, lineHeight: 1 }}>zoom_in</span>
                      </div>
                      {img.caption && (
                        <div style={{ fontSize: isPC ? 12 : 11, color: "#6b7280", marginTop: 5, lineHeight: 1.45 }}>
                          <b style={{ color: "#4f46e5" }}>Ảnh {idx + 1}:</b> {img.caption}
                        </div>
                      )}
                    </div>
                  ))}
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
                    <div style={{ fontSize: isPC ? 13.5 : 13, color: "#374151", lineHeight: 1.6 }}>{st}</div>
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
                  <div key={i} style={{ fontSize: isPC ? 13 : 12.5, color: "#78350f", lineHeight: 1.6, marginBottom: 4 }}>
                    • {t}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Xem ảnh phóng to ── */}
      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,.92)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", height: "100%", overflow: "auto", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
            <img src={zoom.src} alt={zoom.caption || ""} onClick={(e) => e.stopPropagation()}
              style={{ width: `${zoom.scale * 100}%`, maxWidth: "none", transition: "width .15s" }} />
          </div>

          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", bottom: 18, left: 0, right: 0, display: "flex",
              alignItems: "center", justifyContent: "center", gap: 10 }}>
            <button onClick={() => setZoom(z => ({ ...z, scale: Math.max(0.5, z.scale - 0.5) }))}
              style={{ width: 46, height: 46, borderRadius: 12, border: "none", background: "rgba(255,255,255,.16)",
                color: "#fff", fontSize: 22, cursor: "pointer" }}>−</button>
            <div style={{ color: "#fff", fontSize: 13, minWidth: 52, textAlign: "center" }}>
              {Math.round(zoom.scale * 100)}%
            </div>
            <button onClick={() => setZoom(z => ({ ...z, scale: Math.min(4, z.scale + 0.5) }))}
              style={{ width: 46, height: 46, borderRadius: 12, border: "none", background: "rgba(255,255,255,.16)",
                color: "#fff", fontSize: 22, cursor: "pointer" }}>+</button>
            <button onClick={() => setZoom(null)}
              style={{ height: 46, padding: "0 18px", borderRadius: 12, border: "none", background: "#4f46e5",
                color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>Đóng</button>
          </div>

          {zoom.caption && (
            <div onClick={(e) => e.stopPropagation()}
              style={{ position: "fixed", top: 12, left: 12, right: 12, color: "#e5e7eb", fontSize: 12.5,
                lineHeight: 1.5, textAlign: "center" }}>
              {zoom.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
