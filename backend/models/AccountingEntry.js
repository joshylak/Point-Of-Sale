const { Model } = require('objection');

class AccountingEntry extends Model {
  static get tableName() {
    return 'accounting_entries';
  }
}

module.exports = AccountingEntry;