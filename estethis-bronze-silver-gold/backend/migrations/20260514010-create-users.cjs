'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('users', {
      id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      email:         { type: DataTypes.STRING(150), allowNull: false, unique: true },
      phone:         { type: DataTypes.STRING(20) },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role_id: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'roles', key: 'id' }, onDelete: 'RESTRICT',
      },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('users', ['email'],   { name: 'idx_users_email', unique: true });
    await queryInterface.addIndex('users', ['role_id'], { name: 'idx_users_role_id' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
