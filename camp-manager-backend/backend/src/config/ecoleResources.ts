// Registre des ressources « école » gérées par le CRUD générique.
// Chaque entrée décrit une table, les champs modifiables et le module (autorisation) requis.

export type FieldKind = 'string' | 'date' | 'datetime' | 'number' | 'ref'
export type RefModel = 'eleve' | 'classe' | 'enseignant' | 'groupeEcole'

export interface Field {
  name: string
  kind: FieldKind
  required?: boolean
  ref?: RefModel
}

export interface Resource {
  path: string                         // /api/ecole/<path>
  model: string                        // delegate Prisma
  module: string                       // autorisation requise
  scope: 'camp' | 'eleve'              // la ligne porte campId, ou passe par l'élève
  fields: Field[]
  include?: Record<string, unknown>
  orderBy?: Record<string, 'asc' | 'desc'>
  unique?: string[]                    // POST = upsert sur cette clé composite
  methods?: ('GET' | 'POST' | 'PUT' | 'DELETE')[]
  adminDelete?: boolean                // suppression réservée aux admins
  setAuthor?: string                   // champ rempli avec l'utilisateur connecté
}

const s = (name: string, required = false): Field => ({ name, kind: 'string', required })
const d = (name: string, required = false): Field => ({ name, kind: 'date', required })
const dt = (name: string, required = false): Field => ({ name, kind: 'datetime', required })
const n = (name: string, required = false): Field => ({ name, kind: 'number', required })
const ref = (name: string, r: RefModel, required = false): Field => ({ name, kind: 'ref', ref: r, required })

const withEleve = { eleve: { select: { id: true, nom: true, prenom: true } } }
const withClasse = { classe: { select: { id: true, nom: true } } }
const withEnseignant = { enseignant: { select: { id: true, nom: true, prenom: true } } }

export const RESOURCES: Resource[] = [
  {
    path: 'sante', model: 'eleve', module: 'sante_ecole', scope: 'camp', methods: ['GET', 'PUT'],
    fields: [s('groupeSanguin'), s('allergies'), s('medicaments'), s('infosMedicales')],
    include: withClasse, orderBy: { nom: 'asc' },
  },
  {
    path: 'enseignants', model: 'enseignant', module: 'enseignants', scope: 'camp', adminDelete: true,
    fields: [s('nom', true), s('prenom', true), s('telephone'), s('email'), s('specialite'), s('statut'), d('dateArrivee'), s('notes'), ref('classeId', 'classe')],
    include: withClasse, orderBy: { nom: 'asc' },
  },
  {
    path: 'emploi-temps', model: 'activiteEcole', module: 'emploi_temps', scope: 'camp',
    fields: [s('titre', true), s('description'), s('lieu'), s('couleur'), dt('debut', true), dt('fin', true), ref('classeId', 'classe'), ref('enseignantId', 'enseignant')],
    include: { ...withClasse, ...withEnseignant }, orderBy: { debut: 'asc' },
  },
  {
    path: 'frais', model: 'paiementEleve', module: 'frais', scope: 'eleve', adminDelete: true,
    fields: [ref('eleveId', 'eleve', true), s('libelle', true), n('montant', true), s('methode'), dt('datePaiement'), s('reference'), s('notes')],
    include: withEleve, orderBy: { datePaiement: 'desc' },
  },
  {
    path: 'depenses-ecole', model: 'depenseEcole', module: 'frais', scope: 'camp', adminDelete: true,
    fields: [s('libelle', true), s('categorie', true), n('montant', true), dt('dateDepense'), s('notes')],
    orderBy: { dateDepense: 'desc' },
  },
  {
    path: 'documents-eleves', model: 'documentEleve', module: 'documents_eleves', scope: 'eleve',
    fields: [ref('eleveId', 'eleve', true), s('nom', true), s('type', true), s('statut'), s('url'), s('notes')],
    include: withEleve, orderBy: { createdAt: 'desc' },
  },
  {
    path: 'messages-ecole', model: 'messageEcole', module: 'messages_ecole', scope: 'camp', setAuthor: 'auteurId',
    fields: [s('sujet', true), s('contenu', true), ref('eleveId', 'eleve')],
    include: withEleve, orderBy: { createdAt: 'desc' },
  },
  {
    path: 'sorties-eleves', model: 'sortieEleve', module: 'sorties_eleves', scope: 'camp',
    fields: [s('nom', true), s('prenom', true), dt('heureSortie', true), s('motif', true), s('personne'), dt('heureRetour'), s('notes'), ref('eleveId', 'eleve')],
    orderBy: { heureSortie: 'desc' },
  },
  {
    path: 'visiteurs-ecole', model: 'visiteurEcole', module: 'visiteurs_ecole', scope: 'camp',
    fields: [s('nom', true), s('prenom', true), s('telephone', true), s('motif', true), s('heureArrivee'), s('heureDepart'), s('notes')],
    orderBy: { createdAt: 'desc' },
  },
  {
    path: 'dons-ecole', model: 'donEcole', module: 'dons_ecole', scope: 'camp',
    fields: [s('nom', true), s('prenom', true), s('telephone'), s('description', true), n('montant'), s('notes')],
    orderBy: { createdAt: 'desc' },
  },
  {
    path: 'lecons', model: 'leconEcole', module: 'lecons', scope: 'camp',
    fields: [d('date', true), s('matiere'), s('theme', true), s('contenu', true), s('notes'), ref('classeId', 'classe'), ref('enseignantId', 'enseignant')],
    include: { ...withClasse, ...withEnseignant }, orderBy: { date: 'desc' },
  },
  {
    path: 'causeries-ecole', model: 'causerieEcole', module: 'causeries_ecole', scope: 'camp', unique: ['groupeId', 'date'],
    fields: [ref('groupeId', 'groupeEcole', true), d('date', true), s('theme', true), s('resume'), s('notes')],
    include: { groupe: { select: { id: true, nom: true, couleur: true } } }, orderBy: { date: 'desc' },
  },
]
