const Knex = require('knex');

const knex = Knex({
  client: 'sqlite3',
  connection: {
    filename: 'C:/DB/DB'
  },
  useNullAsDefault: true
});

async function testConnection() {
  try {
    await knex.raw('select 1+1 as result');
    console.log('SQLite connection successful!');
  } catch (err) {
    console.error('SQLite connection failed:', err);
  } finally {
    await knex.destroy();
  }
}

testConnection();