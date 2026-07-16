// Order Tool — gives AI the ability to query order data
// This is your Node.js code, NOT the AI
// AI requests a tool call → your code runs this → returns result to AI

import { Order } from '../../models/order.model.js';

// ── Tool Definition ────────────────────────────────────────────
// This is what you send to Gemini so it knows the tool exists
// and how to call it correctly
export const orderToolDefinitions = [
  {
    name: 'get_order_status',
    description: `Get the current status and details of a customer order.
Use this when a user asks about their order status, delivery date,
tracking information, or order details.
Always use this tool when an order ID is mentioned.`,
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'The order ID (e.g. ORD-1234). Extract this from user message.'
        }
      },
      required: ['orderId']
    }
  },

  {
    name: 'get_orders_by_customer',
    description: `Get all orders for a specific customer by their email address.
Use this when a user asks to see all their orders or order history.`,
    parameters: {
      type: 'object',
      properties: {
        customerEmail: {
          type: 'string',
          description: 'The customer email address'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of orders to return. Default is 5.'
        }
      },
      required: ['customerEmail']
    }
  },

  {
    name: 'cancel_order',
    description: `Cancel a pending or confirmed order.
Only use this when the user explicitly asks to cancel an order.
Do NOT cancel unless specifically requested.`,
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'The order ID to cancel'
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation provided by the customer'
        }
      },
      required: ['orderId']
    }
  }
];

// ── Tool Executors ─────────────────────────────────────────────
// These actually run when AI requests a tool call

export const orderToolExecutors = {

  get_order_status: async ({ orderId }) => {
    try {
      const order = await Order.findOne({
        orderId: orderId.trim().toUpperCase()
      });

      if (!order) {
        return {
          success: false,
          error: `Order ${orderId} not found. Please check the order ID.`
        };
      }

      return {
        success: true,
        order: {
          orderId: order.orderId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          customerName: order.customerName,
          items: order.items,
          totalAmount: order.totalAmount,
          trackingNumber: order.trackingNumber || 'Not yet assigned',
          estimatedDelivery: order.estimatedDelivery
            ? order.estimatedDelivery.toDateString()
            : 'Not yet scheduled',
          shippingAddress: order.shippingAddress,
          createdAt: order.createdAt.toDateString(),
          notes: order.notes || null
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch order: ${error.message}`
      };
    }
  },

  get_orders_by_customer: async ({ customerEmail, limit = 5 }) => {
    try {
      const orders = await Order.find({ customerEmail })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('orderId status totalAmount createdAt estimatedDelivery items');

      if (orders.length === 0) {
        return {
          success: true,
          message: `No orders found for ${customerEmail}`,
          orders: []
        };
      }

      return {
        success: true,
        totalFound: orders.length,
        orders: orders.map(o => ({
          orderId: o.orderId,
          status: o.status,
          totalAmount: o.totalAmount,
          itemCount: o.items.length,
          createdAt: o.createdAt.toDateString(),
          estimatedDelivery: o.estimatedDelivery
            ? o.estimatedDelivery.toDateString()
            : 'TBD'
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch orders: ${error.message}`
      };
    }
  },

  cancel_order: async ({ orderId, reason }) => {
    try {
      const order = await Order.findOne({ orderId: orderId.trim().toUpperCase() });

      if (!order) {
        return { success: false, error: `Order ${orderId} not found.` };
      }

      // Business rule — can only cancel certain statuses
      const cancellableStatuses = ['pending', 'confirmed', 'processing'];
      if (!cancellableStatuses.includes(order.status)) {
        return {
          success: false,
          error: `Order ${orderId} cannot be cancelled. Current status: ${order.status}. Only pending, confirmed, or processing orders can be cancelled.`
        };
      }

      order.status = 'cancelled';
      order.notes = `Cancelled by customer. Reason: ${reason || 'Not specified'}`;
      await order.save();

      return {
        success: true,
        message: `Order ${orderId} has been successfully cancelled.`,
        refundInfo: order.paymentStatus === 'paid'
          ? 'A refund will be processed within 5-7 business days.'
          : 'No payment was charged.'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cancel order: ${error.message}`
      };
    }
  }
};