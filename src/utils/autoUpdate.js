// Tự phát hiện bản mới: so sánh build đang chạy với /version.json trên server.
// Khác nhau → tải lại trang (PWA không còn kẹt bản cũ).
const CURRENT = typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : "dev";
let checking = false;

async function check() {
  if (checking || CURRENT === "dev") return;
  checking = true;
  try {
    const r = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return;
    const { build } = await r.json();
    if (build && build !== CURRENT) {
      // tránh lặp reload: chỉ reload nếu chưa reload cho build này
      const key = "hk_reloaded_for";
      if (sessionStorage.getItem(key) !== build) {
        sessionStorage.setItem(key, build);
        try {
          if ("caches" in window) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
        } catch {}
        window.location.reload();
      }
    }
  } catch {} finally { checking = false; }
}

export function startAutoUpdate() {
  check();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  setInterval(check, 5 * 60 * 1000);
}
