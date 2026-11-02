import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import * as A from "@/api";
import { useAccounts, usePlanned } from "@/hooks";
import { describe, groupHistory } from "@/lib/history";
import { MESI } from "@/lib/dates";
import { Card } from "./Card";
import { ConfirmButton } from "./form";

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Storico delle modifiche con il pulsante Annulla per ogni operazione. */
export function HistoryCard() {
  const qh = useQuery({ queryKey: ["history"], queryFn: A.getHistory });
  const accounts = useAccounts().data ?? [];
  const planned = usePlanned().data ?? [];
  const [shown, setShown] = useState(15);
  const [open, setOpen] = useState<number | null>(null);
  const names = { accounts: new Map(accounts.map((a) => [a.id, a.name])), planned: new Map(planned.map((p) => [p.id, p.name])) };

  let body;
  if (qh.isPending) body = <p className="empty">Caricamento…</p>;
  else if (qh.error) body = <p className="empty">Impossibile caricare lo storico.</p>;
  else if (qh.data === null)
    body = <p className="note" style={{ margin: 0 }}>Per attivare lo storico riesegui lo script <code>supabase/setup.sql</code> in Supabase (SQL Editor → Run).</p>;
  else {
    const groups = groupHistory(qh.data!);
    body = groups.length === 0 ? (
      <p className="empty">Nessuna modifica registrata. Da ora ogni modifica comparirà qui e si potrà annullare.</p>
    ) : (
      <>
        <div className="list">
          {groups.slice(0, shown).map((g) => {
            const key = g[0].id;
            return (
              <div key={key} className="item" style={{ cursor: "default", flexWrap: "wrap", opacity: g[0].undone ? 0.55 : 1 }}>
                <span className="main" style={{ minWidth: 0 }}>
                  <b style={{ whiteSpace: "normal" }}>{describe(g[g.length - 1], names)}</b>
                  <small>
                    {when(g[0].createdAt)}
                    {g.length > 1 && (
                      <button type="button" className="link" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setOpen(open === key ? null : key)}>
                        {open === key ? "nascondi" : `+ altre ${g.length - 1}`}
                      </button>
                    )}
                  </small>
                </span>
                {g[0].undone ? (
                  <span className="tag done">Annullata</span>
                ) : (
                  <span style={{ flexShrink: 0 }}>
                    <ConfirmButton run={() => A.undoHistory(g)} label="Annulla" confirmLabel="Conferma" className="btn ghost sm" icon={false} />
                  </span>
                )}
                {open === key && (
                  <ul style={{ width: "100%", margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--muted)" }}>
                    {[...g].reverse().map((x) => <li key={x.id}>{describe(x, names)}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {groups.length > shown && (
          <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={() => setShown(shown + 30)}>Mostra altre</button>
        )}
      </>
    );
  }

  return (
    <Card id="impostazioni-storico" title={<><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RotateCcw size={14} /> Storico modifiche</span></>}>
      <p className="note" style={{ marginTop: 0 }}>Ogni aggiunta, modifica o cancellazione. "Annulla" rimette i dati com'erano prima di quella operazione.</p>
      {body}
    </Card>
  );
}
