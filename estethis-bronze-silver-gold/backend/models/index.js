// ─────────────────────────────────────────────────────────────
// MODELS — imports all Sequelize models and wires associations.
// Importing this module is idempotent; associations are set up once.
// ─────────────────────────────────────────────────────────────

import Product        from './Product.js';
import Review         from './Review.js';
import ProductColor   from './ProductColor.js';
import ProductSize    from './ProductSize.js';
import ProductFeature from './ProductFeature.js';
import Role           from './Role.js';
import Permission     from './Permission.js';
import RolePermission from './RolePermission.js';
import User           from './User.js';
import ActionLog         from './ActionLog.js';
import ObservationEntry  from './ObservationEntry.js';
import sequelize         from '../config/database.js';

// ── Product 3NF associations ──────────────────────────────────
Product.hasMany(ProductColor,   { foreignKey: 'product_id', onDelete: 'CASCADE', hooks: true });
ProductColor.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(ProductSize,    { foreignKey: 'product_id', onDelete: 'CASCADE', hooks: true });
ProductSize.belongsTo(Product,  { foreignKey: 'product_id' });

Product.hasMany(ProductFeature,   { foreignKey: 'product_id', onDelete: 'CASCADE', hooks: true });
ProductFeature.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(Review,    { foreignKey: 'product_id', onDelete: 'CASCADE', hooks: true });
Review.belongsTo(Product,  { foreignKey: 'product_id' });

// ── Auth associations ─────────────────────────────────────────
// Role ↔ Permission (many-to-many via RolePermission join table)
Role.belongsToMany(Permission, {
  through: RolePermission, foreignKey: 'role_id', otherKey: 'permission_id',
});
Permission.belongsToMany(Role, {
  through: RolePermission, foreignKey: 'permission_id', otherKey: 'role_id',
});

// User → Role (many Users belong to one Role)
User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(User,   { foreignKey: 'role_id' });

// ActionLog → User
ActionLog.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(ActionLog,   { foreignKey: 'user_id', onDelete: 'CASCADE' });

// ObservationEntry → User
ObservationEntry.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(ObservationEntry,   { foreignKey: 'user_id', onDelete: 'CASCADE' });

export {
  Product, Review, ProductColor, ProductSize, ProductFeature,
  Role, Permission, RolePermission, User, ActionLog, ObservationEntry,
  sequelize,
};
