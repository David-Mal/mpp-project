// ─────────────────────────────────────────────────────────────
// GRAPHQL SCHEMA
// Exposes the SAME data and logic as the REST API through a
// GraphQL interface. Both transports coexist — the frontend can
// choose either (or both).
//
// Gold requirement: "take the same logic and data that you already
// have, but now expose them through a graphql interface instead of
// classical endpoints."
// ─────────────────────────────────────────────────────────────

export const typeDefs = /* GraphQL */ `
  # ── Product ──────────────────────────────────────────────
  type Product {
    id:          Int!
    name:        String!
    category:    String!
    price:       Float!
    stock:       Int!
    colors:      [String!]!
    sizes:       [String!]!
    description: String
    features:    [String!]!
    image:       String
    createdAt:   String!
    updatedAt:   String!
    # 1-to-many: reviews belonging to this product
    reviews(page: Int, limit: Int): ReviewPage!
    reviewStats: ReviewStats!
  }

  type ProductPage {
    data:       [Product!]!
    total:      Int!
    page:       Int!
    limit:      Int!
    totalPages: Int!
    hasMore:    Boolean!
  }

  type ProductStats {
    byCategory:    [CategoryCount!]!
    totalProducts: Int!
    totalStock:    Int!
    totalValue:    Float!
  }

  type CategoryCount {
    category: String!
    count:    Int!
  }

  # ── Review ───────────────────────────────────────────────
  type Review {
    id:        Int!
    productId: Int!
    author:    String!
    rating:    Int!
    comment:   String!
    createdAt: String!
    updatedAt: String!
    product:   Product
  }

  type ReviewPage {
    data:       [Review!]!
    total:      Int!
    page:       Int!
    limit:      Int!
    totalPages: Int!
    hasMore:    Boolean!
  }

  type ReviewStats {
    productId:    Int!
    count:        Int!
    avgRating:    Float!
    distribution: [RatingBucket!]!
  }

  type RatingBucket {
    star:  Int!
    count: Int!
  }

  # ── Generator ────────────────────────────────────────────
  type GeneratorStatus {
    running:        Boolean!
    intervalMs:     Int!
    batchSize:      Int!
    totalGenerated: Int!
    startedAt:      String
  }

  # ── Queries ──────────────────────────────────────────────
  type Query {
    # Products
    products(page: Int, limit: Int, search: String, sort: String): ProductPage!
    product(id: Int!): Product
    productStats: ProductStats!

    # Reviews (1-to-many)
    reviews(productId: Int!, page: Int, limit: Int): ReviewPage!
    review(id: Int!): Review
    reviewStats(productId: Int!): ReviewStats!

    # Generator
    generatorStatus: GeneratorStatus!
  }

  # ── Mutations ────────────────────────────────────────────
  type Mutation {
    # Products
    createProduct(input: ProductInput!): Product!
    updateProduct(id: Int!, input: ProductInput!): Product!
    deleteProduct(id: Int!): Boolean!

    # Reviews
    createReview(productId: Int!, input: ReviewInput!): Review!
    updateReview(id: Int!, input: ReviewInput!): Review!
    deleteReview(id: Int!): Boolean!

    # Generator
    startGenerator(intervalMs: Int, batchSize: Int): GeneratorStatus!
    stopGenerator: GeneratorStatus!
    tickGenerator(batchSize: Int): [Product!]!
  }

  # ── Input types ──────────────────────────────────────────
  input ProductInput {
    name:        String!
    category:    String!
    price:       Float!
    stock:       Int!
    colors:      [String!]!
    sizes:       [String!]!
    description: String
    features:    [String!]
    image:       String
  }

  input ReviewInput {
    author:  String!
    rating:  Int!
    comment: String!
  }
`;
