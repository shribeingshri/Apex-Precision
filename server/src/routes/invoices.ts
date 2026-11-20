import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { InvoiceStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { logActivity } from '../utils/audit';

export const invoicesRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const InvoiceItemSchema = z.object({
  description: z.string().min(2),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

const InvoiceCreateSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  items: z.array(InvoiceItemSchema).min(1, 'Invoice must have at least one line item'),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(18),
  paymentTerms: z.string().default('Net 30 Days'),
  notes: z.string().optional(),
});

invoicesRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, projectId, status } = req.query;
    const where: any = {};

    if (clientId && typeof clientId === 'string') where.clientId = clientId;
    if (projectId && typeof projectId === 'string') where.projectId = projectId;
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as InvoiceStatus;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, clientCode: true, companyName: true, email: true } },
        project: { select: { id: true, projectCode: true, name: true } },
        items: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });

    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: 'INVOICE_FETCH_ERROR', message: err.message });
  }
});

invoicesRouter.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found.' });
      return;
    }

    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: 'INVOICE_DETAIL_ERROR', message: err.message });
  }
});

invoicesRouter.post('/', authenticateToken, requirePermission('MANAGE_INVOICES'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = InvoiceCreateSchema.parse(req.body);

    let subtotal = new Decimal(0);
    const calculatedItems = data.items.map((item) => {
      const lineTotal = new Decimal(item.quantity).times(new Decimal(item.unitPrice));
      subtotal = subtotal.plus(lineTotal);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: lineTotal.toFixed(2),
      };
    });

    const discount = new Decimal(data.discount);
    const taxableAmount = Decimal.max(0, subtotal.minus(discount));
    const taxRate = new Decimal(data.taxRate);
    const taxAmount = taxableAmount.times(taxRate.dividedBy(100));
    const totalAmount = taxableAmount.plus(taxAmount);

    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId: data.clientId,
          projectId: data.projectId,
          invoiceDate: new Date(data.invoiceDate),
          dueDate: new Date(data.dueDate),
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          taxRate: taxRate.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          amountReceived: '0.00',
          outstandingBalance: totalAmount.toFixed(2),
          paymentTerms: data.paymentTerms,
          status: 'ISSUED',
          notes: data.notes,
          items: {
            create: calculatedItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      return created;
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'GENERATE_INVOICE',
      entity: 'Invoice',
      entityId: invoice.id,
      details: `Generated invoice ${invoice.invoiceNumber} for amount INR ${totalAmount.toFixed(2)} (Subtotal: ${subtotal.toFixed(2)}, Tax: ${taxAmount.toFixed(2)})`,
      ipAddress: req.ip,
    });

    res.status(201).json(invoice);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'INVOICE_CREATE_ERROR', message: err.message });
  }
});
