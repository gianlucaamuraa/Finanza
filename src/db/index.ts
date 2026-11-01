import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** SSL obbligatorio per i database remoti (Supabase, Neon), disattivato in locale. */
export function sslFor(url: string) {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" ? false : ("require" as const);
}

const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non impostata");
  // prepare: false per compatibilità con i pooler (Supabase/Neon in modalità transaction)
  return postgres(url, { prepare: false, max: 5, ssl: sslFor(url) });
}

const pg = globalForDb.pg ?? client();
if (process.env.NODE_ENV !== "production") globalForDb.pg = pg;

export const db = drizzle(pg, { schema });
export { schema };
