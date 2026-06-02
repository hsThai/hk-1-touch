/**
 * RMAPage.jsx — Trả hàng NCC (Return Merchandise Authorization)
 * @version 2026-06-01-v1
 * Cho phép ghi nhận và theo dõi linh kiện trả lại nhà cung cấp (DOA, lỗi, sai spec)
 */
import React, { useState, useEffect } from "react";
import { SparePart, StockLedger, Supplier } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("vi-VN");
}

const STATUS_COLORS = {
  pending:   { bg:"#fef3c7", color:"#d97706", label:"⏳ Chờ trả"       },
  shipped:   { bg:"#dbeafe", color:"#2563eb", label:"📦 Đã gửi"        },
  received:  { bg:"#d1fae5", color:"#059669", label:"✅ NCC nhận"       },
  replaced:  { bg:"#ede9fe", color:"#7c3aed", label:"🔄 Đã đổi"        },
  refunded:  { bg:"#fce7f3", color:"#be185d", label:"💰 Đã hoàn tiền"  },
  cancelled: { bg:"#f3f4f6", color:"#6b7280", label:"❌ Huỷ"            },
};

const REASONS = [
  { key:"doa",     label:"DOA — Hàng chết khi nhận"  },
  { key:"wrong",   label:"Sai linh kiện / model"       },
  { key:"defect",  label:"Lỗi sản xuất"                },
  { key:"expired", label:"Hết hạn bảo hành"            },
  { key:"other",   label:"Lý do khác"                  },
];

