import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Review = sequelize.define('Review', {
  id:        { type: DataTypes.INTEGER,  primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER,  allowNull: false, field: 'product_id' },
  author:    { type: DataTypes.STRING(60), allowNull: false },
  rating:    { type: DataTypes.SMALLINT, allowNull: false },
  comment:   { type: DataTypes.TEXT,     allowNull: false },
}, {
  tableName:   'reviews',
  underscored: true,
});

export default Review;
