import "server-only";
import postgres from "postgres";

/**
 * Controlla la configurazione (variabili d'ambiente e database) e restituisce
 * i problemi trovati, in italiano. Non mostra mai valori segreti.
 */
export async function setupProblems(): Promise<string[]> {
  const problems: string[] = [];
  const secret = process.env.AUTH_SECRET;
  if (!process.env.APP_PASSWORD) problems.push("Manca la variabile APP_PASSWORD (la password per entrare nell'app).");
  if (!secret) problems.push("Manca la variabile AUTH_SECRET.");
  else if (secret.length < 32) problems.push(`AUTH_SECRET è troppo corta (${secret.length} caratteri): ne servono almeno 32.`);

  const url = process.env.DATABASE_URL;
  if (!url) {
    problems.push("Manca la variabile DATABASE_URL (la stringa di connessione di Supabase).");
    return problems;
  }
  if (/\[.*password.*\]/i.test(url)) {
    problems.push("In DATABASE_URL è rimasto [YOUR-PASSWORD]: sostituiscilo con la password del database, senza parentesi quadre.");
    return problems;
  }
  let host = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    if (/^db\..*\.supabase\.co$/.test(host))
      problems.push("DATABASE_URL usa la \"Direct connection\" di Supabase, che Vercel non raggiunge: usa la stringa \"Transaction pooler\" (porta 6543).");
  } catch {
    problems.push("DATABASE_URL non è un indirizzo valido. Se la password contiene caratteri speciali (@ # / ? :) cambiala su Supabase con una solo lettere e numeri.");
    return problems;
  }

  const local = host === "localhost" || host === "127.0.0.1";
  const sql = postgres(url, { max: 1, prepare: false, ssl: local ? false : "require", connect_timeout: 8, idle_timeout: 1, onnotice: () => {} });
  try {
    await sql`select 1`;
    try {
      await sql`select payday from settings limit 1`;
    } catch (e) {
      if (code(e) === "42P01")
        problems.push("Il database è raggiungibile ma le tabelle non esistono ancora: su Vercel fai Redeploy (le tabelle vengono create durante il deploy).");
      else throw e;
    }
  } catch (e) {
    problems.push(dbMessage(e));
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
  return problems;
}

function code(e: unknown): string {
  return (e as { code?: string })?.code ?? "";
}

function dbMessage(e: unknown): string {
  const c = code(e);
  const msg = String((e as { message?: string })?.message ?? "");
  if (c === "28P01" || /password authentication failed/i.test(msg))
    return "Il database rifiuta la password: controlla la password dentro DATABASE_URL (è quella del database Supabase, non quella dell'account).";
  if (/tenant or user not found/i.test(msg))
    return "Supabase non riconosce l'utente: copia di nuovo la stringa \"Transaction pooler\" (l'utente deve essere del tipo postgres.xxxxxxxx).";
  if (c === "ENOTFOUND" || c === "EAI_AGAIN") return "L'indirizzo del database in DATABASE_URL non esiste: ricopia la stringa da Supabase.";
  if (c === "ECONNREFUSED" || c === "ETIMEDOUT" || c === "CONNECT_TIMEOUT" || c === "ENETUNREACH")
    return "Il database non risponde: verifica che il progetto Supabase sia attivo e di usare la stringa \"Transaction pooler\".";
  return `Errore di connessione al database${c ? ` (codice ${c})` : ""}.`;
}
