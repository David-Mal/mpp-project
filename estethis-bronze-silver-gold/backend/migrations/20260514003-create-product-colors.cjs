'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('product_colors', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      product_id: {
        type:       DataTypes.INTEGER,
        allowNull:  false,
        references: { model: 'products', key: 'id' },
        onDelete:   'CASCADE',
      },
      color: { type: DataTypes.STRING(30), allowNull: false },
    });

    await queryInterface.addIndex('product_colors', ['product_id'], { name: 'idx_product_colors_product_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_colors');
  },
};