// ── Form tạo RMA mới ─────────────────────────────────────
function CreateRMAModal({ user, suppliers, spareParts, onClose, onCreated }) {
  const [form, setForm] = useState({
    supplier_id:     "",
    part_id:         "",
    qty:             1,
    reason:          "doa",
    note:            "",
    expected_return: "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.supplier_id)          { setErr("Chọn nhà cung cấp"); return; }
    if (!form.part_id)              { setErr("Chọn linh kiện"); return; }
    if (!form.qty || form.qty < 1)  { setErr("Số lượng phải ≥ 1"); return; }
    setSaving(true);
    setErr("");
    try {
      const part     = spareParts.find(p => p.id === form.part_id);
      const supplier = suppliers.find(s => s.id === form.supplier_id);
      const reasonLabel = REASONS.find(r => r.key === form.reason)?.label || form.reason;
      const noteText = `RMA → ${supplier?.name || "NCC"}: ${reasonLabel}${form.note ? ". " + form.note : ""}${form.expected_return ? " | Dự kiến: " + form.expected_return : ""}`;

      await StockLedger.create({
        part_id:      form.part_id,
        part_name:    part?.name || "",
        qty:         -Math.abs(Number(form.qty)),
        txn_type:    "rma_out",
        note:         noteText,
        created_by:   user?.id || "",
        ref_type:    "rma",
        warehouse_id: part?.warehouse_id || "",
        sku:          part?.sku || "",
        category:     part?.category || "",
        unit:         part?.unit || "",
      });

      onCreated?.();
      onClose();
    } catch(e) {
      setErr(e.message || "Lỗi tạo phiếu RMA");
    }
    setSaving(false);
  }

  const INP = {
    width:"100%", border:"1.5px solid #e5e7eb", borderRadius:8,
    padding:"8px 10px", fontSize:14, marginBottom:12, marginTop:4,
    outline:"none", boxSizing:"border-box", background:"#fff",
  };
  const LBL = { fontSize:13, fontWeight:700, color:"#374151" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:900,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, padding:24, width:"100%",
        maxWidth:480, maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontWeight:900, fontSize:17, color:"#1e1b4b" }}>
            📦 Tạo phiếu trả hàng NCC
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", border:"none",
            background:"#f3f4f6", cursor:"pointer", fontSize:16, lineHeight:1 }}>✕</button>
        </div>

        {err && (
          <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8,
            padding:"8px 12px", marginBottom:12, fontSize:13 }}>{err}</div>
        )}

        {/* NCC */}
        <label style={LBL}>Nhà cung cấp *</label>
        <select value={form.supplier_id} onChange={e => set("supplier_id", e.target.value)} style={INP}>
          <option value="">— Chọn NCC —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name || s.full_name}</option>)}
        </select>

        {/* Linh kiện */}
        <label style={LBL}>Linh kiện *</label>
        <select value={form.part_id} onChange={e => set("part_id", e.target.value)} style={INP}>
          <option value="">— Chọn linh kiện —</option>
          {spareParts.map(p => (
            <option key={p.id} value={p.id}>{p.name} {p.sku ? `— ${p.sku}` : ""}</option>
          ))}
        </select>

        {/* Số lượng */}
        <label style={LBL}>Số lượng *</label>
        <input type="number" min={1} value={form.qty}
          onChange={e => set("qty", parseInt(e.target.value) || 1)} style={INP} />

        {/* Lý do */}
        <label style={LBL}>Lý do trả *</label>
        <select value={form.reason} onChange={e => set("reason", e.target.value)} style={INP}>
          {REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>

        {/* Ngày dự kiến nhận lại */}
        <label style={LBL}>Ngày dự kiến nhận lại / hoàn tiền</label>
        <input type="date" value={form.expected_return}
          onChange={e => set("expected_return", e.target.value)} style={INP} />

        {/* Ghi chú */}
        <label style={LBL}>Ghi chú thêm</label>
        <textarea rows={3} value={form.note}
          onChange={e => set("note", e.target.value)}
          placeholder="Số lot, thông tin thêm..."
          style={{ ...INP, height:"auto", padding:"8px 10px", resize:"vertical", marginBottom:20 }} />

        <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
          <button onClick={onClose} disabled={saving}
            style={{ background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10,
              padding:"10px 20px", fontWeight:700, cursor:"pointer" }}>
            Huỷ
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:10,
              padding:"10px 24px", fontWeight:700, cursor:"pointer" }}>
            {saving ? "⏳ Đang lưu..." : "✅ Tạo phiếu RMA"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────
export default function RMAPage({ user }) {
  const [ledgers,   setLedgers]   = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [parts,     setParts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search,    setSearch]    = useState("");

  async function load() {
    setLoading(true);
    try {
      const [led, sup, prt] = await Promise.allSettled([
        StockLedger.list({ filter: 'txn_type="rma_out"', sort:"-id", limit:200 }),
        Supplier.list({ sort:"name", limit:200 }),
        SparePart.list({ sort:"name", limit:500 }),
      ]);
      setLedgers(led.status==="fulfilled" ? (led.value || []) : []);
      setSuppliers(sup.status==="fulfilled" ? (sup.value || []) : []);
      setParts(prt.status==="fulfilled" ? (prt.value || []) : []);
    } catch(e) {
      console.error("RMAPage load:", e);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const stats = {
    total: ledgers.length,
    qty:   ledgers.reduce((a, l) => a + Math.abs(l.qty || 0), 0),
  };

  const filtered = ledgers.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.part_name||"").toLowerCase().includes(q)
        || (l.note||"").toLowerCase().includes(q)
        || (l.sku||"").toLowerCase().includes(q);
  });

  const canCreate = ["owner","admin","manager","warehouse","team_leader"].includes(user?.role);

  return (
    <div style={{ padding:"16px 14px 80px", maxWidth:960, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b" }}>📦 Trả hàng NCC (RMA)</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>
            Ghi nhận linh kiện lỗi DOA, sai spec — theo dõi đổi trả / hoàn tiền
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:12,
              padding:"10px 20px", fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", gap:8 }}>
            <span className="material-icons" style={{ fontSize:18, fontFamily:"Material Icons" }}>add</span>
            Tạo phiếu RMA
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        {[
          { label:"Tổng phiếu",   val:stats.total,       icon:"receipt_long", color:"#4f46e5", bg:"#eef2ff" },
          { label:"Tổng SL trả",  val:stats.qty + " cái", icon:"inventory_2",  color:"#dc2626", bg:"#fee2e2" },
          { label:"Nhà cung cấp", val:suppliers.length,   icon:"storefront",   color:"#059669", bg:"#d1fae5" },
        ].map(s => (
          <div key={s.label} style={{ flex:"1 1 120px", background:s.bg, borderRadius:14,
            padding:"14px 16px", minWidth:110, border:"1.5px solid #e5e7eb" }}>
            <span className="material-icons" style={{ fontSize:22, color:s.color, fontFamily:"Material Icons" }}>
              {s.icon}
            </span>
            <div style={{ fontWeight:900, fontSize:20, color:s.color, marginTop:4 }}>{s.val}</div>
            <div style={{ fontSize:12, color:s.color, opacity:.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        placeholder="🔍 Tìm linh kiện, SKU, ghi chú..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:10,
          padding:"9px 14px", fontSize:14, marginBottom:16, outline:"none", boxSizing:"border-box" }}
      />

      {/* Danh sách */}
      {loading ? (
        <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:60 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ color:"#6b7280", fontSize:15, fontWeight:600 }}>
            {search ? "Không tìm thấy kết quả" : "Chưa có phiếu RMA nào"}
          </div>
          {canCreate && !search && (
            <button onClick={() => setShowCreate(true)}
              style={{ marginTop:16, background:"#4f46e5", color:"#fff", border:"none",
                borderRadius:10, padding:"10px 24px", fontWeight:700, cursor:"pointer" }}>
              + Tạo phiếu đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div style={{ background:"#fff", borderRadius:14, overflow:"hidden",
          border:"1.5px solid #e5e7eb", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc", borderBottom:"1.5px solid #e5e7eb" }}>
                {["Ngày","Linh kiện","SKU","SL trả","Lý do / Ghi chú","Người tạo"].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:12,
                    fontWeight:800, color:"#374151", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, idx) => (
                <tr key={l.id} style={{ borderBottom:"1px solid #f3f4f6",
                  background: idx%2===0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding:"10px 14px", fontSize:13, color:"#6b7280", whiteSpace:"nowrap" }}>
                    {fmtDate(l.created)}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:13, fontWeight:600, color:"#1e1b4b" }}>
                    {l.part_name || "—"}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:12, color:"#9ca3af", fontFamily:"monospace" }}>
                    {l.sku || "—"}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:14, color:"#dc2626", fontWeight:700 }}>
                    {Math.abs(l.qty || 0)}
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:12, color:"#374151", maxWidth:280 }}>
                    <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:280 }}>
                      {l.note || "—"}
                    </div>
                  </td>
                  <td style={{ padding:"10px 14px", fontSize:12, color:"#6b7280" }}>
                    {l.created_by || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal tạo */}
      {showCreate && (
        <CreateRMAModal
          user={user}
          suppliers={suppliers}
          spareParts={parts}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
