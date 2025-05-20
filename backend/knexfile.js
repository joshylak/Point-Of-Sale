module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: 'C:/DB/DB'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    }
  }
};