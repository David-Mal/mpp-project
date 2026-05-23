'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('permissions', {
      id:   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('permissions');
  },
};
