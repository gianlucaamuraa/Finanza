# Finanza

App web personale e responsive per gestire le proprie finanze. Si usa dal telefono, anche installata come app, e dal computer.

- **Pubblicazione**: GitHub Pages, gratuita e automatica a ogni modifica.
- **Dati e accesso**: Supabase (database Postgres e login con email e password).
- **Sicurezza**: regole nel database (Row Level Security). Ogni utente vede e modifica solo i propri dati.

## Pagine

- **Dashboard**
  - quota giornaliera (quanto resta da spendere ÷ giorni al prossimo stipendio)
  - patrimonio
  - entrate e importo da accantonare
  - uscite del mese per categoria
  - ripartizione dello stipendio
  - prossime scadenze
  - andamento del PAC
- **Movimenti**: mese per mese, con due schede.
  - *Stipendio*: entrata e ripartizione sui conti. Si può copiare la ripartizione dal mese precedente.
    - ogni ripartizione si può collegare a una spesa prevedibile: la rata di quel mese risulta versata;
    - *Proposta di ripartizione*: rate e versamenti PAC del mese non ancora coperti, con importi e conti già compilati; accettando si creano le ripartizioni.
  - *Uscite*: spese per conto e categoria, speso rispetto ad assegnato, filtro per conto.
- **Spese prevedibili**: importo, mese di inizio e mese di fine. La rata mensile viene calcolata in automatico.
  - card *Versamenti mese per mese*: toccando un mese vedi su quali conti le rate sono state versate e su quali andranno versate (conto predefinito della spesa, o scelto quando segni la rata come versata).
- **Lungo termine (PAC)**: versamenti mese per mese e anno per anno, mesi futuri pianificati, collegamento opzionale a un conto.
- **Impostazioni**: conti e contanti, categorie, giorno dello stipendio, conti che contano per la quota.

Il mese va da uno stipendio al successivo. Se lo stipendio arriva dal giorno 15 in poi, apre il mese successivo: lo stipendio del 27 ottobre apre "Novembre".

## Configurazione (una volta sola)

### 1. Supabase
1. Crea il tuo utente: **Authentication → Users → Add user → Create new user**.
   - Inserisci email e password.
   - Lascia attivo **Auto Confirm User**.
2. Blocca le nuove registrazioni: **Authentication → Sign In / Providers → Email**. Disattiva **Allow new users to sign up**, così nessun altro può crearsi un account.
3. Esegui lo script del database:
   - apri **SQL Editor → New query**;
   - incolla tutto il contenuto di [`supabase/setup.sql`](supabase/setup.sql);
   - premi **Run**.

   Lo script:
   - assegna al tuo utente i dati già presenti;
   - attiva le regole di sicurezza;
   - crea le viste per i saldi.

   Si può rieseguire senza danni.
4. Copia i due dati per l'app da **Project Settings → API Keys** (o **Data API**):
   - **Project URL**, del tipo `https://xxxx.supabase.co`;
   - **Publishable key** (`sb_publishable_…`), oppure la chiave *anon* nelle chiavi "Legacy".

   Non sono segreti: senza login non danno accesso a nessun dato.

### 2. GitHub
1. Nel repository vai su **Settings → Pages**. In **Build and deployment → Source** scegli **GitHub Actions**.
2. Vai su **Settings → Secrets and variables → Actions → scheda Variables → New repository variable** e crea:
   - `SUPABASE_URL`: il Project URL;
   - `SUPABASE_KEY`: la publishable key.
3. Vai su **Actions → Pubblica su GitHub Pages → Run workflow**. Dopo la prima volta, la pubblicazione parte da sola a ogni modifica.
4. L'app sarà su `https://<utente>.github.io/<repository>/`. Dal telefono aprila e scegli "Aggiungi alla schermata Home".

## Sviluppo in locale

```bash
npm install
cp .env.example .env.local   # inserisci URL e chiave di Supabase
npm run dev
```

- `npm test`: test dei calcoli (periodi, rate, quota giornaliera, PAC)
- `npm run build`: controllo dei tipi e compilazione in `dist/`

## Tecnologie

React 19, Vite, React Router (con indirizzi `#/…`, adatti a GitHub Pages), TanStack Query, supabase-js, icone Lucide.

## Struttura

```
src/
  api.ts          letture e salvataggi su Supabase, con i controlli dei dati
  hooks.ts        caricamento dati per le pagine (con memoria temporanea)
  pages/          Dashboard, Movimenti, Spese prevedibili, Lungo termine, Impostazioni, Accesso
  components/     fogli modali, moduli, navigazione, icone
  lib/            calcoli (periodi, rate, quota, PAC) e formattazione importi
supabase/setup.sql  tabelle, regole di sicurezza e viste
.github/workflows/pages.yml  pubblicazione automatica
mockup/           mockup HTML iniziale
```
