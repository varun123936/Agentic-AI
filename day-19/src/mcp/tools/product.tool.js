import { Product } from '../../models/product.model.js';

export const productToolDefinitions = [
  {
    name: 'search_products',
    description: `Search for products in the catalog by name, category, or description.
Use this when a user asks about available products, pricing,
or wants to find something specific.`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term — product name, category, or keyword'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results to return. Default 5.'
        }
      },
      required: ['query']
    }
  },

  {
    name: 'check_product_stock',
    description: `Check if a specific product is in stock and get its current price.
Use when a user asks about product availability or pricing.`,
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The product ID to check'
        }
      },
      required: ['productId']
    }
  }
];

export const productToolExecutors = {

  search_products: async ({ query, maxResults = 5 }) => {
    try {
      const products = await Product.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(maxResults);

      if (products.length === 0) {
        return {
          success: true,
          message: `No products found for "${query}"`,
          products: []
        };
      }

      return {
        success: true,
        totalFound: products.length,
        products: products.map(p => ({
          productId: p.productId,
          name: p.name,
          category: p.category,
          price: p.price,
          stock: p.stock,
          rating: p.rating,
          description: p.description?.substring(0, 100)
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: `Search failed: ${error.message}`
      };
    }
  },

  check_product_stock: async ({ productId }) => {
    try {
      const product = await Product.findOne({ productId });

      if (!product) {
        return {
          success: false,
          error: `Product ${productId} not found.`
        };
      }

      return {
        success: true,
        productId: product.productId,
        name: product.name,
        price: product.price,
        stock: product.stock,
        inStock: product.stock > 0,
        stockLevel: product.stock > 10
          ? 'good' : product.stock > 0
          ? 'low' : 'out_of_stock'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check stock: ${error.message}`
      };
    }
  }
};