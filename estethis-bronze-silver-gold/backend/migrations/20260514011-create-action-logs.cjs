'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('action_logs', {
      id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
      },
      group_id:    { type: DataTypes.STRING(20), allowNull: false },
      action_info: { type: DataTypes.TEXT,       allowNull: false },
      created_at:  { type: DataTypes.DATE,       allowNull: false },
    });
    await queryInterface.addIndex('action_logs', ['user_id'],    { name: 'idx_al_user_id' });
    await queryInterface.addIndex('action_logs', ['group_id'],   { name: 'idx_al_group_id' });
    await queryInterface.addIndex('action_logs', ['created_at'], { name: 'idx_al_created_at' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('action_logs');
  },
};
