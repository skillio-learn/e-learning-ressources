-- CreateEnum
CREATE TYPE "SessionFormat" AS ENUM ('INTER', 'INTRA');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COMPANY';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "confidential" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "accessDelay" TEXT,
ADD COLUMN     "certCandidates" INTEGER,
ADD COLUMN     "certPeriod" TEXT,
ADD COLUMN     "certSuccessRate" DOUBLE PRECISION,
ADD COLUMN     "pedagogicalReferentId" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "absenceAlertAt" TIMESTAMP(3),
ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "absenceAlertThreshold" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "handicapReferentId" TEXT,
ADD COLUMN     "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyEmployerOnAbsence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishResults" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualiopiCertified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualiopiCertifier" TEXT,
ADD COLUMN     "qualiopiExpiresAt" TIMESTAMP(3),
ADD COLUMN     "qualiopiScope" TEXT[] DEFAULT ARRAY['ACTIONS']::TEXT[],
ADD COLUMN     "qualityReferentId" TEXT,
ADD COLUMN     "resultsNote" TEXT,
ADD COLUMN     "rnqVersion" TEXT NOT NULL DEFAULT '2026';

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "accessInfo" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "format" "SessionFormat" NOT NULL DEFAULT 'INTER',
ADD COLUMN     "minParticipants" INTEGER,
ADD COLUMN     "modality" "TrainingModality",
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "room" TEXT,
ADD COLUMN     "trainerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendarToken" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "termsAcceptedVersion" TEXT,
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpRecoveryHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "siret" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "opcoName" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "shareProgress" BOOLEAN NOT NULL DEFAULT true,
    "shareTime" BOOLEAN NOT NULL DEFAULT true,
    "shareAttendance" BOOLEAN NOT NULL DEFAULT true,
    "shareResults" BOOLEAN NOT NULL DEFAULT false,
    "shareDocuments" BOOLEAN NOT NULL DEFAULT true,
    "shareAbsenceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyConvention" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sessionId" TEXT,
    "reference" TEXT NOT NULL,
    "trainees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hours" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "vatRate" DOUBLE PRECISION DEFAULT 20,
    "paymentTerms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signerTitle" TEXT,
    "signature" TEXT,
    "signedIp" TEXT,
    "contentHash" TEXT,
    "signedContent" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyConvention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeedsAnalysis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "sessionId" TEXT,
    "enrollmentId" TEXT,
    "context" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "constraints" TEXT,
    "adaptations" TEXT,
    "filledByRole" TEXT NOT NULL,
    "filledById" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeedsAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "createdById" TEXT,
    "link" TEXT,
    "linkLabel" TEXT,
    "remindedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "url" TEXT,
    "summary" TEXT NOT NULL,
    "impact" TEXT,
    "actions" TEXT,
    "publishedOn" TIMESTAMP(3),
    "shareWithTrainers" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchAck" (
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ackAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchAck_pkey" PRIMARY KEY ("itemId","userId")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "need" TEXT NOT NULL,
    "measures" TEXT,
    "partners" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" TEXT NOT NULL DEFAULT 'LEARNER',
    "handledById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceRecord" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'ABSENCE',
    "minutes" INTEGER,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "size" INTEGER,
    "data" BYTEA,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "declaredBy" TEXT NOT NULL DEFAULT 'LEARNER',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsertionSurvey" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "horizonMonths" INTEGER NOT NULL DEFAULT 6,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "situation" TEXT,
    "relatedToTraining" BOOLEAN,
    "skillsUsed" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsertionSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "lastAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerQualification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "obtainedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileName" TEXT,
    "fileType" TEXT,
    "size" INTEGER,
    "data" BYTEA,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityIndicator" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "applicable" BOOLEAN NOT NULL DEFAULT true,
    "notApplicableReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "comment" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "size" INTEGER,
    "data" BYTEA,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImprovementAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "indicatorCode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "result" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprovementAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "certifier" TEXT,
    "auditor" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "result" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "indicatorCode" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actionId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonConformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditorAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditorAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityRisk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "process" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 2,
    "impact" INTEGER NOT NULL DEFAULT 2,
    "mitigation" TEXT,
    "ownerName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siret" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'SUBCONTRACTOR',
    "contactEmail" TEXT,
    "qualiopiCertified" BOOLEAN NOT NULL DEFAULT false,
    "qualiopiExpiresAt" TIMESTAMP(3),
    "contractSignedAt" TIMESTAMP(3),
    "contractFileName" TEXT,
    "contractFileType" TEXT,
    "contractSize" INTEGER,
    "contractData" BYTEA,
    "lastEvaluationAt" TIMESTAMP(3),
    "evaluationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_organizationId_idx" ON "Company"("organizationId");

