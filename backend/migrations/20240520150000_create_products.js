exports.up = function(knex) {
  return knex.schema.createTable('products', table => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('description');
    table.string('sku').notNullable().unique();
    table.string('category').notNullable();
    table.float('price').notNullable();
    table.float('cost').notNullable();
    table.float('taxRate').defaultTo(0);
    table.string('barcode');
    table.string('imageUrl');
    table.boolean('isActive').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('products');
};