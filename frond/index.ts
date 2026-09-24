export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANIMATEUR' | 'PARENT'

export interface User {
  id: string
  nom: string
  prenom: string
  email: string
  role: Role
  avatarUrl?: string
  campId?: string | null
  permissions?: string[]
  campType?: 'CAMP' | 'ECOLE' | null
  campNom?: string | null
  dernierLogin?: string
  createdAt: string
}

export type StatutCamp = 'BROUILLON' | 'OUVERT' | 'COMPLET' | 'EN_COURS' | 'TERMINE' | 'ANNULE'
export type StatutInscription = 'EN_ATTENTE' | 'CONFIRME' | 'ANNULE' | 'LISTE_ATTENTE'
export type StatutPaiement = 'EN_ATTENTE' | 'PARTIEL' | 'PAYE' | 'REMBOURSE' | 'ANNULE'

export interface CampParoisse {
  id: string
  campId: string
  nom: string
  responsable?: string
  telephone?: string
  prixParticipant?: number | null
}

export interface Camp {
  id: string
  nom: string
  description?: string
  lieu: string
  adresse?: string
  dateDebut: string
  dateFin: string
  capaciteMax: number
  prixBase: number
  statut: StatutCamp
  imageUrl?: string
  _count?: { participants: number; animateurs: number; activites: number }
  paroisses?: CampParoisse[]
  createdAt: string
}

export interface Participant {
  id: string
  campId: string
  nom: string
  prenom: string
  dateNaissance: string
  lieuNaissance?: string
  genre?: string
  niveauScolaire?: string
  participationsAnterieures?: number
  contactAdolescent?: string
  paroisse?: string
  responsableParoisse?: string
  responsableTelephone?: string
  groupeSanguin?: string
  infosMedicales?: string
  allergies?: string
  medicaments?: string
  nomUrgence: string
  telephoneUrgence: string
  statutInscription: StatutInscription
  dispense?: boolean
  notes?: string
  parents?: Parent[]
  paiements?: Paiement[]
  groupes?: { groupe: { nom: string; couleur: string } }[]
  createdAt: string
}

export interface Parent {
  id: string
  participantId: string
  nom: string
  prenom: string
  email: string
  telephone: string
  relation: string
  principal: boolean
}

export interface Paiement {
  id: string
  participantId?: string
  campId?: string
  libelle?: string
  montant: number
  montantTotal?: number
  statut: StatutPaiement
  methode: string
  reference?: string
  datePaiement?: string
  notes?: string
}

export interface Depense {
  id: string
  campId: string
  libelle: string
  categorie: string
  montant: number
  dateDepense: string
  reference?: string
  notes?: string
  camp?: { id: string; nom: string }
}

export interface Groupe {
  id: string
  campId: string
  nom: string
  couleur: string
  animateurId?: string
  _count?: { participants: number }
}

export interface Activite {
  id: string
  campId: string
  titre: string
  description?: string
  lieu?: string
  dateHeureDebut: string
  dateHeureFin: string
  capaciteMax?: number
  couleur: string
  statut: string
}

export interface CampStats {
  camp: { id: string; nom: string; capaciteMax: number }
  participants: { total: number; confirmes: number; tauxOccupation: number; parStatut: { statutInscription: string; _count: number }[] }
  finance: { totalEncaisse: number; totalAttendu: number; nombrePaiements: number }
  activites: number
  documents: { parStatut: { statut: string; _count: number }[] }
}

export type TypePresence = 'ANIMATEUR' | 'ENFANT'

export interface FichePresence {
  id: string
  campId: string
  type: TypePresence
  nom: string
  prenom: string
  heureSortie: string
  motif: string
  heureRetour?: string
  signature?: string
  notes?: string
  camp?: { id: string; nom: string }
  createdAt: string
  updatedAt: string
}

export interface Visiteur {
  id: string
  campId: string
  nom: string
  prenom: string
  telephone: string
  qualite: string
  notes?: string
  heureArrivee?: string
  heureDepart?: string
  camp?: { id: string; nom: string }
  createdAt: string
}

export interface Don {
  id: string
  campId: string
  nom: string
  prenom: string
  telephone: string
  description: string
  montant?: number
  notes?: string
  camp?: { id: string; nom: string }
  createdAt: string
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
  meta?: { total: number; page: number; perPage: number; totalPages: number }
}