-- CreateIndex
CREATE INDEX "CompanyConvention_companyId_idx" ON "CompanyConvention"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "NeedsAnalysis_enrollmentId_key" ON "NeedsAnalysis"("enrollmentId");

-- CreateIndex
CREATE INDEX "Task_organizationId_status_dueAt_idx" ON "Task"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "WatchItem_organizationId_createdAt_idx" ON "WatchItem"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Accommodation_organizationId_status_idx" ON "Accommodation"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRecord_slotId_userId_key" ON "AbsenceRecord"("slotId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InsertionSurvey_token_key" ON "InsertionSurvey"("token");

-- CreateIndex
CREATE INDEX "InsertionSurvey_organizationId_dueAt_idx" ON "InsertionSurvey"("organizationId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "InsertionSurvey_enrollmentId_horizonMonths_key" ON "InsertionSurvey"("enrollmentId", "horizonMonths");

-- CreateIndex
CREATE INDEX "TrainerQualification_organizationId_userId_idx" ON "TrainerQualification"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityIndicator_organizationId_code_key" ON "QualityIndicator"("organizationId", "code");

-- CreateIndex
CREATE INDEX "QualityEvidence_organizationId_code_idx" ON "QualityEvidence"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ImprovementAction_organizationId_status_idx" ON "ImprovementAction"("organizationId", "status");

-- CreateIndex
CREATE INDEX "QualityAudit_organizationId_scheduledAt_idx" ON "QualityAudit"("organizationId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditorAccess_tokenHash_key" ON "AuditorAccess"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_pedagogicalReferentId_fkey" FOREIGN KEY ("pedagogicalReferentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_qualityReferentId_fkey" FOREIGN KEY ("qualityReferentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_handicapReferentId_fkey" FOREIGN KEY ("handicapReferentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyConvention" ADD CONSTRAINT "CompanyConvention_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyConvention" ADD CONSTRAINT "CompanyConvention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyConvention" ADD CONSTRAINT "CompanyConvention_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedsAnalysis" ADD CONSTRAINT "NeedsAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedsAnalysis" ADD CONSTRAINT "NeedsAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedsAnalysis" ADD CONSTRAINT "NeedsAnalysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedsAnalysis" ADD CONSTRAINT "NeedsAnalysis_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchItem" ADD CONSTRAINT "WatchItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchAck" ADD CONSTRAINT "WatchAck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WatchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchAck" ADD CONSTRAINT "WatchAck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRecord" ADD CONSTRAINT "AbsenceRecord_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AttendanceSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRecord" ADD CONSTRAINT "AbsenceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRecord" ADD CONSTRAINT "AbsenceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRecord" ADD CONSTRAINT "AbsenceRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsertionSurvey" ADD CONSTRAINT "InsertionSurvey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsertionSurvey" ADD CONSTRAINT "InsertionSurvey_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerQualification" ADD CONSTRAINT "TrainerQualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerQualification" ADD CONSTRAINT "TrainerQualification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerQualification" ADD CONSTRAINT "TrainerQualification_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityIndicator" ADD CONSTRAINT "QualityIndicator_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityEvidence" ADD CONSTRAINT "QualityEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementAction" ADD CONSTRAINT "ImprovementAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementAction" ADD CONSTRAINT "ImprovementAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityAudit" ADD CONSTRAINT "QualityAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "QualityAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ImprovementAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditorAccess" ADD CONSTRAINT "AuditorAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRisk" ADD CONSTRAINT "QualityRisk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sécurité : tables inaccessibles via l'API Supabase (accès uniquement par l'application)
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyConvention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NeedsAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchAck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Accommodation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AbsenceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InsertionSurvey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Webhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainerQualification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualityIndicator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualityEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImprovementAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualityAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NonConformity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditorAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QualityRisk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subcontractor" ENABLE ROW LEVEL SECURITY;
