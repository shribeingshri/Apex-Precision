-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bankCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "earlyDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "instrumentDate" TIMESTAMP(3),
ADD COLUMN     "lateFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "netCashReceived" DECIMAL(12,2),
ADD COLUMN     "paymentType" TEXT NOT NULL DEFAULT 'INVOICE_PAYMENT',
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "tdsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
