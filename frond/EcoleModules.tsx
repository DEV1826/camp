import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import api from './http'
import { Header, Field, Modal, errMsg, today, fmtDate, useCampId } from './EcolePages'

// ─── Types de champs ─────────────────────────────────────────
type FType = 'text' | 'textarea' | 'date' | 'datetime' | 'time' | 'number' | 'select' | 'eleve' | 'classe' | 'enseignant' | 'groupe'

interface FieldCfg {
  name: string
  label: string
  type: FType
  required?: boolean
  options?: [string, string][]
  hideInList?: boolean
}

interface CrudCfg {
  title: string
  subtitle: string
  path: string                        // /ecole/<path>
  addLabel?: string
  fields: FieldCfg[]
  canCreate?: boolean
  canDelete?: boolean
  identity?: (row: Row) => string     // colonne d'identité (ex. élève)
}

type Row = Record<string, any>
type Lookup = { id: string; nom: string; prenom?: string }

const money = (n: number | string | null | undefined) =>
  n === null || n === undefined ? '–' : `${Number(n).toLocaleString('fr-FR')} FCFA`
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fullName = (l?: Lookup | null) => (l ? [l.nom, l.prenom].filter(Boolean).join(' ') : '–')

// Champ référence → { chemin d'API des options, clé de la relation renvoyée }
const REFS: Partial<Record<FType, { path: string; rel: string }>> = {
  eleve: { path: '/eleves', rel: 'eleve' },
  classe: { path: '/classes', rel: 'classe' },
  enseignant: { path: '/ecole/enseignants', rel: 'enseignant' },
  groupe: { path: '/groupes-ecole', rel: 'groupe' },
}

