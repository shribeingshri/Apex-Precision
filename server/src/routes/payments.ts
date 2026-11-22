import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { logActivity } from '../utils/audit';

export const paymentsRouter = Router();

const PaymentRecordSchema = z.object({
  paymentType: z.enum(['INVOICE_PAYMENT', 'ADVANCE_PAYMENT']).default('INVOICE_PAYMENT'),
  invoiceId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  tdsAmount: z.number().min(0, 'TDS cannot be negative').default(0),
  bankCharges: z.number().min(0, 'Bank charges cannot be negative').default(0),
  lateFee: z.number().min(0, 'Late fee cannot be negative').default(0),
  earlyDiscount: z.number().min(0, 'Early discount cannot be negative').default(0),
  paymentDate: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  transactionReference: z.string().min(3, 'Transaction reference must be at least 3 characters'),
  bankName: z.string().optional(),
  instrumentDate: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const ReversePaymentSchema = z.object({
  reason: z.string().min(5, 'A clear reversal reason is required (min 5 characters)'),
});

paymentsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, invoiceId, status } = req.query;
    const where: any = {};

    if (clientId && typeof clientId === 'string') where.clientId = clientId;
    if (invoiceId && typeof invoiceId === 'string') where.invoiceId = invoiceId;
    if (status && typeof status === 'string') where.status = status;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        client: { select: { id: true, clientCode: true, companyName: true, gstin: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, outstandingBalance: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: 'PAYMENTS_FETCH_ERROR', message: err.message });
  }
});

paymentsRouter.post('/', authenticateToken, requirePermission('RECORD_PAYMENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = PaymentRecordSchema.parse(req.body);

    // 1. Idempotency Check: Prevent duplicate payment recordings
    if (data.idempotencyKey) {
      const existing = await prisma.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        res.status(409).json({
          error: 'DUPLICATE_PAYMENT',
          message: 'This payment transaction has already been processed (Idempotency matched).',
          payment: existing,
        });
        return;
      }
    }

    const paymentAmount = new Decimal(data.amount);
    const tds = new Decimal(data.tdsAmount || 0);
    const bankCharges = new Decimal(data.bankCharges || 0);
    const lateFee = new Decimal(data.lateFee || 0);
    const earlyDiscount = new Decimal(data.earlyDiscount || 0);

    // Net Cash actually hitting bank = Applied Amount - TDS - Early Discount + Late Fee - Bank Charges
    const netCash = Decimal.max(
      new Decimal(0),
      paymentAmount.minus(tds).minus(earlyDiscount).plus(lateFee).minus(bankCharges)
    );

    const count = await prisma.payment.count();
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // 2. Handle Advance / Unallocated Payment
    if (data.paymentType === 'ADVANCE_PAYMENT' || !data.invoiceId) {
      if (!data.clientId) {
        res.status(400).json({
          error: 'CLIENT_REQUIRED',
          message: 'Client selection is required for advance payments.',
        });
        return;
      }

      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      if (!client) {
        res.status(404).json({ error: 'CLIENT_NOT_FOUND', message: 'Selected client not found.' });
        return;
      }

      const payment = await prisma.payment.create({
        data: {
          paymentNumber,
          paymentType: 'ADVANCE_PAYMENT',
          clientId: client.id,
          paymentDate: new Date(data.paymentDate),
          amount: paymentAmount.toFixed(2),
          tdsAmount: tds.toFixed(2),
          bankCharges: bankCharges.toFixed(2),
          lateFee: lateFee.toFixed(2),
          earlyDiscount: earlyDiscount.toFixed(2),
          netCashReceived: netCash.toFixed(2),
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference,
          bankName: data.bankName,
          instrumentDate: data.instrumentDate ? new Date(data.instrumentDate) : null,
          status: PaymentStatus.COMPLETED,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
        },
      });

      await logActivity({
        userId: req.user!.id,
        userName: req.user!.fullName,
        action: 'RECORD_ADVANCE_PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        details: `Recorded advance payment of INR ${paymentAmount.toFixed(2)} (Net Cash: INR ${netCash.toFixed(2)}) for client ${client.companyName}`,
        ipAddress: req.ip,
      });

      res.status(201).json({ payment, updatedInvoice: null });
      return;
    }

    // 3. Handle Invoice Payment
    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
    });

    if (!invoice) {
      res.status(404).json({ error: 'INVOICE_NOT_FOUND', message: 'Target invoice not found.' });
      return;
    }

    if (invoice.status === 'PAID') {
      res.status(400).json({
        error: 'INVOICE_ALREADY_PAID',
        message: 'This invoice has already been fully paid.',
      });
      return;
    }

    if (invoice.status === 'CANCELLED') {
      res.status(400).json({
        error: 'INVOICE_CANCELLED',
        message: 'Cannot record payments against a cancelled invoice.',
      });
      return;
    }

    const currentReceived = new Decimal(invoice.amountReceived.toString());
    const currentOutstanding = new Decimal(invoice.outstandingBalance.toString());

    // Validation: Applied invoice settlement must not exceed current outstanding balance
    if (paymentAmount.greaterThan(currentOutstanding)) {
      res.status(400).json({
        error: 'EXCESS_PAYMENT_AMOUNT',
        message: `Payment amount (${paymentAmount.toFixed(2)}) exceeds current outstanding invoice balance of ${currentOutstanding.toFixed(2)}.`,
      });
      return;
    }

    const newAmountReceived = currentReceived.plus(paymentAmount);
    const newOutstanding = currentOutstanding.minus(paymentAmount);
    const newStatus = newOutstanding.isZero() ? 'PAID' : 'PARTIALLY_PAID';

    // 4. Atomic Multi-record Transaction
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          paymentType: 'INVOICE_PAYMENT',
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          projectId: invoice.projectId,
          paymentDate: new Date(data.paymentDate),
          amount: paymentAmount.toFixed(2),
          tdsAmount: tds.toFixed(2),
          bankCharges: bankCharges.toFixed(2),
          lateFee: lateFee.toFixed(2),
          earlyDiscount: earlyDiscount.toFixed(2),
          netCashReceived: netCash.toFixed(2),
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference,
          bankName: data.bankName,
          instrumentDate: data.instrumentDate ? new Date(data.instrumentDate) : null,
          status: PaymentStatus.COMPLETED,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
          allocations: {
            create: {
              invoiceId: invoice.id,
              amount: paymentAmount.toFixed(2),
            },
          },
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountReceived: newAmountReceived.toFixed(2),
          outstandingBalance: newOutstanding.toFixed(2),
          status: newStatus,
        },
      });

      return { payment, updatedInvoice };
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'RECORD_PAYMENT',
      entity: 'Payment',
      entityId: result.payment.id,
      details: `Recorded payment ${paymentNumber} of INR ${paymentAmount.toFixed(2)} (TDS: ${tds.toFixed(2)}, Fees: ${bankCharges.toFixed(2)}, Late Fee: ${lateFee.toFixed(2)}, Discount: ${earlyDiscount.toFixed(2)}) for invoice ${invoice.invoiceNumber}. New outstanding: INR ${newOutstanding.toFixed(2)}`,
      ipAddress: req.ip,
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Invalid payment payload', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'PAYMENT_RECORD_ERROR', message: err.message });
  }
});

