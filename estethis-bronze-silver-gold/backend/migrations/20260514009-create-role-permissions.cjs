'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('role_permissions', {
      role_id: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'roles', key: 'id' }, onDelete: 'CASCADE',
      },
      permission_id: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'permissions', key: 'id' }, onDelete: 'CASCADE',
      },
    });
    await queryInterface.addConstraint('role_permissions', {
      fields: ['role_id', 'permission_id'],
      type: 'primary key',
      name: 'pk_role_permissions',
    });
    await queryInterface.addIndex('role_permissions', ['role_id'], { name: 'idx_rp_role_id' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('role_permissions');
  },
};