// ─── Page générique ──────────────────────────────────────────
export function CrudPage({ cfg, embedded, onChange }: { cfg: CrudCfg; embedded?: boolean; onChange?: () => void }) {
  const campId = useCampId()
  const [rows, setRows] = useState<Row[]>([])
  const [lookups, setLookups] = useState<Partial<Record<FType, Lookup[]>>>({})
  const [form, setForm] = useState<Row>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const canCreate = cfg.canCreate !== false
  const canDelete = cfg.canDelete !== false

  const load = useCallback(() => {
    api.get(`/ecole/${cfg.path}?campId=${campId}`).then(({ data }) => setRows(data.data || [])).catch(() => setRows([]))
  }, [campId, cfg.path])
  useEffect(load, [load])

  // Options des champs de type référence
  useEffect(() => {
    for (const t of new Set(cfg.fields.map(f => f.type))) {
      const ref = REFS[t]
      if (ref) api.get(`${ref.path}?campId=${campId}`).then(({ data }) => setLookups(l => ({ ...l, [t]: data.data || [] }))).catch(() => {})
    }
  }, [campId, cfg.fields])

  const initialForm = () => Object.fromEntries(cfg.fields.map(f => [f.name, f.type === 'date' ? today() : '']))

  const openNew = () => { setEditingId(null); setForm(initialForm()); setError(''); setOpen(true) }
  const openEdit = (row: Row) => {
    setEditingId(row.id)
    setForm(Object.fromEntries(cfg.fields.map(f => {
      const v = row[f.name]
      if (v === null || v === undefined) return [f.name, '']
      if (f.type === 'date') return [f.name, String(v).slice(0, 10)]
      if (f.type === 'datetime') return [f.name, toLocalInput(v)]
      return [f.name, v]
    })))
    setError(''); setOpen(true)
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault(); setError('')
    const body: Row = { campId }
    for (const f of cfg.fields) {
      const v = form[f.name]
      body[f.name] = f.type === 'datetime' && v ? new Date(v).toISOString() : v
    }
    try {
      if (editingId) await api.put(`/ecole/${cfg.path}/${editingId}`, body)
      else await api.post(`/ecole/${cfg.path}`, body)
      setOpen(false); load(); onChange?.()
    } catch (err) { setError(errMsg(err)) }
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer cet élément ?')) return
    await api.delete(`/ecole/${cfg.path}/${id}`).catch(() => {}); load(); onChange?.()
  }

  const cell = (row: Row, f: FieldCfg): ReactNode => {
    const v = row[f.name]
    const ref = REFS[f.type]
    if (ref) return f.type === 'classe' || f.type === 'groupe' ? (row[ref.rel]?.nom ?? '–') : fullName(row[ref.rel])
    if (v === null || v === undefined || v === '') return '–'
    if (f.type === 'date') return fmtDate(v)
    if (f.type === 'datetime') return fmtDateTime(v)
    if (f.type === 'number') return money(v)
    if (f.type === 'select') return f.options?.find(o => o[0] === v)?.[1] ?? v
    return String(v)
  }

  const listFields = cfg.fields.filter(f => f.type !== 'textarea' && !f.hideInList)

  const input = (f: FieldCfg) => {
    const val = form[f.name] ?? ''
    const set = (v: string) => setForm({ ...form, [f.name]: v })
    const common = { className: 'input-field', required: f.required, value: val }
    const ref = REFS[f.type]
    if (ref) {
      return (
        <select {...common} onChange={e => set(e.target.value)}>
          <option value="">{f.required ? '— Choisir —' : '— Aucun —'}</option>
          {(lookups[f.type] ?? []).map(o => <option key={o.id} value={o.id}>{fullName(o)}</option>)}
        </select>
      )
    }
    if (f.type === 'select') {
      return <select {...common} onChange={e => set(e.target.value)}>{f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    }
    if (f.type === 'textarea') return <textarea {...common} className="input-field min-h-24" onChange={e => set(e.target.value)} />
    const htmlType = f.type === 'datetime' ? 'datetime-local' : f.type === 'number' ? 'number' : f.type
    return <input {...common} type={htmlType} min={f.type === 'number' ? 0 : undefined} onChange={e => set(e.target.value)} />
  }

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-6xl mx-auto space-y-6'}>
      {!embedded && (
        <Header title={cfg.title} subtitle={`${rows.length} enregistrement${rows.length > 1 ? 's' : ''} — ${cfg.subtitle}`}
          action={canCreate ? <button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={16} />{cfg.addLabel ?? 'Ajouter'}</button> : undefined} />
      )}
      {embedded && canCreate && (
        <div className="flex justify-end"><button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={16} />{cfg.addLabel ?? 'Ajouter'}</button></div>
      )}

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-center py-10 text-ink-3 text-sm">Rien à afficher pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-3 text-xs border-b border-border">
              {cfg.identity && <th className="py-2">Élève</th>}
              {listFields.map(f => <th key={f.name} className="py-2 pr-3">{f.label}</th>)}
              <th />
            </tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-border/50">
                  {cfg.identity && <td className="py-2 font-medium">{cfg.identity(row)}</td>}
                  {listFields.map(f => <td key={f.name} className="py-2 pr-3">{cell(row, f)}</td>)}
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => openEdit(row)} className="p-1.5 text-ink-3 hover:text-ink"><Edit2 size={14} /></button>
                    {canDelete && <button onClick={() => remove(row.id)} className="p-1.5 text-ink-3 hover:text-ember"><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={editingId ? 'Modifier' : cfg.addLabel ?? 'Ajouter'} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{error}</div>}
            {cfg.identity && editingId && <p className="text-sm font-medium">{cfg.identity(rows.find(r => r.id === editingId) ?? {})}</p>}
            <div className="grid grid-cols-2 gap-3">
              {cfg.fields.map(f => (
                <div key={f.name} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                  <Field label={f.label + (f.required ? ' *' : '')}>{input(f)}</Field>
                </div>
              ))}
            </div>
            <button className="btn-primary">{editingId ? 'Enregistrer' : 'Ajouter'}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Configurations des modules ──────────────────────────────
const STATUT_ENSEIGNANT: [string, string][] = [['ACTIF', 'Actif'], ['CONGE', 'En congé'], ['INACTIF', 'Inactif']]
const METHODES: [string, string][] = [['ESPECES', 'Espèces'], ['MOBILE_MONEY', 'Mobile money'], ['VIREMENT', 'Virement'], ['CHEQUE', 'Chèque']]
const STATUT_DOC: [string, string][] = [['EN_ATTENTE', 'En attente'], ['VALIDE', 'Validé'], ['REJETE', 'Rejeté']]

const CFG = {
  sante: {
    title: 'Médical', subtitle: 'dossier de santé des élèves', path: 'sante', canCreate: false, canDelete: false,
    identity: r => `${r.nom ?? ''} ${r.prenom ?? ''}`.trim(),
    fields: [
      { name: 'groupeSanguin', label: 'Groupe sanguin', type: 'text' },
      { name: 'allergies', label: 'Allergies', type: 'text' },
      { name: 'medicaments', label: 'Médicaments', type: 'text' },
      { name: 'infosMedicales', label: 'Infos médicales', type: 'textarea' },
    ],
  },
  enseignants: {
    title: 'Enseignants', subtitle: 'personnel enseignant', path: 'enseignants', addLabel: 'Nouvel enseignant',
    fields: [
      { name: 'nom', label: 'Nom', type: 'text', required: true },
      { name: 'prenom', label: 'Prénom', type: 'text', required: true },
      { name: 'telephone', label: 'Téléphone', type: 'text' },
      { name: 'email', label: 'Email', type: 'text', hideInList: true },
      { name: 'specialite', label: 'Spécialité', type: 'text' },
      { name: 'classeId', label: 'Classe', type: 'classe' },
      { name: 'statut', label: 'Statut', type: 'select', options: STATUT_ENSEIGNANT },
      { name: 'dateArrivee', label: "Date d'arrivée", type: 'date', hideInList: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  emploi: {
    title: 'Emploi du temps', subtitle: 'cours et activités de la classe', path: 'emploi-temps', addLabel: 'Nouvelle activité',
    fields: [
      { name: 'titre', label: 'Titre', type: 'text', required: true },
      { name: 'debut', label: 'Début', type: 'datetime', required: true },
      { name: 'fin', label: 'Fin', type: 'datetime', required: true },
      { name: 'classeId', label: 'Classe', type: 'classe' },
      { name: 'enseignantId', label: 'Enseignant', type: 'enseignant' },
      { name: 'lieu', label: 'Lieu', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  paiements: {
    title: 'Paiements', subtitle: 'frais de scolarité', path: 'frais', addLabel: 'Nouveau paiement',
    fields: [
      { name: 'eleveId', label: 'Élève', type: 'eleve', required: true },
      { name: 'libelle', label: 'Libellé (ex. Tranche 1)', type: 'text', required: true },
      { name: 'montant', label: 'Montant (FCFA)', type: 'number', required: true },
      { name: 'methode', label: 'Méthode', type: 'select', options: METHODES },
      { name: 'datePaiement', label: 'Date', type: 'datetime' },
      { name: 'reference', label: 'Référence', type: 'text', hideInList: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  depenses: {
    title: 'Dépenses', subtitle: "sorties d'argent de l'école", path: 'depenses-ecole', addLabel: 'Nouvelle dépense',
    fields: [
      { name: 'libelle', label: 'Libellé', type: 'text', required: true },
      { name: 'categorie', label: 'Catégorie', type: 'text', required: true },
      { name: 'montant', label: 'Montant (FCFA)', type: 'number', required: true },
      { name: 'dateDepense', label: 'Date', type: 'datetime' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  documents: {
    title: 'Documents', subtitle: 'pièces des élèves (certificats, autorisations…)', path: 'documents-eleves', addLabel: 'Nouveau document',
    fields: [
      { name: 'eleveId', label: 'Élève', type: 'eleve', required: true },
      { name: 'nom', label: 'Nom du document', type: 'text', required: true },
      { name: 'type', label: 'Type', type: 'text', required: true },
      { name: 'statut', label: 'Statut', type: 'select', options: STATUT_DOC },
      { name: 'url', label: 'Lien du fichier', type: 'text', hideInList: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  messages: {
    title: 'Messages', subtitle: 'communications avec les parents', path: 'messages-ecole', addLabel: 'Nouveau message',
    fields: [
      { name: 'sujet', label: 'Sujet', type: 'text', required: true },
      { name: 'eleveId', label: 'Élève concerné', type: 'eleve' },
      { name: 'contenu', label: 'Message', type: 'textarea', required: true },
    ],
  },
  sorties: {
    title: 'Sorties des élèves', subtitle: 'sorties et retours pendant la journée', path: 'sorties-eleves', addLabel: 'Nouvelle sortie',
    fields: [
      { name: 'nom', label: 'Nom', type: 'text', required: true },
      { name: 'prenom', label: 'Prénom', type: 'text', required: true },
      { name: 'heureSortie', label: 'Heure de sortie', type: 'datetime', required: true },
      { name: 'motif', label: 'Motif', type: 'text', required: true },
      { name: 'personne', label: 'Personne qui récupère', type: 'text' },
      { name: 'heureRetour', label: 'Heure de retour', type: 'datetime' },
      { name: 'eleveId', label: 'Élève (fiche)', type: 'eleve', hideInList: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  visiteurs: {
    title: 'Visiteurs', subtitle: "registre des visites à l'école", path: 'visiteurs-ecole', addLabel: 'Nouveau visiteur',
    fields: [
      { name: 'nom', label: 'Nom', type: 'text', required: true },
      { name: 'prenom', label: 'Prénom', type: 'text', required: true },
      { name: 'telephone', label: 'Téléphone', type: 'text', required: true },
      { name: 'motif', label: 'Motif de la visite', type: 'text', required: true },
      { name: 'heureArrivee', label: 'Heure d\'arrivée', type: 'time' },
      { name: 'heureDepart', label: 'Heure de départ', type: 'time' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  dons: {
    title: 'Dons', subtitle: 'dons reçus par l\'école', path: 'dons-ecole', addLabel: 'Nouveau don',
    fields: [
      { name: 'nom', label: 'Nom', type: 'text', required: true },
      { name: 'prenom', label: 'Prénom', type: 'text', required: true },
      { name: 'telephone', label: 'Téléphone', type: 'text' },
      { name: 'description', label: 'Description du don', type: 'text', required: true },
      { name: 'montant', label: 'Montant (FCFA)', type: 'number' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  lecons: {
    title: 'Leçons', subtitle: 'cahier journal des enseignements', path: 'lecons', addLabel: 'Nouvelle leçon',
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'matiere', label: 'Matière / domaine', type: 'text' },
      { name: 'theme', label: 'Thème', type: 'text', required: true },
      { name: 'classeId', label: 'Classe', type: 'classe' },
      { name: 'enseignantId', label: 'Enseignant', type: 'enseignant' },
      { name: 'contenu', label: 'Contenu', type: 'textarea', required: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  causeries: {
    title: 'Causeries des groupes', subtitle: 'un thème par groupe et par jour', path: 'causeries-ecole', addLabel: 'Nouvelle causerie',
    fields: [
      { name: 'groupeId', label: 'Groupe', type: 'groupe', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'theme', label: 'Thème', type: 'text', required: true },
      { name: 'resume', label: 'Résumé', type: 'textarea' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
} satisfies Record<string, CrudCfg>

export const SantePage = () => <CrudPage cfg={CFG.sante} />
export const EnseignantsPage = () => <CrudPage cfg={CFG.enseignants} />
export const EmploiTempsPage = () => <CrudPage cfg={CFG.emploi} />
export const DocumentsElevesPage = () => <CrudPage cfg={CFG.documents} />
export const MessagesEcolePage = () => <CrudPage cfg={CFG.messages} />
export const SortiesElevesPage = () => <CrudPage cfg={CFG.sorties} />
export const VisiteursEcolePage = () => <CrudPage cfg={CFG.visiteurs} />
export const DonsEcolePage = () => <CrudPage cfg={CFG.dons} />
export const LeconsPage = () => <CrudPage cfg={CFG.lecons} />
export const CauseriesEcolePage = () => <CrudPage cfg={CFG.causeries} />

// ─── Frais de scolarité : paiements, dépenses, bilan ─────────
export function FraisPage() {
  const campId = useCampId()
  const [tab, setTab] = useState<'paiements' | 'depenses' | 'bilan'>('paiements')
  const [version, setVersion] = useState(0)
  const [eleves, setEleves] = useState<Lookup[]>([])
  const [paiements, setPaiements] = useState<Row[]>([])
  const [depenses, setDepenses] = useState<Row[]>([])
  const [frais, setFrais] = useState(0)

  useEffect(() => {
    api.get(`/eleves?campId=${campId}`).then(({ data }) => setEleves(data.data || [])).catch(() => {})
    api.get('/camps?perPage=1').then(({ data }) => setFrais(Number(data.data?.[0]?.prixBase ?? 0))).catch(() => {})
  }, [campId])
  useEffect(() => {
    api.get(`/ecole/frais?campId=${campId}`).then(({ data }) => setPaiements(data.data || [])).catch(() => {})
    api.get(`/ecole/depenses-ecole?campId=${campId}`).then(({ data }) => setDepenses(data.data || [])).catch(() => {})
  }, [campId, version])

  const encaisse = paiements.reduce((s, p) => s + Number(p.montant), 0)
  const sorties = depenses.reduce((s, d) => s + Number(d.montant), 0)

  const bilan = useMemo(() => eleves.map(e => {
    const paye = paiements.filter(p => p.eleveId === e.id).reduce((s, p) => s + Number(p.montant), 0)
    return { ...e, paye, reste: Math.max(frais - paye, 0) }
  }), [eleves, paiements, frais])

  const TABS = [['paiements', 'Paiements'], ['depenses', 'Dépenses'], ['bilan', 'Bilan par élève']] as const

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Header title="Frais de scolarité" subtitle={`Frais annuels par élève : ${money(frais)}`} />
      <div className="grid grid-cols-3 gap-3">
        {[['Encaissé', encaisse], ['Dépenses', sorties], ['Solde', encaisse - sorties]].map(([l, v]) => (
          <div key={l as string} className="card text-center">
            <p className="text-xl font-display font-700 text-ink">{money(v as number)}</p>
            <p className="text-xs text-ink-3 mt-1">{l}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border ${tab === k ? 'bg-sage/12 text-sage border-sage/20' : 'text-ink-2 border-border'}`}>{l}</button>
        ))}
      </div>
      {tab === 'paiements' && <CrudPage cfg={CFG.paiements} embedded onChange={() => setVersion(v => v + 1)} />}
      {tab === 'depenses' && <CrudPage cfg={CFG.depenses} embedded onChange={() => setVersion(v => v + 1)} />}
      {tab === 'bilan' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-3 text-xs border-b border-border"><th className="py-2">Élève</th><th>Payé</th><th>Reste à payer</th><th>Situation</th></tr></thead>
            <tbody>
              {bilan.map(b => (
                <tr key={b.id} className="border-b border-border/50">
                  <td className="py-2 font-medium">{fullName(b)}</td><td>{money(b.paye)}</td><td>{money(b.reste)}</td>
                  <td><span className={`px-2 py-0.5 rounded-full text-xs ${b.reste === 0 && frais > 0 ? 'bg-sage/15 text-sage' : b.paye > 0 ? 'bg-gold/15 text-gold' : 'bg-ember/10 text-ember'}`}>
                    {b.reste === 0 && frais > 0 ? 'Soldé' : b.paye > 0 ? 'Partiel' : 'Impayé'}</span></td>
                </tr>
              ))}
              {bilan.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-ink-3">Aucun élève.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Rapport journalier ──────────────────────────────────────
export function RapportEcolePage() {
  const campId = useCampId()
  const [date, setDate] = useState(today())
  const [auto, setAuto] = useState<Row | null>(null)
  const [form, setForm] = useState({ resume: '', incidents: '', observations: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setMsg('')
    api.get(`/ecole/rapports?campId=${campId}&date=${date}`).then(({ data }) => {
      setAuto(data.data.auto)
      const r = data.data.rapport
      setForm({ resume: r?.resume ?? '', incidents: r?.incidents ?? '', observations: r?.observations ?? '' })
    }).catch(() => setAuto(null))
  }, [campId, date])

  const save = async () => {
    try { await api.put('/ecole/rapports', { campId, date, ...form }); setMsg('Rapport enregistré ✓') }
    catch (err) { setMsg(errMsg(err)) }
  }

  const cards: [string, string | number | undefined][] = [
    ['Présents', auto?.presents], ['Absents', auto?.absents], ['Sorties', auto?.sorties], ['Visiteurs', auto?.visiteurs],
    ['Encaissé', auto ? money(auto.encaisse) : undefined], ['Dépenses', auto ? money(auto.depenses) : undefined],
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Header title="Rapport journalier" subtitle="Chiffres du jour calculés automatiquement"
        action={<input type="date" className="input-field w-auto" value={date} onChange={e => setDate(e.target.value)} />} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(([l, v]) => (
          <div key={l} className="card text-center"><p className="text-xl font-display font-700 text-ink">{v ?? '–'}</p><p className="text-xs text-ink-3 mt-1">{l}</p></div>
        ))}
      </div>
      <div className="card space-y-3">
        {(['resume', 'incidents', 'observations'] as const).map(k => (
          <Field key={k} label={{ resume: 'Résumé de la journée', incidents: 'Incidents', observations: 'Observations' }[k]}>
            <textarea className="input-field min-h-24" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
          </Field>
        ))}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save}>Enregistrer</button>
          {msg && <span className="text-sm text-ink-2">{msg}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Statistiques ────────────────────────────────────────────
const COULEURS_EVAL: [string, string, string][] = [['VERT', 'Acquis', '#7eb87a'], ['JAUNE', 'En cours', '#e5c14a'], ['ORANGE', 'À renforcer', '#e08a3a'], ['ROUGE', 'Non acquis', '#d4614a']]

export function StatistiquesEcolePage() {
  const campId = useCampId()
  const [s, setS] = useState<Row | null>(null)
  useEffect(() => { api.get(`/ecole/statistiques-ecole?campId=${campId}`).then(({ data }) => setS(data.data)).catch(() => setS(null)) }, [campId])

  if (!s) return <div className="max-w-5xl mx-auto"><Header title="Statistiques" subtitle="Chargement…" /></div>

  const totalEval = COULEURS_EVAL.reduce((n, [k]) => n + (s.evaluations[k] ?? 0), 0)
  const maxClasse = Math.max(1, ...s.classes.map((c: Row) => c.total))
  const Card = ({ l, v }: { l: string; v: ReactNode }) => (
    <div className="card text-center"><p className="text-xl font-display font-700 text-ink">{v}</p><p className="text-xs text-ink-3 mt-1">{l}</p></div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Header title="Statistiques" subtitle="Vue d'ensemble de l'école" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card l="Élèves" v={s.eleves.total} /><Card l="Garçons" v={s.eleves.garcons} /><Card l="Filles" v={s.eleves.filles} />
        <Card l="Enseignants" v={s.enseignants} />
        <Card l="Encaissé" v={money(s.finances.encaisse)} /><Card l="Reste à encaisser" v={money(s.finances.reste)} />
        <Card l="Dépenses" v={money(s.finances.depenses)} /><Card l="Solde (dons inclus)" v={money(s.finances.solde)} />
        <Card l="Taux de présence" v={s.presences.taux === null ? '–' : `${s.presences.taux}%`} />
        <Card l="Visiteurs" v={s.visiteurs} /><Card l="Sorties" v={s.sorties} /><Card l="Dons" v={money(s.finances.dons)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h3 className="font-display font-700 text-ink">Effectif par classe</h3>
          {s.classes.length === 0 && <p className="text-sm text-ink-3">Aucune classe.</p>}
          {s.classes.map((c: Row) => (
            <div key={c.id}>
              <div className="flex justify-between text-xs text-ink-2 mb-1"><span>{c.nom}</span><span>{c.total}</span></div>
              <div className="h-2 bg-surface rounded-full overflow-hidden"><div className="h-full rounded-full bg-sage" style={{ width: `${(c.total / maxClasse) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card space-y-3">
          <h3 className="font-display font-700 text-ink">Évaluations (toutes périodes)</h3>
          {totalEval === 0 && <p className="text-sm text-ink-3">Aucune évaluation.</p>}
          {COULEURS_EVAL.map(([k, label, hex]) => {
            const n = s.evaluations[k] ?? 0
            return (
              <div key={k}>
                <div className="flex justify-between text-xs text-ink-2 mb-1"><span>{label}</span><span>{n}</span></div>
                <div className="h-2 bg-surface rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${totalEval ? (n / totalEval) * 100 : 0}%`, background: hex }} /></div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
