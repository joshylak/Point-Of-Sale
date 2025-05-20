const { Model } = require('objection');
class Sale extends Model {
  static get tableName() { return 'sales'; }
}
module.exports = Sale;