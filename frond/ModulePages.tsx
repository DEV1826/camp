import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Calendar, Check, CheckCircle, CreditCard, Download, Edit2, FileText, Mail, Pencil, Plus, Printer, Save,
  HeartPulse, Search, Settings, Trash2, Upload, Users, X,
} from 'lucide-react'
import api from './http'
import type { Activite, Camp, CampParoisse, CampStats, Depense, Paiement, Participant, StatutCamp } from './index'
import { formatCFA, formatDate, formatDateTime, statutCampBadge, statutCampLabel, statutInscriptionBadge, statutInscriptionLabel, statutPaiementBadge, statutPaiementLabel } from './helpers'
import { useAuthStore } from './auth.store'

type ApiList<T> = { data: T[]; meta?: { total?: number } }
type ApiOne<T> = { data: T }

type DocumentItem = {
  id: string
  nom: string
  type: string
  urlFichier: string
  statut: 'EN_ATTENTE' | 'VALIDE' | 'REJETE'
  notes?: string
  uploadedAt: string
  participant: { id: string; nom: string; prenom: string; camp?: { id: string; nom: string } }
}

type MessageItem = {
  id: string
  sujet: string
  contenu: string
  lu: boolean
  envoyeAt: string
  camp: { id: string; nom: string }
  expediteur: { nom: string; prenom: string; email: string }
  parent?: { nom: string; prenom: string; email: string; telephone: string }
}

type ActivityItem = Activite & {
  camp?: { id: string; nom: string }
  animateur?: { user: { nom: string; prenom: string } }
}

type PaymentItem = Paiement & {
  participant: { id: string; nom: string; prenom: string; camp?: { id: string; nom: string } }
}

type DepenseItem = Depense & {
  camp?: { id: string; nom: string }
}

const emptyCamp = {
  nom: '',
  description: '',
  lieu: '',
  adresse: '',
  dateDebut: '',
  dateFin: '',
  capaciteMax: 60,
  prixBase: 75000,
}

export const MODULE_LABELS: Record<string, string> = {
  participants: 'Participants', medical: 'Médical', groupes: 'Groupes', animateurs: 'Animateurs',
  planning: 'Planning', caisse: 'Caisse', documents: 'Documents', messages: 'Messages',
  statistiques: 'Statistiques', presence: 'Présence / Sorties', visiteurs: 'Visiteurs', dons: 'Dons',
  rapport: 'Rapport journalier', enseignements: 'Enseignements', causeries: 'Causeries groupes',
}

export const MODULE_LABELS_ECOLE: Record<string, string> = {
  eleves: 'Élèves', sante_ecole: 'Médical', groupes_ecole: 'Groupes', enseignants: 'Enseignants',
  emploi_temps: 'Emploi du temps', frais: 'Frais de scolarité', documents_eleves: 'Documents',
  messages_ecole: 'Messages', statistiques_ecole: 'Statistiques', sorties_eleves: 'Sorties des élèves',
  visiteurs_ecole: 'Visiteurs', dons_ecole: 'Dons', rapport_ecole: 'Rapport journalier',
  lecons: 'Leçons', causeries_ecole: 'Causeries des groupes',
  classes: 'Classes', evaluations: 'Évaluations (couleurs)', programme_ecole: 'Programme', presences_eleves: 'Appel des élèves',
}

export const CHAMPS_ELEVE_LABELS: Record<string, string> = {
  sexe: 'Sexe', dateNaissance: 'Date de naissance', lieuNaissance: 'Lieu de naissance',
  parent: 'Nom et prénom du parent', telephoneParent: 'Téléphone du parent', adresse: 'Adresse',
  infosMedicales: 'Infos médicales', classe: 'Classe', groupes: 'Groupes', notes: 'Notes',
}
export const CHAMPS_ELEVE_DEFAUT = ['sexe', 'dateNaissance', 'lieuNaissance', 'parent', 'telephoneParent', 'classe', 'groupes', 'notes']

export function ChampsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter(x => x !== c) : [...value, c])
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Object.entries(CHAMPS_ELEVE_LABELS).map(([c, label]) => (
        <label key={c} className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
          <input type="checkbox" checked={value.includes(c)} onChange={() => toggle(c)} />
          {label}
        </label>
      ))}
    </div>
  )
}

export const labelsFor = (type?: string) => (type === 'ECOLE' ? MODULE_LABELS_ECOLE : MODULE_LABELS)

export function PermissionsPicker({ value, onChange, type }: { value: string[]; onChange: (v: string[]) => void; type?: string }) {
  const labels = labelsFor(type)
  const toggle = (m: string) => onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m])
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Object.entries(labels).map(([m, label]) => (
        <label key={m} className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
          <input type="checkbox" checked={value.includes(m)} onChange={() => toggle(m)} />
          {label}
        </label>
      ))}
      <button type="button" className="text-xs text-sage text-left" onClick={() => onChange(value.length === Object.keys(labels).length ? [] : Object.keys(labels))}>
        Tout cocher / décocher
      </button>
    </div>
  )
}

const emptyAdmin = { nom: '', prenom: '', email: '', motDePasse: '', permissions: Object.keys(MODULE_LABELS) }


function getErrorMessage(err: unknown) {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response
    return response?.data?.message || 'Une erreur est survenue'
  }
  return 'Une erreur est survenue'
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  )
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display font-700 text-2xl text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="text-center py-16 text-ink-3">
      <Icon size={38} className="mx-auto mb-4 opacity-40" />
      <p className="font-medium text-ink-2">{title}</p>
      <p className="text-sm mt-1">{text}</p>
    </div>
  )
}

function useCamps() {
  const [camps, setCamps] = useState<Camp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<ApiList<Camp>>('/camps?perPage=100')
      .then(({ data }) => setCamps(data.data || []))
      .catch(() => setCamps([]))
      .finally(() => setLoading(false))
  }, [])

  return { camps, loading }
}

function useParticipants(campId: string) {
  const [participants, setParticipants] = useState<Participant[]>([])

  useEffect(() => {
    if (!campId) {
      setParticipants([])
      return
    }

    api.get<ApiList<Participant>>(`/camps/${campId}/participants?perPage=100`)
      .then(({ data }) => setParticipants(data.data || []))
      .catch(() => setParticipants([]))
  }, [campId])

  return participants
}

