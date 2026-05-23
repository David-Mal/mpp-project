'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('reviews', {
      id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      product_id: {
        type:       DataTypes.INTEGER,
        allowNull:  false,
        references: { model: 'products', key: 'id' },
        onDelete:   'CASCADE',
      },
      author:     { type: DataTypes.STRING(60), allowNull: false },
      rating:     { type: DataTypes.SMALLINT,   allowNull: false },
      comment:    { type: DataTypes.TEXT,        allowNull: false },
      created_at: { type: DataTypes.DATE,        allowNull: false },
      updated_at: { type: DataTypes.DATE,        allowNull: false },
    });

    await queryInterface.addIndex('reviews', ['product_id'], { name: 'idx_reviews_product_id' });
    await queryInterface.addIndex('reviews', ['rating'],     { name: 'idx_reviews_rating' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reviews');
  },
};
