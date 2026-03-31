import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { id, ...patch } = body;
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const RepairOrder = base44.asServiceRole.entities.RepairOrder;
    const updated = await RepairOrder.update(id, patch);

    return Response.json({ success: true, record: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});