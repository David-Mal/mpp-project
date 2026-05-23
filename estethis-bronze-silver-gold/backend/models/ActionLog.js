import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Stores every action performed by a logged-in user.
// Fields match the assignment spec:
//   userId     → USER_ID
//   groupId    → GROUP_ID  ('admin' | 'user')
//   actionInfo → ACTION_INFORMATION
//   createdAt  → TIMESTAMP  (auto-set by Sequelize)
const ActionLog = sequelize.define('ActionLog', {
  id:         { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  userId:     { type: DataTypes.INTEGER,    allowNull: false },
  groupId:    { type: DataTypes.STRING(20), allowNull: false },
  actionInfo: { type: DataTypes.TEXT,       allowNull: false },
}, {
  tableName:   'action_logs',
  underscored: true,
  updatedAt:   false,   // only createdAt is meaningful
});

export default ActionLog;
