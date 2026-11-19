# PLAN — ICC BFC Finances

Application web (PWA) de gestion financière multi-églises pour Impact Centre Chrétien, Bourgogne-Franche-Comté.
Statut : **brouillon à valider** (phase 1). Rien n'est codé tant que ce plan n'est pas validé.

---

## 0. Décisions techniques (résumé)

| Sujet | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15** (App Router, Server Actions, TypeScript strict) | Demandé. Next 16 existe ; je reste sur 15 sauf avis contraire. |
| Backend | **Appwrite Cloud** (`https://fra.cloud.appwrite.io/v1`, serveur v2.7) | Demandé ; région Francfort (RGPD). |
| SDK | `node-appwrite@32` côté serveur, `appwrite@29` côté client (Realtime uniquement) | API **TablesDB / rows** disponible, avec **transactions** et `incrementRowColumn` (compteurs atomiques). |
| UI | Tailwind v4 + shadcn/ui + Lucide + police Geist | Demandé. |
| Données | Recharts, TanStack Table, Zod + React Hook Form | Demandé. |
| Exports | ExcelJS, @react-pdf/renderer | Demandé. |
| Emails | Appwrite Messaging, fournisseur **SMTP ou Resend** à brancher dans la console Appwrite | Une seule voie d'envoi, abstraite derrière `lib/notify.ts`. |
| Tâches planifiées | **Appwrite Functions** (cron) : rappels de validation, alertes caisse, résumé hebdo | Le reste en Server Actions. |
| Tests | Vitest (calculs, workflow, permissions) + Playwright (parcours, 390 px & 1440 px) | |

### Principe de sécurité central
1. **Lectures** : faites avec un client Appwrite *au nom de l'utilisateur* (session cookie httpOnly → `setSession`). Appwrite applique lui-même les permissions de ligne : un trésorier de Besançon **ne peut physiquement pas** lire une ligne de Chalon, même en appelant l'API directement.
2. **Écritures** : passent par des Server Actions qui (a) vérifient le rôle de l'utilisateur dans l'église, (b) valident avec Zod, (c) vérifient le verrou de période, puis écrivent avec le client admin (clé API serveur) **en posant explicitement les permissions** de la ligne, (d) écrivent l'historique de statut + le journal d'audit dans la **même transaction**.
3. Toutes les tables ont `rowSecurity: true` et **aucune permission au niveau table** (sauf listes de référence globales en lecture pour `users`).
4. La clé API ne quitte jamais le serveur (`server-only` importé dans `lib/appwrite/admin.ts`).

---

## 1. Rôles et permissions

### 1.1 Modèle Appwrite
- **Une team par église** : id `church-<slug>` (ex. `church-dijon`). Rôles de membership : `treasurer`, `pastor`, `reader`.
- **Team `eglise-mere`** : rôle `admin` = administrateurs de l'église mère.
- **Super administrateur** : label utilisateur `superadmin` (`Role.label('superadmin')`).
- Un utilisateur peut être membre de plusieurs teams avec des rôles différents.
- Le statut « église mère » est porté par `churches.isMother` ; la team `eglise-mere` est indépendante, ce qui permet de changer d'église mère sans recréer de permissions sur les données (les lignes référencent la team `eglise-mere`, pas Dijon).

### 1.2 Permissions posées sur chaque ligne d'une église
```
read   : team:church-X, team:eglise-mere, label:superadmin
update : team:church-X/treasurer, team:eglise-mere/admin, label:superadmin
delete : (aucune — suppression uniquement via Server Action, logique « soft delete »)
```
Les mises à jour sensibles (statuts, validations, montants verrouillés) ne passent **que** par Server Action ; la permission `update` côté client sert seulement à l'édition de brouillons.

