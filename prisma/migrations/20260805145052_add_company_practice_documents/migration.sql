-- CreateEnum
CREATE TYPE "PracticeStatus" AS ENUM ('PREPARATION', 'AUTHORIZED', 'ACTIVE', 'SUSPENDED', 'CLOSING', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequirementEvidenceKind" AS ENUM ('PDF', 'DIGITAL_RECORD');

-- CreateEnum
CREATE TYPE "RequirementStage" AS ENUM ('INITIAL', 'CLOSING');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'OBSERVED', 'APPROVED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "DocumentReviewDecisionType" AS ENUM ('OBSERVED', 'APPROVED', 'ANNULLED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "ruc" TEXT,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "address" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "foreign" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRepresentative" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRepresentative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Practice" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyRepresentativeId" TEXT NOT NULL,
    "representativeSnapshot" JSONB NOT NULL,
    "academicPeriodId" TEXT NOT NULL,
    "campusSchoolId" TEXT NOT NULL,
    "letterRequestId" TEXT,
    "areaRole" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "schedule" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "status" "PracticeStatus" NOT NULL DEFAULT 'PREPARATION',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Practice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeStatusHistory" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "fromStatus" "PracticeStatus",
    "toStatus" "PracticeStatus" NOT NULL,
    "actorId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequirementDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "evidenceKind" "RequirementEvidenceKind" NOT NULL,
    "stage" "RequirementStage" NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRequirementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeRequirementSnapshot" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "requirementDefinitionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "evidenceKind" "RequirementEvidenceKind" NOT NULL,
    "stage" "RequirementStage" NOT NULL,
    "mandatory" BOOLEAN NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeRequirementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "requirementSnapshotId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "fileAssetId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentReview" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "DocumentReviewDecisionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_ruc_key" ON "Company"("ruc");

-- CreateIndex
CREATE INDEX "Company_legalName_idx" ON "Company"("legalName");

-- CreateIndex
CREATE INDEX "Company_createdById_idx" ON "Company"("createdById");

-- CreateIndex
CREATE INDEX "CompanyRepresentative_companyId_active_idx" ON "CompanyRepresentative"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Practice_letterRequestId_key" ON "Practice"("letterRequestId");

-- CreateIndex
CREATE INDEX "Practice_studentProfileId_status_idx" ON "Practice"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "Practice_campusSchoolId_status_idx" ON "Practice"("campusSchoolId", "status");

-- CreateIndex
CREATE INDEX "Practice_academicPeriodId_status_idx" ON "Practice"("academicPeriodId", "status");

-- CreateIndex
CREATE INDEX "Practice_companyId_idx" ON "Practice"("companyId");

-- CreateIndex
CREATE INDEX "PracticeStatusHistory_practiceId_createdAt_idx" ON "PracticeStatusHistory"("practiceId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentRequirementDefinition_active_stage_idx" ON "DocumentRequirementDefinition"("active", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequirementDefinition_code_version_key" ON "DocumentRequirementDefinition"("code", "version");

-- CreateIndex
CREATE INDEX "PracticeRequirementSnapshot_practiceId_stage_mandatory_idx" ON "PracticeRequirementSnapshot"("practiceId", "stage", "mandatory");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeRequirementSnapshot_practiceId_code_key" ON "PracticeRequirementSnapshot"("practiceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Document_requirementSnapshotId_key" ON "Document"("requirementSnapshotId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_fileAssetId_key" ON "DocumentVersion"("fileAssetId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_status_idx" ON "DocumentVersion"("documentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReview_documentVersionId_key" ON "DocumentReview"("documentVersionId");

-- CreateIndex
CREATE INDEX "DocumentReview_reviewerId_createdAt_idx" ON "DocumentReview"("reviewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");

-- CreateIndex
CREATE INDEX "FileAsset_sha256_idx" ON "FileAsset"("sha256");

-- CreateIndex
CREATE INDEX "FileAsset_uploadedById_createdAt_idx" ON "FileAsset"("uploadedById", "createdAt");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRepresentative" ADD CONSTRAINT "CompanyRepresentative_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_companyRepresentativeId_fkey" FOREIGN KEY ("companyRepresentativeId") REFERENCES "CompanyRepresentative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_campusSchoolId_fkey" FOREIGN KEY ("campusSchoolId") REFERENCES "CampusSchool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_letterRequestId_fkey" FOREIGN KEY ("letterRequestId") REFERENCES "LetterRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeStatusHistory" ADD CONSTRAINT "PracticeStatusHistory_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeStatusHistory" ADD CONSTRAINT "PracticeStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRequirementSnapshot" ADD CONSTRAINT "PracticeRequirementSnapshot_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRequirementSnapshot" ADD CONSTRAINT "PracticeRequirementSnapshot_requirementDefinitionId_fkey" FOREIGN KEY ("requirementDefinitionId") REFERENCES "DocumentRequirementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_requirementSnapshotId_fkey" FOREIGN KEY ("requirementSnapshotId") REFERENCES "PracticeRequirementSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReview" ADD CONSTRAINT "DocumentReview_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentReview" ADD CONSTRAINT "DocumentReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
