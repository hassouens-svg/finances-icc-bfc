/**
 * Contenu du guide d'utilisation — source unique pour la page « Guide » et l'aide contextuelle de chaque module.
 */
export type GuideStep = { title: string; text: string; href?: string; cta?: string };
export type GuideModule = { id: string; num?: number; short: string; title: string; who: string; summary: string; href: string; steps: GuideStep[]; tips?: string[] };

export const MODULES: GuideModule[] = [
  {
    id: "cite-royale", short: "Cité Royale", num: 1, title: "Achats & approvisionnement — Demandes à la Cité Royale", href: "/app/cite-royale",
    who: "Trésoriers (création), église mère (validation des demandes des églises filles)",
    summary: "Suivre toutes les demandes de matériel, d'équipement ou de financement envoyées à la Cité Royale, jusqu'à la réception.",
    steps: [
      { title: "Créer la demande", text: "Objet, type, motif, quantité, montant estimé, priorité et date souhaitée. Joignez devis et photos.", href: "/app/cite-royale/nouvelle", cta: "Nouvelle demande" },
      { title: "La lancer", text: "« Lancer la demande ». Une église fille passe d'abord par l'église mère (« À valider par l'église mère ») avant l'envoi." },
      { title: "Suivre l'envoi", text: "Marquez-la « Envoyée à la Cité Royale », puis « En attente ». Notez la référence donnée par la Cité Royale. Une alerte apparaît si elle reste en attente trop longtemps." },
      { title: "Enregistrer la réponse", text: "« Validée » ou « Refusée » (motif obligatoire)." },
      { title: "Réceptionner", text: "« Enregistrer la réception » : montant ou quantité reçus, date et photo du bon. L'écart avec la demande est calculé. Puis « Clôturer »." },
    ],
    tips: ["La vue « Tableau » (Kanban) montre d'un coup d'œil où en est chaque demande.", "Un besoin de département approuvé peut être converti en demande Cité Royale en un clic."],
  },
  {
    id: "besoins", short: "Besoins", num: 2, title: "Besoins des départements", href: "/app/besoins",
    who: "Responsables de départements (sans compte), trésoriers",
    summary: "Les départements expriment leurs besoins via un lien public ; la trésorerie étudie, approuve et finance.",
    steps: [
      { title: "Partager le lien", text: "Administration › Liens publics : créez un lien « Besoins » (général ou par département) et partagez-le par WhatsApp ou QR code.", href: "/app/admin/liens", cta: "Liens & QR codes" },
      { title: "Le responsable remplit le formulaire", text: "Sur son téléphone, sans compte. Il reçoit un lien de suivi personnel." },
      { title: "Étudier", text: "Ouvrez le besoin et cliquez sur « Mettre à l'étude ». Le demandeur voit le statut changer sur son lien de suivi." },
      { title: "Décider", text: "« Approuver » (montant total ou partiel) ou « Refuser » (commentaire obligatoire)." },
      { title: "Convertir et financer", text: "« Convertir » en dépense de l'église ou en demande à la Cité Royale, puis « Marquer comme financé »." },
    ],
    tips: ["Un budget annuel par département (Administration › Départements) affiche une jauge consommé / restant."],
  },
  {
    id: "remboursements", short: "Remboursements", num: 3, title: "Remboursements", href: "/app/remboursements",
    who: "Membres (sans compte), trésoriers, valideurs",
    summary: "Rembourser une personne qui a avancé une dépense pour l'église, avec photo du justificatif.",
    steps: [
      { title: "Partager le lien", text: "Administration › Liens publics : lien « Remboursements » + QR code.", href: "/app/admin/liens", cta: "Liens & QR codes" },
      { title: "La personne envoie sa demande", text: "Motif, montant, date et photo du ticket (obligatoire). Aucune coordonnée bancaire n'est demandée en ligne." },
      { title: "Vérifier puis valider", text: "« Commencer la vérification », puis « Valider » en choisissant la catégorie. Une dépense liée est créée avec le justificatif et suit le circuit de validation." },
      { title: "Rembourser", text: "Quand la dépense liée est entièrement validée, « Rembourser » : date, mode et preuve. La dépense passe « Payée » et le demandeur est prévenu." },
    ],
  },
  {
    id: "offrandes", short: "Offrandes", num: 4, title: "Dons & offrandes", href: "/app/offrandes",
    who: "Trésoriers et équipes de comptage",
    summary: "Saisir les offrandes de chaque culte, enveloppe par enveloppe, avec enregistrement automatique et comptage à deux.",
    steps: [
      { title: "Ouvrir la séance", text: "« Saisir des offrandes » : choisissez la date et le culte, puis « Commencer la saisie ».", href: "/app/offrandes/nouvelle", cta: "Saisir des offrandes" },
      { title: "Saisir chaque enveloppe", text: "Nominatif ou Anonyme → nom (proposé automatiquement s'il est connu) → montant → Entrée. Chaque enveloppe est enregistrée immédiatement : pas de bouton « Enregistrer »." },
      { title: "Type et moyen restent sélectionnés", text: "Dîme, offrande… et Espèces, Chèque… restent choisis pour l'enveloppe suivante. Changez-les seulement quand c'est nécessaire." },
      { title: "Corriger", text: "Crayon pour modifier une enveloppe, corbeille pour la supprimer. Vous pouvez quitter la page et reprendre plus tard (« Saisies en cours »)." },
      { title: "Comptage et validation", text: "Les deux compteurs recomptent espèces et chèques ; l'écart s'affiche. « Valider la séance » verrouille la séance et met l'argent « En caisse »." },
    ],
    tips: [
      "Chaque nouveau nom crée automatiquement une fiche dans « Donateurs », avec l'historique de ses dons.",
      "Au clavier : Nom → Entrée → Montant → Entrée. Une centaine d'enveloppes se saisit en quelques minutes.",
      "Une séance validée ne se modifie plus (sauf déverrouillage par un administrateur, tracé).",
    ],
  },
  {
    id: "depenses", short: "Dépenses", num: 5, title: "Dépenses, projets & validation", href: "/app/depenses",
    who: "Trésoriers (saisie, paiement), pasteurs et église mère (validation)",
    summary: "Toute dépense suit un circuit de validation avant de pouvoir être payée.",
    steps: [
      { title: "Saisir la dépense", text: "Objet, montant, catégorie, fournisseur, photo de la facture. Rattachez-la si besoin à un projet.", href: "/app/depenses/nouvelle", cta: "Nouvelle dépense" },
      { title: "Soumettre à validation", text: "Le circuit est choisi automatiquement (ex. < 100 € : trésorier ; 100–500 € : + pasteur ; ≥ 500 € : + église mère)." },
      { title: "Valider", text: "Chaque valideur reçoit une notification et utilise l'écran « À valider » : Approuver, Refuser ou Demander une précision.", href: "/app/a-valider", cta: "À valider" },
      { title: "Payer", text: "Après la dernière validation seulement : « Marquer payée ». La caisse ou la banque est débitée." },
    ],
    tips: ["Dépense déjà avancée ? Cochez « régularisation » : le motif est obligatoire et le circuit reste le même.", "Projets & événements : budget prévu vs réalisé avec jauge."],
  },
  {
    id: "depots", short: "Dépôts", num: 6, title: "Dépôts bancaires", href: "/app/depots",
    who: "Trésoriers",
    summary: "Porter à la banque l'argent « En caisse » (espèces et chèques des offrandes).",
    steps: [
      { title: "Préparer le dépôt", text: "« Nouveau dépôt » : cochez les séances à déposer (ou un montant libre), vérifiez la liste des chèques.", href: "/app/depots/nouveau", cta: "Nouveau dépôt" },
      { title: "Bordereau", text: "Compte bancaire, date, déposant, n° et photo du bordereau." },
      { title: "Déposé", text: "Une fois l'argent remis : la caisse diminue, la banque augmente du même montant." },
      { title: "Confirmer sur le relevé", text: "Indiquez le montant crédité et la date de valeur ; un écart éventuel est signalé et corrigé en banque." },
    ],
  },
  {
    id: "tresorerie", short: "Trésorerie", num: 7, title: "Trésorerie, budget & comptabilité", href: "/app/tresorerie",
    who: "Trésoriers, pasteurs, église mère",
    summary: "Soldes en temps réel, compte de résultat, budget, rapprochement bancaire, clôture mensuelle et exports.",
    steps: [
      { title: "Trésorerie", text: "Caisse, chaque compte bancaire, courbe sur 12 mois et prévisionnel.", href: "/app/tresorerie", cta: "Trésorerie" },
      { title: "Compte de résultat", text: "Dons et offrandes − dépenses payées = résultat, comparé à la période précédente.", href: "/app/compte-de-resultat", cta: "Compte de résultat" },
      { title: "Budget", text: "Prévu vs réalisé par catégorie ou département.", href: "/app/budget", cta: "Budget" },
      { title: "Rapprochement", text: "Importez le relevé (CSV) et pointez chaque ligne avec un dépôt ou une dépense.", href: "/app/rapprochement", cta: "Rapprochement" },
      { title: "Clôturer le mois", text: "Depuis la Trésorerie : un mois clôturé ne peut plus être modifié." },
      { title: "Exporter", text: "Rapports Excel et PDF prêts à signer.", href: "/app/rapports", cta: "Rapports" },
    ],
  },
];

