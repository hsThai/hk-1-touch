import React from "react";
import { RepairOrder, logHistory } from "./pb.jsx";

export default function EditOrderModal({ order, users, currentUser, onClose, onSave }) {
  const ISSUES_LIST = ["Màn hình","Pin","Sạc","Camera","Loa","Mic","Nút bấm","Wifi","Bluetooth","IC","Bo mạch","Vỏ máy","Khác"];
  const parseIssues = (raw) => { if (!raw) return []; if (Array.isArray(raw)) return raw; return raw.split(",").map(s => s.trim()).filter(Boolean); };
  const [form, setForm] = React.useState({
    customer_name: order.customer_name||"", customer_phone: order.customer_phone||"",
    device_name: order.device_name||"", device_model: order.device_model||"",
    imei: order.imei||order.imei_serial||"", passcode: order.passcode||"",
    issues: parseIssues(order.issue_description), issue_description: order.issue_description||"",
    technician_note: order.technician_note||"", assigned_to: order.assigned_to||"",
    assigned_to_name: order.assigned_to_name||"", status: order.status||"Cho KTV",
    priority: order.priority||"Thuong",
    estimated_cost: order.estimated_cost!=null?String(order.estimated_cost):"",
    final_cost: order.final_cost!=null?String(order.final_cost):"",
    deposit: order.deposit!=null?String(order.deposit):"",
    warranty_days: order.warranty_days!=null?String(order.warranty_days):"0",
    received_date: order.received_date?order.received_date.substring(0,16):"",
    estimated_done_date: order.estimated_done_date?order.estimated_done_date.substring(0,16):"",
    done_date: order.done_date?order.done_date.substring(0,16):"",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleIssue = (issue) => {
    const next = form.issues.includes(issue) ? form.issues.filter(x=>x!==issue) : [...form.issues, issue];
    setForm(f => ({ ...f, issues: next, issue_description: next.join(", ") }));
  };
  const inp  = { width:"100%", height:46, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box", background:"#fff" };
  const lbl  = { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 };
  const sec  = { background:"#f9fafb", borderRadius:16, padding:16, marginBottom:14 };
  const row2 = { display:"flex", gap:10, marginBottom:10 };
  const techs = (users||[]).filter(u => ["technician","manager","admin"].includes(u.role));
  const STATUS_OPTS = [
    {val:"Chờ KTV",label:"⏳ Chờ KTV"},{val:"KTV Đang Kiểm",label:"🔍 KTV Đang Kiểm"},
    {val:"Chờ Báo Giá",label:"💰 Chờ Báo Giá"},{val:"Chờ Xác Nhận",label:"📋 Chờ Xác Nhận"},
    {val:"Chờ KTV Sửa",label:"🛠️ Chờ KTV Sửa"},{val:"Đang Sửa",label:"🔧 Đang Sửa"},
    {val:"Chờ Linh Kiện",label:"📦 Chờ Linh Kiện"},{val:"Hoàn Thành",label:"✅ Hoàn Thành"},
    {val:"Đã Giao",label:"🏠 Đã Giao"},{val:"Hủy",label:"❌ Hủy"},
  ];
  async function handleSave() {
    if (!form.device_model.trim()&&!form.device_name.trim()) { alert("Vui lòng nhập tên thiết bị!"); return; }
    setSaving(true);
    try {
      const payload = {
        customer_name:form.customer_name, customer_phone:form.customer_phone,
        device_name:form.device_name, device_model:form.device_model,
        imei:form.imei, passcode:form.passcode, issue_description:form.issue_description,
        technician_note:form.technician_note, assigned_to:form.assigned_to,
        assigned_to_name:form.assigned_to_name, status:form.status, priority:form.priority,
        estimated_cost:form.estimated_cost===""?null:Number(form.estimated_cost),
        final_cost:form.final_cost===""?null:Number(form.final_cost),
        deposit:form.deposit===""?null:Number(form.deposit),
        warranty_days:Number(form.warranty_days)||0,
        received_date:form.received_date||null, estimated_done_date:form.estimated_done_date||null,
        done_date:form.done_date||null,
      };
      const pbId = order._id||order.id;
      const updated = await RepairOrder.update(pbId, payload);
      const changes = [];
      if (form.assigned_to!==order.assigned_to) changes.push(`Reassign: ${order.assigned_to_name||"??"} → ${form.assigned_to_name||"??"}`);
      if (form.status!==order.status) changes.push(`Trạng thái: ${order.status} → ${form.status}`);
      logHistory({ order_id:pbId, order_code:order.order_code||order.id,
        action_type:form.assigned_to!==order.assigned_to?"reassigned":form.status!==order.status?"status_changed":"other",
        action_label:"Cập nhật đơn", changed_by_id:currentUser?.id||"",
        changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"",
        old_value:order.status||"", new_value:form.status||"", note:changes.join("; "),
      });
      onSave(updated);
    } catch(e) { alert("Lỗi lưu: "+(e?.message||JSON.stringify(e))); }
    setSaving(false);
  }
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"12px 0 0",overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:22,width:"100%",maxWidth:520,marginBottom:24,boxShadow:"0 24px 64px rgba(0,0,0,.3)"}}>
        <div style={{position:"sticky",top:0,background:"#7c3aed",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:"22px 22px 0 0",zIndex:1}}>
          <div>
            <div style={{color:"#fff",fontWeight:800,fontSize:17}}>✏️ Sửa đơn #{order.order_code||order.id}</div>
            <div style={{color:"rgba(255,255,255,.7)",fontSize:12,marginTop:2}}>{order.device_model} — {order.customer_name}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"16px 16px 8px"}}>
          <div style={{...sec,background:"#f0f9ff"}}>
            <div style={{fontWeight:800,fontSize:14,color:"#0369a1",marginBottom:10}}>👤 Khách Hàng</div>
            <div style={row2}>
              <div style={{flex:2}}><label style={lbl}>Tên khách</label><input value={form.customer_name} onChange={e=>set("customer_name",e.target.value)} style={inp} placeholder="Nguyễn Văn A"/></div>
              <div style={{flex:1}}><label style={lbl}>Số điện thoại</label><input value={form.customer_phone} onChange={e=>set("customer_phone",e.target.value)} inputMode="tel" style={inp} placeholder="09xx..."/></div>
            </div>
          </div>
          <div style={sec}>
            <div style={{fontWeight:800,fontSize:14,color:"#3730a3",marginBottom:10}}>📱 Thiết Bị</div>
            <div style={row2}>
              <div style={{flex:2}}><label style={lbl}>Hãng / Tên máy</label><input value={form.device_name} onChange={e=>set("device_name",e.target.value)} style={inp} placeholder="iPhone, Samsung..."/></div>
              <div style={{flex:2}}><label style={lbl}>Model *</label><input value={form.device_model} onChange={e=>set("device_model",e.target.value)} style={inp} placeholder="iPhone 14 Pro..."/></div>
              <div style={{width:80}}><label style={lbl}>🔑 PIN</label><input value={form.passcode} onChange={e=>set("passcode",e.target.value)} maxLength={8} style={{...inp,width:"100%",textAlign:"center",letterSpacing:3,fontWeight:700}}/></div>
            </div>
            <label style={lbl}>IMEI / Serial</label>
            <input value={form.imei} onChange={e=>set("imei",e.target.value)} inputMode="numeric" style={{...inp,marginBottom:10}} placeholder="15 số IMEI hoặc Serial"/>
            <label style={lbl}>Lỗi khách báo</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
              {ISSUES_LIST.map(issue=>(
                <button key={issue} onClick={()=>toggleIssue(issue)} type="button"
                  style={{padding:"8px 14px",borderRadius:20,border:"1.5px solid",borderColor:form.issues.includes(issue)?"#4f46e5":"#e5e7eb",background:form.issues.includes(issue)?"#eef2ff":"#fff",color:form.issues.includes(issue)?"#4f46e5":"#6b7280",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  {form.issues.includes(issue)?"✓ ":""}{issue}
                </button>
              ))}
            </div>
            <label style={lbl}>Ghi chú kỹ thuật</label>
            <textarea value={form.technician_note} onChange={e=>set("technician_note",e.target.value)} rows={3} style={{...inp,height:"auto",padding:"10px 14px",resize:"vertical"}} placeholder="Tình trạng máy, phụ kiện kèm theo..."/>
          </div>
          {(currentUser?.role!=="receptionist")&&(
          <div style={{...sec,background:"#fdf4ff"}}>
            <div style={{fontWeight:800,fontSize:14,color:"#7c3aed",marginBottom:10}}>🧑‍🔧 Phân công & Trạng thái</div>
            <div style={row2}>
              <div style={{flex:1}}>
                <label style={lbl}>Kỹ thuật viên</label>
                <select value={form.assigned_to} onChange={e=>{const u=techs.find(t=>t.id===e.target.value);set("assigned_to",e.target.value);set("assigned_to_name",u?(u.full_name||u.name||""):"");}} style={inp}>
                  <option value="">-- Chưa phân công --</option>
                  {techs.map(u=><option key={u.id} value={u.id}>{u.full_name||u.name} ({u.role})</option>)}
                </select>
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>Trạng thái</label>
                <select value={form.status} onChange={e=>set("status",e.target.value)} style={inp}>
                  {STATUS_OPTS.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <label style={lbl}>Ưu tiên</label>
            <select value={form.priority} onChange={e=>set("priority",e.target.value)} style={inp}>
              <option value="Thuong">⚪ Bình thường</option>
              <option value="Gap">🔴 Khẩn cấp</option>
              <option value="VIP">⭐ VIP</option>
            </select>
          </div>)}
          <div style={{...sec,background:"#fff7ed"}}>
            <div style={{fontWeight:800,fontSize:14,color:"#c2410c",marginBottom:10}}>📅 Thời Gian</div>
            <div style={row2}>
              <div style={{flex:1}}><label style={lbl}>Ngày nhận</label><input type="datetime-local" value={form.received_date} onChange={e=>set("received_date",e.target.value)} style={inp}/></div>
              <div style={{flex:1}}><label style={lbl}>Dự kiến xong</label><input type="datetime-local" value={form.estimated_done_date} onChange={e=>set("estimated_done_date",e.target.value)} style={inp}/></div>
            </div>
            <label style={lbl}>Ngày hoàn thành thực tế</label>
            <input type="datetime-local" value={form.done_date} onChange={e=>set("done_date",e.target.value)} style={inp}/>
          </div>
          <div style={{...sec,background:"#f0fdf4"}}>
            <div style={{fontWeight:800,fontSize:14,color:"#059669",marginBottom:10}}>💰 Chi Phí</div>
            <div style={row2}>
              <div style={{flex:1}}><label style={lbl}>Dự kiến</label><input value={form.estimated_cost} onChange={e=>set("estimated_cost",e.target.value)} type="number" inputMode="numeric" style={inp} placeholder="0"/></div>
              <div style={{flex:1}}><label style={lbl}>Thực tế</label><input value={form.final_cost} onChange={e=>set("final_cost",e.target.value)} type="number" inputMode="numeric" style={inp} placeholder="0"/></div>
              <div style={{flex:1}}><label style={lbl}>Đặt cọc</label><input value={form.deposit} onChange={e=>set("deposit",e.target.value)} type="number" inputMode="numeric" style={inp} placeholder="0"/></div>
            </div>
            <label style={lbl}>Bảo hành (ngày)</label>
            <input value={form.warranty_days} onChange={e=>set("warranty_days",e.target.value)} type="number" min={0} inputMode="numeric" style={inp}/>
          </div>
        </div>
        <div style={{position:"sticky",bottom:0,background:"#fff",padding:"12px 16px 20px",borderTop:"1px solid #f3f4f6",display:"flex",gap:10}}>
          <button onClick={onClose} type="button" style={{flex:1,height:50,borderRadius:14,border:"1.5px solid #e5e7eb",background:"#fff",color:"#6b7280",fontWeight:700,fontSize:15,cursor:"pointer"}}>Hủy</button>
          <button onClick={handleSave} disabled={saving} type="button" style={{flex:2,height:50,borderRadius:14,border:"none",background:saving?"#a5b4fc":"#7c3aed",color:"#fff",fontWeight:800,fontSize:16,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"⏳ Đang lưu...":"💾 Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}