import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Ripulisce l'indirizzo del progetto: spazi, https:// mancante, percorsi in fondo. */
export function normalizeUrl(raw: string | undefined): { url?: string; problem?: string } {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (!v) return { problem: "Manca la variabile SUPABASE_URL." };
  if (/^postgres(ql)?:\/\//i.test(v))
    return {
      problem:
        "SUPABASE_URL contiene la stringa del database (postgresql://…). Serve invece il Project URL, del tipo https://xxxx.supabase.co (Supabase → Project Settings → Data API).",
    };
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return { url: `${u.protocol}//${u.host}` };
  } catch {
    return { problem: `SUPABASE_URL non è un indirizzo valido: "${v}". Deve essere del tipo https://xxxx.supabase.co.` };
  }
}

const parsed = normalizeUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = ((import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? "").trim().replace(/^["']|["']$/g, "");

/** Problema di configurazione da mostrare, se presente. */
export let configProblem: string | null = parsed.problem ?? (key ? null : "Manca la variabile SUPABASE_KEY (la Publishable key).");

let client: SupabaseClient | null = null;
if (!configProblem) {
  try {
    client = createClient(parsed.url!, key, { auth: { persistSession: true, autoRefreshToken: true } });
  } catch (e) {
    configProblem = `Configurazione di Supabase non valida: ${(e as Error).message}`;
  }
}

/** Client Supabase, oppure null se la configurazione non è valida. */
export const supabase = client;

export function sb() {
  if (!supabase) throw new Error(configProblem ?? "Supabase non configurato");
  return supabase;
}
