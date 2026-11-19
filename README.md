# ICC BFC Finances

Application web (installable sur téléphone) de gestion financière des églises **Impact Centre Chrétien — Bourgogne-Franche-Comté** : offrandes, dépenses avec circuit de validation, dépôts bancaires, trésorerie, remboursements, besoins des départements, demandes à la Cité Royale, tableaux de bord et exports.

> Tout est en français, pensé d'abord pour le téléphone. Aucune église, ville ou catégorie n'est figée : tout se configure dans **Administration**.

---

## 1. Ce qu'il faut avant de commencer

- Un compte **Appwrite Cloud** avec un projet (ici : `6aff0a8e000191faf698`, région Francfort).
- Une **clé API serveur** du projet (Appwrite › *Clés API* › *Créer*) avec les scopes : `databases`, `tables`, `storage`, `users`, `teams`, `functions`, `messaging`.
- **Node.js 20 ou plus** sur votre ordinateur (https://nodejs.org).
- Un compte **Vercel** (gratuit) relié à GitHub pour la mise en ligne.

## 2. Installer sur votre ordinateur

```bash
git clone https://github.com/hassouens-svg/finances-icc-bfc.git
cd finances-icc-bfc
npm install
cp .env.example .env.local
```

Ouvrez `.env.local` et remplissez :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | `https://fra.cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | l'ID du projet |
| `APPWRITE_API_KEY` | la clé API serveur (**jamais** partagée, jamais préfixée par `NEXT_PUBLIC_`) |
| `APP_URL` | `http://localhost:3000` en local, l'adresse Vercel en ligne |
| `SESSION_SECRET` | une longue chaîne aléatoire : `openssl rand -hex 32` |
| `DATA_ENCRYPTION_KEY` | 64 caractères hexadécimaux : `openssl rand -hex 32` |
| `RESEND_API_KEY`, `EMAIL_FROM` | *(facultatif)* pour l'envoi des emails — sans eux, les emails sont seulement journalisés |
| `CRON_SECRET` | *(en ligne)* une chaîne aléatoire qui protège les rappels automatiques |
| `ALLOW_SEED` | `true` pour autoriser les données de démo, `false` en production |

## 3. Créer la base Appwrite (une seule commande)

```bash
npm run setup:appwrite
```

Le script crée la base, les 30 tables, leurs colonnes et index, le bucket de fichiers et l'équipe « église mère ». Il peut être relancé sans risque : il n'ajoute que ce qui manque, ne supprime jamais rien.

> Le forfait gratuit Appwrite n'autorise qu'**un** bucket : justificatifs et bordereaux partagent le bucket `justificatifs`.

## 4. Données de démonstration (facultatif)

```bash
npm run seed            # ajoute les données si la base est vide
npm run seed -- --reset # efface TOUT puis recrée la démo
```

Dijon (église mère) + Besançon, Chalon-sur-Saône, Auxerre ; 3 mois d'offrandes, dépenses, dépôts ; remboursements, besoins, demandes Cité Royale, un projet avec budget.

**Comptes de démo** — mot de passe : `Demo-ICC-2026!`

| Email | Rôle |
|---|---|
| `superadmin@example.com` | Super administrateur |
| `mere@example.com` | Administrateur église mère (voit toute la région) |
| `tresorier.dijon@example.com` | Trésorier — Dijon |
| `pasteur.dijon@example.com` | Pasteur — Dijon |
| `tresorier.besancon@example.com` | Trésorier — Besançon |
| `pasteur.besancon@example.com` | Pasteur — Besançon |
| `tresorier.chalon@example.com` | Trésorier — Chalon |
| `lecteur.chalon@example.com` | Lecteur — Chalon |
| `tresorier.auxerre@example.com` | Trésorier + pasteur — Auxerre |

## 5. Lancer l'application

```bash
npm run dev
```

Ouvrez http://localhost:3000 : la page d'accueil **est** la page de connexion.

## 6. Mettre en ligne sur Vercel

1. Sur https://vercel.com › *Add New… › Project* › importez le dépôt GitHub `finances-icc-bfc`.
2. Dans *Environment Variables*, ajoutez les variables du tableau ci-dessus (avec `APP_URL` = l'adresse Vercel, `ALLOW_SEED=false`).
3. *Deploy*. La région `fra1` (Francfort, proche d'Appwrite) et le rappel quotidien (`/api/cron`, 7 h UTC) sont déjà configurés dans `vercel.json`.
4. Dans Appwrite › *Overview › Add platform › Web*, ajoutez le nom de domaine Vercel (nécessaire pour le temps réel côté navigateur).

## 7. Premiers pas (super administrateur)

1. **Administration › Villes & églises** : créez la ville, l'église **Dijon** et cochez « Église mère ».
2. Créez les églises filles (préfixe de référence : 2 à 5 lettres, ex. `BES`).
3. **Utilisateurs › Inviter** : choisissez l'église et le rôle. Si l'email n'arrive pas, copiez le lien d'invitation (valable 7 jours) et envoyez-le par WhatsApp.
4. Chaque trésorier : **Comptes bancaires**, **Départements**, puis **Liens publics** (besoins + remboursements, avec QR code).
5. L'église mère règle les **Circuits de validation** et les **Alertes**.

## 8. Comment c'est construit

- **Next.js 15** (App Router, Server Actions, TypeScript strict), **Tailwind CSS v4**, composants façon shadcn/ui (Radix), **Lucide**, **Recharts**, **TanStack Table**, **Zod**, **ExcelJS**, **@react-pdf/renderer**.
- **Appwrite** (TablesDB) : `src/lib/schema.ts` est la source unique du schéma.
- **Cloisonnement** : une *team* Appwrite par église (rôles `treasurer`, `pastor`, `reader`) + une team `eglise-mere`. Chaque ligne porte ses permissions (lecture : équipe de l'église + église mère ; écriture : trésorier + admin mère). Les écrans lisent avec la **session de l'utilisateur** : c'est Appwrite qui refuse l'accès, pas seulement l'interface. Les écritures passent par des Server Actions qui vérifient le rôle, la validité (Zod) et les mois clôturés, puis tracent tout dans le **journal d'audit**.
- **Grand livre** (`cash_movements`) : chaque offrande validée, dépôt et dépense payée y écrit ses mouvements. Les soldes en découlent :
  - Caisse = espèces/chèques reçus − dépôts − dépenses payées en espèces
  - Banque = solde d'ouverture + dépôts + virements reçus − dépenses payées par la banque
  - Résultat = dons et offrandes − dépenses payées
- **Règle d'or** : une dépense ne peut être « Payée » qu'après la dernière étape de son circuit (y compris les régularisations et les remboursements).
- **Formulaires publics** : jeton de lien, limitation de débit, champ piège anti-robot, délai minimal, contrôle du vrai type de fichier, aucune donnée bancaire demandée.

## 9. Tests

```bash
npm test                 # tests unitaires : soldes, compte de résultat, circuit de validation
npm run test:e2e         # parcours complets (Playwright, sur un serveur lancé avec les données de démo)
npm run test:isolation   # vérifie directement auprès d'Appwrite qu'un trésorier ne lit pas une autre église
```

## 10. Pages utiles

- `/dev/styleguide` : le design system (désactivé en production, sauf `ENABLE_STYLEGUIDE=true`).
- `/p/<jeton>` : formulaire public ; `/suivi/<jeton>` : suivi d'une demande sans compte.
