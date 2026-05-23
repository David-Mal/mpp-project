import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProductSize = sequelize.define('ProductSize', {
  id:        { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER,    allowNull: false, field: 'product_id' },
  size:      { type: DataTypes.STRING(20), allowNull: false },
}, {
  tableName:   'product_sizes',
  underscored: true,
  timestamps:  false,
});

export default ProductSize;
