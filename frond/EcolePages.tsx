import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Plus, Trash2, Edit2, Users, X } from 'lucide-react'
import api from './http'
import { useAuthStore } from './auth.store'

// ─── Utilitaires ─────────────────────────────────────────────
export const errMsg = (err: unknown) => (err as any)?.response?.data?.message || 'Une erreur est survenue'
export const today = () => new Date().toISOString().slice(0, 10)
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

export const useCampId = () => useAuthStore(s => s.user?.campId ?? '')

export function Header({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between animate-fade-up">
      <div>
        <h1 className="font-display font-700 text-2xl text-ink">{title}</h1>
        {subtitle && <p className="text-ink-3 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-700 text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Types ───────────────────────────────────────────────────
interface Classe { id: string; nom: string; niveau?: string | null; _count?: { eleves: number } }
interface GroupeEcole { id: string; nom: string; couleur: string; description?: string | null; eleves?: { id: string; nom: string; prenom: string }[] }
interface Eleve {
  id: string; nom: string; prenom: string
  sexe?: 'M' | 'F' | null; dateNaissance?: string | null; lieuNaissance?: string | null
  parentNom?: string | null; parentPrenom?: string | null; parentTelephone?: string | null
  adresse?: string | null; infosMedicales?: string | null; notes?: string | null
  classe?: { id: string; nom: string } | null
  groupes: { id: string; nom: string; couleur: string }[]
}
interface Stats {
  total: number; garcons: number; filles: number
  parAge: { age: number; garcons: number; filles: number; total: number }[]
  parClasse: { id: string; nom: string; garcons: number; filles: number; total: number }[]
}
interface Competence { id: string; nom: string }
interface Evaluation { eleveId: string; competenceId: string; couleur: Couleur }
type Couleur = 'VERT' | 'JAUNE' | 'ORANGE' | 'ROUGE'

const COULEURS: { value: Couleur; label: string; hex: string }[] = [
  { value: 'VERT',   label: 'Acquis',      hex: '#7eb87a' },
  { value: 'JAUNE',  label: 'En cours',    hex: '#e5c14a' },
  { value: 'ORANGE', label: 'À renforcer', hex: '#e08a3a' },
  { value: 'ROUGE',  label: 'Non acquis',  hex: '#d4614a' },
]

// ─── Configuration de l'école (champs choisis par le super admin) ───
export const DEFAULT_CHAMPS = ['sexe', 'dateNaissance', 'lieuNaissance', 'parent', 'telephoneParent', 'classe', 'groupes', 'notes']

function useChamps() {
  const [champs, setChamps] = useState<string[]>(DEFAULT_CHAMPS)
  useEffect(() => {
    api.get('/camps?perPage=1').then(({ data }) => {
      const c = data.data?.[0]?.champsEleve
      if (Array.isArray(c)) setChamps(c)
    }).catch(() => {})
  }, [])
  return champs
}

// ─── Tableau de bord école ───────────────────────────────────
export function EcoleDashboard() {
  const campId = useCampId()
  const nom = useAuthStore(s => s.user?.campNom)
  const champs = useChamps()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (campId) api.get(`/eleves/stats?campId=${campId}`).then(({ data }) => setStats(data.data)).catch(() => setStats(null))
  }, [campId])

  const hasSexe = champs.includes('sexe')
  const cards: [string, number | undefined][] = [['Élèves', stats?.total]]
  if (hasSexe) cards.push(['Garçons', stats?.garcons], ['Filles', stats?.filles])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Header title={nom || 'Mon école'} subtitle="Effectif et répartitions" />
      <div className={`grid gap-3 ${hasSexe ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {cards.map(([label, n]) => (
          <div key={label} className="card text-center">
            <p className="text-3xl font-display font-700 text-ink">{n ?? '–'}</p>
            <p className="text-xs text-ink-3 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {champs.includes('classe') && !!stats?.parClasse.length && (
        <div className="card">
          <h3 className="font-display font-700 text-ink mb-3">Effectif par classe</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-3 text-xs border-b border-border">
              <th className="py-2">Classe</th>{hasSexe && <><th>Garçons</th><th>Filles</th></>}<th>Total</th>
            </tr></thead>
            <tbody>
              {stats.parClasse.map(c => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="py-2 font-medium">{c.nom}</td>
                  {hasSexe && <><td>{c.garcons}</td><td>{c.filles}</td></>}
                  <td className="font-medium">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {champs.includes('dateNaissance') && (
        <div className="card">
          <h3 className="font-display font-700 text-ink mb-3">Tableau des âges</h3>
          {!stats?.parAge.length ? (
            <p className="text-sm text-ink-3">Aucun élève avec une date de naissance.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-3 text-xs border-b border-border">
                <th className="py-2">Âge</th>{hasSexe && <><th>Garçons</th><th>Filles</th></>}<th>Total</th>
              </tr></thead>
              <tbody>
                {stats.parAge.map(r => (
                  <tr key={r.age} className="border-b border-border/50">
                    <td className="py-2 font-medium">{r.age} an{r.age > 1 ? 's' : ''}</td>
                    {hasSexe && <><td>{r.garcons}</td><td>{r.filles}</td></>}
                    <td className="font-medium">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Élèves ──────────────────────────────────────────────────
const emptyEleve = {
  nom: '', prenom: '', sexe: 'M', dateNaissance: '', lieuNaissance: '',
  parentNom: '', parentPrenom: '', parentTelephone: '', adresse: '', infosMedicales: '', notes: '',
  classeId: '', groupeEcoleIds: [] as string[],
}

export function ElevesPage() {
  const campId = useCampId()
  const champs = useChamps()
  const has = (c: string) => champs.includes(c)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [groupes, setGroupes] = useState<GroupeEcole[]>([])
  const [search, setSearch] = useState('')
  const [filtreClasse, setFiltreClasse] = useState('')
  const [form, setForm] = useState(emptyEleve)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/classes?campId=${campId}`).then(({ data }) => setClasses(data.data || [])).catch(() => {})
    api.get(`/groupes-ecole?campId=${campId}`).then(({ data }) => setGroupes(data.data || [])).catch(() => {})
  }, [campId])

  const load = useCallback(() => {
    const q = new URLSearchParams({ campId })
    if (search) q.set('search', search)
    if (filtreClasse) q.set('classeId', filtreClasse)
    api.get(`/eleves?${q}`).then(({ data }) => setEleves(data.data || [])).catch(() => setEleves([]))
  }, [campId, search, filtreClasse])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const openNew = () => { setEditingId(null); setForm(emptyEleve); setError(''); setOpen(true) }
  const openEdit = (e: Eleve) => {
    setEditingId(e.id)
    setForm({
      nom: e.nom, prenom: e.prenom, sexe: e.sexe || 'M', dateNaissance: e.dateNaissance?.slice(0, 10) || '',
      lieuNaissance: e.lieuNaissance || '', parentNom: e.parentNom || '', parentPrenom: e.parentPrenom || '',
      parentTelephone: e.parentTelephone || '', adresse: e.adresse || '', infosMedicales: e.infosMedicales || '',
      notes: e.notes || '', classeId: e.classe?.id || '', groupeEcoleIds: e.groupes.map(g => g.id),
    })
    setError(''); setOpen(true)
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault(); setError('')
    try {
      if (editingId) await api.put(`/eleves/${editingId}`, form)
      else await api.post('/eleves', { ...form, campId })
      setOpen(false); load()
    } catch (err) { setError(errMsg(err)) }
  }
  const remove = async (id: string) => {
    if (!confirm('Supprimer cet élève et ses évaluations ?')) return
    await api.delete(`/eleves/${id}`).catch(() => {}); load()
  }
  const toggleGroupe = (id: string) =>
    setForm(f => ({ ...f, groupeEcoleIds: f.groupeEcoleIds.includes(id) ? f.groupeEcoleIds.filter(g => g !== id) : [...f.groupeEcoleIds, id] }))

  const set = (k: keyof typeof emptyEleve) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Header title="Élèves" subtitle={`${eleves.length} élève${eleves.length > 1 ? 's' : ''}`}
        action={<button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={16} />Nouvel élève</button>} />
      <div className="flex gap-3 flex-col sm:flex-row">
        <input className="input-field" placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
        {has('classe') && (
          <select className="input-field sm:w-56" value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)}>
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        )}
      </div>

      <div className="card overflow-x-auto">
        {eleves.length === 0 ? (
          <div className="text-center py-10 text-ink-3"><Users size={32} className="mx-auto mb-2 opacity-40" />Aucun élève</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-3 text-xs border-b border-border">
              <th className="py-2">Nom et prénom</th>
              {has('sexe') && <th>Sexe</th>}
              {has('classe') && <th>Classe</th>}
              {has('groupes') && <th>Groupes</th>}
              {has('dateNaissance') && <th>Né(e) le</th>}
              {has('lieuNaissance') && <th>Lieu</th>}
              {has('parent') && <th>Parent</th>}
              {has('telephoneParent') && <th>Téléphone</th>}
              <th />
            </tr></thead>
            <tbody>
              {eleves.map(e => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="py-2 font-medium">{e.nom} {e.prenom}</td>
                  {has('sexe') && <td>{e.sexe === 'M' ? 'Garçon' : e.sexe === 'F' ? 'Fille' : '–'}</td>}
                  {has('classe') && <td>{e.classe?.nom || '–'}</td>}
                  {has('groupes') && (
                    <td>{e.groupes.length ? e.groupes.map(g => (
                      <span key={g.id} className="inline-block mr-1 px-2 py-0.5 rounded-full text-xs text-white" style={{ background: g.couleur }}>{g.nom}</span>
                    )) : '–'}</td>
                  )}
                  {has('dateNaissance') && <td>{e.dateNaissance ? fmtDate(e.dateNaissance) : '–'}</td>}
                  {has('lieuNaissance') && <td>{e.lieuNaissance || '–'}</td>}
                  {has('parent') && <td>{[e.parentPrenom, e.parentNom].filter(Boolean).join(' ') || '–'}</td>}
                  {has('telephoneParent') && <td>{e.parentTelephone || '–'}</td>}
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => openEdit(e)} className="p-1.5 text-ink-3 hover:text-ink"><Edit2 size={14} /></button>
                    <button onClick={() => remove(e.id)} className="p-1.5 text-ink-3 hover:text-ember"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={editingId ? "Modifier l'élève" : 'Nouvel élève'} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom"><input className="input-field" required value={form.nom} onChange={set('nom')} /></Field>
              <Field label="Prénom"><input className="input-field" required value={form.prenom} onChange={set('prenom')} /></Field>
              {has('sexe') && (
                <Field label="Sexe">
                  <select className="input-field" value={form.sexe} onChange={set('sexe')}>
                    <option value="M">Garçon</option><option value="F">Fille</option>
                  </select>
                </Field>
              )}
              {has('dateNaissance') && <Field label="Date de naissance"><input type="date" className="input-field" value={form.dateNaissance} onChange={set('dateNaissance')} /></Field>}
              {has('lieuNaissance') && <Field label="Lieu de naissance"><input className="input-field" value={form.lieuNaissance} onChange={set('lieuNaissance')} /></Field>}
              {has('classe') && (
                <Field label="Classe">
                  <select className="input-field" value={form.classeId} onChange={set('classeId')}>
                    <option value="">— Aucune —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </Field>
              )}
              {has('parent') && <>
                <Field label="Nom du parent"><input className="input-field" value={form.parentNom} onChange={set('parentNom')} /></Field>
                <Field label="Prénom du parent"><input className="input-field" value={form.parentPrenom} onChange={set('parentPrenom')} /></Field>
              </>}
              {has('telephoneParent') && <Field label="Téléphone du parent"><input type="tel" className="input-field" value={form.parentTelephone} onChange={set('parentTelephone')} /></Field>}
              {has('adresse') && <Field label="Adresse"><input className="input-field" value={form.adresse} onChange={set('adresse')} /></Field>}
            </div>
            {has('groupes') && (
              <Field label="Groupes">
                {groupes.length === 0 ? <p className="text-xs text-ink-3">Aucun groupe — créez-en dans « Groupes ».</p> : (
                  <div className="flex flex-wrap gap-2">
                    {groupes.map(g => (
                      <button type="button" key={g.id} onClick={() => toggleGroupe(g.id)}
                        className={`px-3 py-1 rounded-full text-xs border ${form.groupeEcoleIds.includes(g.id) ? 'text-white border-transparent' : 'text-ink-2 border-border'}`}
                        style={form.groupeEcoleIds.includes(g.id) ? { background: g.couleur } : undefined}>{g.nom}</button>
                    ))}
                  </div>
                )}
              </Field>
            )}
            {has('infosMedicales') && <Field label="Infos médicales"><textarea className="input-field min-h-16" value={form.infosMedicales} onChange={set('infosMedicales')} /></Field>}
            {has('notes') && <Field label="Notes"><textarea className="input-field min-h-16" value={form.notes} onChange={set('notes')} /></Field>}
            <button className="btn-primary">{editingId ? 'Enregistrer' : 'Ajouter'}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Classes ─────────────────────────────────────────────────
export function ClassesPage() {
  const campId = useCampId()
  const [classes, setClasses] = useState<Classe[]>([])
  const [form, setForm] = useState({ nom: '', niveau: '' })
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get(`/classes?campId=${campId}`).then(({ data }) => setClasses(data.data || [])).catch(() => setClasses([]))
  }, [campId])
  useEffect(load, [load])

  const add = async (ev: FormEvent) => {
    ev.preventDefault(); setError('')
    try { await api.post('/classes', { ...form, campId }); setForm({ nom: '', niveau: '' }); load() }
    catch (err) { setError(errMsg(err)) }
  }
  const remove = async (id: string) => {
    if (!confirm('Supprimer cette classe ? Les élèves seront conservés sans classe.')) return
    await api.delete(`/classes/${id}`).catch(() => {}); load()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Header title="Classes" subtitle={`${classes.length} classe${classes.length > 1 ? 's' : ''}`} />
      <form onSubmit={add} className="card flex flex-col sm:flex-row gap-2">
        <input className="input-field" required placeholder="Nom (ex. Petite section A)" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
        <input className="input-field" placeholder="Niveau (optionnel)" value={form.niveau} onChange={e => setForm({ ...form, niveau: e.target.value })} />
        <button className="btn-primary whitespace-nowrap">Ajouter</button>
      </form>
      {error && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{error}</div>}
      <div className="card divide-y divide-border/50">
        {classes.length === 0 && <p className="text-sm text-ink-3 py-6 text-center">Aucune classe.</p>}
        {classes.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium">{c.nom}{c.niveau && <span className="text-ink-3 font-normal"> · {c.niveau}</span>}</p>
              <p className="text-xs text-ink-3">{c._count?.eleves ?? 0} élève{(c._count?.eleves ?? 0) > 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => remove(c.id)} className="p-1.5 text-ink-3 hover:text-ember"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Groupes ─────────────────────────────────────────────────
const COULEURS_GROUPE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6']

export function GroupesEcolePage() {
  const campId = useCampId()
  const [groupes, setGroupes] = useState<GroupeEcole[]>([])
  const [form, setForm] = useState({ nom: '', couleur: COULEURS_GROUPE[0], description: '' })
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get(`/groupes-ecole?campId=${campId}`).then(({ data }) => setGroupes(data.data || [])).catch(() => setGroupes([]))
  }, [campId])
  useEffect(load, [load])

  const add = async (ev: FormEvent) => {
    ev.preventDefault(); setError('')
    try { await api.post('/groupes-ecole', { ...form, campId }); setForm({ nom: '', couleur: COULEURS_GROUPE[0], description: '' }); load() }
    catch (err) { setError(errMsg(err)) }
  }
  const remove = async (id: string) => {
    if (!confirm('Supprimer ce groupe ?')) return
    await api.delete(`/groupes-ecole/${id}`).catch(() => {}); load()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Header title="Groupes" subtitle="Affectez les élèves à un groupe depuis leur fiche" />
      <form onSubmit={add} className="card space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input-field" required placeholder="Nom du groupe" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
          <input className="input-field" placeholder="Description (optionnel)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <button className="btn-primary whitespace-nowrap">Ajouter</button>
        </div>
        <div className="flex gap-2">
          {COULEURS_GROUPE.map(c => (
            <button type="button" key={c} onClick={() => setForm({ ...form, couleur: c })}
              className={`w-6 h-6 rounded-full border-2 ${form.couleur === c ? 'border-ink' : 'border-transparent'}`} style={{ background: c }} />
          ))}
        </div>
      </form>
      {error && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{error}</div>}
      <div className="grid sm:grid-cols-2 gap-4">
        {groupes.length === 0 && <div className="card text-center py-10 text-ink-3 sm:col-span-2">Aucun groupe.</div>}
        {groupes.map(g => (
          <div key={g.id} className="card space-y-2" style={{ borderTop: `4px solid ${g.couleur}` }}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-700 text-ink">{g.nom}</h3>
                {g.description && <p className="text-xs text-ink-3">{g.description}</p>}
              </div>
              <button onClick={() => remove(g.id)} className="p-1.5 text-ink-3 hover:text-ember"><Trash2 size={14} /></button>
            </div>
            <p className="text-xs text-ink-3">{g.eleves?.length ?? 0} élève{(g.eleves?.length ?? 0) > 1 ? 's' : ''}</p>
            <p className="text-sm text-ink-2">{g.eleves?.map(e => `${e.nom} ${e.prenom}`).join(', ') || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Évaluations par couleurs ────────────────────────────────
export function EvaluationsPage() {
  const campId = useCampId()
  const [periode, setPeriode] = useState(today().slice(0, 7))
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [competences, setCompetences] = useState<Competence[]>([])
  const [evals, setEvals] = useState<Record<string, Couleur>>({})
  const [newComp, setNewComp] = useState('')
  const [error, setError] = useState('')
  const [classes, setClasses] = useState<Classe[]>([])
  const [filtreClasse, setFiltreClasse] = useState('')
  useEffect(() => { api.get(`/classes?campId=${campId}`).then(({ data }) => setClasses(data.data || [])).catch(() => {}) }, [campId])

  const key = (e: string, c: string) => `${e}|${c}`

  const loadBase = useCallback(() => {
    api.get(`/eleves?campId=${campId}`).then(({ data }) => setEleves(data.data || []))
    api.get(`/competences?campId=${campId}`).then(({ data }) => setCompetences(data.data || []))
  }, [campId])
  useEffect(loadBase, [loadBase])

  useEffect(() => {
    api.get(`/evaluations?campId=${campId}&periode=${periode}`).then(({ data }) => {
      const map: Record<string, Couleur> = {}
      for (const ev of data.data as Evaluation[]) map[key(ev.eleveId, ev.competenceId)] = ev.couleur
      setEvals(map)
    }).catch(() => setEvals({}))
  }, [campId, periode])

  // Clic : aucune → vert → jaune → orange → rouge → aucune
  const cycle = async (eleveId: string, competenceId: string) => {
    const current = evals[key(eleveId, competenceId)]
    const idx = current ? COULEURS.findIndex(c => c.value === current) : -1
    const next = idx + 1 < COULEURS.length ? COULEURS[idx + 1].value : null
    setError('')
    try {
      await api.put('/evaluations', { eleveId, competenceId, periode, couleur: next })
      setEvals(prev => {
        const copy = { ...prev }
        if (next) copy[key(eleveId, competenceId)] = next; else delete copy[key(eleveId, competenceId)]
        return copy
      })
    } catch (err) { setError(errMsg(err)) }
  }

  const addCompetence = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!newComp.trim()) return
    await api.post('/competences', { campId, nom: newComp.trim() }).catch(err => setError(errMsg(err)))
    setNewComp(''); loadBase()
  }
  const removeCompetence = async (id: string) => {
    if (!confirm('Supprimer cette compétence et ses évaluations ?')) return
    await api.delete(`/competences/${id}`).catch(() => {}); loadBase()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Header title="Évaluations" subtitle="Sans notes : une couleur par compétence et par élève. Cliquez pour changer."
        action={<div className="flex gap-2">
          {classes.length > 0 && (
            <select className="input-field w-auto" value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)}>
              <option value="">Toutes les classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          )}
          <input type="month" className="input-field w-auto" value={periode} onChange={e => setPeriode(e.target.value)} />
        </div>} />
      {error && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{error}</div>}

      <div className="flex flex-wrap gap-4 text-xs text-ink-2">
        {COULEURS.map(c => (
          <span key={c.value} className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full" style={{ background: c.hex }} />{c.label}</span>
        ))}
      </div>

      <form onSubmit={addCompetence} className="flex gap-2">
        <input className="input-field" placeholder="Nouvelle compétence (ex. Langage, Motricité, Graphisme...)" value={newComp} onChange={e => setNewComp(e.target.value)} />
        <button className="btn-primary whitespace-nowrap">Ajouter</button>
      </form>

      <div className="card overflow-x-auto">
        {!eleves.length || !competences.length ? (
          <p className="text-sm text-ink-3 py-6 text-center">Ajoutez des élèves et des compétences pour commencer les évaluations.</p>
        ) : (
          <table className="text-sm">
            <thead><tr className="text-xs text-ink-3">
              <th className="text-left py-2 pr-4 sticky left-0 bg-white">Élève</th>
              {competences.map(c => (
                <th key={c.id} className="px-2 font-medium">
                  <div className="flex items-center gap-1 justify-center">{c.nom}
                    <button onClick={() => removeCompetence(c.id)} className="text-ink-3 hover:text-ember"><X size={11} /></button>
                  </div>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {eleves.filter(e => !filtreClasse || e.classe?.id === filtreClasse).map(e => (
                <tr key={e.id} className="border-t border-border/50">
                  <td className="py-2 pr-4 whitespace-nowrap font-medium sticky left-0 bg-white">{e.nom} {e.prenom}</td>
                  {competences.map(c => {
                    const couleur = evals[key(e.id, c.id)]
                    const hex = COULEURS.find(x => x.value === couleur)?.hex
                    return (
                      <td key={c.id} className="px-2 text-center">
                        <button onClick={() => cycle(e.id, c.id)} title={COULEURS.find(x => x.value === couleur)?.label ?? 'Non évalué'}
                          className="w-7 h-7 rounded-full border border-border transition-transform hover:scale-110"
                          style={{ background: hex ?? 'transparent' }} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Programme ───────────────────────────────────────────────
type TypeProg = 'MENSUEL' | 'HEBDOMADAIRE' | 'MATIN' | 'RYTHME_DE_VIE'
interface Programme { id: string; type: TypeProg; titre: string; contenu: string; date: string }
const TYPES_PROG: { value: TypeProg; label: string }[] = [
  { value: 'MENSUEL', label: 'Répartition mensuelle' },
  { value: 'HEBDOMADAIRE', label: 'Répartition hebdomadaire' },
  { value: 'MATIN', label: 'Programme du matin' },
  { value: 'RYTHME_DE_VIE', label: 'Rythme de vie' },
]

export function ProgrammePage() {
  const campId = useCampId()
  const [type, setType] = useState<TypeProg>('MENSUEL')
  const [items, setItems] = useState<Programme[]>([])
  const [form, setForm] = useState({ titre: '', contenu: '', date: today() })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get(`/programmes?campId=${campId}&type=${type}`).then(({ data }) => setItems(data.data || [])).catch(() => setItems([]))
  }, [campId, type])
  useEffect(load, [load])

  const openNew = () => { setEditingId(null); setForm({ titre: '', contenu: '', date: today() }); setError(''); setOpen(true) }
  const openEdit = (p: Programme) => { setEditingId(p.id); setForm({ titre: p.titre, contenu: p.contenu, date: p.date.slice(0, 10) }); setError(''); setOpen(true) }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault(); setError('')
    try {
      if (editingId) await api.put(`/programmes/${editingId}`, form)
      else await api.post('/programmes', { ...form, type, campId })
      setOpen(false); load()
    } catch (err) { setError(errMsg(err)) }
  }
  const remove = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await api.delete(`/programmes/${id}`).catch(() => {}); load()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Header title="Programme" subtitle="Répartitions, rythme de vie et programme du matin"
        action={<button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={16} />Ajouter</button>} />
      <div className="flex gap-2 flex-wrap">
        {TYPES_PROG.map(t => (
          <button key={t.value} onClick={() => setType(t.value)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${type === t.value ? 'bg-sage/12 text-sage border-sage/20' : 'text-ink-2 border-border hover:border-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-10 text-ink-3">Rien pour le moment.</div>
      ) : items.map(p => (
        <div key={p.id} className="card space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-700 text-ink">{p.titre}</h3>
              <p className="text-xs text-ink-3">{fmtDate(p.date)}</p>
            </div>
            <div className="whitespace-nowrap">
              <button onClick={() => openEdit(p)} className="p-1.5 text-ink-3 hover:text-ink"><Edit2 size={14} /></button>
              <button onClick={() => remove(p.id)} className="p-1.5 text-ink-3 hover:text-ember"><Trash2 size={14} /></button>
            </div>
          </div>
          <p className="text-sm text-ink-2 whitespace-pre-wrap">{p.contenu}</p>
        </div>
      ))}

      {open && (
        <Modal title={`${editingId ? 'Modifier' : 'Ajouter'} — ${TYPES_PROG.find(t => t.value === type)?.label}`} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            {error && <div className="rounded-xl border border-ember/20 bg-ember/10 px-3 py-2 text-sm text-ember">{error}</div>}
            <Field label="Titre"><input className="input-field" required value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} /></Field>
            <Field label="Date"><input type="date" className="input-field" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Contenu"><textarea className="input-field min-h-32" required value={form.contenu} onChange={e => setForm({ ...form, contenu: e.target.value })} /></Field>
            <button className="btn-primary">{editingId ? 'Enregistrer' : 'Ajouter'}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Présences (appel) ───────────────────────────────────────
export function PresencesElevesPage() {
  const campId = useCampId()
  const [date, setDate] = useState(today())
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [present, setPresent] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState('')
  const [classes, setClasses] = useState<Classe[]>([])
  const [filtreClasse, setFiltreClasse] = useState('')
  useEffect(() => { api.get(`/classes?campId=${campId}`).then(({ data }) => setClasses(data.data || [])).catch(() => {}) }, [campId])

  useEffect(() => {
    api.get(`/eleves?campId=${campId}`).then(({ data }) => setEleves(data.data || []))
  }, [campId])

  useEffect(() => {
    api.get(`/presences-eleves?campId=${campId}&date=${date}`).then(({ data }) => {
      const map: Record<string, boolean> = {}
      for (const p of data.data as { eleveId: string; present: boolean }[]) map[p.eleveId] = p.present
      setPresent(map)
    }).catch(() => setPresent({}))
    setMsg('')
  }, [campId, date])

  // Par défaut : présent tant que l'appel n'a pas été enregistré
  const isPresent = (id: string) => present[id] ?? true

  const save = async () => {
    try {
      await api.put('/presences-eleves', { campId, date, presences: eleves.map(e => ({ eleveId: e.id, present: isPresent(e.id) })) })
      setMsg('Appel enregistré ✓')
    } catch (err) { setMsg(errMsg(err)) }
  }

  const nbPresents = eleves.filter(e => isPresent(e.id)).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Header title="Présences" subtitle={`${nbPresents} présent${nbPresents > 1 ? 's' : ''} sur ${eleves.length}`}
        action={<div className="flex gap-2">
          {classes.length > 0 && (
            <select className="input-field w-auto" value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)}>
              <option value="">Toutes les classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          )}
          <input type="date" className="input-field w-auto" value={date} onChange={e => setDate(e.target.value)} />
        </div>} />
      <div className="card divide-y divide-border/50">
        {eleves.length === 0 && <p className="text-sm text-ink-3 py-6 text-center">Aucun élève.</p>}
        {eleves.filter(e => !filtreClasse || e.classe?.id === filtreClasse).map(e => (
          <div key={e.id} className="flex items-center justify-between py-2.5">
            <span className="text-sm font-medium">{e.nom} {e.prenom}</span>
            <button onClick={() => setPresent({ ...present, [e.id]: !isPresent(e.id) })}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${isPresent(e.id) ? 'bg-sage/12 text-sage border-sage/20' : 'bg-ember/10 text-ember border-ember/20'}`}>
              {isPresent(e.id) ? 'Présent' : 'Absent'}
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="btn-primary" disabled={!eleves.length}>Enregistrer l'appel</button>
        {msg && <span className="text-sm text-ink-2">{msg}</span>}
      </div>
    </div>
  )
}
