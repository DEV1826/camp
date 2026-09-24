-- Camp : champs de la fiche élève choisis par le super admin
ALTER TABLE "camps" ADD COLUMN "champs_eleve" TEXT[] DEFAULT ARRAY['sexe', 'dateNaissance', 'lieuNaissance', 'parent', 'telephoneParent', 'classe', 'groupes', 'notes']::TEXT[];

-- Élèves : parent (nom, prénom, téléphone) à la place du prénom de la mère
ALTER TABLE "eleves" RENAME COLUMN "prenom_mere" TO "parent_prenom";
ALTER TABLE "eleves" ADD COLUMN "parent_nom" TEXT,
ADD COLUMN "parent_telephone" TEXT,
ADD COLUMN "adresse" TEXT,
ADD COLUMN "infos_medicales" TEXT,
ADD COLUMN "classe_id" TEXT,
ALTER COLUMN "sexe" DROP NOT NULL,
ALTER COLUMN "date_naissance" DROP NOT NULL;

-- Classes
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" TEXT,
    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "classes_camp_id_idx" ON "classes"("camp_id");

-- Groupes d'école
CREATE TABLE "groupes_ecole" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    CONSTRAINT "groupes_ecole_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "groupes_ecole_camp_id_idx" ON "groupes_ecole"("camp_id");

CREATE TABLE "eleve_groupes" (
    "eleve_id" TEXT NOT NULL,
    "groupe_id" TEXT NOT NULL,
    CONSTRAINT "eleve_groupes_pkey" PRIMARY KEY ("eleve_id","groupe_id")
);


ALTER TABLE "eleves" ADD CONSTRAINT "eleves_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "classes" ADD CONSTRAINT "classes_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "groupes_ecole" ADD CONSTRAINT "groupes_ecole_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eleve_groupes" ADD CONSTRAINT "eleve_groupes_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eleve_groupes" ADD CONSTRAINT "eleve_groupes_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "groupes_ecole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
