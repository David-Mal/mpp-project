'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('product_sizes', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      product_id: {
        type:       DataTypes.INTEGER,
        allowNull:  false,
        references: { model: 'products', key: 'id' },
        onDelete:   'CASCADE',
      },
      size: { type: DataTypes.STRING(20), allowNull: false },
    });

    await queryInterface.addIndex('product_sizes', ['product_id'], { name: 'idx_product_sizes_product_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_sizes');
  },
};
