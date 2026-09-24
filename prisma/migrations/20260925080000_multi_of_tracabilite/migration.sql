-- CreateEnum
CREATE TYPE "TrainingModality" AS ENUM ('FOAD', 'PRESENTIEL', 'MIXTE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('JOB_SEEKER', 'EMPLOYEE', 'SELF_EMPLOYED', 'STUDENT', 'CIVIL_SERVANT', 'OTHER');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('CPF', 'OPCO', 'FRANCE_TRAVAIL', 'EMPLOYER', 'REGION', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INCOMPLETE', 'ACCEPTED', 'ENROLLED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationEventType" AS ENUM ('STATUS', 'MESSAGE', 'NOTE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "LoginEventType" AS ENUM ('LOGIN', 'LOGOUT', 'FAILED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
ALTER TYPE "EnrollmentPolicy" ADD VALUE 'APPLICATION';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OF_ADMIN';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "cpfEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modality" "TrainingModality" NOT NULL DEFAULT 'FOAD',
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "requiredDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rncpCode" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "enrolledById" TEXT,
ADD COLUMN     "fundingReference" TEXT,
ADD COLUMN     "fundingType" "FundingType",
ADD COLUMN     "plannedHours" DOUBLE PRECISION,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "minTimeSec" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "siret" TEXT,
    "nda" TEXT,
    "ndaRegion" TEXT,
    "qualiopiNumber" TEXT,
    "qualiopiDate" TIMESTAMP(3),
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "managerName" TEXT,
    "managerTitle" TEXT,
    "internalRulesUrl" TEXT,
    "cgvUrl" TEXT,
    "requiredDocuments" TEXT[] DEFAULT ARRAY['ID', 'CV']::TEXT[],
    "inactivityTimeoutMin" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "civility" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "birthName" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthPlace" TEXT,
    "nationality" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'France',
    "phone" TEXT,
    "employmentStatus" "EmploymentStatus",
    "franceTravailId" TEXT,
    "franceTravailAgency" TEXT,
    "educationLevel" TEXT,
    "lastDiploma" TEXT,
    "currentJob" TEXT,
    "employerName" TEXT,
    "employerSiret" TEXT,
    "employerAddress" TEXT,
    "employerContactName" TEXT,
    "employerContactEmail" TEXT,
    "employerContactPhone" TEXT,
    "opcoName" TEXT,
    "disability" BOOLEAN NOT NULL DEFAULT false,
    "disabilityNeeds" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "fundingType" "FundingType",
    "fundingReference" TEXT,
    "fundingDetails" TEXT,
    "motivation" TEXT,
    "expectations" TEXT,
    "experience" TEXT,
    "prerequisitesOk" BOOLEAN NOT NULL DEFAULT false,
    "availability" TEXT,
    "consentRgpd" BOOLEAN NOT NULL DEFAULT false,
    "consentTerms" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "profileSnapshot" JSONB,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" "ApplicationEventType" NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus",
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "location" TEXT,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "type" "LoginEventType" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "activitySessionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSlot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSignature" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AttendanceSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisfactionResponse" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "globalScore" DOUBLE PRECISION NOT NULL,
    "recommend" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SatisfactionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "courseId" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProfile_userId_key" ON "LearnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_number_key" ON "Application"("number");

-- CreateIndex
CREATE INDEX "Application_courseId_status_idx" ON "Application"("courseId", "status");

-- CreateIndex
CREATE INDEX "Application_userId_idx" ON "Application"("userId");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_createdAt_idx" ON "ApplicationEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivitySession_userId_startedAt_idx" ON "ActivitySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "TimeLog_userId_courseId_startedAt_idx" ON "TimeLog"("userId", "courseId", "startedAt");

-- CreateIndex
CREATE INDEX "TimeLog_lessonId_idx" ON "TimeLog"("lessonId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AttendanceSlot_sessionId_date_idx" ON "AttendanceSlot"("sessionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSignature_slotId_userId_key" ON "AttendanceSignature"("slotId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SatisfactionResponse_enrollmentId_key" ON "SatisfactionResponse"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_applicationId_key" ON "Enrollment"("applicationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Données : organisme par défaut pour les formations et comptes existants
INSERT INTO "Organization" ("id", "slug", "name", "requiredDocuments", "inactivityTimeoutMin", "active", "createdAt", "updatedAt")
VALUES ('org_skillio_default', 'skillio-formation', 'Skillio Formation', ARRAY['ID','CV']::TEXT[], 15, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
UPDATE "Course" SET "organizationId" = 'org_skillio_default' WHERE "organizationId" IS NULL;
UPDATE "User" SET "organizationId" = 'org_skillio_default' WHERE "organizationId" IS NULL AND "role" <> 'ADMIN';
ALTER TABLE "Course" ALTER COLUMN "organizationId" SET NOT NULL;

-- RLS : accès uniquement côté serveur (Supabase)
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearnerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivitySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceSignature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SatisfactionResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Complaint" ENABLE ROW LEVEL SECURITY;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProfile" ADD CONSTRAINT "LearnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSlot" ADD CONSTRAINT "AttendanceSlot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSignature" ADD CONSTRAINT "AttendanceSignature_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AttendanceSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSignature" ADD CONSTRAINT "AttendanceSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisfactionResponse" ADD CONSTRAINT "SatisfactionResponse_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisfactionResponse" ADD CONSTRAINT "SatisfactionResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

