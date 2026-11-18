/**
 * productSearch.js — Tìm hàng hoá thông minh cho POS
 *
 * Vì sao cần: PocketBase chỉ so khớp chuỗi con chính xác (LIKE) nên gõ
 * "mk đb" không ra "Mk 14PM ĐB UV Pro". Ở đây tải danh mục về máy, chuẩn hoá
 * bỏ dấu tiếng Việt rồi tìm theo từng từ, không phụ thuộc thứ tự hay khoảng trắng.
 *
 * Có cache localStorage (mặc định 12 giờ) để lần sau mở máy không phải tải lại.
 */
import { SparePart } from "../pages/pb.jsx";

const CACHE_KEY = "hk_catalog_search_v2";
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 giờ

/** Bỏ dấu tiếng Việt, về chữ thường, gom khoảng trắng */
export function normalizeVN(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Rút gọn 1 bản ghi hàng hoá để lưu cache */
function pack(p) {
  return {
    id: p.id,
    sku: p.sku || "",
    name: p.name || "",
    unit: p.unit || "",
    price: Number(p.price ?? p.retail_price ?? 0) || 0,
    cost_price: Number(p.cost_price ?? 0) || 0,
    stock_qty: Number(p.stock_qty ?? 0) || 0,
    category: p.category || "",
    images: p.images || null,
    is_active: p.is_active !== false,
  };
}

/** Dựng chỉ mục tìm kiếm (đã chuẩn hoá) */
export function buildSearchIndex(list) {
  return (list || []).map(p => {
    const nn = normalizeVN(p.name);
    const ns = normalizeVN(p.sku).replace(/\s+/g, "");
    return { ...p, _nn: nn, _ns: ns, _words: nn.split(" ").filter(Boolean) };
  });
}

/** Gõ dính liền có thiếu từ giữa: "mkdb" khớp "mk 14pm db ..." */
function compactMatch(words, q) {
  let p = 0;
  for (const w of words) {
    if (p >= q.length) break;
    if (q.startsWith(w, p)) { p += w.length; continue; }
    const rest = q.slice(p);
    if (rest.length >= 2 && w.startsWith(rest)) { p = q.length; break; }
  }
  return p >= q.length;
}

/**
 * Tìm theo nhiều từ, không phân biệt dấu/hoa-thường/khoảng trắng.
 * Mọi từ trong câu tìm phải xuất hiện (dạng đầu từ hoặc nằm trong tên).
 */
export function searchProducts(index, query, { limit = 30 } = {}) {
  const q = normalizeVN(query);
  if (!q) return [];
  const qNoSpace = q.replace(/\s+/g, "");
  const tokens = q.split(" ").filter(Boolean);

  const out = [];
  for (const p of index || []) {
    let score = 0;
    const name = p._nn || "";
    const sku = p._ns || "";

    if (sku === q || name === q || (p.sku || "").toLowerCase() === String(query).toLowerCase().trim()) {
      score = 1200;
    } else if (sku && (sku === qNoSpace || sku.startsWith(qNoSpace))) {
      score = 1000;
    } else if (tokens.length === 1 && qNoSpace.length >= 3 && compactMatch(p._words || [], qNoSpace)) {
      // gõ dính liền / thiếu từ giữa: "mkdb" vẫn ra "Mk 14PM ĐB UV Pro"
      score = 600;
    } else {
      let ok = true;
      let tokenScore = 0;
      const nameFlat = name.replace(/\s+/g, "");
      for (const t of tokens) {
        const idxWord = p._words ? p._words.findIndex(w => w.startsWith(t)) : -1;
        if (idxWord === 0) tokenScore += 90;          // khớp ngay từ đầu tên
        else if (idxWord > 0) tokenScore += 60 - Math.min(idxWord, 20); // khớp đầu từ ở giữa
        else if (name.includes(t)) tokenScore += 25;  // nằm trong một từ
        else if (sku.includes(t)) tokenScore += 15;   // khớp mã
        else if (nameFlat.includes(t)) tokenScore += 10; // gõ dính liền
        else { ok = false; break; }
      }
      if (!ok) continue;
      // tên càng ngắn càng đúng ý, và chuỗi khớp càng liền càng tốt
      score = 400 + tokenScore;
      if (name.includes(q)) score += 80;
      score -= Math.min(40, Math.floor(name.length / 12));
    }

    if (p.is_active === false) score -= 150;
    if (Number(p.stock_qty) > 0) score += 40;          // ưu tiên hàng còn tồn
    out.push({ p, score });
  }

  out.sort((a, b) => b.score - a.score || (Number(b.p.stock_qty) || 0) - (Number(a.p.stock_qty) || 0));
  return out.slice(0, limit).map(x => x.p);
}

/**
 * Tải danh mục hàng hoá để tìm (có cache).
 * onProgress(pct) để hiển thị tiến độ khi lần đầu tải.
 */
export async function loadCatalogForSearch(onProgress) {
  // 1) Dùng cache nếu còn hạn
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Array.isArray(data) && data.length && Date.now() - ts < CACHE_TTL) {
        onProgress && onProgress(100, true);
        return buildSearchIndex(data);
      }
    }
  } catch { /* cache hỏng thì bỏ qua */ }

  // 2) Tải mới
  const FIELDS = "id,sku,name,unit,price,retail_price,cost_price,stock_qty,category,images,is_active";
  const PER = 500, MAX_PAGES = 40;
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await SparePart.list({ sort: "name", limit: PER, page, fields: FIELDS }).catch(() => []);
    all.push(...(rows || []));
    onProgress && onProgress(Math.min(99, Math.round((page * PER) / 130)), false);
    if ((rows || []).length < PER) break;
  }

  const packed = all.map(pack);
  // 3) Lưu cache (nếu trình duyệt còn chỗ)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: packed }));
  } catch { /* hết dung lượng thì chỉ giữ trong bộ nhớ */ }

  onProgress && onProgress(100, false);
  return buildSearchIndex(packed);
}
