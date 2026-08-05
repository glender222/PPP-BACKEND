-- CreateEnum
CREATE TYPE "LetterRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'OBSERVED', 'RESUBMITTED', 'APPROVED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "LetterReviewDecisionType" AS ENUM ('OBSERVED', 'APPROVED', 'ANNULLED');

-- CreateTable
CREATE TABLE "LetterTemplate" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LetterTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterRequest" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "targetCompany" TEXT NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "templateData" JSONB NOT NULL,
    "status" "LetterRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "number" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterRequestRevision" (
    "id" TEXT NOT NULL,
    "letterRequestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LetterRequestRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterReviewDecision" (
    "id" TEXT NOT NULL,
    "letterRequestId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "LetterReviewDecisionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LetterReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedLetterFile" (
    "id" TEXT NOT NULL,
    "letterRequestId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedLetterFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterStateHistory" (
    "id" TEXT NOT NULL,
    "letterRequestId" TEXT NOT NULL,
    "fromStatus" "LetterRequestStatus",
    "toStatus" "LetterRequestStatus" NOT NULL,
    "actorId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LetterStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LetterTemplate_campusId_schoolId_active_idx" ON "LetterTemplate"("campusId", "schoolId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LetterTemplate_campusId_schoolId_key" ON "LetterTemplate"("campusId", "schoolId");

-- CreateIndex
CREATE INDEX "LetterTemplateVersion_templateId_isActive_idx" ON "LetterTemplateVersion"("templateId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LetterTemplateVersion_templateId_version_key" ON "LetterTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "LetterRequest_studentProfileId_status_idx" ON "LetterRequest"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "LetterRequest_campusId_schoolId_status_idx" ON "LetterRequest"("campusId", "schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LetterRequestRevision_letterRequestId_version_key" ON "LetterRequestRevision"("letterRequestId", "version");

-- CreateIndex
CREATE INDEX "LetterReviewDecision_letterRequestId_idx" ON "LetterReviewDecision"("letterRequestId");

-- CreateIndex
CREATE INDEX "LetterReviewDecision_revisionId_idx" ON "LetterReviewDecision"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedLetterFile_letterRequestId_key" ON "GeneratedLetterFile"("letterRequestId");

-- CreateIndex
CREATE INDEX "LetterStateHistory_letterRequestId_createdAt_idx" ON "LetterStateHistory"("letterRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterTemplate" ADD CONSTRAINT "LetterTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterTemplateVersion" ADD CONSTRAINT "LetterTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LetterTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterRequest" ADD CONSTRAINT "LetterRequest_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterRequest" ADD CONSTRAINT "LetterRequest_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterRequest" ADD CONSTRAINT "LetterRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterRequest" ADD CONSTRAINT "LetterRequest_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "LetterTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterRequestRevision" ADD CONSTRAINT "LetterRequestRevision_letterRequestId_fkey" FOREIGN KEY ("letterRequestId") REFERENCES "LetterRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterReviewDecision" ADD CONSTRAINT "LetterReviewDecision_letterRequestId_fkey" FOREIGN KEY ("letterRequestId") REFERENCES "LetterRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterReviewDecision" ADD CONSTRAINT "LetterReviewDecision_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "LetterRequestRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterReviewDecision" ADD CONSTRAINT "LetterReviewDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedLetterFile" ADD CONSTRAINT "GeneratedLetterFile_letterRequestId_fkey" FOREIGN KEY ("letterRequestId") REFERENCES "LetterRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedLetterFile" ADD CONSTRAINT "GeneratedLetterFile_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "LetterRequestRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedLetterFile" ADD CONSTRAINT "GeneratedLetterFile_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "LetterTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterStateHistory" ADD CONSTRAINT "LetterStateHistory_letterRequestId_fkey" FOREIGN KEY ("letterRequestId") REFERENCES "LetterRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterStateHistory" ADD CONSTRAINT "LetterStateHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
