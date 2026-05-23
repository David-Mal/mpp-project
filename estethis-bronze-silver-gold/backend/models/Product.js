import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Product = sequelize.define('Product', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:        { type: DataTypes.STRING(80),  allowNull: false },
  category:    { type: DataTypes.STRING(20),  allowNull: false },
  price:       { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock:       { type: DataTypes.INTEGER,     defaultValue: 0,  allowNull: false },
  description: { type: DataTypes.TEXT,        defaultValue: '' },
  image:       { type: DataTypes.STRING(500), defaultValue: '' },
}, {
  tableName:   'products',
  underscored: true,
});

export default Product;
