import GroupesPage from './GroupesPage'
import AnimateursPage from './AnimateursPage'
import GroupeDetailPage from './GroupeDetailPage'
import AnimateurDetailPage from './AnimateurDetailPage'
import FichePresencePage from './FichePresencePage'
import VisiteursPage from './VisiteursPage'
import DonsPage from './DonsPage'
import RapportPage from './RapportPage'
import EnseignementsPage from './EnseignementsPage'
import CauseriesPage from './CauseriesPage'
import { EcoleDashboard, ElevesPage, ClassesPage, GroupesEcolePage, EvaluationsPage, ProgrammePage, PresencesElevesPage } from './EcolePages'
import { useAuthStore } from './auth.store'
import {
  SantePage, EnseignantsPage, EmploiTempsPage, FraisPage, DocumentsElevesPage, MessagesEcolePage,
  StatistiquesEcolePage, SortiesElevesPage, VisiteursEcolePage, DonsEcolePage, RapportEcolePage,
  LeconsPage, CauseriesEcolePage,
} from './EcoleModules'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './AppLayout'
import CampsPage from './CampsPage'
import DashboardPage from './DashboardPage'
import LoginPage from './LoginPage'
import PlanningPage from './PlanningPage'
import CaissePage from './CaissePage'
import {
  CampDetailPage,
  CampFormPage,
  DocumentsPage,
  MessagesPage,
  MedicalPage,
  ParticipantsPage,
  SettingsPage,
  StatistiquesPage,
} from './ModulePages'
import ProtectedRoute, { SuperAdminRoute } from './ProtectedRoute'
import './index.css'

function Home() {
  const campType = useAuthStore(s => s.user?.campType)
  return campType === 'ECOLE' ? <EcoleDashboard /> : <DashboardPage />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="camps" element={<CampsPage />} />
          <Route path="groupes" element={<GroupesPage />} />
          <Route path="groupes-eleves" element={<GroupesEcolePage />} />
          <Route path="animateurs" element={<AnimateursPage />} />
          <Route path="camps/nouveau" element={<SuperAdminRoute><CampFormPage /></SuperAdminRoute>} />
          <Route path="camps/:id" element={<CampDetailPage />} />
          <Route path="participants" element={<ParticipantsPage />} />
          <Route path="medical" element={<MedicalPage />} />
          <Route path="planning" element={<PlanningPage />} />
          <Route path="paiements" element={<CaissePage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="statistiques" element={<StatistiquesPage />} />
          <Route path="parametres" element={<SettingsPage />} />
         
          <Route path="groupes/:id" element={<GroupeDetailPage />} />
          <Route path="animateurs/:id" element={<AnimateurDetailPage />} />
          <Route path="presence" element={<FichePresencePage />} />
          <Route path="visiteurs" element={<VisiteursPage />} />
          <Route path="dons" element={<DonsPage />} />
          <Route path="rapport" element={<RapportPage />} />
          <Route path="enseignements" element={<EnseignementsPage />} />
          <Route path="causeries" element={<CauseriesPage />} />
          <Route path="eleves" element={<ElevesPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="evaluations" element={<EvaluationsPage />} />
          <Route path="programme" element={<ProgrammePage />} />
          <Route path="appel" element={<PresencesElevesPage />} />
          <Route path="ecole/sante" element={<SantePage />} />
          <Route path="ecole/enseignants" element={<EnseignantsPage />} />
          <Route path="ecole/emploi" element={<EmploiTempsPage />} />
          <Route path="ecole/frais" element={<FraisPage />} />
          <Route path="ecole/documents" element={<DocumentsElevesPage />} />
          <Route path="ecole/messages" element={<MessagesEcolePage />} />
          <Route path="ecole/statistiques" element={<StatistiquesEcolePage />} />
          <Route path="ecole/sorties" element={<SortiesElevesPage />} />
          <Route path="ecole/visiteurs" element={<VisiteursEcolePage />} />
          <Route path="ecole/dons" element={<DonsEcolePage />} />
          <Route path="ecole/rapport" element={<RapportEcolePage />} />
          <Route path="ecole/lecons" element={<LeconsPage />} />
          <Route path="ecole/causeries" element={<CauseriesEcolePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
