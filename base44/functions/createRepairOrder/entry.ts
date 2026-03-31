import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const RepairOrder = base44.asServiceRole.entities.RepairOrder;

    const {
      order_code, customer_name, customer_phone, device_model,
      imei, passcode, qr_code, issue_description, technician_note,
      status, assigned_to, assigned_to_name, assigned_at,
      received_date, images, accept_stage, estimated_cost
    } = body;

    const record = await RepairOrder.create({
      order_code: order_code || "",
      customer_name: customer_name || "",
      customer_phone: customer_phone || "",
      device_model: device_model || "",
      imei: imei || "",
      passcode: passcode || "",
      qr_code: qr_code || "",
      issue_description: issue_description || "[]",
      technician_note: technician_note || "",
      status: status || "Mới Nhận",
      assigned_to: assigned_to || "",
      assigned_to_name: assigned_to_name || "",
      assigned_at: assigned_at || "",
      received_date: received_date || new Date().toISOString(),
      images: images || [],
      accept_stage: accept_stage || 0,
      estimated_cost: estimated_cost || 0,
    });

    return Response.json({ success: true, id: record.id, record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});