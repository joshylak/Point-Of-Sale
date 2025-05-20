const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.PG_DATABASE || 'posdb',
  process.env.PG_USER || 'postgres',
  process.env.PG_PASSWORD || 'password',
  {
    host: process.env.PG_HOST || 'localhost',
    dialect: 'postgres',
    logging: false,
  }
);

const Product = require('./Product');
const Inventory = require('./Inventory');
const Sale = require('./Sale');
const User = require('./User');
// ... any other models

module.exports = {
  Product,
  Inventory,
  Sale,
  User,
  // ... any other models
};