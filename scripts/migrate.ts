// Applica le migrazioni e inserisce i dati iniziali (solo se mancanti).
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const DEFAULT_CATEGORIES: [string, string][] = [
  ["Spesa", "shopping-cart"],
  ["Casa e bollette", "lightbulb"],
  ["Trasporti", "fuel"],
  ["Ristoranti e bar", "utensils"],
  ["Shopping", "shopping-bag"],
  ["Abbonamenti", "tv"],
  ["Salute", "pill"],
  ["Svago", "clapperboard"],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[migrate] DATABASE_URL non impostata: migrazione saltata.");
    return;
  }
  const pg = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });

  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();

  const [{ n: nCat }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.categories);
  if (nCat === 0) {
    await db
      .insert(schema.categories)
      .values(DEFAULT_CATEGORIES.map(([name, icon], i) => ({ name, icon, sortOrder: i })));
  }
  const [{ n: nAcc }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.accounts);
  if (nAcc === 0) {
    await db.insert(schema.accounts).values([
      { name: "Conto corrente", kind: "corrente", icon: "landmark", color: "#2563eb", includeInQuota: true, sortOrder: 0 },
      { name: "Contanti", kind: "contanti", icon: "banknote", color: "#db2777", includeInQuota: true, sortOrder: 1 },
    ]);
  }
  console.log("[migrate] Database aggiornato.");
  await pg.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
