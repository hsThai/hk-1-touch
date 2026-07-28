/* PurchaseOrderPage.jsx — Đặt hàng NCC — HK One Touch */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { PurchaseOrder, PurchaseOrderItem, SparePart, Supplier, logAction } from "./pb.jsx";
import { usePermission } from "./PermissionContext.jsx";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

function genPOCode() {
  const now = new Date();
  const ymd = now.getFullYear().toString() +
    String(now.getMonth()+1).padStart(2,"0") +
    String(now.getDate()).padStart(2,"0");
  return `PO-${ymd}-${String(Math.floor(Math.random()*900)+100)}`;
}

const STATUS_CONFIG = {
  draft:     { label:"Nháp",           color:"#6b7280", bg:"#f3f4f6" },
  confirmed: { label:"Đã xác nhận",    color:"#2563eb", bg:"#eff6ff" },
  partial:   { label:"Nhận một phần",  color:"#d97706", bg:"#fffbeb" },
  received:  { label:"Đã nhận đủ",     color:"#059669", bg:"#f0fdf4" },
  cancelled: { label:"Đã huỷ",         color:"#dc2626", bg:"#fef2f2" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span style={{
      display:"inline-block", padding:"3px 10px", borderRadius:20,
      fontSize:12, fontWeight:600,
      color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.color}30`
    }}>{cfg.label}</span>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
      background:"#1e293b", color:"#fff", padding:"10px 20px", borderRadius:12,
      fontSize:14, fontWeight:600, zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,.3)",
      whiteSpace:"nowrap", pointerEvents:"none"
    }}>{msg}</div>
  );
}


// PortalDropdown: render dropdown ở position:fixed tương đối với input ref
function PortalDropdown({ inputRef, show, children }) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (show && inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, [show, inputRef]);
  if (!show || !rect) return null;
  return (
    <div style={{
      position:"fixed", top:rect.top, left:rect.left, width:rect.width,
      background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
      zIndex:99999, maxHeight:240, overflowY:"auto",
      boxShadow:"0 8px 30px rgba(0,0,0,.18)"
    }}>
      {children}
    </div>
  );
}

function POModal({ user, po, onClose, onSaved, allParts }) {
  const [isPC] = React.useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const isNew = !po;
  const canEdit = isNew || po?.status === "draft" || po?.status === "confirmed";
  const [supplierName,  setSupplierName]  = useState(po?.supplier_name  || "");
  const [supplierPhone, setSupplierPhone] = useState(po?.supplier_phone || "");
  const [orderDate,     setOrderDate]     = useState(po?.order_date     || new Date().toISOString().slice(0,10));
  const [expectedDate,  setExpectedDate]  = useState(po?.expected_date  || "");
  const [note,          setNote]          = useState(po?.note           || "");
  const [items,         setItems]         = useState([]);
  const [saving,        setSaving]        = useState(false);
  const [supplierSearch,    setSupplierSearch]    = useState(po?.supplier_name || "");
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [partSearch,    setPartSearch]    = useState({});
  const [partDropdown,  setPartDropdown]  = useState(null);
  const partInputRefs = useRef({});
  const supplierInputRef = useRef(null);

  useEffect(() => {
    if (po?.id) {
      PurchaseOrderItem.list({ filter:`po_id="${po.id}"`, limit:200 })
        .then(r => setItems((r||[]).map(it => ({
          id: it.id, _saved:true,
          part_id:it.part_id||"", part_name:it.part_name||"", sku:it.sku||"",
          qty_ordered:it.qty_ordered||1, qty_received:it.qty_received||0,
          unit_price:it.unit_price||0, total_price:it.total_price||0, note:it.note||""
        }))))
        .catch(()=>{});
    } else {
      setItems([{ id:Date.now(), part_id:"", part_name:"", sku:"", qty_ordered:1, qty_received:0, unit_price:0, total_price:0, note:"" }]);
    }
  }, [po]);

  // Auto-search supplier khi gõ tên
  useEffect(() => {
    const q = supplierSearch.trim();
    if (q.length < 1) { setSupplierSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await Supplier.list({ limit:200 });
        const filtered = (res||[]).filter(s =>
          s.name?.toLowerCase().includes(q.toLowerCase()) ||
          s.phone?.includes(q)
        ).slice(0,6);
        setSupplierSuggestions(filtered);
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  function addRow() {
    setItems(p => [...p, { id:Date.now(), part_id:"", part_name:"", sku:"", qty_ordered:1, qty_received:0, unit_price:0, total_price:0, note:"" }]);
  }
  function removeRow(id) { setItems(p => p.filter(i => i.id !== id)); }
  function updateRow(id, field, val) {
    setItems(p => p.map(i => {
      if (i.id !== id) return i;
      const upd = { ...i, [field]: val };
      if (field === "qty_ordered" || field === "unit_price")
        upd.total_price = Number(upd.qty_ordered||0) * Number(upd.unit_price||0);
      return upd;
    }));
  }
  function selectPart(rowId, part) {
    setItems(p => p.map(i => {
      if (i.id !== rowId) return i;
      const up = { unit_price: part.price||0 };
      up.total_price = Number(i.qty_ordered||1) * up.unit_price;
      return { ...i, part_id:part.id, part_name:part.name, sku:part.sku||"", ...up };
    }));
    setPartSearch(p => { const n={...p}; delete n[rowId]; return n; });
    setPartDropdown(null);
  }

  const totalValue = items.reduce((s,i) => s + Number(i.total_price||0), 0);

  async function handleSave(asDraft) {
    if (!supplierName.trim()) { alert("Vui lòng nhập tên NCC"); return; }
    if (!items.some(i => i.part_name?.trim())) { alert("Vui lòng thêm ít nhất 1 mặt hàng"); return; }
    setSaving(true);
    try {
      const poCode = po?.po_code || genPOCode();
      const poData = {
        po_code: poCode, supplier_name: supplierName, supplier_phone: supplierPhone,
        order_date: orderDate, expected_date: expectedDate,
        status: asDraft ? "draft" : (po?.status === "confirmed" ? "confirmed" : "confirmed"),
        total_items: items.filter(i=>i.part_name?.trim()).length,
        total_qty: items.reduce((s,i) => s+Number(i.qty_ordered||0), 0),
        total_value: totalValue, note,
        created_by: po?.created_by || user?.id || "",
        created_by_name: po?.created_by_name || user?.full_name || "",
        ...(!asDraft && !po?.confirmed_by ? {
          confirmed_by: user?.id||"", confirmed_by_name: user?.full_name||"",
          confirmed_at: new Date().toISOString().slice(0,10),
        } : {})
      };
      let savedPO;
      if (po?.id) {
        savedPO = await PurchaseOrder.update(po.id, poData);
        const olds = await PurchaseOrderItem.list({ filter:`po_id="${po.id}"`, limit:200 });
        for (const oi of (olds||[])) await PurchaseOrderItem.delete(oi.id).catch(()=>{});
      } else {
        savedPO = await PurchaseOrder.create(poData);
      }
      for (const it of items.filter(i=>i.part_name?.trim())) {
        await PurchaseOrderItem.create({
          po_id:savedPO.id, po_code:poCode, part_id:it.part_id||"", part_name:it.part_name,
          sku:it.sku||"", qty_ordered:Number(it.qty_ordered)||1, qty_received:Number(it.qty_received)||0,
          unit_price:Number(it.unit_price)||0, total_price:Number(it.total_price)||0, note:it.note||""
        });
      }
      logAction(user, po?.id ? "update" : "create_po", "purchase_order", savedPO.id, `${po?.id ? "Sửa" : "Tạo"} PO ${poCode}: ${supplierName} — ${totalValue.toLocaleString("vi-VN")}đ`);
      onSaved?.(); onClose();
    } catch(e) { alert("Lỗi lưu: "+e.message); }
    setSaving(false);
  }

  const inputStyle = (editable) => ({
    width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e5e7eb",
    fontSize:14, boxSizing:"border-box", background:editable?"#fff":"#f9fafb",
    color:"#1e1b4b"
  });

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000,
        display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding: isPC ? "16px 8px 60px" : 0 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:800, boxShadow:"0 20px 60px rgba(0,0,0,.25)", margin:"auto", borderRadius: isPC ? 16 : 0, maxHeight: isPC ? "95vh" : "100vh", overflowY:"auto" }}>
        <div style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius:"16px 16px 0 0", padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:17 }}>
              {isNew ? "🛒 Tạo đơn đặt hàng NCC" : `📋 ${po.po_code}`}
            </div>
            {!isNew && po?.status === "confirmed" && (
              <div style={{color:"rgba(255,255,255,.8)",fontSize:11,marginTop:4,fontStyle:"italic"}}>
                ✏️ Đang chỉnh sửa đơn đã xác nhận (chưa nhập hàng)
              </div>
            )}
            {!isNew && <div style={{marginTop:6}}><StatusBadge status={po.status} /></div>}
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:36, height:36, borderRadius:"50%", cursor:"pointer", fontSize:20, fontWeight:700 }}>×</button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "1fr 1fr" : "1fr", gap:12, marginBottom:14 }}>
            {/* Tên NCC — autocomplete */}
            <div style={{ position:"relative" }}>
              <label style={{fontSize:12,fontWeight:600,color:"#6b7280",display:"block",marginBottom:4}}>Tên NCC *</label>
              <input
                ref={supplierInputRef}
                value={supplierSearch}
                onChange={e => { setSupplierSearch(e.target.value); setSupplierName(e.target.value); setShowSupplierDrop(true); }}
                onFocus={() => setShowSupplierDrop(true)}
                onBlur={() => setTimeout(() => setShowSupplierDrop(false), 180)}
                disabled={!canEdit}
                placeholder="Tên nhà cung cấp..."
                style={inputStyle(canEdit)}
              />
              {canEdit && (
                <PortalDropdown inputRef={supplierInputRef} show={showSupplierDrop && supplierSuggestions.length > 0}>
                  {supplierSuggestions.map(s => (
                    <div key={s.id}
                      onMouseDown={() => {
                        setSupplierName(s.name || "");
                        setSupplierPhone(s.phone || "");
                        setSupplierSearch(s.name || "");
                        setSupplierSuggestions([]);
                        setShowSupplierDrop(false);
                      }}
                      style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6",
                        display:"flex", justifyContent:"space-between", alignItems:"center" }}
                      onMouseEnter={e => e.currentTarget.style.background="#f5f3ff"}
                      onMouseLeave={e => e.currentTarget.style.background="#fff"}
                    >
                      <div style={{fontWeight:700, fontSize:13, color:"#1e1b4b"}}>{s.name}</div>
                      {s.phone && <div style={{fontSize:12, color:"#6b7280"}}>{s.phone}</div>}
                    </div>
                  ))}
                </PortalDropdown>
              )}
            </div>
            {/* SĐT NCC */}
            <div>
              <label style={{fontSize:12,fontWeight:600,color:"#6b7280",display:"block",marginBottom:4}}>SĐT NCC</label>
              <input value={supplierPhone} onChange={e=>setSupplierPhone(e.target.value)} disabled={!canEdit}
                placeholder="Số điện thoại" style={inputStyle(canEdit)} />
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:"#6b7280",display:"block",marginBottom:4}}>Ngày đặt</label>
              <input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)} disabled={!canEdit} style={inputStyle(canEdit)} />
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:"#6b7280",display:"block",marginBottom:4}}>Ngày dự kiến nhận</label>
              <input type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} disabled={!canEdit} style={inputStyle(canEdit)} />
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:"#6b7280",display:"block",marginBottom:4}}>Ghi chú</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} disabled={!canEdit}
              placeholder="Ghi chú..." rows={2}
              style={{...inputStyle(canEdit), resize:"vertical"}} />
          </div>

          {/* Bảng hàng */}
          <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#374151"}}>Danh sách hàng hóa</div>
          {/* Header row — chỉ PC */}
          {isPC && (
            <div style={{display:"flex",background:"#f9fafb",borderBottom:"1.5px solid #e5e7eb",borderRadius:"8px 8px 0 0",padding:"8px 10px",gap:8,fontSize:12,fontWeight:600,color:"#6b7280"}}>
              <div style={{flex:1}}>Tên hàng / SKU</div>
              <div style={{width:70,textAlign:"center"}}>SL đặt</div>
              {!canEdit && <div style={{width:70,textAlign:"center"}}>SL nhận</div>}
              <div style={{width:120,textAlign:"right"}}>Đơn giá</div>
              <div style={{width:120,textAlign:"right"}}>Thành tiền</div>
              {canEdit && <div style={{width:36}}></div>}
            </div>
          )}
          {/* Item rows */}
          {items.map(row => {
            const filteredParts = allParts.filter(p => {
              const q = (partSearch[row.id]||"").toLowerCase();
              return !q || p.name.toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q) || (p.category||"").toLowerCase().includes(q);
            }).slice(0,20);
            return (
              <div key={row.id} style={{
                borderBottom:"1px solid #f3f4f6", padding:"10px 8px",
                display:"flex", flexWrap:"wrap", gap:8, alignItems:"flex-end",
              }}>
                {/* Tên hàng — full width trên mobile, flex:1 trên PC */}
                <div style={{flex:"1 1 100%", minWidth:0, position:"relative"}}>
                  {!isPC && <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",marginBottom:3}}>Tên hàng</div>}
                  {canEdit ? (
                    <>
                      <input
                        ref={el => { partInputRefs.current[row.id] = el; }}
                        value={partDropdown === row.id && partSearch[row.id] !== undefined ? partSearch[row.id] : (partSearch[row.id] || row.part_name || "")}
                        onChange={e=>{
                          setPartSearch(p=>({...p,[row.id]:e.target.value}));
                          updateRow(row.id,"part_name",e.target.value);
                          setPartDropdown(row.id);
                        }}
                        onFocus={()=>setPartDropdown(row.id)}
                        onBlur={()=>setTimeout(()=>setPartDropdown(null),200)}
                        placeholder="Tìm linh kiện hoặc nhập tự do..."
                        style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e5e7eb",fontSize:13,boxSizing:"border-box"}}
                      />
                      {(() => {
                        const q = (partSearch[row.id]||"").toLowerCase();
                        const showDrop = partDropdown===row.id && (filteredParts.length>0 || !q);
                        const grouped = {};
                        (q ? filteredParts : allParts.slice(0,80)).forEach(p => {
                          const cat = p.category || "Khác";
                          if (!grouped[cat]) grouped[cat] = [];
                          grouped[cat].push(p);
                        });
                        const cats = Object.keys(grouped).sort();
                        const rowRef = { current: partInputRefs.current[row.id] };
                        return (
                          <PortalDropdown inputRef={rowRef} show={showDrop && cats.length>0}>
                            {!q && (
                              <div style={{padding:"7px 12px",fontSize:11,color:"#9ca3af",fontWeight:700,borderBottom:"1px solid #f3f4f6",background:"#f9fafb",letterSpacing:".5px"}}>
                                📦 CHỌN THEO DANH MỤC
                              </div>
                            )}
                            {cats.map(cat => (
                              <div key={cat}>
                                <div style={{padding:"5px 12px",fontSize:11,fontWeight:800,color:"#4f46e5",background:"#f5f3ff",borderBottom:"1px solid #ede9fe",letterSpacing:".3px"}}>
                                  {cat.toUpperCase()} ({grouped[cat].length})
                                </div>
                                {grouped[cat].map(p=>(
                                  <div key={p.id} onMouseDown={()=>selectPart(row.id,p)}
                                    style={{padding:"8px 14px",cursor:"pointer",borderBottom:"1px solid #f9f9f9",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}
                                    onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
                                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                                    <div>
                                      <span style={{fontWeight:700,color:"#1e1b4b"}}>{p.name}</span>
                                      {p.sku&&<span style={{fontSize:11,color:"#9ca3af",marginLeft:6}}>SKU: {p.sku}</span>}
                                    </div>
                                    {p.price>0 && <span style={{fontSize:12,color:"#059669",fontWeight:700}}>{p.price.toLocaleString("vi-VN")}đ</span>}
                                  </div>
                                ))}
                              </div>
                            ))}
                            {q && filteredParts.length===0 && (
                              <div style={{padding:"10px 14px",color:"#9ca3af",fontSize:13,textAlign:"center"}}>Không tìm thấy linh kiện</div>
                            )}
                          </PortalDropdown>
                        );
                      })()}
                    </>
                  ) : (
                    <div>
                      <div style={{fontWeight:600}}>{row.part_name}</div>
                      {row.sku&&<div style={{fontSize:11,color:"#9ca3af"}}>SKU: {row.sku}</div>}
                    </div>
                  )}
                </div>
                {/* SL đặt */}
                <div style={{flex:"0 0 auto"}}>
                  {!isPC && <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",marginBottom:3,textAlign:"center"}}>SL</div>}
                  {canEdit
                    ? <input type="number" min={1} value={row.qty_ordered} onChange={e=>updateRow(row.id,"qty_ordered",Number(e.target.value))}
                        style={{width:70,padding:"7px 8px",borderRadius:7,border:"1.5px solid #e5e7eb",fontSize:13,textAlign:"center",boxSizing:"border-box"}} />
                    : <div style={{textAlign:"center",fontWeight:700,padding:"7px 0"}}>{row.qty_ordered}</div>}
                </div>
                {/* SL nhận — chỉ view mode */}
                {!canEdit && (
                  <div style={{flex:"0 0 auto"}}>
                    {!isPC && <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",marginBottom:3,textAlign:"center"}}>Nhận</div>}
                    <div style={{textAlign:"center",fontWeight:700,padding:"7px 0",color:row.qty_received>=row.qty_ordered?"#059669":row.qty_received>0?"#d97706":"#6b7280",width:70}}>
                      {row.qty_received||0}
                    </div>
                  </div>
                )}
                {/* Đơn giá */}
                <div style={{flex:"1 1 120px",minWidth:90}}>
                  {!isPC && <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",marginBottom:3,textAlign:"right"}}>Đơn giá</div>}
                  {canEdit
                    ? <input
                        type="text"
                        inputMode="numeric"
                        value={(row.unit_price||0).toLocaleString("vi-VN")}
                        onChange={e=>{
                          const raw = e.target.value.replace(/[^0-9]/g,"");
                          updateRow(row.id,"unit_price", raw ? Number(raw) : 0);
                        }}
                        style={{width:"100%",padding:"7px 8px",borderRadius:7,border:"1.5px solid #e5e7eb",fontSize:13,textAlign:"right",boxSizing:"border-box"}}
                      />
                    : <div style={{textAlign:"right",padding:"7px 0"}}>{(row.unit_price||0).toLocaleString("vi-VN")}</div>}
                </div>
                {/* Thành tiền + nút xóa cùng hàng */}
                <div style={{flex:"1 1 120px",minWidth:100,display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                  <div style={{flex:1}}>
                    {!isPC && <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",marginBottom:3,textAlign:"right"}}>Thành tiền</div>}
                    <div style={{textAlign:"right",fontWeight:700,color:"#4f46e5",padding:"7px 0",fontSize:13}}>
                      {(row.total_price||0).toLocaleString("vi-VN")}đ
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={()=>removeRow(row.id)}
                      style={{width:30,height:30,border:"none",background:"#fef2f2",color:"#dc2626",borderRadius:"50%",cursor:"pointer",fontSize:16,fontWeight:700,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {canEdit && (
            <button onClick={addRow} style={{marginTop:10,padding:"7px 16px",borderRadius:8,border:"1.5px dashed #a78bfa",background:"#f5f3ff",color:"#7c3aed",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              + Thêm hàng
            </button>
          )}
          <div style={{marginTop:16,padding:"12px 16px",background:"#f5f3ff",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:14,fontWeight:600,color:"#374151"}}>Tổng giá trị đặt hàng</span>
            <span style={{fontSize:18,fontWeight:800,color:"#4f46e5"}}>{totalValue.toLocaleString("vi-VN")}đ</span>
          </div>

          {/* Phần C: Đối chiếu */}
          {!canEdit && ["partial","received"].includes(po?.status) && items.length>0 && (
            <div style={{marginTop:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#374151"}}>📊 Đối chiếu Đặt — Nhận</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"#f9fafb"}}>
                      {["Tên hàng","Đặt","Nhận","Chênh lệch","Trạng thái"].map(h=>(
                        <th key={h} style={{padding:"8px 10px",textAlign:h==="Tên hàng"?"left":"center",fontWeight:600,color:"#6b7280",borderBottom:"1.5px solid #e5e7eb"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(row=>{
                      const diff = (row.qty_received||0)-(row.qty_ordered||0);
                      return (
                        <tr key={row.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                          <td style={{padding:"8px 10px",fontWeight:600}}>{row.part_name}</td>
                          <td style={{padding:"8px 10px",textAlign:"center"}}>{row.qty_ordered}</td>
                          <td style={{padding:"8px 10px",textAlign:"center",fontWeight:700}}>{row.qty_received||0}</td>
                          <td style={{padding:"8px 10px",textAlign:"center"}}>
                            <span style={{padding:"2px 10px",borderRadius:12,
                              background:diff<0?"#fef2f2":"#f0fdf4",
                              color:diff<0?"#dc2626":"#059669",fontWeight:700}}>
                              {diff>=0?"+":""}{diff}
                            </span>
                          </td>
                          <td style={{padding:"8px 10px",textAlign:"center",fontWeight:700}}>
                            {diff===0?<span style={{color:"#059669"}}>✅ Đủ</span>
                              :diff<0?<span style={{color:"#dc2626"}}>⚠️ Thiếu</span>
                              :<span style={{color:"#059669"}}>✅ Dư</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{marginTop:20,display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
            <button onClick={onClose} disabled={saving}
              style={{padding:"10px 20px",borderRadius:10,border:"1.5px solid #e5e7eb",background:"#f9fafb",color:"#374151",fontSize:14,fontWeight:600,cursor:"pointer"}}>
              Đóng
            </button>
            {canEdit && <>
              <button onClick={()=>handleSave(true)} disabled={saving}
                style={{padding:"10px 20px",borderRadius:10,border:"1.5px solid #6366f1",background:"#eef2ff",color:"#4f46e5",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {saving?"⏳...":(po?.status==="confirmed"?"↩️ Huỷ xác nhận":"💾 Lưu nháp")}
              </button>
              <button onClick={()=>handleSave(false)} disabled={saving}
                style={{padding:"10px 24px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 8px rgba(79,70,229,.4)"}}>
                {saving?"⏳...":(po?.status==="confirmed"?"💾 Lưu thay đổi":"✅ Xác nhận đặt hàng")}
              </button>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrderPage({ user }) {

  const { can } = usePermission();
  const canCreatePO = can("purchase_order","create");
  const canEditPO = can("purchase_order","edit");
  const canDeletePO = can("purchase_order","delete");
  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [selectedPO,   setSelectedPO]   = useState(null);
  const [toast,        setToast]        = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterNCC,    setFilterNCC]    = useState("");
  const [allParts,     setAllParts]     = useState([]);

  const canManage = ["owner","admin","manager","supervisor"].includes(user?.role);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""),3000); };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try { setOrders(await PurchaseOrder.list({ sort:"-id", limit:100 }) || []); }
    catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    SparePart.list({ limit:1000 })
      .then(r => setAllParts((r||[]).map(p=>({ id:p.id, name:p.name, sku:p.sku||"", price:p.price||0, category:p.category||"" }))))
      .catch(()=>{});
  }, []);

  const filtered = orders.filter(o =>
    (filterStatus==="all" || o.status===filterStatus) &&
    (!filterNCC || o.supplier_name?.toLowerCase().includes(filterNCC.toLowerCase()))
  );

  async function handleDelete(po, e) {
    e.stopPropagation();
    if (po.status === "partial" || po.status === "received") {
      window.alert("Không thể xoá đơn đã nhập hàng!");
      return;
    }
    if (!window.confirm(`Xoá đơn ${po.po_code}? Hành động này không thể hoàn tác.`)) return;
    try {
      const olds = await PurchaseOrderItem.list({ filter:`po_id="${po.id}"`, limit:200 });
      for (const oi of (olds||[])) await PurchaseOrderItem.delete(oi.id).catch(()=>{});
      await PurchaseOrder.delete(po.id);
      logAction(user, "delete", "purchase_order", po.id, `Xóa PO ${po.po_code}: ${po.supplier_name||""}`);
      showToast("✅ Đã xoá"); loadOrders();
    } catch(e) { showToast("❌ Lỗi: "+e.message); }
  }

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: isPC ? 1200 : "100%", margin:"0 auto" }}>
      <Toast msg={toast} />

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:"#1e1b4b"}}>🛒 Đặt hàng NCC</div>
          <div style={{fontSize:13,color:"#6b7280",marginTop:2}}>Quản lý đơn đặt hàng nhà cung cấp</div>
        </div>
        {canManage && (
          <button onClick={()=>{setSelectedPO(null);setShowModal(true);}}
            style={{padding:"10px 20px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",boxShadow:"0 2px 8px rgba(79,70,229,.35)"}}>
            + Tạo đơn đặt hàng
          </button>
        )}
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #e5e7eb",fontSize:13,background:"#fff"}}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={filterNCC} onChange={e=>setFilterNCC(e.target.value)}
          placeholder="🔍 Tìm theo tên NCC..."
          style={{padding:"8px 14px",borderRadius:8,border:"1.5px solid #e5e7eb",fontSize:13,minWidth:200}} />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:18}}>
        {Object.entries(STATUS_CONFIG).map(([k,v])=>{
          const cnt = orders.filter(o=>o.status===k).length;
          return (
            <div key={k} onClick={()=>setFilterStatus(filterStatus===k?"all":k)}
              style={{background:filterStatus===k?v.bg:"#fff",border:`1.5px solid ${v.color}${filterStatus===k?"":"30"}`,
                borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all .15s"}}>
              <div style={{fontSize:22,fontWeight:800,color:v.color}}>{cnt}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{v.label}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>⏳ Đang tải...</div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>
          <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:48,display:"block",marginBottom:8}}>shopping_cart</span>
          <div style={{fontSize:15,fontWeight:600}}>Chưa có đơn đặt hàng</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(po=>(
            <div key={po.id}
              style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:14,padding:"14px 16px",cursor:"pointer",
                transition:"box-shadow .15s",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.1)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.05)"}
              onClick={()=>{setSelectedPO(po);setShowModal(true);}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:800,fontSize:15,color:"#1e1b4b"}}>{po.po_code}</span>
                    <StatusBadge status={po.status} />
                  </div>
                  <div style={{fontSize:13,color:"#374151",fontWeight:600}}>{po.supplier_name}</div>
                  {po.supplier_phone && <div style={{fontSize:12,color:"#6b7280"}}>{po.supplier_phone}</div>}
                  <div style={{fontSize:12,color:"#9ca3af",marginTop:3}}>
                    Đặt: {fmtDate(po.order_date)}
                    {po.expected_date && ` · Dự kiến: ${fmtDate(po.expected_date)}`}
                    {` · ${po.total_items||0} loại · SL: ${po.total_qty||0}`}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#4f46e5"}}>{fmt(po.total_value)}</div>
                  {canManage && (po.status==="draft" || po.status==="confirmed") && (
                    <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
                      <button onClick={e=>{e.stopPropagation();setSelectedPO(po);setShowModal(true);}}
                        style={{padding:"4px 10px",borderRadius:6,border:"1px solid #a78bfa",background:"#f5f3ff",color:"#7c3aed",fontSize:12,cursor:"pointer",fontWeight:600}}>
                        ✏️ Sửa
                      </button>
                      <button onClick={e=>handleDelete(po,e)} disabled={!canDeletePO}
                        style={{padding:"4px 10px",borderRadius:6,border:"1px solid #fca5a5",background:"#fef2f2",color:"#dc2626",fontSize:12,cursor:"pointer",fontWeight:600}}>
                        Xoá
                    </button>
                    </div>
                  )}
                </div>
              </div>
              {po.note && <div style={{marginTop:8,fontSize:12,color:"#6b7280",fontStyle:"italic",borderTop:"1px solid #f3f4f6",paddingTop:6}}>📝 {po.note}</div>}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <POModal user={user} po={selectedPO} allParts={allParts}
          onClose={()=>{setShowModal(false);setSelectedPO(null);}}
          onSaved={()=>{showToast("✅ Đã lưu đơn đặt hàng");loadOrders();}} />
      )}
    </div>
  );
}
