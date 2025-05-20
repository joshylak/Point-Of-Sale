const { Model } = require('objection');
const Product = require('./Product');

class Inventory extends Model {
  static get tableName() {
    return 'inventory';
  }

  static get relationMappings() {
    return {
      product: {
        relation: Model.BelongsToOneRelation,
        modelClass: Product,
        join: {
          from: 'inventory.productId',
          to: 'products.id'
        }
      }
    };
  }
}

module.exports = Inventory;