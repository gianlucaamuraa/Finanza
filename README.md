# Finanza

App web personale e responsive per gestire le proprie finanze, usabile dal telefono (anche installata come app) e dal computer.

## Pagine

- **Dashboard**
  - quota giornaliera (quanto resta da spendere ÷ giorni al prossimo stipendio)
  - patrimonio
  - entrate del mese e importo da accantonare
  - uscite del mese per categoria
  - ripartizione dello stipendio
  - prossime scadenze
  - andamento del PAC
- **Movimenti**: mese per mese, con due schede.
  - *Stipendio*: entrata dello stipendio e ripartizione sui conti e sui contanti. Si può copiare la ripartizione dal mese precedente.
  - *Uscite*: spese per conto e per categoria, con il confronto tra speso e assegnato e il filtro per conto. Un'uscita si può collegare a una spesa prevedibile.
- **Spese prevedibili**: importo totale, mese di inizio e mese di fine. La rata mensile viene calcolata in automatico, con l'avanzamento delle rate.
- **Lungo termine (PAC)**: versamenti mese per mese e anno per anno, con i mesi futuri pianificati.
  - Se colleghi un conto al PAC, i mesi senza versamento registrato usano quanto hai spostato su quel conto in Movimenti.
- **Impostazioni**
  - conti e contanti (nome, tipo, icona, colore, saldo iniziale)
  - categorie di spesa
  - giorno dello stipendio
  - conti da considerare per la quota giornaliera

### Come funziona il mese

Il mese va da uno stipendio al successivo. Se lo stipendio arriva dal giorno 15 in poi, apre il mese successivo: lo stipendio del 27 ottobre apre "Novembre", che va dal 27 ottobre al 26 novembre. Se arriva prima del 15, apre il mese stesso.

## Tecnologie

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Drizzle ORM su PostgreSQL, icone Lucide.
L'accesso è protetto da una password personale, con una sessione firmata salvata in un cookie.

## Avvio in locale

Requisiti: Node.js 20 o superiore e un database PostgreSQL.

```bash
npm install
cp .env.example .env.local   # poi compila i valori
npm run db:migrate           # crea le tabelle e i dati iniziali
npm run dev
```

Variabili d'ambiente:

| Nome | Descrizione |
| --- | --- |
| `DATABASE_URL` | Connessione Postgres |
| `APP_PASSWORD` | Password per accedere all'app |
| `AUTH_SECRET` | Segreto di almeno 32 caratteri (`openssl rand -hex 32`) |

## Pubblicazione (Supabase + Vercel)

Supabase ospita il database, Vercel ospita l'app. Entrambi sono gratuiti per un uso personale.

### 1. Database su Supabase
1. Su [supabase.com](https://supabase.com) crea un nuovo progetto, scegli la regione Europa (es. Frankfurt) e annota la password del database.
2. Apri **Connect** in alto, sezione **Connection string**, e copia la stringa **Transaction pooler** (porta `6543`).
   Ha questa forma: `postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
3. Sostituisci `[PASSWORD]` con la password del database.

Usa il *pooler* e non la "Direct connection": quella funziona solo con IPv6, che Vercel non supporta.

### 2. App su Vercel
1. Su [vercel.com](https://vercel.com) importa questo repository.
2. In **Environment Variables** inserisci:
   - `DATABASE_URL`: la stringa di Supabase del passo 1
   - `APP_PASSWORD`: la password con cui entrerai nell'app
   - `AUTH_SECRET`: un testo casuale di almeno 32 caratteri (per esempio da `openssl rand -hex 32`)
3. Avvia il deploy. Il comando `build` crea da solo le tabelle su Supabase e inserisce le categorie iniziali.
4. Dal telefono apri l'indirizzo `.vercel.app`, poi scegli "Aggiungi alla schermata Home".

Funziona allo stesso modo con qualsiasi altro Postgres (es. Neon): basta cambiare `DATABASE_URL`.

## Comandi utili

- `npm test`: test dei calcoli (periodi, rate, quota giornaliera, PAC)
- `npm run db:generate`: genera una nuova migrazione dopo una modifica a `src/db/schema.ts`
- `npm run lint`: controllo del codice

## Struttura

```
src/
  app/
    (app)/          pagine protette: dashboard, movimenti, spese-prevedibili, lungo-termine, impostazioni
    login/          accesso
    actions.ts      Server Actions (inserimento, modifica, eliminazione)
  components/       interfaccia (fogli modali, moduli, navigazione, icone)
  db/               schema Drizzle e connessione
  lib/              calcoli (periodi, rate, quota, PAC), formattazione importi, sessione
  proxy.ts          protezione delle pagine
drizzle/            migrazioni SQL
mockup/             mockup HTML iniziale
```
