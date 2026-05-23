import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id:           { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  email:        { type: DataTypes.STRING(150),  allowNull: false, unique: true },
  phone:        { type: DataTypes.STRING(20) },
  passwordHash: { type: DataTypes.STRING(255),  allowNull: false, field: 'password_hash' },
  roleId:       { type: DataTypes.INTEGER,     allowNull: false,  field: 'role_id' },
}, {
  tableName:   'users',
  underscored: true,
});

export default User;
