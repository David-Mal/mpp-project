import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ProductFeature = sequelize.define('ProductFeature', {
  id:        { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER,     allowNull: false, field: 'product_id' },
  feature:   { type: DataTypes.STRING(200), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER,     defaultValue: 0,  field: 'sort_order' },
}, {
  tableName:   'product_features',
  underscored: true,
  timestamps:  false,
});

export default ProductFeature;
