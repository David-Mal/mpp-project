// ─────────────────────────────────────────────────────────────
// SEQUELIZE INSTANCE
// Dialect selection:
//   NODE_ENV=test  → SQLite :memory: (fast, zero-config)
//   DB_DIALECT=sqlite → file-based SQLite (default dev)
//   DB_DIALECT=postgres → PostgreSQL (production)
// ─────────────────────────────────────────────────────────────

import { Sequelize } from 'sequelize';
import 'dotenv/config';

const isTest    = process.env.NODE_ENV === 'test';
const dialect   = process.env.DB_DIALECT || 'sqlite';
const useSQLite = isTest || dialect === 'sqlite';

let sequelize;

if (useSQLite) {
  sequelize = new Sequelize({
    dialect:  'sqlite',
    storage:  isTest ? ':memory:' : (process.env.DB_STORAGE || './estethis.sqlite3'),
    logging:  false,
  });

  // Foreign-key enforcement is off by default in SQLite;
  // enable it so ON DELETE CASCADE works identically to PostgreSQL.
  sequelize.afterConnect((conn) =>
    new Promise((resolve, reject) =>
      conn.run('PRAGMA foreign_keys = ON', (err) => (err ? reject(err) : resolve()))
    )
  );
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME     || 'estethis_db',
    process.env.DB_USER     || 'postgres',
    process.env.DB_PASSWORD || 'postgres',
    {
      host:    process.env.DB_HOST || 'localhost',
      port:    parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      logging: false,
      dialectOptions: { decimalNumbers: true },
    }
  );
}

export default sequelize;
