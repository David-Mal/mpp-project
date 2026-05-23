// sequelize-cli database config (CommonJS so the CLI can require() it)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  development: {
    dialect:  process.env.DB_DIALECT  || 'sqlite',
    storage:  process.env.DB_STORAGE  || path.resolve(__dirname, '../../estethis.sqlite3'),
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME     || 'estethis_db',
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    logging:  false,
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  },
  production: {
    dialect:  process.env.DB_DIALECT  || 'postgres',
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging:  false,
  },
};