export const ROLES_GUIDE: { role: string; does: string[] }[] = [
  { role: "Super administrateur", does: ["Crée les villes et les églises, désigne l'église mère, ajoute les logos", "Crée tous les comptes, y compris d'autres super administrateurs", "Voit le journal d'audit complet et règle tous les paramètres"] },
  { role: "Administrateur église mère", does: ["Bascule entre « Toutes les églises » et une église précise", "Crée les églises filles et les comptes de leurs équipes", "Règle les circuits de validation et les alertes, valide les grosses dépenses"] },
  { role: "Trésorier", does: ["Saisit offrandes, dépenses, dépôts", "Traite remboursements et besoins, crée les demandes Cité Royale", "Gère les départements, comptes bancaires et liens publics de son église"] },
  { role: "Pasteur / Responsable", does: ["Consulte tout ce qui concerne son église", "Valide les dépenses à son étape du circuit"] },
  { role: "Lecteur", does: ["Consultation seule (conseil, auditeur)"] },
];

export const FIRST_STEPS: GuideStep[] = [
  { title: "Créer les églises", text: "Super admin : Administration › Villes & églises. Créez Dijon avec son logo et cochez « Église mère », puis les églises filles.", href: "/app/admin/eglises", cta: "Villes & églises" },
  { title: "Créer les comptes", text: "Administration › Utilisateurs › « Créer un compte » : église, rôle, et mot de passe (ou lien d'invitation).", href: "/app/admin/utilisateurs", cta: "Utilisateurs" },
  { title: "Préparer chaque église", text: "Comptes bancaires (avec solde de départ), départements, puis liens publics.", href: "/app/admin", cta: "Administration" },
  { title: "Régler les règles", text: "Église mère : circuits de validation et seuils d'alerte.", href: "/app/admin/workflows", cta: "Circuits de validation" },
  { title: "Utiliser au quotidien", text: "Saisir les offrandes chaque dimanche, déposer la caisse, saisir et valider les dépenses." },
];

export function guideFor(id: string) {
  return MODULES.find((m) => m.id === id);
}
