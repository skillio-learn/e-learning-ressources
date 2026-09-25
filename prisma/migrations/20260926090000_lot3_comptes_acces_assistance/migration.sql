-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_PROFILE', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('PENDING_DOCUMENTS', 'UNDER_REVIEW', 'GRANTED', 'REFUSED');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'WAITING', 'RESOLVED');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "accessDecidedAt" TIMESTAMP(3),
ADD COLUMN     "accessDecidedById" TEXT,
ADD COLUMN     "accessDecisionNote" TEXT,
ADD COLUMN     "accessStatus" "AccessStatus" NOT NULL DEFAULT 'GRANTED',
ADD COLUMN     "accessSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'OF';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "accountRequiredDocuments" TEXT[] DEFAULT ARRAY['ID']::TEXT[],
ADD COLUMN     "allowSelfRegistration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoGrantAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cgvText" TEXT,
ADD COLUMN     "enrollmentRequiredDocuments" TEXT[] DEFAULT ARRAY['CONVENTION', 'CGV', 'INTERNAL_RULES']::TEXT[],
ADD COLUMN     "internalRulesText" TEXT,
ADD COLUMN     "requireAccountValidation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportAutoReply" TEXT,
ADD COLUMN     "supportEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supportHours" TEXT,
ADD COLUMN     "supportResponseHours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountReviewNote" TEXT,
ADD COLUMN     "accountReviewedAt" TIMESTAMP(3),
ADD COLUMN     "accountReviewedById" TEXT,
ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "accountSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "createdVia" TEXT NOT NULL DEFAULT 'SELF';

-- CreateTable
CREATE TABLE "LearnerDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "enrollmentId" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "size" INTEGER,
    "data" BYTEA,
    "signature" TEXT,
    "signedIp" TEXT,
    "signedUserAgent" TEXT,
    "contentHash" TEXT,
    "signedContent" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "uploadedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnerDocument_userId_enrollmentId_idx" ON "LearnerDocument"("userId", "enrollmentId");

-- CreateIndex
CREATE INDEX "LearnerDocument_organizationId_status_idx" ON "LearnerDocument"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SupportConversation_organizationId_status_lastMessageAt_idx" ON "SupportConversation"("organizationId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportConversation_userId_lastMessageAt_idx" ON "SupportConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountReviewedById_fkey" FOREIGN KEY ("accountReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_accessDecidedById_fkey" FOREIGN KEY ("accessDecidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerDocument" ADD CONSTRAINT "LearnerDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerDocument" ADD CONSTRAINT "LearnerDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerDocument" ADD CONSTRAINT "LearnerDocument_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerDocument" ADD CONSTRAINT "LearnerDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerDocument" ADD CONSTRAINT "LearnerDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Les inscriptions existantes conservent leur accès ; les nouvelles attendent les documents d'inscription.
ALTER TABLE "Enrollment" ALTER COLUMN "accessStatus" SET DEFAULT 'PENDING_DOCUMENTS';

-- RLS : accès uniquement côté serveur (Supabase)
ALTER TABLE "LearnerDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;