### 1.3 Matrice
| Action | Super admin | Admin mère | Trésorier | Pasteur | Lecteur | Public |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Villes, églises, désigner l'église mère | ✅ | créer églises filles | — | — | — | — |
| Utilisateurs / invitations | ✅ toutes | ✅ toutes églises | — | — | — | — |
| Listes configurables (catégories, types…) | ✅ | ✅ (défauts régionaux) | ajouts locaux si autorisé | — | — | — |
| Workflows de validation, seuils d'alerte | ✅ | ✅ | — | — | — | — |
| Sélecteur « Toutes les églises » + consolidé | ✅ | ✅ | — | — | — | — |
| Offrandes, dépôts, dépenses, remboursements, besoins, demandes CR | ✅ | ✅ | ✅ son église | lecture | lecture | — |
| Valider une étape de workflow | ✅ | si étape « église mère » | si étape « trésorier » | si étape « pasteur » | — | — |
| Déverrouiller séance / mois clôturé | ✅ | ✅ | — | — | — | — |
| Soumettre besoin / remboursement | — | — | — | — | — | via lien |
| Suivre sa demande | — | — | — | — | — | via jeton |
| Journal d'audit | ✅ | ✅ | son église | son église | — | — |

### 1.4 Résolution du contexte (chaque requête serveur)
`getContext()` → `{ user, isSuperAdmin, isMotherAdmin, memberships: [{churchId, roles}], view: 'all' | churchId }`.
La vue est stockée dans un cookie ; `view='all'` n'est accepté que pour admin mère / super admin. Toutes les requêtes de liste ajoutent `Query.equal('churchId', …)` selon la vue (filtrage fonctionnel) — **en plus** des permissions Appwrite (garantie de sécurité).

---

## 2. Schéma de données Appwrite (`lib/schema.ts`)

