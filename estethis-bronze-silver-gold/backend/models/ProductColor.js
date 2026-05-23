import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProductColor = sequelize.define('ProductColor', {
  id:        { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER,     allowNull: false, field: 'product_id' },
  color:     { type: DataTypes.STRING(30),  allowNull: false },
}, {
  tableName:   'product_colors',
  underscored: true,
  timestamps:  false,
});

export default ProductColor;
