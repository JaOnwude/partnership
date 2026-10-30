import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createDb(url: string) {
  return drizzle(neon(url), { schema });
}

let db: ReturnType<typeof createDb> | undefined;

// Created on first use so builds and tests work without DATABASE_URL.
export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = createDb(url);
  }
  return db;
}
