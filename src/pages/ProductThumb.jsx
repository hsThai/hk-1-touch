/* ProductThumb.jsx — Ảnh đại diện hàng hóa dùng chung cho mọi trang có hàng hóa
 * Dùng: <ProductThumb partId={x.part_id} sku={x.sku} size={40} />
 * - Chỉ nạp 1 lần các hàng CÓ ảnh (filter images:length>0), cache theo id + sku
 * - Không có ảnh → hiện ô icon mờ (giữ bố cục thẳng hàng)
 * - Bấm vào ảnh → phóng to
 */
import React, { useEffect, useState } from "react";
import { getPbUrl, normalizePbUrl } from "./pb.jsx";
import { MediaViewer } from "./MediaViewer.jsx";

let _cache = null;          // { byId:{}, bySku:{} }
let _loading = null;
const _subs = new Set();

async function loadImages(force = false) {
  if (_cache && !force) return _cache;
  if (_loading) return _loading;
  _loading = (async () => {
    const byId = {}, bySku = {};
    let page = 1;
    for (;;) {
      const r = await fetch(`${getPbUrl()}/api/collections/product_catalog/records?perPage=500&page=${page}&filter=${encodeURIComponent("images:length>0")}&fields=id,sku,images`);
      if (!r.ok) break;
      const d = await r.json();
      for (const it of d.items || []) {
        const imgs = (it.images || []).map(normalizePbUrl).filter(Boolean);
        if (!imgs.length) continue;
        byId[it.id] = imgs;
        if (it.sku) bySku[String(it.sku)] = imgs;
      }
      if (page >= (d.totalPages || 1)) break;
      page++;
    }
    _cache = { byId, bySku };
    _loading = null;
    _subs.forEach(fn => fn());
    return _cache;
  })().catch(() => { _loading = null; _cache = { byId:{}, bySku:{} }; return _cache; });
  return _loading;
}

/** Gọi sau khi sửa/ thêm ảnh hàng hóa để các trang khác cập nhật */
export function refreshProductImages() { _cache = null; return loadImages(true); }

/** Lấy mảng ảnh của 1 hàng (đồng bộ, từ cache) */
export function getProductImages(partId, sku) {
  if (!_cache) return [];
  return (partId && _cache.byId[partId]) || (sku && _cache.bySku[String(sku)]) || [];
}

export function ProductThumb({ partId, sku, size = 40, radius = 8, style, zoom = true }) {
  const [, force] = useState(0);
  const [viewer, setViewer] = useState(null);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    _subs.add(fn);
    if (!_cache) loadImages();
    return () => { _subs.delete(fn); };
  }, []);
  const imgs = getProductImages(partId, sku);
  const box = { width:size, height:size, borderRadius:radius, flexShrink:0, ...style };
  if (!imgs.length) {
    return (
      <div style={{ ...box, background:"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center", color:"#d1d5db" }}>
        <span className="material-icons" style={{ fontSize: Math.round(size * 0.5), fontFamily:"Material Icons", lineHeight:1 }}>image</span>
      </div>
    );
  }
  return (
    <>
      <img src={imgs[0]} alt="" loading="lazy"
        onClick={zoom ? (e) => { e.stopPropagation(); setViewer({ items: imgs, startIndex: 0 }); } : undefined}
        style={{ ...box, objectFit:"cover", border:"1px solid #e5e7eb", cursor: zoom ? "zoom-in" : "default", background:"#fff" }} />
      {viewer && <MediaViewer items={viewer.items} startIndex={viewer.startIndex} onClose={() => setViewer(null)} />}
    </>
  );
}
export default ProductThumb;
