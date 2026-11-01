import { Suspense } from "react";
import { safe } from "@/components/safe";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import { getAccounts, getBalances, getCategories } from "@/lib/data";
import { base } from "@/lib/view";
import { eur } from "@/lib/money";
import { ACCOUNT_COLORS } from "@/lib/icon-keys";
import { logout } from "@/app/actions";
import { IconBox } from "@/components/Icon";
import { SheetTrigger } from "@/components/Sheet";
import { AccountForm, CategoryForm, PaydayForm } from "@/components/forms";
import { PageSkeleton } from "@/components/ui";

export default function ImpostazioniPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Impostazioni />
    </Suspense>
  );
}

async function Impostazioni() {
  return safe(() => ImpostazioniContent());
}

async function ImpostazioniContent() {
  const { payday } = await base();
  const [accounts, categories, balances] = await Promise.all([getAccounts(true), getCategories(), getBalances()]);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const used = new Set(active.map((a) => a.color));
  const nextColor = ACCOUNT_COLORS.find((c) => !used.has(c)) ?? ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length];
  const quotaNames = active.filter((a) => a.includeInQuota).map((a) => a.name);

  const accountRow = (a: (typeof accounts)[number]) => (
    <SheetTrigger key={a.id} className="item" title="Modifica conto" content={<AccountForm initial={a} />}>
      <IconBox name={a.icon} color={a.color} />
      <span className="main">
        <b>{a.name}</b>
        <small>{a.includeInQuota ? "Conta per la quota giornaliera" : "Non conta per la quota"}</small>
      </span>
      <span className="right num">{eur(balances.get(a.id) ?? 0, "auto")}</span>
    </SheetTrigger>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card">
        <div className="card-title">Stipendio e quota giornaliera</div>
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
      </div>

      <div className="card">
        <div className="card-title">
          Conti e contanti
          <SheetTrigger className="link" title="Nuovo conto" content={<AccountForm defaultColor={nextColor} />}><Plus size={14} /> Aggiungi</SheetTrigger>
        </div>
        <div className="list">{active.map(accountRow)}</div>
        {active.length === 0 && <p className="empty">Nessun conto. Aggiungine uno.</p>}
        <p className="note" style={{ marginTop: 12, marginBottom: 0 }}>
          Saldo = saldo iniziale + quanto ripartito sul conto − uscite registrate.
        </p>
      </div>

      {archived.length > 0 && (
        <div className="card">
          <div className="card-title">Conti archiviati</div>
          <div className="list">{archived.map(accountRow)}</div>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          Categorie di spesa
          <SheetTrigger className="link" title="Nuova categoria" content={<CategoryForm />}><Plus size={14} /> Aggiungi</SheetTrigger>
        </div>
        <div className="list">
          {categories.map((c) => (
            <SheetTrigger key={c.id} className="item" title="Modifica categoria" content={<CategoryForm initial={c} />}>
              <IconBox name={c.icon} small />
              <span className="main"><b>{c.name}</b></span>
              <ChevronRight size={18} className="muted" />
            </SheetTrigger>
          ))}
        </div>
      </div>

      <form action={logout}>
        <button type="submit" className="btn ghost"><LogOut size={16} /> Esci</button>
      </form>
    </div>
  );
}
