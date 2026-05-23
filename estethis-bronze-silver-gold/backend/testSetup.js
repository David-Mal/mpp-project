// ─────────────────────────────────────────────────────────────
// VITEST SETUP — runs in every worker before the test file.
// Imports models (which registers associations as a side-effect),
// then syncs the SQLite :memory: schema fresh for each worker.
// ─────────────────────────────────────────────────────────────

import { beforeAll, afterAll } from 'vitest';

// Importing models/index.js registers all associations once.
import { sequelize } from './models/index.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});
