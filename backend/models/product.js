const { Model } = require('objection');
const Inventory = require('./Inventory');

class Product extends Model {
  static get tableName() {
    return 'products';
  }

  static get relationMappings() {
    return {
      inventories: {
        relation: Model.HasManyRelation,
        modelClass: Inventory,
        join: {
          from: 'products.id',
          to: 'inventory.productId'
        }
      }
    };
  }
}

module.exports = Product;