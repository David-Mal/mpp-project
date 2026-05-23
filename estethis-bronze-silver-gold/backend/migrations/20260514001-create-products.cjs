'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('products', {
      id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name:        { type: DataTypes.STRING(80),    allowNull: false },
      category:    { type: DataTypes.STRING(20),    allowNull: false },
      price:       { type: DataTypes.DECIMAL(10,2), allowNull: false },
      stock:       { type: DataTypes.INTEGER,       defaultValue: 0, allowNull: false },
      description: { type: DataTypes.TEXT,          defaultValue: '' },
      image:       { type: DataTypes.STRING(500),   defaultValue: '' },
      created_at:  { type: DataTypes.DATE,          allowNull: false },
      updated_at:  { type: DataTypes.DATE,          allowNull: false },
    });

    // Index for fast category filter / stats aggregation
    await queryInterface.addIndex('products', ['category'], { name: 'idx_products_category' });
    await queryInterface.addIndex('products', ['price'],    { name: 'idx_products_price' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('products');
  },
};
