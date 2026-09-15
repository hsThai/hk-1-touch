/**
 * ProductImportExportModal.jsx — Nhập/Xuất file Excel cho Danh mục hàng hóa
 * Xuất: toàn bộ hàng hóa hiện có ra .xlsx để sửa thêm/bớt.
 * Nhập: đọc .xlsx/.csv → khớp theo SKU (có SKU thì update, không có/không khớp thì tạo mới)
 *       → tự tạo Danh mục mới nếu tên danh mục trong file chưa tồn tại.
 * @version 2026-09-15-v1
 */
import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { SparePart, ProductCategory, logAction } from "./pb.jsx";

const TEMPLATE_HEADERS = [
  "Tên hàng hóa", "SKU", "Danh mục", "ĐVT", "Giá vốn", "Giá bán lẻ",
  "Giá bán sỉ", "Tồn kho", "IMEI/Serial", "Kích hoạt", "Ghi chú",
];

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || ("cat_" + Date.now());
}

function parseBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (["0", "false", "không", "khong", "ẩn", "an", "no"].includes(s)) return false;
  return true; // mặc định kích hoạt
}

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[.,\s]/g, m => (m === "," ? "." : "")).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export default function ProductImportExportModal({ user, items, categories, catMap, onClose, onImported }) {
  const [mode, setMode] = useState("menu"); // menu | preview | importing | done
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);       // dữ liệu thô parse từ file
  const [errors, setErrors] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [overwriteStock, setOverwriteStock] = useState(false);

  // ── XUẤT FILE ─────────────────────────────────────────────
  function exportExcel() {
    const data = items.map(i => ({
      "Tên hàng hóa": i.name || "",
      "SKU": i.sku || "",
      "Danh mục": catMap[i.category]?.name || i.category || "",
      "ĐVT": i.unit || "Cái",
      "Giá vốn": i.cost_price || 0,
      "Giá bán lẻ": i.retail_price || i.price || 0,
      "Giá bán sỉ": i.wholesale_price || 0,
      "Tồn kho": i.stock_qty || 0,
      "IMEI/Serial": i.serial_imei || "",
      "Kích hoạt": i.is_active !== false ? "Có" : "Không",
      "Ghi chú": i.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: TEMPLATE_HEADERS });
    ws["!cols"] = [
      { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh mục hàng hóa");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `danh-muc-hang-hoa_${stamp}.xlsx`);
  }

  function downloadTemplate() {
    const sample = [{
      "Tên hàng hóa": "Pin iPhone 14 Pro", "SKU": "PIN-IP14P", "Danh mục": "Linh kiện",
      "ĐVT": "Cái", "Giá vốn": 250000, "Giá bán lẻ": 450000, "Giá bán sỉ": 380000,
      "Tồn kho": 10, "IMEI/Serial": "", "Kích hoạt": "Có", "Ghi chú": "",
    }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mẫu nhập hàng hóa");
    XLSX.writeFile(wb, "mau-nhap-danh-muc-hang-hoa.xlsx");
  }

  // ── ĐỌC FILE NHẬP ─────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        processRows(json);
      } catch (err) {
        alert("Không đọc được file. Vui lòng dùng đúng file .xlsx / .csv theo mẫu.\n" + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function processRows(json) {
    const errs = [];
    const skuIndex = {};
    items.forEach(i => { if (i.sku) skuIndex[i.sku.trim().toLowerCase()] = i; });

    const parsed = json.map((r, idx) => {
      const rowNo = idx + 2; // +1 header +1 1-index
      const name = String(r["Tên hàng hóa"] || r["ten hang hoa"] || "").trim();
      const sku = String(r["SKU"] || "").trim();
      const catName = String(r["Danh mục"] || r["Danh muc"] || "").trim();
      const unit = String(r["ĐVT"] || r["DVT"] || "Cái").trim() || "Cái";
      const cost = parseNum(r["Giá vốn"] || r["Gia von"]);
      const retail = parseNum(r["Giá bán lẻ"] || r["Gia ban le"]);
      const wholesale = parseNum(r["Giá bán sỉ"] || r["Gia ban si"]);
      const stock = parseNum(r["Tồn kho"] || r["Ton kho"]);
      const serial = String(r["IMEI/Serial"] || "").trim();
      const active = parseBool(r["Kích hoạt"] || r["Kich hoat"]);
      const note = String(r["Ghi chú"] || r["Ghi chu"] || "").trim();

      if (!name) { errs.push(`Dòng ${rowNo}: thiếu "Tên hàng hóa" — bỏ qua`); return null; }

      const existing = sku ? skuIndex[sku.toLowerCase()] : null;

      return {
        rowNo, name, sku, catName, unit, cost, retail, wholesale, stock,
        serial, active, note, existing,
      };
    }).filter(Boolean);

    setErrors(errs);
    setRows(parsed);
    setMode("preview");
  }

  const summary = useMemo(() => {
    const toCreate = rows.filter(r => !r.existing).length;
    const toUpdate = rows.filter(r => r.existing).length;
    const catNamesInFile = [...new Set(rows.map(r => r.catName).filter(Boolean))];
    const existingCatNames = new Set(categories.map(c => (c.name || "").trim().toLowerCase()));
    const newCats = catNamesInFile.filter(n => !existingCatNames.has(n.trim().toLowerCase()));
    return { toCreate, toUpdate, newCats, total: rows.length };
  }, [rows, categories]);

  // ── THỰC HIỆN NHẬP ────────────────────────────────────────
  async function confirmImport() {
    setBusy(true);
    setMode("importing");
    try {
      // 1) Tạo danh mục mới còn thiếu trước
      const catByName = {};
      categories.forEach(c => { catByName[(c.name || "").trim().toLowerCase()] = c; });
      let sortBase = categories.length;
      for (const catName of summary.newCats) {
        const rec = await ProductCategory.create({
          name: catName, code: slugify(catName), icon: "📦",
          color: "#6366f1", sort_order: ++sortBase, is_active: true,
        });
        catByName[catName.trim().toLowerCase()] = rec;
        logAction(user, "create", "product_category", rec.id, "Tạo danh mục mới (từ nhập file): " + catName);
      }

      // 2) Tạo / cập nhật hàng hóa
      let created = 0, updated = 0, failed = 0;
      for (const r of rows) {
        try {
          const cat = r.catName ? catByName[r.catName.trim().toLowerCase()] : null;
          const payload = {
            name: r.name,
            sku: r.sku,
            category: cat?.code || r.existing?.category || "other",
            unit: r.unit,
            cost_price: r.cost,
            price: r.retail,
            retail_price: r.retail,
            wholesale_price: r.wholesale,
            serial_imei: r.serial,
            is_active: r.active,
            note: r.note,
          };
          if (r.existing) {
            if (overwriteStock) payload.stock_qty = r.stock;
            await SparePart.update(r.existing.id, payload);
            logAction(user, "update", "spare_part", r.existing.id, "Cập nhật hàng hóa (nhập file): " + r.name);
            updated++;
          } else {
            payload.stock_qty = r.stock;
            const rec = await SparePart.create(payload);
            logAction(user, "create", "spare_part", rec.id, "Tạo hàng hóa mới (nhập file): " + r.name);
            created++;
          }
        } catch (e) { failed++; }
      }
      setResult({ created, updated, failed, newCats: summary.newCats.length });
      setMode("done");
      onImported?.();
    } catch (e) {
      alert("Lỗi khi nhập file: " + e.message);
      setMode("preview");
    }
    setBusy(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1200, display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"20px 12px" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:24, width:"min(720px,95vw)", margin:"10px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>📁 Nhập / Xuất file danh mục hàng hóa</div>
          <button onClick={onClose} style={{ border:"none", background:"transparent", fontSize:20, cursor:"pointer", color:"#9ca3af" }}>✕</button>
        </div>

        {mode === "menu" && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>
              Xuất file để chỉnh sửa hàng loạt (thêm/bớt/sửa giá, tồn kho...), rồi nhập lại — hệ thống tự khớp theo <strong>SKU</strong>: có SKU trùng thì cập nhật, không trùng thì tạo hàng mới. Danh mục chưa có trong hệ thống sẽ được tự tạo.
            </div>

            <div style={{ display:"grid", gap:10 }}>
              <button onClick={exportExcel} style={{
                display:"flex", alignItems:"center", gap:10, height:52, borderRadius:14, border:"1.5px solid #c7d2fe",
                background:"#eef2ff", color:"#4338ca", fontWeight:800, fontSize:14, cursor:"pointer", padding:"0 16px",
              }}>
                <span className="material-icons" style={{ fontFamily:"Material Icons" }}>file_download</span>
                Xuất file Excel ({items.length} hàng hóa hiện có)
              </button>

              <label style={{
                display:"flex", alignItems:"center", gap:10, height:52, borderRadius:14, border:"1.5px solid #86efac",
                background:"#f0fdf4", color:"#166534", fontWeight:800, fontSize:14, cursor:"pointer", padding:"0 16px",
              }}>
                <span className="material-icons" style={{ fontFamily:"Material Icons" }}>file_upload</span>
                Nhập file Excel / CSV để thêm hàng loạt
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display:"none" }} />
              </label>

              <button onClick={downloadTemplate} style={{
                display:"flex", alignItems:"center", gap:8, height:40, borderRadius:12, border:"1.5px dashed #d1d5db",
                background:"#fff", color:"#6b7280", fontWeight:700, fontSize:13, cursor:"pointer", padding:"0 16px", justifyContent:"center",
              }}>
                <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:18 }}>description</span>
                Tải file mẫu (trống, có sẵn cột đúng chuẩn)
              </button>
            </div>

            <div style={{ marginTop:16, padding:"10px 14px", background:"#fffbeb", borderRadius:10, fontSize:12, color:"#92400e" }}>
              💡 Cột bắt buộc: <strong>Tên hàng hóa</strong>. Cột "SKU" để trống → luôn tạo hàng mới (không khớp cập nhật). "Kích hoạt" ghi Có/Không.
            </div>
          </div>
        )}

        {mode === "preview" && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:13, color:"#374151", marginBottom:10 }}>
              📄 File: <strong>{fileName}</strong> — đọc được <strong>{summary.total}</strong> dòng hợp lệ
              {errors.length > 0 && <span style={{ color:"#dc2626" }}> ({errors.length} dòng lỗi bị bỏ qua)</span>}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
              <div style={{ background:"#f0fdf4", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontWeight:900, fontSize:20, color:"#059669" }}>{summary.toCreate}</div>
                <div style={{ fontSize:11, color:"#6b7280" }}>Hàng hóa mới</div>
              </div>
              <div style={{ background:"#eff6ff", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontWeight:900, fontSize:20, color:"#2563eb" }}>{summary.toUpdate}</div>
                <div style={{ fontSize:11, color:"#6b7280" }}>Cập nhật (khớp SKU)</div>
              </div>
              <div style={{ background:"#faf5ff", borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontWeight:900, fontSize:20, color:"#7c3aed" }}>{summary.newCats.length}</div>
                <div style={{ fontSize:11, color:"#6b7280" }}>Danh mục mới sẽ tạo</div>
              </div>
            </div>

            {summary.newCats.length > 0 && (
              <div style={{ fontSize:12, color:"#7c3aed", marginBottom:10 }}>
                Danh mục mới: {summary.newCats.join(", ")}
              </div>
            )}

            {errors.length > 0 && (
              <div style={{ fontSize:12, color:"#dc2626", background:"#fef2f2", borderRadius:10, padding:"8px 12px", marginBottom:10, maxHeight:100, overflowY:"auto" }}>
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            {summary.toUpdate > 0 && (
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:12, fontSize:13, color:"#374151" }}>
                <input type="checkbox" checked={overwriteStock} onChange={e=>setOverwriteStock(e.target.checked)}
                  style={{ width:16, height:16, accentColor:"#6366f1" }} />
                Cũng ghi đè tồn kho theo file cho {summary.toUpdate} hàng cập nhật (bỏ qua nếu tồn kho đang được quản lý qua nhập/xuất kho)
              </label>
            )}

            <div style={{ border:"1.5px solid #e5e7eb", borderRadius:12, overflow:"hidden", maxHeight:280, overflowY:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc", position:"sticky", top:0 }}>
                    <th style={{ padding:"6px 10px", textAlign:"left" }}>Tên</th>
                    <th style={{ padding:"6px 10px", textAlign:"left" }}>SKU</th>
                    <th style={{ padding:"6px 10px", textAlign:"left" }}>Danh mục</th>
                    <th style={{ padding:"6px 10px", textAlign:"right" }}>Tồn</th>
                    <th style={{ padding:"6px 10px", textAlign:"center" }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid #f3f4f6" }}>
                      <td style={{ padding:"6px 10px" }}>{r.name}</td>
                      <td style={{ padding:"6px 10px", fontFamily:"monospace" }}>{r.sku || "—"}</td>
                      <td style={{ padding:"6px 10px" }}>{r.catName || "—"}</td>
                      <td style={{ padding:"6px 10px", textAlign:"right" }}>{r.stock}</td>
                      <td style={{ padding:"6px 10px", textAlign:"center" }}>
                        {r.existing
                          ? <span style={{ color:"#2563eb", fontWeight:700 }}>Cập nhật</span>
                          : <span style={{ color:"#059669", fontWeight:700 }}>Mới</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              <button onClick={()=>{ setMode("menu"); setRows([]); setErrors([]); }} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
              <button onClick={confirmImport} disabled={busy || rows.length===0} style={{ flex:2, height:44, borderRadius:12, border:"none", background:"#059669", color:"#fff", fontWeight:800, cursor:"pointer", opacity: busy?0.6:1 }}>
                ✅ Xác nhận nhập {summary.total} hàng hóa
              </button>
            </div>
          </div>
        )}

        {mode === "importing" && (
          <div style={{ textAlign:"center", padding:60, color:"#6b7280" }}>⏳ Đang nhập dữ liệu, vui lòng đợi...</div>
        )}

        {mode === "done" && result && (
          <div style={{ marginTop:16, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
            <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:8 }}>Nhập file hoàn tất!</div>
            <div style={{ fontSize:13, color:"#374151", lineHeight:1.8 }}>
              ✅ Tạo mới: <strong>{result.created}</strong> hàng hóa<br/>
              🔄 Cập nhật: <strong>{result.updated}</strong> hàng hóa<br/>
              {result.newCats > 0 && <>🏷️ Tạo mới: <strong>{result.newCats}</strong> danh mục<br/></>}
              {result.failed > 0 && <span style={{ color:"#dc2626" }}>⚠️ Lỗi: {result.failed} dòng</span>}
            </div>
            <button onClick={onClose} style={{ marginTop:20, height:44, padding:"0 32px", borderRadius:12, border:"none", background:"#6366f1", color:"#fff", fontWeight:800, cursor:"pointer" }}>
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
