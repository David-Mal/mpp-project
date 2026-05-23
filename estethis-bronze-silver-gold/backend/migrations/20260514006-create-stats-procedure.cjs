'use strict';
// PostgreSQL-only: stored function + update trigger.
// Skipped automatically when dialect is SQLite.

module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;

    // Stored function: returns per-category stats used by getStats()
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION get_product_stats()
      RETURNS TABLE (
        category    TEXT,
        cnt         BIGINT,
        avg_price   NUMERIC,
        total_stock BIGINT,
        total_value NUMERIC
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          p.category::TEXT,
          COUNT(p.id),
          ROUND(AVG(p.price), 2),
          COALESCE(SUM(p.stock), 0)::BIGINT,
          ROUND(CAST(SUM(p.price * p.stock) AS NUMERIC), 2)
        FROM products p
        GROUP BY p.category;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger: propagate updated_at to the parent product whenever
    // its child color / size / feature rows change.
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION touch_product_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE products
           SET updated_at = NOW()
         WHERE id = COALESCE(NEW.product_id, OLD.product_id);
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    for (const tbl of ['product_colors', 'product_sizes', 'product_features']) {
      await queryInterface.sequelize.query(`
        CREATE TRIGGER trg_${tbl}_touch
        AFTER INSERT OR DELETE ON ${tbl}
        FOR EACH ROW EXECUTE FUNCTION touch_product_updated_at();
      `);
    }
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;

    for (const tbl of ['product_colors', 'product_sizes', 'product_features']) {
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS trg_${tbl}_touch ON ${tbl};`
      );
    }
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS touch_product_updated_at CASCADE;');
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS get_product_stats CASCADE;');
  },
};
