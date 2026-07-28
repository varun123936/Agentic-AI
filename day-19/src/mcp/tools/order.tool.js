import { Order } from '../../models/order.model.js';

export const orderToolDefinitions = [
  { name: 'get_order_status', description: 'Get current status and details of a customer order by order ID.',
    parameters: { type:'object', properties: { orderId: { type:'string', description:'Order ID like ORD-1001' } }, required:['orderId'] } },
  { name: 'get_orders_by_customer', description: 'Get all orders for a customer by email.',
    parameters: { type:'object', properties: { customerEmail: { type:'string' }, limit: { type:'number', description:'Max results. Default 5' } }, required:['customerEmail'] } },
  { name: 'cancel_order', description: 'Cancel an order. REQUIRES HUMAN APPROVAL before calling.',
    parameters: { type:'object', properties: { orderId: { type:'string' }, reason: { type:'string' } }, required:['orderId'] } }
];

export const orderToolExecutors = {
  get_order_status: async ({ orderId }) => {
    try {
      const o = await Order.findOne({ orderId: orderId.trim().toUpperCase() });
      if (!o) return { success:false, error:`Order ${orderId} not found.` };
      return { success:true, order: { orderId:o.orderId, status:o.status, paymentStatus:o.paymentStatus, customerName:o.customerName, items:o.items, totalAmount:o.totalAmount, trackingNumber:o.trackingNumber||'Not assigned', estimatedDelivery:o.estimatedDelivery?.toDateString()||'TBD', shippingAddress:o.shippingAddress, createdAt:o.createdAt.toDateString() } };
    } catch(e) { return { success:false, error:e.message }; }
  },
  get_orders_by_customer: async ({ customerEmail, limit=5 }) => {
    try {
      const orders = await Order.find({ customerEmail }).sort({ createdAt:-1 }).limit(limit).select('orderId status totalAmount createdAt items');
      return { success:true, totalFound:orders.length, orders: orders.map(o => ({ orderId:o.orderId, status:o.status, totalAmount:o.totalAmount, itemCount:o.items.length, createdAt:o.createdAt.toDateString() })) };
    } catch(e) { return { success:false, error:e.message }; }
  },
  cancel_order: async ({ orderId, reason }) => {
    try {
      const o = await Order.findOne({ orderId: orderId.trim().toUpperCase() });
      if (!o) return { success:false, error:`Order ${orderId} not found.` };
      if (!['pending','confirmed','processing'].includes(o.status)) return { success:false, error:`Cannot cancel. Status: ${o.status}` };
      o.status = 'cancelled'; o.notes = `Cancelled. Reason: ${reason||'Not specified'}`;
      await o.save();
      return { success:true, message:`Order ${orderId} cancelled.`, refundInfo: o.paymentStatus==='paid'?'Refund in 5-7 days.':'No charge made.' };
    } catch(e) { return { success:false, error:e.message }; }
  }
};