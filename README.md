# Rotation — journal de rotation prop firm

App web pour gérer tes comptes prop firm en mode business : achats, jours gagnants, éval → buffer → follow-up, payouts, comptes cramés, resets, et toutes les stats (ROI, coût par payout, taux de réussite par étape, délais, séries, mois par mois, par firm, par plan, modèle vs réel).

- **Front** : React + Vite (hébergé sur Vercel, gratuit)
- **Base de données + connexion** : Supabase (gratuit), chaque ligne est privée à ton compte (RLS)
- Sans Supabase configuré, l'app tourne en **mode local** (données dans le navigateur) : pratique pour tester.

---

## Mise en ligne (≈ 15 min)

### 1. Supabase (base de données)
1. Crée un compte sur [supabase.com](https://supabase.com) → **New project** (choisis la région Europe, note le mot de passe).
2. Dans le projet : **SQL Editor → New query**, colle tout le contenu de `supabase/schema.sql`, clique **Run**. Ça crée les tables et la sécurité.
3. **Project Settings → API** (ou **Connect**) : copie
   - l'**URL du projet** (`https://xxxx.supabase.co`)
   - la clé **anon / publishable** (publique, faite pour le navigateur — n'utilise jamais la clé `service_role`).

### 2. GitHub
1. Crée un dépôt (privé si tu veux) et envoie ce dossier dedans :
   ```bash
   git init && git add . && git commit -m "Rotation"
   git branch -M main
   git remote add origin https://github.com/TON_PSEUDO/rotation.git
   git push -u origin main
   ```

### 3. Vercel (hébergement)
1. Sur [vercel.com](https://vercel.com) → **Add New → Project** → importe le dépôt.
2. Framework : **Vite** (détecté tout seul). Build : `npm run build`, dossier : `dist`.
3. **Environment Variables** : ajoute
   - `VITE_SUPABASE_URL` = l'URL du projet
   - `VITE_SUPABASE_ANON_KEY` = la clé anon / publishable
4. **Deploy**. Tu obtiens une adresse du type `https://rotation-xxx.vercel.app`.

### 4. Relier la connexion à ton adresse
Dans Supabase : **Authentication → URL Configuration** :
- **Site URL** = ton adresse Vercel
- **Redirect URLs** : ajoute ton adresse Vercel (et `http://localhost:5173` si tu développes en local)

Ouvre ton adresse Vercel → **Créer un compte** → confirme l'e-mail → c'est prêt. Sur téléphone, « Ajouter à l'écran d'accueil » pour l'avoir comme une app.

> Si tu es le seul utilisateur, une fois ton compte créé tu peux désactiver les nouvelles inscriptions dans les réglages **Authentication** de Supabase (option « Allow new users to sign up »).

---

## Récupérer ton historique Excel
1. Réglages → **Importer ton historique (CSV)**.
2. Format attendu (même que PROPA Journal) : `date,type,firm,account,amount,size,stage,note`
   - `date` = jj/mm/aaaa · `type` = purchase, reset, activation, fee, payout
   - `amount` = ce que tu as vraiment payé ou reçu (payouts **après** split)
   - `stage` = eval, buffer, followup, dead, completed (sur la ligne d'achat)
   - colonnes facultatives : `plan, dll, consistency, combination`
3. Le plus simple : dans Excel, mets tes colonnes dans cet ordre, copie les lignes (avec l'en-tête) et colle-les dans la zone. Le bouton **Copier la consigne pour l'IA** te donne le message à envoyer à Claude avec tes relevés de firms pour qu'il te sorte le CSV.
4. Vérifie ensuite les étapes dans **Comptes** (Modifier sur un compte pour corriger).

## Utilisation au quotidien
- **Acheter des comptes** (touche `A`) : firm, plan, taille, prix, quantité → les comptes sont nommés automatiquement si tu ne colles pas leurs identifiants.
- **Aujourd'hui** : la liste des comptes à trader, avec Gagné / Éval validée / Buffer validé / Payout / Cramé. Chaque clic est horodaté et alimente les stats (réussite, séries, jour de la semaine…).
- **Comptes** : vue en colonnes Éval / Buffer / Follow-up, le compteur de jours par compte, les resets.
- **Payout** (touche `P`) : montant affiché par la firm + split → l'app garde ce que tu reçois, et passe le compte au cycle suivant.
- **Réglages** : jours d'éval / buffer / jours gagnants par payout / payouts max / prix / split par firm ; ton modèle mathématique par plan (onglet Modèle) ; bankroll de départ et objectif ; sauvegarde JSON et export CSV.
- **Image à partager** (Aujourd'hui et Tableau de bord) : PNG prêt à poster.

## Développer en local
```bash
npm install
cp .env.example .env.local   # mets ton URL et ta clé Supabase (ou laisse vide → mode local)
npm run dev                  # http://localhost:5173
npm run typecheck            # vérification TypeScript
npm run build:demo           # version démo autonome en un seul fichier HTML (dist-demo/)
```

## Structure
```
supabase/schema.sql   tables + sécurité RLS
src/lib/logic.ts      modèle d'étapes (éval → buffer → follow-up → payouts)
src/lib/stats.ts      tous les calculs (ROI, entonnoir, délais, séries, mois, plans, modèle)
src/lib/store.tsx     données : Supabase ou navigateur, mises à jour instantanées
src/views/            les onglets
src/modals/           achat, payout, dépense, modification, reset, image à partager
```
