import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import type { Session } from "@supabase/supabase-js";
import { configProblem, supabase } from "./supabase";
import { queryClient } from "./queryClient";
import { Sidebar, TabBar, TopBar } from "./components/Nav";
import Dashboard from "./pages/Dashboard";
import Movimenti from "./pages/Movimenti";
import SpesePrevedibili from "./pages/SpesePrevedibili";
import LungoTermine from "./pages/LungoTermine";
import Impostazioni from "./pages/Impostazioni";
import Login from "./pages/Login";

/** Sessione Supabase corrente (undefined = ancora in verifica). */
function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export function App() {
  const session = useSession();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!supabase) return <NotConfigured />;
  if (session === undefined) return null;
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <div className="app">
      <Sidebar />
      <div className="content">
        <TopBar />
        <main className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/movimenti" element={<Movimenti />} />
            <Route path="/spese-prevedibili" element={<SpesePrevedibili />} />
            <Route path="/lungo-termine" element={<LungoTermine />} />
            <Route path="/impostazioni" element={<Impostazioni />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <TabBar />
    </div>
  );
}

function NotConfigured() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ maxWidth: 460, borderColor: "var(--neg-line)", background: "var(--neg-soft)" }}>
        <div className="card-title" style={{ color: "var(--neg)" }}>Configurazione da correggere</div>
        <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 12 }}>{configProblem}</p>
        <p className="note" style={{ margin: 0 }}>
          Su GitHub: Settings → Secrets and variables → Actions → Variables. Correggi SUPABASE_URL e SUPABASE_KEY, poi
          Actions → Pubblica su GitHub Pages → Run workflow.
        </p>
      </div>
    </main>
  );
}