export function CampFormPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyCamp)
  const [admin, setAdmin] = useState(emptyAdmin)
  const [type, setType] = useState<'CAMP' | 'ECOLE'>('CAMP')
  const [champs, setChamps] = useState<string[]>(CHAMPS_ELEVE_DEFAUT)
  const changeType = (t: 'CAMP' | 'ECOLE') => { setType(t); setAdmin(a => ({ ...a, permissions: Object.keys(labelsFor(t)) })) }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/camps', { ...form, type, admin, ...(type === 'ECOLE' && { champsEleve: champs }) })
      navigate('/camps')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/camps" className="inline-flex items-center gap-2 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Retour aux camps
      </Link>
      <PageHeader title={type === 'ECOLE' ? 'Nouvelle école' : 'Nouveau camp'} subtitle="Créer un espace avec son administrateur." />

      <form onSubmit={submit} className="card space-y-4">
        {error && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{error}</div>}
        <Field label="Type d'espace">
          <div className="flex gap-2">
            {([['CAMP', 'Camp'], ['ECOLE', 'École maternelle']] as const).map(([v, l]) => (
              <button type="button" key={v} onClick={() => changeType(v)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${type === v ? 'bg-sage/12 text-sage border-sage/20' : 'text-ink-2 border-border'}`}>{l}</button>
            ))}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={type === 'ECOLE' ? "Nom de l'école" : 'Nom du camp'}>
            <input className="input-field" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
          </Field>
          <Field label="Lieu">
            <input className="input-field" required value={form.lieu} onChange={e => setForm({ ...form, lieu: e.target.value })} />
          </Field>
          <Field label={type === 'ECOLE' ? 'Début année scolaire' : 'Date début'}>
            <input type="date" className="input-field" required value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })} />
          </Field>
          <Field label={type === 'ECOLE' ? 'Fin année scolaire' : 'Date fin'}>
            <input type="date" className="input-field" required value={form.dateFin} onChange={e => setForm({ ...form, dateFin: e.target.value })} />
          </Field>
          <Field label={type === 'ECOLE' ? 'Effectif maximum' : 'Capacité'}>
            <input type="number" min={1} className="input-field" required value={form.capaciteMax} onChange={e => setForm({ ...form, capaciteMax: Number(e.target.value) })} />
          </Field>
          <Field label={type === 'ECOLE' ? 'Frais de scolarité annuels par élève (FCFA)' : 'Prix de base'}>
            <input type="number" min={0} className="input-field" required value={form.prixBase} onChange={e => setForm({ ...form, prixBase: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Adresse">
          <input className="input-field" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className="input-field min-h-24" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="border-t border-border pt-4 space-y-4">
          <h3 className="font-display font-700 text-ink">Administrateur du camp</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Prénom">
              <input className="input-field" required value={admin.prenom} onChange={e => setAdmin({ ...admin, prenom: e.target.value })} />
            </Field>
            <Field label="Nom">
              <input className="input-field" required value={admin.nom} onChange={e => setAdmin({ ...admin, nom: e.target.value })} />
            </Field>
            <Field label="Email (identifiant de connexion)">
              <input type="email" className="input-field" required value={admin.email} onChange={e => setAdmin({ ...admin, email: e.target.value })} />
            </Field>
            <Field label="Mot de passe (8 caractères min.)">
              <input type="password" minLength={8} className="input-field" required value={admin.motDePasse} onChange={e => setAdmin({ ...admin, motDePasse: e.target.value })} />
            </Field>
          </div>
          {type === 'ECOLE' && (
            <Field label="Champs de la fiche élève (nom et prénom toujours présents)">
              <ChampsPicker value={champs} onChange={setChamps} />
            </Field>
          )}
          <Field label="Autorisations (modules accessibles)">
            <PermissionsPicker type={type} value={admin.permissions} onChange={permissions => setAdmin({ ...admin, permissions })} />
          </Field>
        </div>
        <button disabled={saving} className="btn-primary inline-flex items-center gap-2">
          <Save size={16} /> {saving ? 'Création...' : 'Créer le camp'}
        </button>
      </form>
    </div>
  )
}

const STATUTS_CAMP = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'OUVERT', label: 'Ouvert' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'COMPLET', label: 'Complet' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'ANNULE', label: 'Annulé' },
]

export function CampDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [camp, setCamp] = useState<Camp | null>(null)
  const [stats, setStats] = useState<CampStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [paroisses, setParoisses] = useState<CampParoisse[]>([])
  const [paroisseForm, setParoisseForm] = useState({ nom: '', responsable: '', telephone: '' })
  const [paroisseError, setParoisseError] = useState('')
  const [editingParoisseId, setEditingParoisseId] = useState<string | null>(null)
  const [paroisseEditForm, setParoisseEditForm] = useState({ nom: '', responsable: '', telephone: '', prixParticipant: '' })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ ...emptyCamp, statut: 'OUVERT' as string })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const loadParoisses = () => {
    if (!id) return
    api.get<{ data: CampParoisse[] }>(`/camps/${id}/paroisses`)
      .then(({ data }) => setParoisses(data.data || []))
      .catch(() => {})
  }

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<ApiOne<Camp>>(`/camps/${id}`).then(({ data }) => setCamp(data.data)),
      api.get<ApiOne<CampStats>>(`/camps/${id}/stats`).then(({ data }) => setStats(data.data)).catch(() => undefined),
    ]).finally(() => setLoading(false))
    loadParoisses()
  }, [id])

  const deleteCamp = async () => {
    if (!id || !window.confirm('Supprimer ce camp et ses données associées ?')) return
    await api.delete(`/camps/${id}`)
    navigate('/camps')
  }

  const openEdit = () => {
    if (!camp) return
    setEditForm({
      nom: camp.nom,
      description: camp.description ?? '',
      lieu: camp.lieu,
      adresse: camp.adresse ?? '',
      dateDebut: camp.dateDebut.slice(0, 10),
      dateFin: camp.dateFin.slice(0, 10),
      capaciteMax: camp.capaciteMax,
      prixBase: Number(camp.prixBase),
      statut: camp.statut,
    })
    setEditError('')
    setShowEditModal(true)
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!id) return
    setEditSaving(true)
    setEditError('')
    try {
      const { data } = await api.put<ApiOne<Camp>>(`/camps/${id}`, editForm)
      setCamp(data.data)
      setShowEditModal(false)
    } catch (err) {
      setEditError(getErrorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  const addParoisse = async (e: FormEvent) => {
    e.preventDefault()
    setParoisseError('')
    try {
      await api.post(`/camps/${id}/paroisses`, paroisseForm)
      setParoisseForm({ nom: '', responsable: '', telephone: '' })
      loadParoisses()
    } catch (err: any) {
      setParoisseError(err?.response?.data?.message || 'Erreur')
    }
  }

  const deleteParoisse = async (paroisseId: string) => {
    await api.delete(`/camps/${id}/paroisses/${paroisseId}`)
    loadParoisses()
  }

  const startEditParoisse = (p: CampParoisse) => {
    setEditingParoisseId(p.id)
    setParoisseEditForm({ nom: p.nom, responsable: p.responsable || '', telephone: p.telephone || '', prixParticipant: p.prixParticipant != null ? String(p.prixParticipant) : '' })
  }

  const saveEditParoisse = async (paroisseId: string) => {
    await api.put(`/camps/${id}/paroisses/${paroisseId}`, {
      ...paroisseEditForm,
      prixParticipant: paroisseEditForm.prixParticipant === '' ? null : Number(paroisseEditForm.prixParticipant),
    })
    setEditingParoisseId(null)
    loadParoisses()
  }

  if (loading) return <div className="card animate-pulse h-40" />
  if (!camp) return <EmptyState icon={Calendar} title="Camp introuvable" text="Ce camp n'existe pas ou n'est plus disponible." />

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/camps" className="inline-flex items-center gap-2 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Retour aux camps
      </Link>
      <PageHeader
        title={camp.nom}
        subtitle={`${camp.lieu} · ${formatDate(camp.dateDebut)} au ${formatDate(camp.dateFin)}`}
        action={
          <div className="flex gap-2">
            <button onClick={openEdit} className="btn-ghost inline-flex items-center gap-2"><Pencil size={16} /> Modifier</button>
            <button onClick={deleteCamp} className="btn-danger inline-flex items-center gap-2"><Trash2 size={16} /> Supprimer</button>
          </div>
        }
      />
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="card"><p className="text-xs text-ink-3">Statut</p><span className={statutCampBadge[camp.statut as StatutCamp]}>{statutCampLabel[camp.statut as StatutCamp]}</span></div>
        <div className="card"><p className="text-xs text-ink-3">Participants</p><p className="font-display font-700 text-xl">{stats?.participants.total ?? camp._count?.participants ?? 0}/{camp.capaciteMax}</p></div>
        <div className="card"><p className="text-xs text-ink-3">Paiements</p><p className="font-display font-700 text-xl">{formatCFA(stats?.finance.totalEncaisse ?? 0)}</p></div>
        <div className="card"><p className="text-xs text-ink-3">Activités</p><p className="font-display font-700 text-xl">{stats?.activites ?? camp._count?.activites ?? 0}</p></div>
      </div>
      {camp.description && (
        <div className="card">
          <h2 className="font-display font-700 text-sm mb-2">Description</h2>
          <p className="text-sm text-ink-2">{camp.description}</p>
        </div>
      )}

      {/* Paroisses */}
      <div className="card space-y-4">
        <h2 className="font-display font-700 text-sm">Paroisses du camp</h2>
        <p className="text-xs text-ink-3">Les paroisses ajoutées ici seront proposées en liste déroulante lors de l'inscription d'un participant.</p>
        {paroisseError && <div className="text-sm text-ember">{paroisseError}</div>}
        <form onSubmit={addParoisse} className="grid sm:grid-cols-4 gap-2">
          <input className="input-field sm:col-span-2" placeholder="Nom de la paroisse *" required value={paroisseForm.nom} onChange={e => setParoisseForm(f => ({ ...f, nom: e.target.value }))} />
          <input className="input-field" placeholder="Responsable" value={paroisseForm.responsable} onChange={e => setParoisseForm(f => ({ ...f, responsable: e.target.value }))} />
          <input className="input-field" placeholder="Téléphone" value={paroisseForm.telephone} onChange={e => setParoisseForm(f => ({ ...f, telephone: e.target.value }))} />
          <button type="submit" className="btn-primary sm:col-span-4 flex items-center justify-center gap-2"><Plus size={15} /> Ajouter</button>
        </form>
        {paroisses.length === 0 ? (
          <p className="text-xs text-ink-3 text-center py-2">Aucune paroisse définie — les participants peuvent saisir librement.</p>
        ) : (
          <div className="space-y-1.5">
            {paroisses.map(p => editingParoisseId === p.id ? (
              <div key={p.id} className="rounded-xl border border-sage/40 bg-surface p-3 space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className="input-field" placeholder="Nom *" value={paroisseEditForm.nom} onChange={e => setParoisseEditForm(f => ({ ...f, nom: e.target.value }))} />
                  <input className="input-field" placeholder="Responsable" value={paroisseEditForm.responsable} onChange={e => setParoisseEditForm(f => ({ ...f, responsable: e.target.value }))} />
                  <input className="input-field" placeholder="Téléphone" value={paroisseEditForm.telephone} onChange={e => setParoisseEditForm(f => ({ ...f, telephone: e.target.value }))} />
                  <div className="relative">
                    <input type="number" className="input-field pr-12" placeholder="Prix / participant" value={paroisseEditForm.prixParticipant} onChange={e => setParoisseEditForm(f => ({ ...f, prixParticipant: e.target.value }))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">FCFA</span>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingParoisseId(null)} className="btn-ghost px-3 py-1.5 text-xs">Annuler</button>
                  <button onClick={() => saveEditParoisse(p.id)} className="btn-primary px-3 py-1.5 text-xs">Enregistrer</button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.nom}</p>
                  <p className="text-xs text-ink-3">
                    {p.responsable || ''}{p.telephone ? ` · ${p.telephone}` : ''}
                    {p.prixParticipant != null ? <span className="ml-2 px-1.5 py-0.5 rounded bg-sage/10 text-sage font-medium">{Number(p.prixParticipant).toLocaleString('fr-FR')} FCFA/pers.</span> : <span className="ml-2 text-ink-3/60">Prix non défini</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEditParoisse(p)} className="text-ink-3 hover:text-sage p-1.5 rounded-lg hover:bg-sage/10 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => deleteParoisse(p.id)} className="text-ink-3 hover:text-ember p-1.5 rounded-lg hover:bg-ember/5 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Link className="btn-primary inline-flex justify-center items-center gap-2" to="/participants"><Users size={16} /> Ajouter participant</Link>
        <Link className="btn-ghost inline-flex justify-center items-center gap-2" to="/planning"><Calendar size={16} /> Planifier activité</Link>
        <Link className="btn-ghost inline-flex justify-center items-center gap-2" to="/paiements"><CreditCard size={16} /> Suivre paiements</Link>
      </div>

      {/* ── Modal édition camp ─────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-display font-700 text-lg">Modifier le camp</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-surface text-ink-3 hover:text-ink transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              {editError && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{editError}</div>}
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nom du camp">
                  <input className="input-field" required value={editForm.nom} onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))} />
                </Field>
                <Field label="Lieu">
                  <input className="input-field" required value={editForm.lieu} onChange={e => setEditForm(f => ({ ...f, lieu: e.target.value }))} />
                </Field>
                <Field label="Date début">
                  <input type="date" className="input-field" required value={editForm.dateDebut} onChange={e => setEditForm(f => ({ ...f, dateDebut: e.target.value }))} />
                </Field>
                <Field label="Date fin">
                  <input type="date" className="input-field" required value={editForm.dateFin} onChange={e => setEditForm(f => ({ ...f, dateFin: e.target.value }))} />
                </Field>
                <Field label="Capacité">
                  <input type="number" min={1} className="input-field" required value={editForm.capaciteMax} onChange={e => setEditForm(f => ({ ...f, capaciteMax: Number(e.target.value) }))} />
                </Field>
                <Field label="Prix de base (FCFA)">
                  <input type="number" min={0} className="input-field" required value={editForm.prixBase} onChange={e => setEditForm(f => ({ ...f, prixBase: Number(e.target.value) }))} />
                </Field>
                <Field label="Statut">
                  <select className="input-field" value={editForm.statut} onChange={e => setEditForm(f => ({ ...f, statut: e.target.value }))}>
                    {STATUTS_CAMP.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Adresse">
                  <input className="input-field" value={editForm.adresse} onChange={e => setEditForm(f => ({ ...f, adresse: e.target.value }))} />
                </Field>
              </div>
              <Field label="Description">
                <textarea className="input-field min-h-20" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-ghost">Annuler</button>
                <button type="submit" disabled={editSaving} className="btn-primary inline-flex items-center gap-2">
                  <Save size={15} />{editSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const METHODES_PAIE = [
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CARTE_BANCAIRE', label: 'Carte bancaire' },
  { value: 'CHEQUE', label: 'Chèque' },
]

function downloadCSVTemplate() {
  const header = 'paroisse,responsableParoisse,responsableTelephone,nom,prenom,dateNaissance,lieuNaissance,genre,niveauScolaire,participationsAnterieures,contactAdolescent,parentNom,parentPrenom,parentLien,parentTelephone,parentEmail,sante,montantVerse'
  const sample = 'NKOLNDONGO I,KAPTCHOUANG BLONDINE,696585367,TEGUIA,Romane Berthe Noé,22/01/2009,Yaoundé,Fille,2nd - Tle,0,688026659,TEGUIA POKAM,Appolinaire,Père,695384000,parent@email.com,RAS,2000'
  const blob = new Blob([header + '\n' + sample], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'modele-participants.csv'; a.click()
}

export function ParticipantsPage() {
  const { camps } = useCamps()
  const [campId, setCampId] = useState('')
  const [campPrice, setCampPrice] = useState(0)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterParoisse, setFilterParoisse] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [submitError, setSubmitError] = useState('')
  const csvRef = useRef<HTMLInputElement>(null)

  // Modal paiement post-inscription
  const [payModal, setPayModal] = useState<{ id: string; nom: string; prenom: string } | null>(null)
  const [payForm, setPayForm] = useState({ montant: '', methode: 'MOBILE_MONEY', reference: '' })
  const [payError, setPayError] = useState('')
  const [paySaving, setPaySaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [campParoisses, setCampParoisses] = useState<CampParoisse[]>([])

  // Modal détail / modification participant
  const [viewP, setViewP] = useState<Participant | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<typeof emptyForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Fouille des sacs
  type ArticleSac = { id: string; article: string; quantite: number; categorie: string | null; confisque: boolean; notes: string | null }
  const [articlesSac, setArticlesSac] = useState<ArticleSac[]>([])
  const [articleForm, setArticleForm] = useState({ article: '', quantite: 1, categorie: '', confisque: false, notes: '' })
  const [articleSaving, setArticleSaving] = useState(false)

  useEffect(() => { if (!campId && camps[0]) setCampId(camps[0].id) }, [camps, campId])
  useEffect(() => {
    const camp = camps.find(c => c.id === campId)
    if (camp) setCampPrice(camp.prixBase)
    if (campId) {
      api.get<{ data: CampParoisse[] }>(`/camps/${campId}/paroisses`)
        .then(({ data }) => setCampParoisses(data.data || []))
        .catch(() => setCampParoisses([]))
    }
  }, [campId, camps])

  const load = () => {
    if (!campId) return
    api.get<ApiList<Participant>>(`/camps/${campId}/participants?perPage=500`)
      .then(({ data }) => setParticipants(data.data || []))
      .catch(() => setParticipants([]))
  }
  useEffect(load, [campId])

  const filteredParticipants = useMemo(() => {
    const q = search.toLowerCase().trim()
    return participants.filter(p => {
      if (q && !`${p.prenom} ${p.nom} ${p.paroisse || ''}`.toLowerCase().includes(q)) return false
      if (filterStatut && p.statutInscription !== filterStatut) return false
      if (filterParoisse && p.paroisse !== filterParoisse) return false
      return true
    })
  }, [participants, search, filterStatut, filterParoisse])

  const paroisseOptions = useMemo(() => {
    const set = new Set(participants.map(p => p.paroisse).filter(Boolean) as string[])
    return [...set].sort()
  }, [participants])

  const doublons = useMemo(() => {
    const map = new Map<string, Participant[]>()
    participants.forEach(p => {
      const key = `${p.nom.trim().toLowerCase()}|${p.prenom.trim().toLowerCase()}`
      map.set(key, [...(map.get(key) ?? []), p])
    })
    return [...map.values()]
      .filter(g => g.length > 1)
      .map(group => {
        const dateKey = (p: Participant) => p.dateNaissance ? new Date(p.dateNaissance).toISOString().slice(0, 10) : ''
        const dates = group.map(dateKey)
        const certain = dates.some((d, i) => d && dates.some((d2, j) => j !== i && d === d2))
        return { group, certain }
      })
      .sort((a, b) => Number(b.certain) - Number(a.certain))
  }, [participants])

  const [showDoublons, setShowDoublons] = useState(true)

  // Convert French label to Prisma RelationParent enum (PERE|MERE|TUTEUR|AUTRE)
  const toRelationEnum = (v: string): string => {
    const map: Record<string, string> = {
      'père': 'PERE', 'pere': 'PERE', 'PERE': 'PERE',
      'mère': 'MERE', 'mere': 'MERE', 'MERE': 'MERE',
      'tuteur': 'TUTEUR', 'TUTEUR': 'TUTEUR', 'tutrice': 'TUTEUR',
    }
    return map[v?.trim()] ?? 'AUTRE'
  }

  const emptyForm = {
    paroisse: '', responsableParoisse: '', responsableTelephone: '',
    nom: '', prenom: '', dateNaissance: '', lieuNaissance: '', genre: 'Fille',
    niveauScolaire: '', participationsAnterieures: '0', contactAdolescent: '',
    groupeSanguin: '', allergies: '', medicaments: '', infosMedicales: '',
    nomUrgence: '', telephoneUrgence: '',
    parentNom: '', parentPrenom: '', parentLien: 'Père', parentEmail: '', parentTelephone: '',
    montantVerse: '',
  }
  const [form, setForm] = useState(emptyForm)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setSubmitError('')
    try {
      const res = await api.post<ApiOne<Participant>>(`/camps/${campId}/participants`, {
        nom: form.nom, prenom: form.prenom, dateNaissance: form.dateNaissance,
        lieuNaissance: form.lieuNaissance || undefined,
        genre: form.genre || undefined,
        niveauScolaire: form.niveauScolaire || undefined,
        participationsAnterieures: Number(form.participationsAnterieures) || 0,
        contactAdolescent: form.contactAdolescent || undefined,
        paroisse: form.paroisse || undefined,
        responsableParoisse: form.responsableParoisse || undefined,
        responsableTelephone: form.responsableTelephone || undefined,
        groupeSanguin: form.groupeSanguin || undefined,
        allergies: form.allergies || undefined,
        medicaments: form.medicaments || undefined,
        infosMedicales: form.infosMedicales || undefined,
        nomUrgence: form.nomUrgence,
        telephoneUrgence: form.telephoneUrgence,
        montantVerse: form.montantVerse ? Number(form.montantVerse) : undefined,
        parents: form.parentNom ? [{ nom: form.parentNom, prenom: form.parentPrenom, email: form.parentEmail, telephone: form.parentTelephone, relation: toRelationEnum(form.parentLien), principal: true }] : undefined,
      })
      const created = res.data.data
      setForm(emptyForm)
      setShowForm(false)
      load()
      if (!form.montantVerse) {
        setPayForm({ montant: String(campPrice), methode: 'MOBILE_MONEY', reference: '' })
        setPayError('')
        setPayModal({ id: created.id, nom: created.nom, prenom: created.prenom })
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally { setSaving(false) }
  }

  const submitPay = async () => {
    if (!payModal || !payForm.montant) { setPayError('Entrez un montant.'); return }
    setPayError(''); setPaySaving(true)
    try {
      const montant = Number(payForm.montant)
      await api.post('/paiements', {
        participantId: payModal.id, montant, montantTotal: campPrice,
        methode: payForm.methode, reference: payForm.reference || undefined,
        statut: montant >= campPrice ? 'PAYE' : montant > 0 ? 'PARTIEL' : 'EN_ATTENTE',
        datePaiement: new Date().toISOString(),
      })
      setPayModal(null); load()
    } catch (err) { setPayError(getErrorMessage(err)) }
    finally { setPaySaving(false) }
  }

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !campId) return
    setImporting(true); setImportResult('')
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { setImportResult('Fichier vide ou sans données.'); return }

      // Detect separator (, or ;)
      const sep = lines[0].includes(';') ? ';' : ','
      const parseRow = (row: string) => row.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))

      const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim())
      const idx = (names: string[]) => names.map(n => headers.findIndex(h => h.includes(n))).find(i => i >= 0) ?? -1

      // Convert any date string to ISO YYYY-MM-DD
      const MOIS: Record<string, string> = {
        janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04',
        mai: '05', juin: '06', juillet: '07', août: '08', aout: '08',
        septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12',
      }
      const toISO = (raw: string): string | undefined => {
        if (!raw) return undefined
        const s = raw.trim()
        // Already ISO: 2026-06-06
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
        // DD/MM/YYYY or DD-MM-YYYY
        const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
        if (slash) return `${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`
        // French: "06 juin 2026" or "6 juin 2026"
        const french = s.match(/^(\d{1,2})\s+([a-zéèûôâùàî]+)\s+(\d{4})$/i)
        if (french) {
          const m = MOIS[french[2].toLowerCase()]
          if (m) return `${french[3]}-${m}-${french[1].padStart(2,'0')}`
        }
        return undefined
      }

      // Normalize header: lowercase + remove accents + collapse spaces
      const norm = (s: string) => s.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

      const hn = headers.map(norm) // normalized headers

      // Find first column whose normalized header CONTAINS any of the given substrings
      const col = (...terms: string[]) => {
        for (const t of terms) {
          const i = hn.findIndex(h => h.includes(t))
          if (i >= 0) return i
        }
        return -1
      }
      // Find first column whose normalized header IS EXACTLY one of the given values
      const colExact = (...terms: string[]) => {
        for (const t of terms) {
          const i = hn.findIndex(h => h === t)
          if (i >= 0) return i
        }
        return -1
      }

      // Detect format: spreadsheet has "enfant" in headers
      const isSheet = hn.some(h => h.includes('enfant'))

      // ── Column indices ──
      const iParoisse     = col('paroisse')
      // Responsable: "nom du responsable de paroisse" contains "responsable de paroisse"
      const iResp         = col('responsable de paroisse', 'responsableparoisse', 'nom du responsable')
      // Tel responsable: "resp telephone" or "contact du responsable"
      const iRespTel      = col('resp telephone', 'telephone du responsable', 'contact du responsable', 'responsabletelephone')
      // Child name: spreadsheet uses "nom complet de l'enfant", template uses standalone "nom"
      const iNomComplet   = col('enfant (nom', 'complet de l enfant', 'nom et prenom')
      const iNom          = isSheet ? -1 : colExact('nom')
      const iPrenom       = isSheet ? -1 : colExact('prenom')
      // Date/Lieu/Genre/Niveau
      const iDob          = col('date de naissance', 'datenaissance', 'date naissance')
      const iLieu         = col('lieu de naissance', 'lieunaissance', 'lieu naissance')
      const iGenre        = colExact('genre')
      const iNiveau       = col('niveau scolaire', 'niveauscolaire')
      const iPartic       = col('participations anterieures', 'participationsanterieures', 'nombre de participations')
      const iContact      = col('contact de l adolescent', 'contactadolescent', 'contact adolescent')
      // Parent name: spreadsheet uses "nom complet du parent / tuteur", template uses "parentnom"
      const iParentComplet = col('complet du parent', 'parent / tuteur', 'tuteur legal')
      const iParentNom    = isSheet ? -1 : col('parentnom')
      const iParentPrenom = isSheet ? -1 : col('parentprenom')
      const iParentLien   = col('lien de parente', 'parentlien', 'lien avec l enfant', 'lien parente')
      // Parent tel: "telephone du parent" or "telephone parent" (avoid matching resp telephone)
      const iParentTel    = col('telephone du parent', 'telephone parent', 'parenttelephone', 'telurgence', 'parenttel')
      const iParentEmail  = col('parentemail', 'email du parent')
      const iUrgenceNom   = col('contacturgence', 'contact urgence', 'nomurgence')
      const iSante        = col('sante', 'maladie reguliere', 'infos medicales')
      const iMontant      = col('montant des frais', 'montantverse', 'frais verses')

      // Split "NOM PRENOM..." → { nom: first word, prenom: rest }
      const splitName = (s: string) => {
        const parts = s.trim().split(/\s+/).filter(Boolean)
        return { nom: parts[0] || '', prenom: parts.slice(1).join(' ') }
      }

      const rows = lines.slice(1)
      let ok = 0; let fail = 0
      for (const row of rows) {
        if (!row.trim()) continue
        const c = parseRow(row)
        const g = (i: number) => (i >= 0 ? c[i]?.trim() || '' : '')

        // Child name
        let nom: string, prenom: string
        if (iNomComplet >= 0) {
          const s = splitName(g(iNomComplet))
          nom = s.nom; prenom = s.prenom
        } else {
          nom = g(iNom); prenom = g(iPrenom)
        }
        if (!nom && !prenom) { fail++; continue }

        // Parent name
        let parentNom: string, parentPrenom: string
        if (iParentComplet >= 0) {
          const s = splitName(g(iParentComplet))
          parentNom = s.nom; parentPrenom = s.prenom
        } else {
          parentNom = g(iParentNom); parentPrenom = g(iParentPrenom)
        }

        const dob          = toISO(g(iDob))
        const parentLien   = g(iParentLien) || 'Père'
        const parentTel    = g(iParentTel)
        const parentEmail  = g(iParentEmail)
        const sante        = g(iSante)
        const montantVerse = g(iMontant)
        const nomUrgence   = g(iUrgenceNom) || parentNom || 'À renseigner'
        const telUrgence   = parentTel || '0000000000'

        try {
          await api.post(`/camps/${campId}/participants`, {
            nom, prenom,
            dateNaissance: dob,
            lieuNaissance: g(iLieu) || undefined,
            genre: g(iGenre) || undefined,
            niveauScolaire: g(iNiveau) || undefined,
            participationsAnterieures: Number(g(iPartic)) || 0,
            contactAdolescent: g(iContact) || undefined,
            paroisse: g(iParoisse) || undefined,
            responsableParoisse: g(iResp) || undefined,
            responsableTelephone: g(iRespTel) || undefined,
            infosMedicales: sante && sante.toUpperCase() !== 'RAS' ? sante : undefined,
            nomUrgence,
            telephoneUrgence: telUrgence,
            montantVerse: montantVerse ? Number(montantVerse) : undefined,
            parents: parentNom || parentTel ? [{
              nom: parentNom, prenom: parentPrenom,
              email: parentEmail || '', telephone: parentTel,
              relation: toRelationEnum(parentLien), principal: true,
            }] : undefined,
          })
          ok++
        } catch { fail++ }
      }
      setImportResult(`Import terminé : ${ok} participant${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}${fail > 0 ? ` · ${fail} erreur${fail > 1 ? 's' : ''}` : ''}.`)
      load()
    } catch { setImportResult('Erreur lors de la lecture du fichier.') }
    finally { setImporting(false); if (csvRef.current) csvRef.current.value = '' }
  }

  const changeStatut = async (id: string, statut: string) => {
    await api.put(`/participants/${id}/statut`, { statut }); load()
  }

  const deleteParticipant = async (id: string, nom: string) => {
    if (!window.confirm(`Supprimer définitivement ${nom} ? Cette action est irréversible.`)) return
    try {
      await api.delete(`/participants/${id}`)
      setViewP(null)
      load()
    } catch { alert('Erreur lors de la suppression.') }
  }

  const resolveGroupDoublons = async (group: Participant[]) => {
    const toDelete = group.slice(1)
    if (!window.confirm(`Garder "${group[0].prenom} ${group[0].nom}" #1 et supprimer ${toDelete.length} doublon${toDelete.length > 1 ? 's' : ''} ?`)) return
    await Promise.allSettled(toDelete.map(p => api.delete(`/participants/${p.id}`)))
    load()
  }

  const resolveAllCertainDoublons = async () => {
    const certainGroups = doublons.filter(d => d.certain)
    const toDelete = certainGroups.flatMap(d => d.group.slice(1))
    if (toDelete.length === 0) return
    if (!window.confirm(`Supprimer ${toDelete.length} doublon${toDelete.length > 1 ? 's' : ''} certains en gardant le premier enregistrement de chaque groupe ?`)) return
    await Promise.allSettled(toDelete.map(p => api.delete(`/participants/${p.id}`)))
    load()
  }

  const loadArticlesSac = async (participantId: string) => {
    try {
      const { data } = await api.get<{ data: ArticleSac[] }>(`/participants/${participantId}/articles-sac`)
      setArticlesSac(data.data || [])
    } catch { setArticlesSac([]) }
  }

  const openParticipant = async (p: Participant) => {
    setArticlesSac([])
    setArticleForm({ article: '', quantite: 1, categorie: '', confisque: false, notes: '' })
    try {
      const { data } = await api.get<ApiOne<Participant>>(`/participants/${p.id}`)
      setViewP(data.data)
      setEditMode(false)
      setEditError('')
      loadArticlesSac(p.id)
    } catch {
      setViewP(p)
      loadArticlesSac(p.id)
    }
  }

  const addArticleSac = async (e: FormEvent) => {
    e.preventDefault()
    if (!viewP || !articleForm.article.trim()) return
    setArticleSaving(true)
    try {
      await api.post(`/participants/${viewP.id}/articles-sac`, articleForm)
      setArticleForm({ article: '', quantite: 1, categorie: '', confisque: false, notes: '' })
      loadArticlesSac(viewP.id)
    } catch { /* silent */ }
    setArticleSaving(false)
  }

  const deleteArticleSac = async (id: string) => {
    if (!viewP) return
    await api.delete(`/participants/${viewP.id}/articles-sac/${id}`)
    loadArticlesSac(viewP.id)
  }

  const toggleConfisque = async (a: ArticleSac) => {
    if (!viewP) return
    await api.put(`/participants/${viewP.id}/articles-sac/${a.id}`, { confisque: !a.confisque })
    loadArticlesSac(viewP.id)
  }

  const startEdit = (p: Participant) => {
    const par = p.parents?.[0]
    const relMap: Record<string, string> = { PERE: 'Père', MERE: 'Mère', TUTEUR: 'Tuteur', AUTRE: 'Autre' }
    const dob = p.dateNaissance ? p.dateNaissance.slice(0, 10) : ''
    setEditForm({
      paroisse: p.paroisse || '', responsableParoisse: p.responsableParoisse || '', responsableTelephone: p.responsableTelephone || '',
      nom: p.nom, prenom: p.prenom, dateNaissance: dob, lieuNaissance: p.lieuNaissance || '', genre: p.genre || 'Fille',
      niveauScolaire: p.niveauScolaire || '', participationsAnterieures: String(p.participationsAnterieures ?? 0), contactAdolescent: p.contactAdolescent || '',
      groupeSanguin: p.groupeSanguin || '', allergies: p.allergies || '', medicaments: p.medicaments || '', infosMedicales: p.infosMedicales || '',
      nomUrgence: p.nomUrgence, telephoneUrgence: p.telephoneUrgence,
      parentNom: par?.nom || '', parentPrenom: par?.prenom || '', parentLien: relMap[par?.relation || ''] || 'Père', parentEmail: par?.email || '', parentTelephone: par?.telephone || '',
      montantVerse: '',
    })
    setEditMode(true)
    setEditError('')
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!viewP || !editForm) return
    setEditSaving(true); setEditError('')
    try {
      const res = await api.put<ApiOne<Participant>>(`/participants/${viewP.id}`, {
        nom: editForm.nom, prenom: editForm.prenom,
        dateNaissance: editForm.dateNaissance || undefined,
        lieuNaissance: editForm.lieuNaissance || undefined,
        genre: editForm.genre || undefined,
        niveauScolaire: editForm.niveauScolaire || undefined,
        participationsAnterieures: Number(editForm.participationsAnterieures) || 0,
        contactAdolescent: editForm.contactAdolescent || undefined,
        paroisse: editForm.paroisse || undefined,
        responsableParoisse: editForm.responsableParoisse || undefined,
        responsableTelephone: editForm.responsableTelephone || undefined,
        groupeSanguin: editForm.groupeSanguin || undefined,
        allergies: editForm.allergies || undefined,
        medicaments: editForm.medicaments || undefined,
        infosMedicales: editForm.infosMedicales || undefined,
        nomUrgence: editForm.nomUrgence,
        telephoneUrgence: editForm.telephoneUrgence,
      })
      setViewP(res.data.data)
      setEditMode(false)
      load()
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Erreur lors de la mise à jour.')
    } finally { setEditSaving(false) }
  }

  const exportParticipantsCSV = () => {
    if (!participants.length) return
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = 'paroisse,responsableParoisse,responsableTelephone,nom,prenom,dateNaissance,lieuNaissance,genre,niveauScolaire,participationsAnterieures,contactAdolescent,parentNom,parentPrenom,parentLien,parentTelephone,parentEmail,sante,statut'
    const lines = participants.map(p => {
      const par = p.parents?.[0]
      return [
        p.paroisse, p.responsableParoisse, p.responsableTelephone,
        p.nom, p.prenom, formatDate(p.dateNaissance), p.lieuNaissance, p.genre,
        p.niveauScolaire, p.participationsAnterieures ?? 0, p.contactAdolescent,
        par?.nom, par?.prenom, par?.relation, par?.telephone, par?.email,
        p.infosMedicales, p.statutInscription,
      ].map(escape).join(',')
    })
    const blob = new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `participants-${campId}.csv`; a.click()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <PageHeader title="Participants" subtitle={`${participants.length} inscrit${participants.length !== 1 ? 's' : ''} · Prix camp : ${formatCFA(campPrice)}`} />
        <div className="flex gap-2 flex-wrap">
          <select className="input-field w-auto" value={campId} onChange={e => setCampId(e.target.value)}>
            {camps.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} disabled={!campId} className="btn-primary flex items-center gap-2 px-3 text-sm disabled:opacity-50"><Plus size={14} /> Inscrire</button>
          <button onClick={downloadCSVTemplate} className="btn-ghost flex items-center gap-2 px-3 text-xs"><Download size={14} /> Modèle CSV</button>
          <label className={`btn-ghost flex items-center gap-2 px-3 text-xs cursor-pointer ${importing ? 'opacity-50' : ''}`}>
            <Upload size={14} /> {importing ? 'Import…' : 'Importer CSV'}
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={importCSV} disabled={importing} />
          </label>
          <button onClick={exportParticipantsCSV} className="btn-ghost flex items-center gap-2 px-3 text-xs"><Download size={14} /> Exporter</button>
        </div>
      </div>

      {importResult && (
        <div className={`rounded-xl border px-3 py-2 text-sm flex items-center gap-2 ${importResult.includes('erreur') ? 'border-gold/20 bg-gold/8 text-gold' : 'border-sage/20 bg-sage/8 text-sage'}`}>
          {importResult}
          <button className="ml-auto" onClick={() => setImportResult('')}><X size={14} /></button>
        </div>
      )}

      {doublons.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <p className="font-semibold text-sm text-amber-800">
                {doublons.length} doublon{doublons.length > 1 ? 's' : ''} détecté{doublons.length > 1 ? 's' : ''} — {doublons.reduce((n, d) => n + d.group.length, 0)} entrées concernées
              </p>
            </div>
            <div className="flex items-center gap-2">
              {doublons.some(d => d.certain) && (
                <button
                  onClick={resolveAllCertainDoublons}
                  className="text-xs px-3 py-1.5 rounded-lg bg-ember text-white hover:bg-ember/90 font-medium"
                >
                  Supprimer les {doublons.filter(d => d.certain).flatMap(d => d.group.slice(1)).length} doublons certains
                </button>
              )}
              <button onClick={() => setShowDoublons(v => !v)} className="text-xs text-amber-600 hover:text-amber-800">
                {showDoublons ? 'Réduire' : 'Voir'}
              </button>
            </div>
          </div>
          {showDoublons && (
            <div className="space-y-3">
              {doublons.map(({ group, certain }) => (
                <div key={group[0].id} className="rounded-xl bg-white border border-amber-200 overflow-hidden">
                  <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-amber-900">{group[0].prenom} {group[0].nom}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${certain ? 'bg-ember/15 text-ember' : 'bg-amber-200 text-amber-700'}`}>
                        {certain ? 'Doublon certain' : 'Doublon possible'}
                      </span>
                      <button
                        onClick={() => resolveGroupDoublons(group)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-ember text-white hover:bg-ember/90 font-medium flex items-center gap-1"
                      >
                        <Trash2 size={11} /> Garder #1
                      </button>
                    </div>
                  </div>
                  <div className="grid divide-y divide-amber-100">
                    {group.map((p, i) => (
                      <div key={p.id} className={`flex items-start justify-between px-4 py-3 gap-3 ${i === 0 ? 'bg-green-50/50' : ''}`}>
                        <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-xs">
                          <div><span className="text-ink-3">Paroisse</span><br /><span className="font-medium text-ink">{p.paroisse || '—'}</span></div>
                          <div><span className="text-ink-3">Né(e) le</span><br /><span className={`font-medium ${certain ? 'text-ember' : 'text-ink'}`}>{formatDate(p.dateNaissance)}</span></div>
                          <div><span className="text-ink-3">Lieu</span><br /><span className="font-medium text-ink">{p.lieuNaissance || '—'}</span></div>
                          <div><span className="text-ink-3">Statut</span><br /><span className="font-medium text-ink">{statutInscriptionLabel[p.statutInscription]}</span></div>
                        </div>
                        {i === 0 ? (
                          <span className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-sage/15 text-sage font-medium">Conserver</span>
                        ) : (
                          <button
                            onClick={() => deleteParticipant(p.id, `${p.prenom} ${p.nom} (#${i + 1})`)}
                            className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-ember/30 text-ember hover:bg-ember/5 flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Supprimer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card space-y-4">
        {/* Barre de recherche + filtres */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="input-field pl-9 w-full" placeholder="Nom, prénom, paroisse…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field w-auto" value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="CONFIRME">Confirmé</option>
            <option value="ANNULE">Annulé</option>
          </select>
          {paroisseOptions.length > 0 && (
            <select className="input-field w-auto" value={filterParoisse} onChange={e => setFilterParoisse(e.target.value)}>
              <option value="">Toutes les paroisses</option>
              {paroisseOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {(search || filterStatut || filterParoisse) && (
            <button onClick={() => { setSearch(''); setFilterStatut(''); setFilterParoisse('') }}
              className="btn-ghost px-3 text-xs flex items-center gap-1"><X size={13} /> Effacer</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-ink-3">{filteredParticipants.length} résultat{filteredParticipants.length !== 1 ? 's' : ''} sur {participants.length}</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-sky/10 text-sky font-medium">
            {participants.filter(p => p.genre === 'Garçon').length} garçons
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-ember/10 text-ember font-medium">
            {participants.filter(p => p.genre === 'Fille').length} filles
          </span>
          {participants.filter(p => !p.genre || (p.genre !== 'Garçon' && p.genre !== 'Fille')).length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted/20 text-ink-3 font-medium">
              {participants.filter(p => !p.genre || (p.genre !== 'Garçon' && p.genre !== 'Fille')).length} non renseigné
            </span>
          )}
        </div>
        {participants.length === 0 ? <EmptyState icon={Users} title="Aucun participant" text="Cliquez sur « Inscrire » pour ajouter le premier participant." /> : (
          <div className="space-y-2">
            {filteredParticipants.map(p => (
              <div key={p.id} className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between hover:border-sage/30 transition-colors">
                <button className="text-left flex-1 min-w-0" onClick={() => openParticipant(p)}>
                  <p className="font-medium text-sm">{p.prenom} {p.nom}</p>
                  <p className="text-xs text-ink-3">
                    {p.paroisse ? `${p.paroisse} · ` : ''}{formatDate(p.dateNaissance)}
                    {p.parents?.[0]?.telephone ? ` · ${p.parents[0].telephone}` : ''}
                  </p>
                </button>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <span className={statutInscriptionBadge[p.statutInscription]}>{statutInscriptionLabel[p.statutInscription]}</span>
                  <button onClick={() => openParticipant(p)} className="btn-ghost px-2.5 py-2 inline-flex items-center gap-1 text-xs"><Pencil size={13} /> Voir</button>
                  {p.statutInscription !== 'CONFIRME' && (
                    <button onClick={() => changeStatut(p.id, 'CONFIRME')} className="btn-ghost px-3 py-2 inline-flex items-center gap-1 text-sage border-sage/30 hover:bg-sage/5 text-xs"><Check size={13} /> Confirmer</button>
                  )}
                  {p.statutInscription !== 'ANNULE' && (
                    <button onClick={() => changeStatut(p.id, 'ANNULE')} className="btn-ghost px-3 py-2 inline-flex items-center gap-1 text-ember border-ember/30 hover:bg-ember/5 text-xs"><Trash2 size={13} /> Annuler</button>
                  )}
                  <button onClick={() => deleteParticipant(p.id, `${p.prenom} ${p.nom}`)} className="btn-ghost px-2.5 py-2 inline-flex items-center gap-1 text-ember border-ember/20 hover:bg-ember/5 text-xs"><Trash2 size={13} /> Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal inscription */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => { setShowForm(false); setSubmitError('') }} />
          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[92vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-display font-700 text-base">Nouvelle inscription</h2>
                <p className="text-xs text-ink-3">Prix du camp : <span className="font-semibold text-sage">{formatCFA(campPrice)}</span> (fixé à la création du camp)</p>
              </div>
              <button onClick={() => { setShowForm(false); setSubmitError('') }} className="text-ink-3 hover:text-ink p-1.5 rounded-lg hover:bg-surface"><X size={17} /></button>
            </div>
            <form onSubmit={submit} className="overflow-y-auto px-6 py-4 space-y-5">
              {submitError && <div className="rounded-xl border border-ember/20 bg-ember/8 px-3 py-2 text-sm text-ember">{submitError}</div>}

              {/* Paroisse */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Paroisse</h3>
                {campParoisses.length > 0 ? (
                  <select className="input-field" value={form.paroisse} onChange={e => {
                    const p = campParoisses.find(p => p.nom === e.target.value)
                    setForm({ ...form, paroisse: e.target.value, responsableParoisse: p?.responsable || form.responsableParoisse, responsableTelephone: p?.telephone || form.responsableTelephone })
                  }}>
                    <option value="">— Choisir une paroisse —</option>
                    {campParoisses.map(p => <option key={p.id} value={p.nom}>{p.nom}</option>)}
                    <option value="Autre">Autre / Hors liste</option>
                  </select>
                ) : (
                  <input className="input-field" placeholder="Nom de la paroisse" value={form.paroisse} onChange={e => setForm({ ...form, paroisse: e.target.value })} />
                )}
                {(campParoisses.length === 0 || form.paroisse === 'Autre' || (form.paroisse && !campParoisses.find(p => p.nom === form.paroisse))) && (
                  <input className="input-field" placeholder="Nom de la paroisse (saisie libre)" value={form.paroisse === 'Autre' ? '' : form.paroisse} onChange={e => setForm({ ...form, paroisse: e.target.value })} />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input className="input-field" placeholder="Responsable paroisse" value={form.responsableParoisse} onChange={e => setForm({ ...form, responsableParoisse: e.target.value })} />
                  <input className="input-field" placeholder="Tél. responsable" value={form.responsableTelephone} onChange={e => setForm({ ...form, responsableTelephone: e.target.value })} />
                </div>
              </section>

              {/* Adolescent */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Adolescent(e)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input-field" placeholder="Nom *" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                  <input className="input-field" placeholder="Prénom *" required value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-3 mb-1 block">Date de naissance *</label>
                    <input type="date" className="input-field" required value={form.dateNaissance} onChange={e => setForm({ ...form, dateNaissance: e.target.value })} />
                  </div>
                  <input className="input-field" placeholder="Lieu de naissance" value={form.lieuNaissance} onChange={e => setForm({ ...form, lieuNaissance: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select className="input-field" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })}>
                    <option value="Fille">Fille</option>
                    <option value="Garçon">Garçon</option>
                  </select>
                  <input className="input-field" placeholder="Niveau scolaire" value={form.niveauScolaire} onChange={e => setForm({ ...form, niveauScolaire: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-3 mb-1 block">Participations antérieures</label>
                    <input type="number" min={0} className="input-field" value={form.participationsAnterieures} onChange={e => setForm({ ...form, participationsAnterieures: e.target.value })} />
                  </div>
                  <input className="input-field" placeholder="Contact adolescent(e)" value={form.contactAdolescent} onChange={e => setForm({ ...form, contactAdolescent: e.target.value })} />
                </div>
              </section>

              {/* Médical */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Santé</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input-field" placeholder="Groupe sanguin" value={form.groupeSanguin} onChange={e => setForm({ ...form, groupeSanguin: e.target.value })} />
                  <input className="input-field" placeholder="Allergies" value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} />
                </div>
                <input className="input-field" placeholder="Médicaments" value={form.medicaments} onChange={e => setForm({ ...form, medicaments: e.target.value })} />
                <input className="input-field" placeholder="Autres infos médicales / maladies" value={form.infosMedicales} onChange={e => setForm({ ...form, infosMedicales: e.target.value })} />
              </section>

              {/* Contact urgence */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Contact d'urgence</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input-field" placeholder="Nom contact urgence *" required value={form.nomUrgence} onChange={e => setForm({ ...form, nomUrgence: e.target.value })} />
                  <input className="input-field" placeholder="Téléphone urgence *" required value={form.telephoneUrgence} onChange={e => setForm({ ...form, telephoneUrgence: e.target.value })} />
                </div>
              </section>

              {/* Parent / Tuteur */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Parent / Tuteur légal</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input-field" placeholder="Nom *" required value={form.parentNom} onChange={e => setForm({ ...form, parentNom: e.target.value })} />
                  <input className="input-field" placeholder="Prénom" value={form.parentPrenom} onChange={e => setForm({ ...form, parentPrenom: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select className="input-field" value={form.parentLien} onChange={e => setForm({ ...form, parentLien: e.target.value })}>
                    <option value="Père">Père</option>
                    <option value="Mère">Mère</option>
                    <option value="Tuteur">Tuteur</option>
                    <option value="Tutrice">Tutrice</option>
                    <option value="Grand-père">Grand-père</option>
                    <option value="Grand-mère">Grand-mère</option>
                    <option value="Oncle">Oncle</option>
                    <option value="Tante">Tante</option>
                  </select>
                  <input className="input-field" placeholder="Téléphone *" required value={form.parentTelephone} onChange={e => setForm({ ...form, parentTelephone: e.target.value })} />
                </div>
                <input type="email" className="input-field" placeholder="Email (optionnel)" value={form.parentEmail} onChange={e => setForm({ ...form, parentEmail: e.target.value })} />
              </section>

              {/* Paiement */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Paiement à l'inscription</h3>
                <div className="relative">
                  <input type="number" min={0} className="input-field pr-16" placeholder="Montant versé (FCFA) — optionnel"
                    value={form.montantVerse} onChange={e => setForm({ ...form, montantVerse: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">FCFA</span>
                </div>
                <div className="flex gap-2">
                  {[0, campPrice / 2, campPrice].filter(v => v > 0).map(v => (
                    <button key={v} type="button" onClick={() => setForm(f => ({ ...f, montantVerse: v === 0 ? '' : String(v) }))}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-border text-ink-2 hover:border-sage hover:text-sage transition-colors">
                      {v === 0 ? 'Rien' : formatCFA(v)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink-3">Si un montant est saisi, le paiement est enregistré automatiquement. Sinon, une fenêtre de paiement s'ouvrira.</p>
              </section>

              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={() => { setShowForm(false); setSubmitError('') }} className="flex-1 btn-ghost py-2.5">Annuler</button>
                <button type="submit" disabled={saving || !campId} className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={16} />}
                  Inscrire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal paiement post-inscription */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-sm p-6 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-700 text-base text-ink">Paiement d'inscription</h2>
                <p className="text-xs text-ink-3">{payModal.prenom} {payModal.nom}</p>
              </div>
              <button onClick={() => setPayModal(null)} className="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-surface"><X size={17} /></button>
            </div>
            <div className="rounded-xl bg-sage/5 border border-sage/20 px-4 py-3">
              <p className="text-xs text-sage font-medium">Prix du camp</p>
              <p className="font-display font-700 text-xl text-sage">{formatCFA(campPrice)}</p>
            </div>
            {payError && <div className="rounded-xl border border-ember/20 bg-ember/8 px-3 py-2 text-sm text-ember">{payError}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-3 mb-1 block">Montant encaissé (FCFA)</label>
                <input type="number" min={0} className="input-field font-display font-700 text-lg" value={payForm.montant}
                  onChange={e => setPayForm(f => ({ ...f, montant: e.target.value }))} />
                <div className="flex gap-2 mt-2">
                  {[campPrice / 2, campPrice].filter(v => v > 0).map(v => (
                    <button key={v} type="button" onClick={() => setPayForm(f => ({ ...f, montant: String(v) }))}
                      className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-border text-ink-2 hover:border-sage hover:text-sage transition-colors">
                      {formatCFA(v)}
                    </button>
                  ))}
                </div>
              </div>
              <select className="input-field" value={payForm.methode} onChange={e => setPayForm(f => ({ ...f, methode: e.target.value }))}>
                {METHODES_PAIE.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <input className="input-field" placeholder="Référence / N° reçu (optionnel)" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayModal(null)} className="flex-1 btn-ghost py-2.5 text-sm">Plus tard</button>
              <button onClick={submitPay} disabled={paySaving} className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                {paySaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CreditCard size={15} />}
                Encaisser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal détail / modification participant */}
      {viewP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => { setViewP(null); setEditMode(false) }} />
          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[92vh] flex flex-col animate-fade-up">

            {/* En-tête */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-display font-700 text-base">{viewP.prenom} {viewP.nom}</h2>
                <p className="text-xs text-ink-3">{viewP.paroisse || 'Sans paroisse'} · {formatDate(viewP.dateNaissance)}</p>
              </div>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <button onClick={() => startEdit(viewP)} className="btn-ghost px-3 py-2 text-xs inline-flex items-center gap-1.5"><Pencil size={13} /> Modifier</button>
                )}
                <button onClick={() => { setViewP(null); setEditMode(false) }} className="text-ink-3 hover:text-ink p-1.5 rounded-lg hover:bg-surface"><X size={17} /></button>
              </div>
            </div>

            {editMode && editForm ? (
              /* ── Mode modification ── */
              <form onSubmit={saveEdit} className="overflow-y-auto px-6 py-4 space-y-5">
                {editError && <div className="rounded-xl border border-ember/20 bg-ember/8 px-3 py-2 text-sm text-ember">{editError}</div>}

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Paroisse</h3>
                  <input className="input-field" placeholder="Nom de la paroisse" value={editForm.paroisse} onChange={e => setEditForm(f => f && ({ ...f, paroisse: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className="input-field" placeholder="Responsable" value={editForm.responsableParoisse} onChange={e => setEditForm(f => f && ({ ...f, responsableParoisse: e.target.value }))} />
                    <input className="input-field" placeholder="Tél. responsable" value={editForm.responsableTelephone} onChange={e => setEditForm(f => f && ({ ...f, responsableTelephone: e.target.value }))} />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Adolescent(e)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="input-field" placeholder="Nom *" required value={editForm.nom} onChange={e => setEditForm(f => f && ({ ...f, nom: e.target.value }))} />
                    <input className="input-field" placeholder="Prénom *" required value={editForm.prenom} onChange={e => setEditForm(f => f && ({ ...f, prenom: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-ink-3 mb-1 block">Date de naissance</label>
                      <input type="date" className="input-field" value={editForm.dateNaissance} onChange={e => setEditForm(f => f && ({ ...f, dateNaissance: e.target.value }))} />
                    </div>
                    <input className="input-field" placeholder="Lieu de naissance" value={editForm.lieuNaissance} onChange={e => setEditForm(f => f && ({ ...f, lieuNaissance: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select className="input-field" value={editForm.genre} onChange={e => setEditForm(f => f && ({ ...f, genre: e.target.value }))}>
                      <option value="Fille">Fille</option>
                      <option value="Garçon">Garçon</option>
                    </select>
                    <input className="input-field" placeholder="Niveau scolaire" value={editForm.niveauScolaire} onChange={e => setEditForm(f => f && ({ ...f, niveauScolaire: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-ink-3 mb-1 block">Participations antérieures</label>
                      <input type="number" min={0} className="input-field" value={editForm.participationsAnterieures} onChange={e => setEditForm(f => f && ({ ...f, participationsAnterieures: e.target.value }))} />
                    </div>
                    <input className="input-field" placeholder="Contact adolescent(e)" value={editForm.contactAdolescent} onChange={e => setEditForm(f => f && ({ ...f, contactAdolescent: e.target.value }))} />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Santé</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="input-field" placeholder="Groupe sanguin" value={editForm.groupeSanguin} onChange={e => setEditForm(f => f && ({ ...f, groupeSanguin: e.target.value }))} />
                    <input className="input-field" placeholder="Allergies" value={editForm.allergies} onChange={e => setEditForm(f => f && ({ ...f, allergies: e.target.value }))} />
                  </div>
                  <input className="input-field" placeholder="Médicaments" value={editForm.medicaments} onChange={e => setEditForm(f => f && ({ ...f, medicaments: e.target.value }))} />
                  <input className="input-field" placeholder="Autres infos médicales" value={editForm.infosMedicales} onChange={e => setEditForm(f => f && ({ ...f, infosMedicales: e.target.value }))} />
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Contact d'urgence</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="input-field" placeholder="Nom contact *" required value={editForm.nomUrgence} onChange={e => setEditForm(f => f && ({ ...f, nomUrgence: e.target.value }))} />
                    <input className="input-field" placeholder="Téléphone *" required value={editForm.telephoneUrgence} onChange={e => setEditForm(f => f && ({ ...f, telephoneUrgence: e.target.value }))} />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Parent / Tuteur légal</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input className="input-field" placeholder="Nom" value={editForm.parentNom} onChange={e => setEditForm(f => f && ({ ...f, parentNom: e.target.value }))} />
                    <input className="input-field" placeholder="Prénom" value={editForm.parentPrenom} onChange={e => setEditForm(f => f && ({ ...f, parentPrenom: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select className="input-field" value={editForm.parentLien} onChange={e => setEditForm(f => f && ({ ...f, parentLien: e.target.value }))}>
                      <option value="Père">Père</option>
                      <option value="Mère">Mère</option>
                      <option value="Tuteur">Tuteur</option>
                      <option value="Tutrice">Tutrice</option>
                      <option value="Autre">Autre</option>
                    </select>
                    <input className="input-field" placeholder="Téléphone" value={editForm.parentTelephone} onChange={e => setEditForm(f => f && ({ ...f, parentTelephone: e.target.value }))} />
                  </div>
                  <input type="email" className="input-field" placeholder="Email" value={editForm.parentEmail} onChange={e => setEditForm(f => f && ({ ...f, parentEmail: e.target.value }))} />
                </section>

                <div className="flex gap-3 pt-2 pb-2">
                  <button type="button" onClick={() => setEditMode(false)} className="flex-1 btn-ghost py-2.5">Annuler</button>
                  <button type="submit" disabled={editSaving} className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                    {editSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                    Enregistrer
                  </button>
                </div>
              </form>
            ) : (
              /* ── Mode lecture ── */
              <div className="overflow-y-auto px-6 py-4 space-y-4">
                {/* Statut + résumé paiements */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={statutInscriptionBadge[viewP.statutInscription]}>{statutInscriptionLabel[viewP.statutInscription]}</span>
                    {viewP.dispense && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gold/10 text-gold border border-gold/20">
                        <CheckCircle size={11} /> Dispensé
                      </span>
                    )}
                  </div>
                  {(() => {
                    const paies = viewP.paiements?.filter(p => !['ANNULE','REMBOURSE'].includes(p.statut)) ?? []
                    const totalPaye = paies.reduce((s, p) => s + Number(p.montant), 0)
                    const montantAttendu = campPrice || Number(paies[0]?.montantTotal ?? 0)
                    const resteDu = Math.max(0, montantAttendu - totalPaye)
                    return (
                      <div className="rounded-xl border border-border bg-surface p-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-ink-3 mb-0.5">Versé</p>
                          <p className="font-display font-700 text-sm text-sage">{formatCFA(totalPaye)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-3 mb-0.5">Attendu</p>
                          <p className="font-display font-700 text-sm text-ink">{montantAttendu ? formatCFA(montantAttendu) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-3 mb-0.5">Reste</p>
                          <p className={`font-display font-700 text-sm ${viewP.dispense || resteDu === 0 ? 'text-sage' : 'text-ember'}`}>
                            {viewP.dispense ? '0 ✓' : formatCFA(resteDu)}
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                  {viewP.paiements?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {viewP.paiements.map((pay, i) => (
                        <span key={i} className={statutPaiementBadge[pay.statut]}>
                          {formatCFA(pay.montant)}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-xs text-ink-3">Aucun paiement enregistré</p>}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Paroisse */}
                  {(viewP.paroisse || viewP.responsableParoisse) && (
                    <div className="rounded-xl bg-surface border border-border p-3 space-y-1">
                      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Paroisse</p>
                      {viewP.paroisse && <p className="text-sm font-medium">{viewP.paroisse}</p>}
                      {viewP.responsableParoisse && <p className="text-xs text-ink-3">{viewP.responsableParoisse}{viewP.responsableTelephone ? ` · ${viewP.responsableTelephone}` : ''}</p>}
                    </div>
                  )}

                  {/* Adolescent */}
                  <div className="rounded-xl bg-surface border border-border p-3 space-y-1">
                    <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Adolescent(e)</p>
                    <p className="text-sm font-medium">{viewP.prenom} {viewP.nom}</p>
                    <p className="text-xs text-ink-3">{formatDate(viewP.dateNaissance)}{viewP.lieuNaissance ? ` · ${viewP.lieuNaissance}` : ''}</p>
                    {viewP.genre && <p className="text-xs text-ink-3">{viewP.genre}{viewP.niveauScolaire ? ` · ${viewP.niveauScolaire}` : ''}</p>}
                    {viewP.participationsAnterieures !== undefined && <p className="text-xs text-ink-3">{viewP.participationsAnterieures} camp{viewP.participationsAnterieures !== 1 ? 's' : ''} antérieur{viewP.participationsAnterieures !== 1 ? 's' : ''}</p>}
                    {viewP.contactAdolescent && <p className="text-xs text-ink-3">Tél. ado : {viewP.contactAdolescent}</p>}
                  </div>

                  {/* Santé */}
                  {(viewP.groupeSanguin || viewP.allergies || viewP.medicaments || viewP.infosMedicales) && (
                    <div className="rounded-xl bg-surface border border-border p-3 space-y-1">
                      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Santé</p>
                      {viewP.groupeSanguin && <p className="text-xs text-ink-3">Groupe sanguin : <span className="text-ink font-medium">{viewP.groupeSanguin}</span></p>}
                      {viewP.allergies && <p className="text-xs text-ink-3">Allergies : {viewP.allergies}</p>}
                      {viewP.medicaments && <p className="text-xs text-ink-3">Médicaments : {viewP.medicaments}</p>}
                      {viewP.infosMedicales && <p className="text-xs text-ink-3">{viewP.infosMedicales}</p>}
                    </div>
                  )}

                  {/* Urgence */}
                  <div className="rounded-xl bg-surface border border-border p-3 space-y-1">
                    <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Contact d'urgence</p>
                    <p className="text-sm font-medium">{viewP.nomUrgence}</p>
                    <p className="text-xs text-ink-3">{viewP.telephoneUrgence}</p>
                  </div>

                  {/* Parent */}
                  {viewP.parents?.[0] && (
                    <div className="rounded-xl bg-surface border border-border p-3 space-y-1 sm:col-span-2">
                      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Parent / Tuteur</p>
                      <p className="text-sm font-medium">{viewP.parents[0].prenom} {viewP.parents[0].nom} <span className="text-xs font-normal text-ink-3">({viewP.parents[0].relation})</span></p>
                      {viewP.parents[0].telephone && <p className="text-xs text-ink-3">{viewP.parents[0].telephone}</p>}
                      {viewP.parents[0].email && <p className="text-xs text-ink-3">{viewP.parents[0].email}</p>}
                    </div>
                  )}
                </div>

                {/* ── Fouille des sacs ───────────────────────── */}
                <div className="rounded-xl bg-surface border border-border p-3 space-y-3 sm:col-span-2">
                  <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Fouille des bagages</p>

                  {/* Liste des articles */}
                  {articlesSac.length > 0 && (
                    <div className="space-y-1.5">
                      {articlesSac.map(a => (
                        <div key={a.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm ${a.confisque ? 'bg-ember/5 border-ember/20' : 'bg-card border-border'}`}>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{a.article}</span>
                            {a.quantite > 1 && <span className="text-ink-3 ml-1">×{a.quantite}</span>}
                            {a.categorie && <span className="ml-2 text-xs text-ink-3 bg-surface border border-border rounded px-1.5 py-0.5">{a.categorie}</span>}
                            {a.confisque && <span className="ml-2 text-xs text-ember font-medium">Confisqué</span>}
                            {a.notes && <p className="text-xs text-ink-3 mt-0.5">{a.notes}</p>}
                          </div>
                          <button onClick={() => toggleConfisque(a)} title={a.confisque ? 'Rendre' : 'Confisquer'} className={`p-1.5 rounded-lg transition-colors text-xs ${a.confisque ? 'text-ember hover:bg-ember/10' : 'text-ink-3 hover:bg-surface'}`}>
                            {a.confisque ? <X size={13} /> : <Check size={13} />}
                          </button>
                          <button onClick={() => deleteArticleSac(a.id)} className="p-1.5 rounded-lg text-ink-3 hover:text-ember hover:bg-ember/5 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulaire d'ajout */}
                  <form onSubmit={addArticleSac} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        className="input-field flex-1 text-sm py-2"
                        placeholder="Article / objet *"
                        value={articleForm.article}
                        onChange={e => setArticleForm(f => ({ ...f, article: e.target.value }))}
                        required
                      />
                      <input
                        type="number" min={1}
                        className="input-field w-16 text-sm py-2"
                        value={articleForm.quantite}
                        onChange={e => setArticleForm(f => ({ ...f, quantite: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="input-field flex-1 text-sm py-2"
                        placeholder="Catégorie (ex: Médicaments, Électronique...)"
                        value={articleForm.categorie}
                        onChange={e => setArticleForm(f => ({ ...f, categorie: e.target.value }))}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-ink-2 whitespace-nowrap cursor-pointer">
                        <input type="checkbox" checked={articleForm.confisque} onChange={e => setArticleForm(f => ({ ...f, confisque: e.target.checked }))} className="rounded" />
                        Confisqué
                      </label>
                    </div>
                    <input
                      className="input-field text-sm py-2"
                      placeholder="Notes"
                      value={articleForm.notes}
                      onChange={e => setArticleForm(f => ({ ...f, notes: e.target.value }))}
                    />
                    <button type="submit" disabled={articleSaving} className="btn-ghost w-full text-sm py-2 flex items-center justify-center gap-2">
                      <Plus size={14} /> {articleSaving ? 'Ajout...' : 'Ajouter un article'}
                    </button>
                  </form>
                </div>

                <div className="flex gap-3 pt-2 pb-1">
                  <button onClick={() => deleteParticipant(viewP.id, `${viewP.prenom} ${viewP.nom}`)} className="btn-ghost flex-1 flex items-center justify-center gap-2 text-ember border-ember/20 hover:bg-ember/5">
                    <Trash2 size={15} /> Supprimer
                  </button>
                  <button onClick={() => startEdit(viewP)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <Pencil size={15} /> Modifier
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function PlanningPage() {
  const { camps } = useCamps()
  const [campId, setCampId] = useState('')
  const [items, setItems] = useState<ActivityItem[]>([])
  const [form, setForm] = useState({ titre: '', description: '', lieu: '', dateHeureDebut: '', dateHeureFin: '', couleur: '#2563eb' })
  const [planError, setPlanError] = useState('')

  useEffect(() => { if (!campId && camps[0]) setCampId(camps[0].id) }, [camps, campId])

  const load = () => {
    api.get<ApiList<ActivityItem>>(`/activites${campId ? `?campId=${campId}` : ''}`)
      .then(({ data }) => setItems(data.data || []))
      .catch(() => setItems([]))
  }
  useEffect(load, [campId])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setPlanError('')
    try {
      await api.post('/activites', {
        ...form,
        campId,
      })
      setForm({ titre: '', description: '', lieu: '', dateHeureDebut: '', dateHeureFin: '', couleur: '#2563eb' })
      load()
    } catch (err) {
      setPlanError(getErrorMessage(err))
    }
  }

  const deleteActivity = async (id: string) => {
    if (!window.confirm('Supprimer cette activité ?')) return
    try {
      await api.delete(`/activites/${id}`)
      load()
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="Planning" subtitle="Créer et suivre les activités du camp." />
      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={submit} className="card space-y-3">
          <h2 className="font-display font-700 text-sm">Nouvelle activité</h2>
          {planError && <div className="rounded-xl border border-ember/20 bg-ember/8 px-3 py-2 text-sm text-ember">{planError}</div>}
          <select className="input-field" required value={campId} onChange={e => setCampId(e.target.value)}>{camps.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
          <input className="input-field" placeholder="Titre de l'activité" required value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} />
          <input className="input-field" placeholder="Lieu" value={form.lieu} onChange={e => setForm({ ...form, lieu: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-3 mb-1 block">Début</label>
              <input type="datetime-local" className="input-field" required value={form.dateHeureDebut} onChange={e => setForm({ ...form, dateHeureDebut: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-ink-3 mb-1 block">Fin</label>
              <input type="datetime-local" className="input-field" required value={form.dateHeureFin} onChange={e => setForm({ ...form, dateHeureFin: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-ink-3">Couleur</label>
            <input type="color" className="w-10 h-9 rounded-xl border border-border cursor-pointer" value={form.couleur} onChange={e => setForm({ ...form, couleur: e.target.value })} />
          </div>
          <button className="btn-primary inline-flex items-center gap-2"><Plus size={16} /> Ajouter</button>
        </form>
        <div className="lg:col-span-2 card">
          {items.length === 0 ? <EmptyState icon={Calendar} title="Aucune activité" text="Ajoutez une activité pour construire le planning." /> : (
            <div className="space-y-2">
              {items.map(a => (
                <div key={a.id} className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center gap-3 group">
                  <div className="h-10 w-1.5 rounded-full shrink-0" style={{ background: a.couleur }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ink">{a.titre}</p>
                    <p className="text-xs text-ink-3 truncate">{formatDateTime(a.dateHeureDebut)} · {a.lieu || 'Lieu à confirmer'}</p>
                  </div>
                  <span className="badge-sky shrink-0">{a.statut}</span>
                  <button
                    onClick={() => deleteActivity(a.id)}
                    className="text-ink-3 hover:text-ember transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MedicalPage() {
  const { camps } = useCamps()
  const [campId, setCampId] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({ groupeSanguin: '', allergies: '', medicaments: '', infosMedicales: '', nomUrgence: '', telephoneUrgence: '' })

  useEffect(() => { if (!campId && camps[0]) setCampId(camps[0].id) }, [camps, campId])

  const load = () => {
    if (!campId) return
    api.get<ApiList<Participant>>(`/camps/${campId}/participants?perPage=500`)
      .then(({ data }) => setParticipants(data.data || []))
      .catch(() => setParticipants([]))
  }

  useEffect(load, [campId])

  const filteredMedical = useMemo(() => {
    const q = search.toLowerCase().trim()
    return participants
      .filter(p => !q || `${p.prenom} ${p.nom}`.toLowerCase().includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'))
  }, [participants, search])

  const startEdit = (p: Participant) => {
    setEditingId(p.id)
    setForm({
      groupeSanguin: p.groupeSanguin || '',
      allergies: p.allergies || '',
      medicaments: p.medicaments || '',
      infosMedicales: p.infosMedicales || '',
      nomUrgence: p.nomUrgence || '',
      telephoneUrgence: p.telephoneUrgence || '',
    })
  }

  const save = async (id: string) => {
    await api.put(`/participants/${id}`, form)
    setEditingId('')
    load()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Médical"
        subtitle="Allergies, traitements, contacts d'urgence et notes de santé."
        action={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input className="input-field pl-8 w-48" placeholder="Nom, prénom…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-full sm:w-56" value={campId} onChange={e => setCampId(e.target.value)}>{camps.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
          </div>
        }
      />
      <p className="text-xs text-ink-3">{filteredMedical.length} participant{filteredMedical.length !== 1 ? 's' : ''} sur {participants.length} · triés A→Z</p>
      {participants.length === 0 ? <EmptyState icon={HeartPulse} title="Aucune fiche médicale" text="Inscrivez des participants pour remplir les informations médicales." /> : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filteredMedical.map(p => {
            const editing = editingId === p.id
            return (
              <div key={p.id} className="card space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display font-700 text-base">{p.prenom} {p.nom}</h2>
                    <p className="text-xs text-ink-3">Urgence : {p.nomUrgence} · {p.telephoneUrgence}</p>
                  </div>
                  <button onClick={() => editing ? void save(p.id) : startEdit(p)} className="btn-ghost px-3 py-2 inline-flex items-center gap-2">
                    {editing ? <Save size={15} /> : <HeartPulse size={15} />}
                    {editing ? 'Sauver' : 'Modifier'}
                  </button>
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input className="input-field" placeholder="Groupe sanguin" value={form.groupeSanguin} onChange={e => setForm({ ...form, groupeSanguin: e.target.value })} />
                      <input className="input-field" placeholder="Allergies" value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} />
                    </div>
                    <input className="input-field" placeholder="Médicaments / traitement" value={form.medicaments} onChange={e => setForm({ ...form, medicaments: e.target.value })} />
                    <textarea className="input-field min-h-24" placeholder="Informations médicales" value={form.infosMedicales} onChange={e => setForm({ ...form, infosMedicales: e.target.value })} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input className="input-field" placeholder="Contact urgence" value={form.nomUrgence} onChange={e => setForm({ ...form, nomUrgence: e.target.value })} />
                      <input className="input-field" placeholder="Téléphone urgence" value={form.telephoneUrgence} onChange={e => setForm({ ...form, telephoneUrgence: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-surface border border-border p-3"><p className="text-xs text-ink-3">Groupe sanguin</p><p>{p.groupeSanguin || '-'}</p></div>
                    <div className="rounded-xl bg-surface border border-border p-3"><p className="text-xs text-ink-3">Allergies</p><p>{p.allergies || '-'}</p></div>
                    <div className="rounded-xl bg-surface border border-border p-3"><p className="text-xs text-ink-3">Traitement</p><p>{p.medicaments || '-'}</p></div>
                    <div className="rounded-xl bg-surface border border-border p-3"><p className="text-xs text-ink-3">Notes</p><p>{p.infosMedicales || '-'}</p></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// PaiementsPage remplacé par CaissePage (src/CaissePage.tsx)
export function PaiementsPage() { return null }

export function DocumentsPage() {
  const { camps } = useCamps()
  const [campId, setCampId] = useState('')
  const participants = useParticipants(campId)
  const [items, setItems] = useState<DocumentItem[]>([])
  const [form, setForm] = useState({ participantId: '', nom: '', type: 'FICHE_SANTE', urlFichier: '' })

  useEffect(() => { if (!campId && camps[0]) setCampId(camps[0].id) }, [camps, campId])
  useEffect(() => { if (!form.participantId && participants[0]) setForm(f => ({ ...f, participantId: participants[0].id })) }, [participants, form.participantId])
  const load = () => api.get<ApiList<DocumentItem>>(`/documents${campId ? `?campId=${campId}` : ''}`).then(({ data }) => setItems(data.data || [])).catch(() => setItems([]))
  useEffect(() => {
    void load()
  }, [campId])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await api.post('/documents', form)
    setForm({ participantId: participants[0]?.id || '', nom: '', type: 'FICHE_SANTE', urlFichier: '' })
    load()
  }

  const update = async (id: string, statut: string) => {
    await api.put(`/documents/${id}/statut`, { statut })
    load()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="Documents" subtitle="Suivi des pièces médicales et autorisations." />
      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={submit} className="card space-y-3">
          <h2 className="font-display font-700 text-sm">Ajouter document</h2>
          <select className="input-field" required value={campId} onChange={e => setCampId(e.target.value)}>{camps.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
          <select className="input-field" required value={form.participantId} onChange={e => setForm({ ...form, participantId: e.target.value })}>{participants.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}</select>
          <input className="input-field" placeholder="Nom du document" required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
          <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="FICHE_SANTE">Fiche santé</option><option value="AUTORISATION_PARENTALE">Autorisation parentale</option><option value="CERTIFICAT_MEDICAL">Certificat médical</option><option value="AUTRE">Autre</option></select>
          <input className="input-field" placeholder="Lien fichier" required value={form.urlFichier} onChange={e => setForm({ ...form, urlFichier: e.target.value })} />
          <button className="btn-primary inline-flex items-center gap-2"><FileText size={16} /> Ajouter</button>
        </form>
        <div className="lg:col-span-2 card">
          {items.length === 0 ? <EmptyState icon={FileText} title="Aucun document" text="Les documents ajoutés seront visibles ici." /> : (
            <div className="space-y-2">
              {items.map(d => <div key={d.id} className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p className="font-medium text-sm">{d.nom}</p><p className="text-xs text-ink-3">{d.participant.prenom} {d.participant.nom} · {d.type}</p></div><div className="flex gap-2"><span className={d.statut === 'VALIDE' ? 'badge-green' : d.statut === 'REJETE' ? 'badge-ember' : 'badge-gold'}>{d.statut}</span><button onClick={() => update(d.id, 'VALIDE')} className="btn-ghost px-3 py-2">Valider</button><button onClick={() => update(d.id, 'REJETE')} className="btn-ghost px-3 py-2">Rejeter</button></div></div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MessagesPage() {
  const { camps } = useCamps()
  const [campId, setCampId] = useState('')
  const [items, setItems] = useState<MessageItem[]>([])
  const [form, setForm] = useState({ sujet: '', contenu: '' })

  useEffect(() => { if (!campId && camps[0]) setCampId(camps[0].id) }, [camps, campId])
  const load = () => api.get<ApiList<MessageItem>>(`/messages${campId ? `?campId=${campId}` : ''}`).then(({ data }) => setItems(data.data || [])).catch(() => setItems([]))
  useEffect(() => {
    void load()
  }, [campId])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await api.post('/messages', { ...form, campId })
    setForm({ sujet: '', contenu: '' })
    load()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader title="Messages" subtitle="Communication avec les familles." />
      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={submit} className="card space-y-3">
          <h2 className="font-display font-700 text-sm">Nouvelle annonce</h2>
          <select className="input-field" required value={campId} onChange={e => setCampId(e.target.value)}>{camps.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
          <input className="input-field" placeholder="Sujet" required value={form.sujet} onChange={e => setForm({ ...form, sujet: e.target.value })} />
          <textarea className="input-field min-h-32" placeholder="Message" required value={form.contenu} onChange={e => setForm({ ...form, contenu: e.target.value })} />
          <button className="btn-primary inline-flex items-center gap-2"><Mail size={16} /> Envoyer</button>
        </form>
        <div className="lg:col-span-2 card">
          {items.length === 0 ? <EmptyState icon={Mail} title="Aucun message" text="Les annonces envoyées apparaîtront ici." /> : (
            <div className="space-y-2">
              {items.map(m => <div key={m.id} className="rounded-xl border border-border bg-surface px-4 py-3"><div className="flex justify-between gap-3"><p className="font-medium text-sm">{m.sujet}</p><span className={m.lu ? 'badge-green' : 'badge-sky'}>{m.lu ? 'Lu' : 'Envoyé'}</span></div><p className="text-sm text-ink-2 mt-2">{m.contenu}</p><p className="text-xs text-ink-3 mt-2">{m.camp.nom} · {formatDateTime(m.envoyeAt)}</p></div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ value, color = 'sage' }: { value: number; color?: string }) {
  const colorClass: Record<string, string> = {
    sage: 'bg-sage', gold: 'bg-gold', sky: 'bg-sky', ember: 'bg-ember',
  }
  return (
    <div className="h-2 bg-surface rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorClass[color] ?? 'bg-sage'}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  )
}

export function StatistiquesPage() {
  const { camps } = useCamps()
  const [campId, setCampId] = useState('all')
  const [stats, setStats] = useState<CampStats | null>(null)
  const [perCampStats, setPerCampStats] = useState<CampStats[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!camps.length) return
    setLoading(true)
    if (campId === 'all') {
      Promise.all(camps.map(c => api.get<ApiOne<CampStats>>(`/camps/${c.id}/stats`).then(r => r.data.data).catch(() => null)))
        .then(results => {
          const valid = results.filter(Boolean) as CampStats[]
          setPerCampStats(valid)
          if (!valid.length) { setStats(null); return }
          const totalCap = valid.reduce((s, c) => s + c.camp.capaciteMax, 0)
          const totalPart = valid.reduce((s, c) => s + c.participants.total, 0)
          const aggregated: CampStats = {
            camp: { id: 'all', nom: 'Tous les camps', capaciteMax: totalCap },
            participants: {
              total: totalPart,
              confirmes: valid.reduce((s, c) => s + c.participants.confirmes, 0),
              tauxOccupation: totalCap > 0 ? Math.round(totalPart / totalCap * 100) : 0,
              parStatut: [],
            },
            finance: {
              totalEncaisse: valid.reduce((s, c) => s + Number(c.finance.totalEncaisse), 0),
              totalAttendu: valid.reduce((s, c) => s + Number(c.finance.totalAttendu), 0),
              nombrePaiements: valid.reduce((s, c) => s + c.finance.nombrePaiements, 0),
            },
            activites: valid.reduce((s, c) => s + c.activites, 0),
            documents: { parStatut: [] },
          }
          setStats(aggregated)
        })
        .finally(() => setLoading(false))
    } else {
      setPerCampStats([])
      api.get<ApiOne<CampStats>>(`/camps/${campId}/stats`)
        .then(({ data }) => setStats(data.data))
        .catch(() => setStats(null))
        .finally(() => setLoading(false))
    }
  }, [campId, camps])

  const paiementRate = stats && stats.finance.totalAttendu > 0
    ? Math.round((stats.finance.totalEncaisse / stats.finance.totalAttendu) * 100) : 0
  const reste = stats ? Math.max(0, stats.finance.totalAttendu - stats.finance.totalEncaisse) : 0

  const exportStatsCSV = () => {
    if (!stats) return
    const label = campId === 'all' ? 'Tous les camps' : (camps.find(c => c.id === campId)?.nom || campId)
    const rows = [
      { indicateur: 'Périmètre', valeur: label },
      { indicateur: 'Capacité totale', valeur: stats.camp.capaciteMax },
      { indicateur: 'Participants inscrits', valeur: stats.participants.total },
      { indicateur: 'Participants confirmés', valeur: stats.participants.confirmes },
      { indicateur: "Taux d'occupation (%)", valeur: stats.participants.tauxOccupation },
      { indicateur: 'Total encaissé (FCFA)', valeur: stats.finance.totalEncaisse },
      { indicateur: 'Total attendu (FCFA)', valeur: stats.finance.totalAttendu },
      { indicateur: 'Reste à percevoir (FCFA)', valeur: reste },
      { indicateur: 'Nombre de paiements', valeur: stats.finance.nombrePaiements },
      { indicateur: 'Activités planifiées', valeur: stats.activites },
      ...(campId === 'all'
        ? perCampStats.map(c => ({ indicateur: `Camp : ${c.camp.nom}`, valeur: `${c.participants.total} inscrits · ${formatCFA(c.finance.totalEncaisse)} encaissés` }))
        : stats.participants.parStatut.map((s: any) => ({ indicateur: `Statut ${s.statutInscription}`, valeur: s._count }))),
    ]
    const content = ['indicateur,valeur', ...rows.map(r => `"${r.indicateur}","${r.valeur}"`)].join('\n')
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stats-${campId}.csv`; a.click()
  }

  const printStats = () => {
    if (!stats) return
    const label = campId === 'all' ? 'Tous les camps' : (camps.find(c => c.id === campId)?.nom || '')
    const perCampRows = campId === 'all'
      ? perCampStats.map(c => {
          const rate = c.finance.totalAttendu > 0 ? Math.round(c.finance.totalEncaisse / c.finance.totalAttendu * 100) : 0
          return `<tr><td>${c.camp.nom}</td><td>${c.participants.total}</td><td>${c.participants.confirmes}</td><td>${c.participants.tauxOccupation}%</td><td style="color:#16a34a;font-weight:600">${formatCFA(c.finance.totalEncaisse)}</td><td>${rate}%</td><td>${c.activites}</td></tr>`
        }).join('')
      : ''
    const win = window.open('', '_blank', 'width=860,height=960')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Statistiques ${label}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:32px;color:#0f172a;font-size:13px}
    h1{font-size:22px;margin-bottom:2px}p.sub{color:#64748b;margin-bottom:24px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}
    .card{border:1px solid #e2e8f0;border-radius:12px;padding:14px}
    .label{font-size:11px;color:#94a3b8;margin-bottom:4px}.val{font-size:20px;font-weight:700}
    .green{color:#16a34a}.gold{color:#d97706}.red{color:#dc2626}
    h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin:20px 0 8px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#94a3b8;padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
    td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
    footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
    </style></head><body>
    <h1>Rapport statistiques</h1>
    <p class="sub">${label} &mdash; ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <div class="grid">
      <div class="card"><div class="label">Participants inscrits</div><div class="val">${stats.participants.total}</div><p style="font-size:12px;color:#64748b;margin-top:4px">${stats.participants.confirmes} confirmés · ${stats.participants.tauxOccupation}%</p></div>
      <div class="card"><div class="label">Total encaissé</div><div class="val green">${formatCFA(stats.finance.totalEncaisse)}</div><p style="font-size:12px;color:#64748b;margin-top:4px">${paiementRate}% du total attendu</p></div>
      <div class="card"><div class="label">Reste à percevoir</div><div class="val ${reste > 0 ? 'red' : 'green'}">${formatCFA(reste)}</div></div>
      <div class="card"><div class="label">Activités planifiées</div><div class="val">${stats.activites}</div></div>
    </div>
    ${campId === 'all' && perCampRows ? `<h2>Détail par camp</h2>
    <table><thead><tr><th>Camp</th><th>Inscrits</th><th>Confirmés</th><th>Occupation</th><th>Encaissé</th><th>Taux</th><th>Activités</th></tr></thead>
    <tbody>${perCampRows}</tbody></table>` : ''}
    ${stats.participants.parStatut?.length ? `<h2>Répartition par statut</h2>
    <table><thead><tr><th>Statut</th><th>Nombre</th><th>%</th></tr></thead><tbody>
    ${stats.participants.parStatut.map((s: any) => `<tr><td>${s.statutInscription}</td><td>${s._count}</td><td>${stats.participants.total > 0 ? Math.round(s._count / stats.participants.total * 100) : 0}%</td></tr>`).join('')}
    </tbody></table>` : ''}
    <footer>Généré le ${new Date().toLocaleString('fr-FR')} &mdash; Camp Manager</footer>
    <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Statistiques"
        subtitle={campId === 'all' ? `Vue globale — ${camps.length} camp${camps.length > 1 ? 's' : ''}` : 'Vue d\'ensemble du camp sélectionné.'}
        action={
          <div className="flex flex-wrap gap-2">
            <select className="input-field w-full sm:w-56" value={campId} onChange={e => setCampId(e.target.value)}>
              <option value="all">Tous les camps</option>
              {camps.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            {stats && <>
              <button onClick={exportStatsCSV} className="btn-ghost flex items-center gap-2 px-3 text-sm"><Download size={14} /> CSV</button>
              <button onClick={printStats} className="btn-ghost flex items-center gap-2 px-3 text-sm"><Printer size={14} /> Imprimer</button>
            </>}
          </div>
        }
      />

      {loading && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card h-28 animate-pulse bg-surface" />)}
        </div>
      )}

      {!loading && !stats && <EmptyState icon={Calendar} title="Aucune donnée" text="Aucune statistique disponible pour cette sélection." />}

      {!loading && stats && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-xs font-medium text-ink-3">Participants inscrits</p>
              <p className="font-display font-700 text-2xl text-ink mt-1">{stats.participants.total}</p>
              <p className="text-xs text-ink-3">{stats.participants.confirmes} confirmés · {stats.camp.capaciteMax} places</p>
              <ProgressBar value={stats.participants.tauxOccupation} color="sage" />
              <p className="text-xs text-sage font-semibold mt-1">{stats.participants.tauxOccupation}% occupé</p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-ink-3">Total encaissé</p>
              <p className="font-display font-700 text-2xl text-ink mt-1">{formatCFA(stats.finance.totalEncaisse)}</p>
              <p className="text-xs text-ink-3">sur {formatCFA(stats.finance.totalAttendu)} attendus</p>
              <ProgressBar value={paiementRate} color="gold" />
              <p className="text-xs text-gold font-semibold mt-1">{paiementRate}% encaissé</p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-ink-3">Reste à percevoir</p>
              <p className={`font-display font-700 text-2xl mt-1 ${reste > 0 ? 'text-ember' : 'text-sage'}`}>{formatCFA(reste)}</p>
              <p className="text-xs text-ink-3">{stats.finance.nombrePaiements} paiement{stats.finance.nombrePaiements > 1 ? 's' : ''} enregistré{stats.finance.nombrePaiements > 1 ? 's' : ''}</p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-ink-3">Activités planifiées</p>
              <p className="font-display font-700 text-2xl text-ink mt-1">{stats.activites}</p>
              <p className="text-xs text-ink-3">sur {camps.length} camp{camps.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Tableau comparatif par camp (vue globale) */}
          {campId === 'all' && perCampStats.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-surface">
                <h2 className="font-display font-700 text-sm text-ink">Comparatif par camp</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-xs font-semibold text-ink-3 uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">Camp</th>
                      <th className="px-4 py-3 text-right">Inscrits</th>
                      <th className="px-4 py-3 text-right">Confirmés</th>
                      <th className="px-4 py-3 text-right">Occupation</th>
                      <th className="px-4 py-3 text-right">Encaissé</th>
                      <th className="px-4 py-3 text-right">Taux paie.</th>
                      <th className="px-4 py-3 text-right">Activités</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perCampStats.map((c, i) => {
                      const rate = c.finance.totalAttendu > 0 ? Math.round(c.finance.totalEncaisse / c.finance.totalAttendu * 100) : 0
                      return (
                        <tr key={c.camp.id} className={`border-b border-border last:border-0 hover:bg-surface/60 ${i % 2 === 0 ? '' : 'bg-surface/30'}`}>
                          <td className="px-5 py-3 font-semibold text-ink">{c.camp.nom}</td>
                          <td className="px-4 py-3 text-right">{c.participants.total}</td>
                          <td className="px-4 py-3 text-right text-sage font-medium">{c.participants.confirmes}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={c.participants.tauxOccupation > 80 ? 'text-ember font-semibold' : 'text-ink-2'}>{c.participants.tauxOccupation}%</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-sage">{formatCFA(c.finance.totalEncaisse)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={rate < 50 ? 'text-ember' : rate < 80 ? 'text-gold' : 'text-sage'}>{rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sky font-medium">{c.activites}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-border bg-surface font-semibold text-sm">
                      <td className="px-5 py-3 text-ink">TOTAL</td>
                      <td className="px-4 py-3 text-right">{stats.participants.total}</td>
                      <td className="px-4 py-3 text-right text-sage">{stats.participants.confirmes}</td>
                      <td className="px-4 py-3 text-right">{stats.participants.tauxOccupation}%</td>
                      <td className="px-4 py-3 text-right text-sage">{formatCFA(stats.finance.totalEncaisse)}</td>
                      <td className="px-4 py-3 text-right">{paiementRate}%</td>
                      <td className="px-4 py-3 text-right text-sky">{stats.activites}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Répartition par statut (camp unique) */}
          {campId !== 'all' && stats.participants.parStatut?.length > 0 && (
            <div className="card">
              <h2 className="font-display font-700 text-sm text-ink mb-4">Répartition des inscriptions</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.participants.parStatut.map((s: any) => (
                  <div key={s.statutInscription} className="rounded-xl bg-surface border border-border p-3">
                    <p className="text-xs text-ink-3 mb-1">{s.statutInscription.replace(/_/g, ' ')}</p>
                    <p className="font-display font-700 text-xl text-ink">{s._count}</p>
                    <div className="mt-2 h-1 bg-border rounded-full">
                      <div className="h-full bg-sage rounded-full" style={{ width: `${stats.participants.total > 0 ? Math.round(s._count / stats.participants.total * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {campId !== 'all' && stats.documents?.parStatut?.length > 0 && (
            <div className="card">
              <h2 className="font-display font-700 text-sm text-ink mb-4">Statut des documents</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {stats.documents.parStatut.map((d: any) => (
                  <div key={d.statut} className="rounded-xl bg-surface border border-border p-3">
                    <p className="text-xs text-ink-3 mb-1">{d.statut}</p>
                    <p className="font-display font-700 text-xl text-ink">{d._count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function SettingsPage() {
  const { user } = useAuthStore()
  const profile = useMemo(() => [
    ['Nom', `${user?.prenom || ''} ${user?.nom || ''}`.trim()],
    ['Email', user?.email || ''],
    ['Rôle', user?.role || ''],
  ], [user])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader title="Paramètres" subtitle="Profil et configuration du compte." />
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage/15 border border-sage/30 flex items-center justify-center"><Settings size={18} className="text-sage" /></div>
          <div><p className="font-medium">Compte connecté</p><p className="text-xs text-ink-3">Les droits d'accès viennent du rôle utilisateur.</p></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {profile.map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-ink-3">{label}</p><p className="text-sm font-medium mt-1">{value || '-'}</p></div>)}
        </div>
      </div>
    </div>
  )
}
