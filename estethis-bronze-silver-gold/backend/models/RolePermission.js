import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Join table: Role ↔ Permission (many-to-many)
// Both fields are the composite PK — primaryKey:true suppresses Sequelize's
// auto-added `id` column and tells findOrCreate which columns identify a row.
const RolePermission = sequelize.define('RolePermission', {
  roleId:       { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
  permissionId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
}, {
  tableName:   'role_permissions',
  underscored: true,
  timestamps:  false,
});

export default RolePermission;
