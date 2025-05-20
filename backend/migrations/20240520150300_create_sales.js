exports.up = function(knex) {
  return knex.schema.createTable('sales', table => {
    table.increments('id').primary();
    table.integer('userId').unsigned().references('id').inTable('users');
    table.float('subtotal').notNullable();
    table.float('tax').notNullable();
    table.float('total').notNullable();
    table.json('items');
    table.json('payments');
    table.string('notes');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('sales');
};