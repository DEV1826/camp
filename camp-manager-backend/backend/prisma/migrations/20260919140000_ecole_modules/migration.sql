-- AlterTable
ALTER TABLE "eleves" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "groupe_sanguin" TEXT,
ADD COLUMN     "medicaments" TEXT;

-- CreateTable
CREATE TABLE "enseignants" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "classe_id" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "specialite" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "date_arrivee" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enseignants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activites_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "classe_id" TEXT,
    "enseignant_id" TEXT,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "lieu" TEXT,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#0ea5e9',

    CONSTRAINT "activites_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements_eleves" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "methode" TEXT NOT NULL DEFAULT 'ESPECES',
    "date_paiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "paiements_eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depenses_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "date_depense" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "depenses_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_eleves" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "eleve_id" TEXT,
    "auteur_id" TEXT,
    "sujet" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorties_eleves" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "eleve_id" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "heure_sortie" TIMESTAMP(3) NOT NULL,
    "motif" TEXT NOT NULL,
    "personne" TEXT,
    "heure_retour" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "sorties_eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visiteurs_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "heure_arrivee" TEXT,
    "heure_depart" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visiteurs_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dons_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "description" TEXT NOT NULL,
    "montant" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dons_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapports_jour" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "resume" TEXT,
    "incidents" TEXT,
    "observations" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapports_jour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecons_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "classe_id" TEXT,
    "enseignant_id" TEXT,
    "date" DATE NOT NULL,
    "matiere" TEXT,
    "theme" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "lecons_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causeries_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "groupe_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "theme" TEXT NOT NULL,
    "resume" TEXT,
    "notes" TEXT,

    CONSTRAINT "causeries_ecole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enseignants_camp_id_idx" ON "enseignants"("camp_id");

-- CreateIndex
CREATE INDEX "activites_ecole_camp_id_idx" ON "activites_ecole"("camp_id");

-- CreateIndex
CREATE INDEX "paiements_eleves_eleve_id_idx" ON "paiements_eleves"("eleve_id");

-- CreateIndex
CREATE INDEX "depenses_ecole_camp_id_idx" ON "depenses_ecole"("camp_id");

-- CreateIndex
CREATE INDEX "documents_eleves_eleve_id_idx" ON "documents_eleves"("eleve_id");

-- CreateIndex
CREATE INDEX "messages_ecole_camp_id_idx" ON "messages_ecole"("camp_id");

-- CreateIndex
CREATE INDEX "sorties_eleves_camp_id_idx" ON "sorties_eleves"("camp_id");

-- CreateIndex
CREATE INDEX "visiteurs_ecole_camp_id_idx" ON "visiteurs_ecole"("camp_id");

-- CreateIndex
CREATE INDEX "dons_ecole_camp_id_idx" ON "dons_ecole"("camp_id");

-- CreateIndex
CREATE UNIQUE INDEX "rapports_jour_camp_id_date_key" ON "rapports_jour"("camp_id", "date");

-- CreateIndex
CREATE INDEX "lecons_ecole_camp_id_idx" ON "lecons_ecole"("camp_id");

-- CreateIndex
CREATE INDEX "causeries_ecole_camp_id_idx" ON "causeries_ecole"("camp_id");

-- CreateIndex
CREATE UNIQUE INDEX "causeries_ecole_groupe_id_date_key" ON "causeries_ecole"("groupe_id", "date");

-- AddForeignKey
ALTER TABLE "enseignants" ADD CONSTRAINT "enseignants_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enseignants" ADD CONSTRAINT "enseignants_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activites_ecole" ADD CONSTRAINT "activites_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activites_ecole" ADD CONSTRAINT "activites_ecole_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activites_ecole" ADD CONSTRAINT "activites_ecole_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "enseignants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_eleves" ADD CONSTRAINT "paiements_eleves_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depenses_ecole" ADD CONSTRAINT "depenses_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_eleves" ADD CONSTRAINT "documents_eleves_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_ecole" ADD CONSTRAINT "messages_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_ecole" ADD CONSTRAINT "messages_ecole_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorties_eleves" ADD CONSTRAINT "sorties_eleves_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorties_eleves" ADD CONSTRAINT "sorties_eleves_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visiteurs_ecole" ADD CONSTRAINT "visiteurs_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dons_ecole" ADD CONSTRAINT "dons_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapports_jour" ADD CONSTRAINT "rapports_jour_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecons_ecole" ADD CONSTRAINT "lecons_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecons_ecole" ADD CONSTRAINT "lecons_ecole_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecons_ecole" ADD CONSTRAINT "lecons_ecole_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "enseignants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "causeries_ecole" ADD CONSTRAINT "causeries_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "causeries_ecole" ADD CONSTRAINT "causeries_ecole_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes_ecole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

