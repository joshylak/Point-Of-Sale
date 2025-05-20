exports.up = function(knex) {
  return knex.schema.createTable('inventory', table => {
    table.increments('id').primary();
    table.integer('productId').unsigned().references('id').inTable('products').onDelete('CASCADE');
    table.integer('quantity').notNullable().defaultTo(0);
    table.string('location');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('inventory');
};