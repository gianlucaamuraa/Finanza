import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** SSL obbligatorio per i database remoti (Supabase, Neon), disattivato in locale. */
export function sslFor(url: string) {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" ? false : ("require" as const);
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non impostata");
  // prepare: false per compatibilità con i pooler (Supabase/Neon in modalità transaction)
  const pg = postgres(url, { prepare: false, max: 5, ssl: sslFor(url) });
  return drizzle(pg, { schema });
}

type DB = ReturnType<typeof create>;
const g = globalThis as unknown as { finanzaDb?: DB };

/**
 * Connessione creata al primo utilizzo: se DATABASE_URL manca, l'errore
 * arriva solo quando si legge o scrive, non al caricamento dell'app.
 */
export const db = new Proxy({} as DB, {
  get(_, prop) {
    g.finanzaDb ??= create();
    const real = g.finanzaDb;
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
export { schema };
