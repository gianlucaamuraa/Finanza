import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** Client Supabase, oppure null se l'app è stata pubblicata senza configurazione. */
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export function sb() {
  if (!supabase) throw new Error("Supabase non configurato");
  return supabase;
}
