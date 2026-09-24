import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Tent, CreditCard, TrendingUp, ArrowRight, Clock, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useAuthStore } from './auth.store'
import api from './http'
import type { Camp, CampStats } from './index'
import { formatCFA, formatDate, statutCampBadge, statutCampLabel } from './helpers'

const mockFinanceData = [
  { mois: 'Jan', encaisse: 0 },
  { mois: 'Fév', encaisse: 0 },
  { mois: 'Mar', encaisse: 120000 },
  { mois: 'Avr', encaisse: 250000 },
  { mois: 'Mai', encaisse: 380000 },
  { mois: 'Juin', encaisse: 520000 },
  { mois: 'Juil', encaisse: 750000 },
]

function StatCard({ icon: Icon, label, value, sub, color = 'sage' }: {
  icon: any; label: string; value: string; sub?: string; color?: string
}) {
  const colorMap: Record<string, { bg: string; icon: string; dot: string }> = {
    sage:  { bg: 'bg-sage/10',  icon: 'text-sage',  dot: 'bg-sage' },
    gold:  { bg: 'bg-gold/10',  icon: 'text-gold',  dot: 'bg-gold' },
    ember: { bg: 'bg-ember/10', icon: 'text-ember', dot: 'bg-ember' },
    sky:   { bg: 'bg-sky/10',   icon: 'text-sky',   dot: 'bg-sky' },
  }
  const c = colorMap[color]
  return (
    <div className="card flex items-start gap-4 animate-fade-up">
      <div className={`w-10 h-10 rounded-xl border border-border flex items-center justify-center shrink-0 ${c.bg}`}>
        <Icon size={18} className={c.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink-3 mb-1">{label}</p>
        <p className="font-display font-700 text-xl text-ink leading-none">{value}</p>
        {sub && <p className="text-xs text-ink-3 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const isSuper = user?.role === "SUPER_ADMIN"
  const [camps, setCamps] = useState<Camp[]>([])
  const [stats, setStats] = useState<CampStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/camps?perPage=5')
        setCamps(data.data || [])
        if (data.data?.[0]?.id) {
          const { data: s } = await api.get(`/camps/${data.data[0].id}/stats`)
          setStats(s.data)
        }
      } catch { /* données vides */ }
      setLoading(false)
    }
    load()
  }, [])

  const totalParticipants = stats?.participants.total ?? 0
  const confirmes         = stats?.participants.confirmes ?? 0
  const encaisse          = stats?.finance.totalEncaisse ?? 0
  const attendu           = stats?.finance.totalAttendu ?? 0
  const tauxPaiement      = attendu > 0 ? Math.round((encaisse / attendu) * 100) : 0

  const pieData = stats
    ? [
        { name: 'Confirmés',  value: confirmes,                     color: '#16a34a' },
        { name: 'En attente', value: totalParticipants - confirmes,  color: '#d97706' },
      ].filter(d => d.value > 0)
    : [{ name: 'Aucun', value: 1, color: '#e2e8f0' }]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-ink-3 text-sm mb-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="font-display font-700 text-2xl text-ink">
          Bonjour, {user?.prenom} 👋
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Participants" value={String(totalParticipants)} sub={`${confirmes} confirmés`}         color="sage" />
        <StatCard icon={Tent}       label="Camps actifs" value={String(camps.length)}      sub="en cours"                          color="sky" />
        <StatCard icon={CreditCard} label="Encaissé"     value={formatCFA(encaisse)}        sub={`${tauxPaiement}% du total`}      color="gold" />
        <StatCard icon={Activity}   label="Activités"    value={String(stats?.activites ?? 0)} sub="planifiées"                   color="ember" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Finance chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-700 text-sm text-ink">Évolution des paiements</h2>
              <p className="text-xs text-ink-3 mt-0.5">7 derniers mois</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-sage font-medium">
              <TrendingUp size={14} />
              +32%
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={mockFinanceData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                labelStyle={{ color: '#475569', fontWeight: 600 }}
                itemStyle={{ color: '#16a34a' }}
                formatter={(v: number) => [formatCFA(v), 'Encaissé']}
              />
              <Area type="monotone" dataKey="encaisse" stroke="#16a34a" strokeWidth={2} fill="url(#areaGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Participants pie */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-700 text-sm text-ink">Inscriptions</h2>
              <p className="text-xs text-ink-3 mt-0.5">Répartition</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <PieChart width={120} height={120}>
              <Pie data={pieData} cx={55} cy={55} innerRadius={36} outerRadius={54} dataKey="value" strokeWidth={0}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
            <div className="space-y-2 w-full">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-ink-2">{d.name}</span>
                  </div>
                  <span className="font-semibold text-ink">{d.value}</span>
                </div>
              ))}
              {stats && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-3">Taux d'occupation</span>
                    <span className="font-semibold text-ink">{stats.participants.tauxOccupation}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sage rounded-full transition-all duration-500"
                      style={{ width: `${stats.participants.tauxOccupation}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Camps list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-700 text-sm text-ink">Camps ouverts</h2>
          <Link to="/camps" className="flex items-center gap-1 text-xs text-sage hover:text-sage-dark font-medium transition-colors">
            Voir tout <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-surface rounded-xl animate-pulse" />)}
          </div>
        ) : camps.length === 0 ? (
          <div className="text-center py-10 text-ink-3 text-sm">
            <Tent size={30} className="mx-auto mb-3 opacity-30" />
            Aucun camp ouvert pour l'instant.
          </div>
        ) : (
          <div className="space-y-1.5">
            {camps.map((camp) => (
              <Link
                key={camp.id}
                to={`/camps/${camp.id}`}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-surface hover:bg-sage/5 border border-transparent hover:border-sage/15 transition-all duration-150 group"
              >
                <div className="w-9 h-9 rounded-xl bg-sage/10 flex items-center justify-center shrink-0">
                  <Tent size={16} className="text-sage" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate group-hover:text-sage transition-colors">{camp.nom}</p>
                  <p className="text-xs text-ink-3">{camp.lieu} · {formatDate(camp.dateDebut)} → {formatDate(camp.dateFin)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={statutCampBadge[camp.statut]}>{statutCampLabel[camp.statut]}</span>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-ink">{camp._count?.participants ?? 0}/{camp.capaciteMax}</p>
                    <p className="text-xs text-ink-3">places</p>
                  </div>
                  <ArrowRight size={14} className="text-ink-3 group-hover:text-sage transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { to: '/camps/nouveau', label: 'Créer un camp',    desc: 'Configurer une nouvelle session', icon: Tent,     color: 'sage' },
          { to: '/participants',  label: 'Inscrire un ado',  desc: 'Nouvelle inscription',            icon: Users,    color: 'sky' },
          { to: '/planning',      label: 'Ajouter activité', desc: 'Planifier au programme',          icon: Clock,    color: 'gold' },
        ].filter(a => a.to !== '/camps/nouveau' || isSuper).map(({ to, label, desc, icon: Icon, color }) => (
          <Link key={to} to={to} className="card hover:border-border group transition-all duration-150 flex items-center gap-3 hover:shadow-md">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
              ${color === 'sage' ? 'bg-sage/10 text-sage' : color === 'sky' ? 'bg-sky/10 text-sky' : 'bg-gold/10 text-gold'}`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="text-xs text-ink-3">{desc}</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-ink-3 group-hover:text-ink transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
