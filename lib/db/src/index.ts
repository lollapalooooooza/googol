import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  console.warn("[AI Studio] DATABASE_URL not set — using mock database");
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async () => ({ rows: [] }),
      release: () => {},
    }),
  } as unknown as pg.Pool;
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: { data?: unknown }) => d?.data ?? {},
    update: async (d: { data?: unknown }) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get: (_, prop) =>
      prop === "query"
        ? new Proxy({}, { get: () => noOp })
        : async () => [],
  });
}

export { pool, db };
export * from "./schema";
