'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('product_features', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      product_id: {
        type:       DataTypes.INTEGER,
        allowNull:  false,
        references: { model: 'products', key: 'id' },
        onDelete:   'CASCADE',
      },
      feature:    { type: DataTypes.STRING(200), allowNull: false },
      sort_order: { type: DataTypes.INTEGER,     defaultValue: 0 },
    });

    await queryInterface.addIndex('product_features', ['product_id'], { name: 'idx_product_features_product_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_features');
  },
};
