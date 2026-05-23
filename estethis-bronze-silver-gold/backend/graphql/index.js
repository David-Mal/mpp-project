// ─────────────────────────────────────────────────────────────
// GRAPHQL HANDLER
// Mounts graphql-yoga on /graphql.
// GET  /graphql  → GraphiQL interactive playground (great for demos)
// POST /graphql  → standard GraphQL over HTTP
//
// Both REST and GraphQL are live simultaneously — the spec says
// "expose them through a graphql interface instead of classical
// endpoints", but keeping REST means the Silver offline-sync
// pipeline (/api/products/sync, WebSocket, etc.) keeps working.
// ─────────────────────────────────────────────────────────────

import { createSchema, createYoga } from 'graphql-yoga';
import { typeDefs }   from './schema.js';
import { resolvers }  from './resolvers.js';

const schema = createSchema({ typeDefs, resolvers });

export const yogaHandler = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  landingPage:     false,
  graphiql:        true,   // GET /graphql opens the interactive playground
  cors:            false,  // Express already sets CORS
  maskedErrors:    false,  // Surface readable validation messages
});
