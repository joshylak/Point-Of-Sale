const Knex = require('knex');
const { Model } = require('objection');

const knex = Knex({
  client: 'sqlite3',
  connection: {
    filename: 'C:/DB/DB'
  },
  useNullAsDefault: true
});

Model.knex(knex);

async function testConnection() {
  try {
    // Simple query to test connection
    await knex.raw('select 1+1 as result');
    console.log('SQLite connection successful!');
  } catch (err) {
    console.error('SQLite connection failed:', err);
  } finally {
    await knex.destroy();
  }
}

if (require.main === module) {
  testConnection();
}

module.exports = knex;