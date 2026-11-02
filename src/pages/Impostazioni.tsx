import { ChevronRight, Plus } from "lucide-react";
import { combine, useAccounts, useBalances, useBase, useCategories } from "@/hooks";
import { eur } from "@/lib/money";
import { ACCOUNT_COLORS } from "@/lib/icon-keys";
import { IconBox } from "@/components/Icon";
import { SheetTrigger } from "@/components/Sheet";
import { AccountForm, CategoryForm, PaydayForm } from "@/components/forms";
import { LogoutButton } from "@/components/Nav";
import { LoadError, PageSkeleton } from "@/components/ui";
import { Card } from "@/components/Card";

export default function Impostazioni() {
  const { settings, payday } = useBase();
  const qAcc = useAccounts();
  const qCat = useCategories();
  const qBal = useBalances();
  const st = combine(settings, qAcc, qCat, qBal);
  if (st.error) return <LoadError error={st.error} onRetry={st.retry} />;
  if (st.loading || !payday) return <PageSkeleton />;
  const accounts = qAcc.data!, balances = qBal.data!;
  const categories = qCat.data!.filter((c) => !c.archived);

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const used = new Set(active.map((a) => a.color));
  const nextColor = ACCOUNT_COLORS.find((c) => !used.has(c)) ?? ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length];
  const quotaNames = active.filter((a) => a.includeInQuota).map((a) => a.name);

  const accountRow = (a: (typeof accounts)[number]) => (
    <SheetTrigger key={a.id} className="item" title="Modifica conto" content={<AccountForm initial={a} balance={balances.get(a.id) ?? a.initialBalance} />}>
      <IconBox name={a.icon} color={a.color} />
      <span className="main">
        <b>{a.name}</b>
        <small>
          {[a.includeInQuota ? "Conta per la quota" : null, a.excludeFromNetWorth ? "Escluso dal patrimonio" : null].filter(Boolean).join(" · ") ||
            "Non conta per la quota"}
        </small>
      </span>
      <span className="right num">{eur(balances.get(a.id) ?? 0, "auto")}</span>
    </SheetTrigger>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <Card id="impostazioni-1" title={<>Stipendio e quota giornaliera</>}>
        <SheetTrigger
          className="item"
          title="Stipendio e quota"
          content={<PaydayForm payday={payday} accounts={active.map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: a.color, includeInQuota: a.includeInQuota }))} />}
        >
          <IconBox name="calendar-clock" />
          <span className="main">
            <b>Stipendio il giorno {payday}</b>
            <small>{quotaNames.length ? `Quota su: ${quotaNames.join(", ")}` : "Nessun conto scelto per la quota"}</small>
          </span>
          <ChevronRight size={18} className="muted" />
        </SheetTrigger>
      </Card>

      <Card id="impostazioni-2" title={<>
          Conti e contanti
          <SheetTrigger className="link" title="Nuovo conto" content={<AccountForm defaultColor={nextColor} />}><Plus size={14} /> Aggiungi</SheetTrigger>
      </>}>
        <div className="list">{active.map(accountRow)}</div>
        {active.length === 0 && <p className="empty">Nessun conto. Aggiungine uno.</p>}
        <p className="note" style={{ marginTop: 12, marginBottom: 0 }}>
          Saldo = saldo iniziale + quanto ripartito sul conto − uscite registrate.
        </p>
      </Card>

      {archived.length > 0 && (
        <Card id="impostazioni-3" title={<>Conti archiviati</>}>
          <div className="list">{archived.map(accountRow)}</div>
        </Card>
      )}

      <Card id="impostazioni-4" title={<>
          Categorie di spesa
          <SheetTrigger className="link" title="Nuova categoria" content={<CategoryForm />}><Plus size={14} /> Aggiungi</SheetTrigger>
      </>}>
        <div className="list">
          {categories.map((c) => (
            <SheetTrigger key={c.id} className="item" title="Modifica categoria" content={<CategoryForm initial={c} />}>
              <IconBox name={c.icon} small />
              <span className="main"><b>{c.name}</b></span>
              <ChevronRight size={18} className="muted" />
            </SheetTrigger>
          ))}
        </div>
      </Card>

      <LogoutButton className="btn ghost" />
    </div>
  );
}
