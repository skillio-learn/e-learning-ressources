-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'ABANDONED';

-- DropIndex
DROP INDEX "SatisfactionResponse_enrollmentId_key";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "positioning" JSONB;

-- AlterTable
ALTER TABLE "AttendanceSlot" ADD COLUMN     "trainerName" TEXT,
ADD COLUMN     "trainerSignature" TEXT,
ADD COLUMN     "trainerSignedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "evaluationMethods" TEXT,
ADD COLUMN     "pedagogicalMethods" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "conventionSignature" TEXT,
ADD COLUMN     "conventionSignedAt" TIMESTAMP(3),
ADD COLUMN     "conventionSignedIp" TEXT,
ADD COLUMN     "convocationSentAt" TIMESTAMP(3),
ADD COLUMN     "exitAssessment" JSONB,
ADD COLUMN     "exitCategory" TEXT,
ADD COLUMN     "exitDate" TIMESTAMP(3),
ADD COLUMN     "exitReason" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "interactiveTimeoutMin" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "mediatorInfo" TEXT,
ADD COLUMN     "referentHandicap" TEXT,
ADD COLUMN     "signatureImage" TEXT;

-- AlterTable
ALTER TABLE "SatisfactionResponse" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'HOT';

-- CreateTable
CREATE TABLE "PedagogicalMessage" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedagogicalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunderFeedback" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "respondentType" TEXT NOT NULL,
    "respondentName" TEXT,
    "answers" JSONB,
    "globalScore" DOUBLE PRECISION,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "FunderFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedagogicalMessage_enrollmentId_createdAt_idx" ON "PedagogicalMessage"("enrollmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FunderFeedback_token_key" ON "FunderFeedback"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "SatisfactionResponse_enrollmentId_kind_key" ON "SatisfactionResponse"("enrollmentId", "kind");

-- AddForeignKey
ALTER TABLE "PedagogicalMessage" ADD CONSTRAINT "PedagogicalMessage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalMessage" ADD CONSTRAINT "PedagogicalMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderFeedback" ADD CONSTRAINT "FunderFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderFeedback" ADD CONSTRAINT "FunderFeedback_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS : accès uniquement côté serveur (Supabase)
ALTER TABLE "PedagogicalMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FunderFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
