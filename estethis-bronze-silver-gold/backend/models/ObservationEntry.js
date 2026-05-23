import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// One row per active threat per user.
// resolvedAt=null → still flagged; resolvedAt=<date> → cleared by admin.
const ObservationEntry = sequelize.define('ObservationEntry', {
  id:         { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  userId:     { type: DataTypes.INTEGER,    allowNull: false },
  reason:     { type: DataTypes.STRING(100), allowNull: false },
  details:    { type: DataTypes.TEXT,       allowNull: false },
  resolvedAt: { type: DataTypes.DATE,       allowNull: true, defaultValue: null },
}, {
  tableName:   'observation_list',
  underscored: true,
});

export default ObservationEntry;
