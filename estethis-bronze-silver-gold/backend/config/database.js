// ─────────────────────────────────────────────────────────────
// SEQUELIZE INSTANCE
// Dialect selection:
//   NODE_ENV=test    → SQLite :memory: (fast, zero-config)
//   DB_DIALECT=sqlite → file-based SQLite (default dev)
//   DATABASE_URL      → PostgreSQL via connection string (cloud, e.g. Neon)
//   DB_DIALECT=postgres → PostgreSQL via individual params
// ─────────────────────────────────────────────────────────────

import { Sequelize } from 'sequelize';
import 'dotenv/config';

const isTest    = process.env.NODE_ENV === 'test';
const dialect   = process.env.DB_DIALECT || 'sqlite';
const useSQLite = isTest || (dialect === 'sqlite' && !process.env.DATABASE_URL);

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
} else if (process.env.DATABASE_URL) {
  // Cloud databases (Neon, Supabase, Render Postgres, Railway, etc.)
  // provide a single postgres:// connection string.
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      decimalNumbers: true,
      ssl: { require: true, rejectUnauthorized: false }, // required by most cloud providers
    },
  });
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
