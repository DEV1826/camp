import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Tent, Users, Calendar, CreditCard,
  FileText, MessageSquare, BarChart3, Settings, LogOut, Menu, X, HeartPulse, UserRound,
  ClipboardList, UserCheck, Gift, BookOpen, NotebookPen
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from './auth.store'
import { initials } from './helpers'

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/camps',        icon: Tent,            label: 'Camps' },
  { to: '/groupes',      perm: 'groupes', icon: Users,           label: 'Groupes' },
  { to: '/animateurs',   perm: 'animateurs', icon: UserRound,       label: 'Animateurs' },
  { to: '/participants', perm: 'participants', icon: Users,           label: 'Participants' },
  { to: '/medical',      perm: 'medical', icon: HeartPulse,      label: 'Médical' },
  { to: '/planning',     perm: 'planning', icon: Calendar,        label: 'Planning' },
  { to: '/paiements',    perm: 'caisse', icon: CreditCard,      label: 'Caisse' },
  { to: '/documents',    perm: 'documents', icon: FileText,        label: 'Documents' },
  { to: '/messages',     perm: 'messages', icon: MessageSquare,   label: 'Messages' },
  { to: '/statistiques', perm: 'statistiques', icon: BarChart3,       label: 'Statistiques' },
  { to: '/presence',    perm: 'presence', icon: ClipboardList,   label: 'Présence / Sorties' },
  { to: '/visiteurs',   perm: 'visiteurs', icon: UserCheck,       label: 'Visiteurs' },
  { to: '/dons',        perm: 'dons', icon: Gift,            label: 'Dons' },
  { to: '/rapport',        perm: 'rapport', icon: BookOpen,      label: 'Rapport journalier' },
  { to: '/enseignements',  perm: 'enseignements', icon: NotebookPen,   label: 'Enseignements' },
  { to: '/causeries',      perm: 'causeries', icon: MessageSquare, label: 'Causeries groupes' },
]

const ecoleNavItems = [
  { to: '/',                  icon: LayoutDashboard, label: 'Ma classe' },
  { to: '/eleves',            perm: 'eleves',             icon: Users,         label: 'Élèves' },
  { to: '/ecole/sante',       perm: 'sante_ecole',        icon: HeartPulse,    label: 'Médical' },
  { to: '/groupes-eleves',    perm: 'groupes_ecole',      icon: UserCheck,     label: 'Groupes' },
  { to: '/classes',           perm: 'classes',            icon: Tent,          label: 'Classes' },
  { to: '/ecole/enseignants', perm: 'enseignants',        icon: UserRound,     label: 'Enseignants' },
  { to: '/ecole/emploi',      perm: 'emploi_temps',       icon: Calendar,      label: 'Emploi du temps' },
  { to: '/ecole/frais',       perm: 'frais',              icon: CreditCard,    label: 'Frais de scolarité' },
  { to: '/ecole/documents',   perm: 'documents_eleves',   icon: FileText,      label: 'Documents' },
  { to: '/ecole/messages',    perm: 'messages_ecole',     icon: MessageSquare, label: 'Messages' },
  { to: '/ecole/statistiques', perm: 'statistiques_ecole', icon: BarChart3,    label: 'Statistiques' },
  { to: '/ecole/sorties',     perm: 'sorties_eleves',     icon: ClipboardList, label: 'Sorties des élèves' },
  { to: '/ecole/visiteurs',   perm: 'visiteurs_ecole',    icon: UserCheck,     label: 'Visiteurs' },
  { to: '/ecole/dons',        perm: 'dons_ecole',         icon: Gift,          label: 'Dons' },
  { to: '/ecole/rapport',     perm: 'rapport_ecole',      icon: BookOpen,      label: 'Rapport journalier' },
  { to: '/ecole/lecons',      perm: 'lecons',             icon: NotebookPen,   label: 'Leçons' },
  { to: '/ecole/causeries',   perm: 'causeries_ecole',    icon: MessageSquare, label: 'Causeries des groupes' },
  { to: '/evaluations',       perm: 'evaluations',        icon: BarChart3,     label: 'Évaluations' },
  { to: '/programme',         perm: 'programme_ecole',    icon: BookOpen,      label: 'Programme' },
  { to: '/appel',             perm: 'presences_eleves',   icon: ClipboardList, label: 'Appel des élèves' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const items: { to: string; perm?: string; icon: typeof Tent; label: string }[] = user?.campType === 'ECOLE' ? ecoleNavItems : navItems

  const handleLogout = () => { logout(); navigate('/login') }

  const SidebarContent = () => (
    <aside className="flex flex-col h-full w-64 bg-white border-r border-border">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sage flex items-center justify-center shadow-sm">
            <Tent size={15} className="text-white" />
          </div>
          <div>
            <p className="font-display font-700 text-sm text-ink leading-none">Camp</p>
            <p className="font-display font-700 text-sm text-sage leading-none">Manager</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {items.filter(i => !i.perm || user?.role === 'SUPER_ADMIN' || user?.permissions?.includes(i.perm)).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150
              ${isActive
                ? 'bg-sage text-white shadow-sm'
                : 'text-ink-2 hover:text-ink hover:bg-surface'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bas : settings + profil */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        <NavLink
          to="/parametres"
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150
            ${isActive ? 'bg-sage text-white shadow-sm' : 'text-ink-2 hover:text-ink hover:bg-surface'}`
          }
        >
          <Settings size={16} />
          Paramètres
        </NavLink>

        {user && (
          <div className="mt-2 px-3 py-2.5 rounded-xl bg-surface border border-border flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
              <span className="text-xs font-display font-700 text-sage">
                {initials(user.nom, user.prenom)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink truncate">{user.prenom} {user.nom}</p>
              <p className="text-xs text-ink-3 truncate capitalize">{user.role.toLowerCase()}</p>
            </div>
            <button onClick={handleLogout} className="text-ink-3 hover:text-ember transition-colors" title="Déconnexion">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white border border-border rounded-xl p-2 text-ink-2 hover:text-ink shadow-sm"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" />
          <div className="absolute left-0 top-0 h-full z-50 shadow-modal" onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop */}
      <div className="hidden lg:flex h-full">
        <SidebarContent />
      </div>
    </>
  )
}
