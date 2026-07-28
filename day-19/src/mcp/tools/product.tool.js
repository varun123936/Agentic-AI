import { Product } from '../../models/product.model.js';

export const productToolDefinitions = [
  { name: 'search_products', description: 'Search products by name or keyword.',
    parameters: { type:'object', properties: { query: { type:'string' }, maxResults: { type:'number' } }, required:['query'] } },
  { name: 'check_product_stock', description: 'Check if product is in stock and its price.',
    parameters: { type:'object', properties: { productId: { type:'string' } }, required:['productId'] } }
];

export const productToolExecutors = {
  search_products: async ({ query, maxResults=5 }) => {
    try {
      const products = await Product.find({ $text:{ $search:query } }, { score:{ $meta:'textScore' } }).sort({ score:{ $meta:'textScore' } }).limit(maxResults);
      return { success:true, totalFound:products.length, products: products.map(p => ({ productId:p.productId, name:p.name, category:p.category, price:p.price, stock:p.stock, rating:p.rating })) };
    } catch(e) { return { success:false, error:e.message }; }
  },
  check_product_stock: async ({ productId }) => {
    try {
      const p = await Product.findOne({ productId });
      if (!p) return { success:false, error:`Product ${productId} not found.` };
      return { success:true, productId:p.productId, name:p.name, price:p.price, stock:p.stock, inStock:p.stock>0, stockLevel:p.stock>10?'good':p.stock>0?'low':'out_of_stock' };
    } catch(e) { return { success:false, error:e.message }; }
  }
};