paymentsRouter.post('/:id/reverse', authenticateToken, requirePermission('RECORD_PAYMENTS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = ReversePaymentSchema.parse(req.body);
    const payment = await prisma.payment.findUnique({ where: { id: String(req.params.id) } });

    if (!payment) {
      res.status(404).json({ error: 'PAYMENT_NOT_FOUND', message: 'Payment record not found.' });
      return;
    }

    if (payment.status === 'REVERSED') {
      res.status(400).json({ error: 'ALREADY_REVERSED', message: 'This payment has already been reversed.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const reversedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REVERSED,
          reversalReason: reason,
          reversedAt: new Date(),
        },
      });

      let updatedInvoice = null;
      if (payment.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
        if (invoice) {
          const payAmt = new Decimal(payment.amount.toString());
          const newReceived = Decimal.max(new Decimal(0), new Decimal(invoice.amountReceived.toString()).minus(payAmt));
          const newOutstanding = new Decimal(invoice.totalAmount.toString()).minus(newReceived);
          const newStatus = newReceived.isZero() ? 'ISSUED' : 'PARTIALLY_PAID';

          updatedInvoice = await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              amountReceived: newReceived.toFixed(2),
              outstandingBalance: newOutstanding.toFixed(2),
              status: newStatus,
            },
          });
        }
      }

      return { payment: reversedPayment, updatedInvoice };
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'REVERSE_PAYMENT',
      entity: 'Payment',
      entityId: payment.id,
      details: `Reversed payment ${payment.paymentNumber} (INR ${payment.amount}). Reason: ${reason}`,
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: err.errors[0]?.message, details: err.errors });
      return;
    }
    res.status(500).json({ error: 'PAYMENT_REVERSE_ERROR', message: err.message });
  }
});