Base unique `icc_finances`. Conventions :
- Tous les montants en **centimes (integer)**. Toutes les dates métier en `datetime` (ISO, Europe/Paris à l'affichage).
- Colonnes communes à toutes les tables d'église : `churchId` (varchar 36, index), `createdBy` (varchar 36), `$createdAt`/`$updatedAt` (natifs Appwrite), `archived` (bool, défaut false).
- Enums Appwrite pour les statuts ; varchar(36) pour les ids ; text pour les longs textes.
- Pas de colonnes « relationship » Appwrite (moins prévisibles, coûteuses en permissions) : liens par id + index.
- `reference` = numéro lisible, généré via compteur atomique (`counters`).

### 2.1 Structure & configuration
| Table | Colonnes principales | Index |
|---|---|---|
| `cities` | name, region, archived | name |
| `churches` | name, slug (unique), cityId, address, isMother, parentChurchId, pastorName, logoFileId, teamId, refPrefix (ex. `DIJ`), settingsJson, active | slug(u), cityId, isMother |
| `departments` | churchId, name, leaderName, leaderEmail, annualBudgetCents?, archived | churchId |
| `expense_categories` | churchId? (null = régional), name, accountingCode?, archived | churchId |
| `donation_types` | churchId?, name, isTithe, archived | churchId |
| `cr_request_types` | churchId?, name | |
| `services` (cultes / événements récurrents) | churchId, name, weekday?, time? | churchId |
| `bank_accounts` | churchId, label, bankName, ibanMasked (4 derniers chiffres), openingBalanceCents, openingDate, archived | churchId |
| `settings` | scope (`global`/`church`), churchId?, key, valueJson | scope+churchId+key (u) |
| `counters` | key (ex. `DIJ-DEP-2026`), value (int) | key (u) |
| `memberships_meta` | userId, churchId, displayName, phone, notifPrefsJson | userId, churchId |

> Les rôles vivent dans les **Teams** ; `memberships_meta` ne stocke que les préférences et infos d'affichage.

### 2.2 Liens publics
| `public_links` | churchId, kind (`funding`/`reimbursement`), departmentId?, token (32 o. aléatoires, base64url, unique), active, expiresAt?, submissionsCount | token(u), churchId |

### 2.3 Module 1 — Demandes à la Cité Royale
| `cite_royale_requests` | churchId, reference (`CR-2026-0012`), title, typeId, reason, description, quantity, estimatedCents, priority (`low/normal/high/urgent`), wishedDate, departmentId?, contactUserId, sendChannel, crReference?, status, viaMother (bool), receivedCents?, receivedQuantity?, receivedAt?, receiptFileId?, statusChangedAt, sourceFundingRequestId? | churchId, status, statusChangedAt |

Statuts : `draft → mother_review (si viaMother) → initiated → sent → pending → approved | rejected → received_full | received_partial → closed`.

### 2.4 Module 2 — Besoins des départements
| `funding_requests` | churchId, reference (`BES-…`), publicLinkId, requesterName, requesterEmail?, requesterPhone?, departmentId, title, description, estimatedCents, approvedCents?, wishedDate, priority, status, trackingToken (unique), decisionComment?, convertedToType? (`expense`/`cr`), convertedToId? | churchId, status, trackingToken(u), departmentId |

Statuts : `received → reviewing → approved | partially_approved | rejected → funded`.

### 2.5 Module 3 — Remboursements
| `reimbursements` | churchId, reference (`RMB-…`), requesterName, requesterEmail?, requesterPhone?, departmentId?, reason, expenseDate, amountCents, wishedMethod (`transfer/cash/other`), status, trackingToken (unique), rejectReason?, paidAt?, paidMethod?, paidProofFileId?, payeeBankInfoEnc? (saisi par trésorier, chiffré AES-GCM côté serveur), expenseId? | churchId, status, trackingToken(u) |

Statuts : `submitted → checking → approved | rejected → paid`. Passage à `paid` ⇒ création automatique de la dépense (transaction).

### 2.6 Module 4 — Dons et offrandes
| Table | Colonnes | Index |
|---|---|---|
| `offering_sessions` | churchId, reference (`OFF-…`), date, serviceId, counter1Name, counter2Name, countedCashCents, countedChequeCents, enteredTotalCents, gapCents, status (`draft/validated`), lockedAt?, lockedBy?, depositedCents (dénormalisé) | churchId, date, status |
| `offering_lines` | churchId, sessionId, donationTypeId, donorId?, anonymous, amountCents, method (`cash/cheque/transfer/card/mobile`), chequeRef?, chequeBank? , depositId? | sessionId, churchId, method |
| `donors` | churchId, fullName, email?, phone?, address?, consentAt, anonymizedAt? | churchId, fullName |

### 2.7 Module 5 — Dépenses, projets, workflow
| Table | Colonnes | Index |
|---|---|---|
| `expenses` | churchId, reference (`DEP-…`), title, categoryId, supplier, amountCents, date, paymentMethod (`cash/bank_transfer/card/cheque`), bankAccountId?, departmentId?, projectId?, status (`draft/submitted/in_approval/approved/rejected/paid`), currentStep, totalSteps, workflowId, isRegularization, regularizationReason?, advancedBy?, paidAt?, source (`manual/reimbursement/funding`), sourceId? | churchId, status, date, categoryId, projectId |
| `projects` | churchId, name, budgetCents, startDate, endDate, ownerName, status (`planned/active/done/cancelled`), milestonesJson | churchId, status |
| `approval_workflows` | churchId? (null = toutes), name, minCents, maxCents?, categoryIds[], priority, active | churchId |
| `approval_steps` | workflowId, order, role (`treasurer/pastor/mother_admin`), maxDelayHours | workflowId |
| `approvals` | churchId, expenseId, stepOrder, role, decision (`approved/rejected/info_requested`), userId, comment, decidedAt | expenseId |

**Règle de sélection** : la règle active la plus spécifique (église > régional, puis catégorie, puis tranche de montant) ; à défaut, règle par défaut « trésorier seul ».
**Règle d'or** : `markExpensePaid()` refuse si `status !== 'approved'`. Une dépense déjà avancée est créée avec `isRegularization = true` + motif obligatoire et suit **le même circuit**.

### 2.8 Module 6 — Dépôts
| `deposits` | churchId, reference (`DPT-…`), bankAccountId, date, depositorName, cashCents, chequeCents, slipNumber, slipFileId?, status (`prepared/deposited/confirmed`), confirmedAt?, confirmedCents?, valueDate?, gapCents? | churchId, status, date |
| `deposit_items` | churchId, depositId, kind (`session/cheque/free`), sessionId?, offeringLineId?, amountCents | depositId |

### 2.9 Module 7 — Trésorerie & comptabilité
| Table | Colonnes | Index |
|---|---|---|
| `cash_movements` (**grand livre**) | churchId, date, account (`cash` / `bank:<bankAccountId>`), direction (`in/out`), amountCents, sourceType (`offering_line/deposit/expense/transfer/opening/adjustment`), sourceId, label | churchId+account+date, sourceType+sourceId |
| `budgets` | churchId, year, scope (`category/department`), scopeId, plannedCents | churchId+year |
| `bank_statement_lines` | churchId, bankAccountId, importBatchId, date, label, amountCents, matchedType?, matchedId? | churchId, bankAccountId, date |
| `period_locks` | churchId, month (`2026-10`), lockedBy, lockedAt | churchId+month (u) |

**Source de vérité des soldes = `cash_movements`**, écrit dans la même transaction que l'événement qui le provoque :
- ligne d'offrande espèces/chèque validée → `cash in`
- ligne virement/carte/mobile → `bank in`
- dépôt passé à « Déposé » → `cash out` + `bank in` (montant déposé)
- dépense payée en espèces → `cash out` ; payée par banque/carte/chèque → `bank out`
- dépôt confirmé avec écart → `bank adjustment` (montant de l'écart, motif tracé)

Formules (testées unitairement) :
- **Caisse** = Σ entrées espèces/chèques − Σ dépôts − Σ dépenses payées en espèces
- **Banque (compte k)** = solde d'ouverture + Σ dépôts sur k + Σ virements reçus sur k − Σ dépenses payées sur k
- **Résultat (période)** = Σ produits (lignes d'offrande + autres recettes) − Σ charges (dépenses **payées**, par date de dépense)

Appwrite n'a pas d'agrégation SQL : les totaux sont calculés côté serveur par pagination (`Query.select` + `cursorAfter`), avec cache `unstable_cache` taggé par église et invalidé à chaque écriture. Volume attendu (quelques milliers de lignes/an/église) : largement suffisant.

### 2.10 Transverses
| Table | Colonnes | Index |
|---|---|---|
| `attachments` | churchId, entityType, entityId, fileId, bucket, name, mime, size, uploadedBy (userId ou `public`) | entityType+entityId |
| `comments` | churchId, entityType, entityId, authorId?, authorName, body, internal (bool — masqué au demandeur public) | entityType+entityId |
| `status_history` | churchId, entityType, entityId, fromStatus, toStatus, actorId?, actorName, comment | entityType+entityId |
| `notifications` | userId, churchId, kind, title, body, link, readAt? | userId+readAt |
| `audit_logs` | churchId?, actorId, action (`create/update/delete/validate/lock/unlock/login…`), entityType, entityId, beforeJson, afterJson, ip? | churchId+$createdAt, entityType+entityId |
| `rate_limits` | key (ex. `ip:token`), windowStart, count | key (u) |

### 2.11 Storage
| Bucket | Contenu | Règles |
|---|---|---|
| `justificatifs` | factures, tickets, devis, photos de réception, preuves de remboursement | 10 Mo, jpg/png/webp/heic/pdf, `fileSecurity: true`, permissions par team comme les lignes |
| `bordereaux` | bordereaux de dépôt bancaire | idem |
| `logos` | logos d'églises | lecture publique |

Les fichiers ne sont jamais servis directement au public : passage par une route serveur qui vérifie le droit (ou le jeton de suivi).

### 2.12 Script `npm run setup:appwrite`
`scripts/setup-appwrite.ts` lit `lib/schema.ts` (source unique, typée) et, pour chaque élément : *get → create si absent → compare et ajoute les colonnes/index manquants* (jamais de suppression). Crée base, tables, colonnes, index, buckets, team `eglise-mere`. Ré-exécutable sans effet de bord. Les types TypeScript des lignes sont **dérivés** du même schéma.

---

## 3. Workflows de statuts

Chaque transition passe par une fonction unique `transition(entity, to, {actor, comment})` qui :
1. vérifie que la transition est autorisée (machine d'états déclarative dans `lib/workflows/*.ts`) et que l'acteur a le rôle requis ;
2. vérifie le verrou de période ;
3. écrit la ligne + `status_history` + `audit_logs` (+ `cash_movements` le cas échéant) **dans une transaction** ;
4. déclenche les notifications (emails + centre de notifications).

Couleurs de badge (identiques partout) :
| Famille | Statuts | Couleur |
|---|---|---|
| Neutre | Brouillon, Préparé | gris |
| En cours | Soumise, Reçu, Initiée, Envoyée, En étude, En vérification, En validation n/N, Déposé | violet |
| Attente | En attente, À valider par l'église mère, Demande de précision | ambre |
| Positif | Approuvée, Validée, Confirmé, Reçue | vert |
| Terminé | Payée, Remboursée, Financé, Clôturée | vert plein |
| Négatif | Refusée, Écart | rouge |

---

## 4. Écrans

### Navigation
- **Mobile** (barre du bas) : Accueil · Argent entré · Argent sorti · À valider · Plus. Bouton flottant violet **+** : offrande / dépense / dépôt.
- **Desktop** (sidebar) : Tableau de bord · Offrandes · Dépenses · Dépôts · Remboursements · Besoins · Cité Royale · Projets · Trésorerie · Rapports · Administration.
- En-tête : sélecteur d'église/vue (admin mère : « Toutes les églises » + liste), filtre de période, cloche de notifications, menu utilisateur.

### Liste des routes
| Route | Écran |
|---|---|
| `/` | Connexion (aucune landing) |
| `/mot-de-passe-oublie`, `/reinitialiser`, `/invitation` | Récupération / définition du mot de passe |
| `/app` | Tableau de bord église ou consolidé |
| `/app/offrandes`, `/app/offrandes/nouvelle`, `/app/offrandes/[id]` | Séances, saisie rapide par culte, détail |
| `/app/donateurs`, `/app/donateurs/[id]` | Fiches donateurs |
| `/app/depenses`, `/nouvelle`, `/[id]` | Dépenses + timeline de validation |
| `/app/a-valider` | File des validations (une carte = un pouce) |
| `/app/projets`, `/[id]` | Projets / événements, budget vs réalisé |
| `/app/depots`, `/nouveau`, `/[id]` | Dépôts bancaires |
| `/app/remboursements`, `/[id]` | File + détail |
| `/app/besoins`, `/[id]` | File + détail + conversion |
| `/app/cite-royale`, `/nouvelle`, `/[id]` | Liste / Kanban / réception |
| `/app/tresorerie` | Soldes, courbe 12 mois, prévisionnel |
| `/app/compte-de-resultat`, `/app/budget`, `/app/rapprochement`, `/app/cloture` | Comptabilité simplifiée |
| `/app/rapports` | Rapports prêts à l'emploi + exports |
| `/app/notifications` | Centre de notifications |
| `/app/admin/{villes,eglises,utilisateurs,departements,listes,workflows,alertes,liens,notifications,audit,export}` | Administration |
| `/p/[token]` | Formulaire public (besoin ou remboursement selon le lien) |
| `/suivi/[trackingToken]` | Suivi public d'une demande |
| `/dev/styleguide` | Design system (désactivé en production) |

---

## 5. Design system (phase 1)

- Tokens Tailwind v4 (`@theme`) : `--color-bg #FFFFFF`, `--color-surface #FAFAFA`, `--color-fg #0A0A0A`, `--color-muted #6B6B76`, `--color-border #EAEAEE`, `--color-accent #6D28D9`, `--color-accent-soft #F3EEFF`, `--color-accent-strong #4C1D95`, succès/attention/erreur + fonds pâles. Mode sombre (noir profond + violet) via `data-theme`.
- Geist Sans + Geist Mono, `tabular-nums` sur tous les montants.
- Formatage centralisé : `formatEuro(cents)` → `1 250,00 €` ; `formatDate` → `19 nov. 2026` (`Intl`, fr-FR).
- Composants : `Button`, `AmountInput` (clavier numérique `inputmode="decimal"`, saisie en euros → centimes), `StatusBadge`, `KpiCard` (compteur animé), `EmptyState`, `Timeline`, `FileCapture` (`capture="environment"`, compression d'image côté client), `PeriodFilter`, `ChurchSwitcher`, `DataTable`, `Sheet` (formulaires en panneau sur mobile), `ConfirmDialog`, `Toast`, `Skeleton`, `Fab`, `BottomNav`, `Sidebar`.
- `/dev/styleguide` présente tout cela, vérifié en 390 px et 1440 px.

---

## 6. Sécurité, RGPD, anti-abus

- Formulaires publics : Server Action uniquement, vérification du jeton du lien (actif, non expiré), **rate limit** (5 envois / 10 min / IP / lien, table `rate_limits`), champ **honeypot**, temps minimal de remplissage, Zod, contrôle MIME réel (magic bytes) + 10 Mo, jamais d'IBAN demandé, mention d'information RGPD.
- Jetons de suivi : 32 octets aléatoires (`crypto.randomBytes`), non devinables ; la page de suivi n'affiche que statut, timeline et commentaires non internes.
- Donateurs : données minimales, **anonymisation** (le nom est effacé, les montants restent pour la comptabilité), durée de conservation configurable (Function mensuelle).
- Coordonnées bancaires saisies par le trésorier : chiffrées AES-256-GCM (clé `DATA_ENCRYPTION_KEY` serveur), affichées masquées.
- Test automatisé d'isolation : un utilisateur de Besançon appelle directement l'API Appwrite (SDK client) sur une ligne de Chalon → **404/401 attendu**.
- Session : cookie httpOnly, `secure`, `sameSite=lax` ; middleware qui protège `/app/**`.
- Clôture mensuelle et séance validée : toute modification ultérieure exige admin + motif, tracée dans l'audit.

---

## 7. Phases

| # | Phase | Livrable vérifiable |
|---|---|---|
| 1 | **PLAN.md** + design system + `/dev/styleguide` | ce document validé, styleguide en captures |
| 2 | Fondations : Next.js, clients Appwrite, `lib/schema.ts` + `setup:appwrite`, auth (connexion, oubli, invitation), layout responsive, sélecteur de vue, `getContext`, permissions, test d'isolation | connexion réelle sur le projet Appwrite |
| 3 | Administration : villes, églises (mère/fille → teams), utilisateurs, départements, listes, comptes bancaires | créer Besançon + inviter un trésorier |
| 4 | Dons & offrandes + caisse + donateurs | séance du dimanche en < 2 min sur mobile |
| 5 | Dépôts + trésorerie | caisse ↓ banque ↑, bordereau photo |
| 6 | Dépenses, projets, workflow de validation, écran « À valider » | dépense > seuil bloquée sans église mère |
| 7 | Remboursements (lien public, suivi, notifications, dépense auto) | parcours e2e complet |
| 8 | Besoins des départements (liens + QR, suivi, conversion, budget département) | parcours e2e complet |
| 9 | Demandes Cité Royale (liste, Kanban, réception, alerte d'attente) | |
| 10 | Dashboards église & consolidé, compte de résultat, budget, rapprochement CSV, clôture | |
| 11 | Exports Excel/PDF, emails, centre de notifications, journal d'audit | |
| 12 | Seed de démo, tests unitaires + e2e, PWA, Lighthouse ≥ 90, revue design, README pas-à-pas | critères d'acceptation cochés |

À la fin de chaque phase : résumé, captures 390 px + 1440 px, reste à faire, commit poussé.

---

## 8. Questions à trancher avant de coder

1. **Projet Appwrite** : quel est le **Project ID** ? (L'endpoint `fra.cloud.appwrite.io` est joignable depuis cet environnement, et une clé y est déjà injectée, mais il me faut l'ID du projet pour l'utiliser.) Le projet est-il vide ?
2. **Emails** : quel fournisseur brancher dans Appwrite Messaging — **Resend** (simple, recommandé) ou un SMTP existant ? Quelle adresse d'expédition (ex. `finances@…`) ?
3. **Hébergement** de l'app Next.js : Vercel (recommandé), ou autre ? Nom de domaine ?
4. **Next.js 15** (comme demandé) ou **16** (dernière version stable) ? Je propose 15.
5. **Reçu fiscal** : je le livre désactivé par défaut, comme demandé — d'accord ?
6. Le skill `frontend-design` n'est pas installable dans cette session cloud ; j'applique directement les principes de design de la section 5 du cahier des charges. OK ?
7. Branche Git : le dépôt étant vide, je pousse sur **`main`** (commit initial), puis une branche par phase. Ça vous convient ?
