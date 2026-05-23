'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('observation_list', {
      id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE',
      },
      reason:      { type: DataTypes.STRING(100), allowNull: false },
      details:     { type: DataTypes.TEXT, allowNull: false },
      resolved_at: { type: DataTypes.DATE, allowNull: true },
      created_at:  { type: DataTypes.DATE, allowNull: false },
      updated_at:  { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('observation_list', ['user_id'],    { name: 'idx_obs_user_id' });
    await queryInterface.addIndex('observation_list', ['resolved_at'], { name: 'idx_obs_resolved_at' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('observation_list');
  },
};
