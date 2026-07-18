import { Order } from '../../models/order.model.js';

export const orderToolDefinitions = [
  {
    name: 'get_order_status',
    description: 'Get current status and details of a customer order by order ID.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID like ORD-1001' }
      },
      required: ['orderId']
    }
  },
  {
    name: 'get_orders_by_customer',
    description: 'Get all orders for a customer by their email address.',
    parameters: {
      type: 'object',
      properties: {
        customerEmail: { type: 'string', description: 'Customer email' },
        limit:         { type: 'number', description: 'Max results. Default 5.' }
      },
      required: ['customerEmail']
    }
  },
  {
    name: 'cancel_order',
    description: 'Cancel an order. REQUIRES HUMAN APPROVAL before calling.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID to cancel' },
        reason:  { type: 'string', description: 'Reason for cancellation' }
      },
      required: ['orderId']
    }
  }
];

export const orderToolExecutors = {

  get_order_status: async ({ orderId }) => {
    try {
      const order = await Order.findOne({ orderId: orderId.trim().toUpperCase() });
      if (!order) return { success: false, error: `Order ${orderId} not found.` };
      return {
        success: true,
        order: {
          orderId: order.orderId, status: order.status,
          paymentStatus: order.paymentStatus,
          customerName: order.customerName, items: order.items,
          totalAmount: order.totalAmount,
          trackingNumber: order.trackingNumber || 'Not assigned',
          estimatedDelivery: order.estimatedDelivery?.toDateString() || 'TBD',
          shippingAddress: order.shippingAddress,
          createdAt: order.createdAt.toDateString(),
          notes: order.notes || null
        }
      };
    } catch (e) { return { success: false, error: e.message }; }
  },

  get_orders_by_customer: async ({ customerEmail, limit = 5 }) => {
    try {
      const orders = await Order.find({ customerEmail })
        .sort({ createdAt: -1 }).limit(limit)
        .select('orderId status totalAmount createdAt items');
      return {
        success: true, totalFound: orders.length,
        orders: orders.map(o => ({
          orderId: o.orderId, status: o.status,
          totalAmount: o.totalAmount, itemCount: o.items.length,
          createdAt: o.createdAt.toDateString()
        }))
      };
    } catch (e) { return { success: false, error: e.message }; }
  },

  cancel_order: async ({ orderId, reason }) => {
    try {
      const order = await Order.findOne({ orderId: orderId.trim().toUpperCase() });
      if (!order) return { success: false, error: `Order ${orderId} not found.` };
      if (!['pending','confirmed','processing'].includes(order.status)) {
        return { success: false, error: `Cannot cancel. Status: ${order.status}` };
      }
      order.status = 'cancelled';
      order.notes  = `Cancelled. Reason: ${reason || 'Not specified'}`;
      await order.save();
      return {
        success: true,
        message: `Order ${orderId} cancelled.`,
        refundInfo: order.paymentStatus === 'paid' ? 'Refund in 5-7 days.' : 'No charge was made.'
      };
    } catch (e) { return { success: false, error: e.message }; }
  }
};