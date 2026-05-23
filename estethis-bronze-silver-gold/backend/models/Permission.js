import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Permission = sequelize.define('Permission', {
  id:   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
}, {
  tableName:  'permissions',
  underscored: true,
  timestamps:  false,
});

export default Permission;
