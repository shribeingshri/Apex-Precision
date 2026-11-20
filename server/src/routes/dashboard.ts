import { Router, Request, Response } from 'express';
import { prisma } from '../utils/db';
import { authenticateToken } from '../middleware/auth';
import { Decimal } from 'decimal.js';

export const dashboardRouter = Router();

dashboardRouter.get('/metrics', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Projects Breakdown
    const projects = await prisma.project.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        status: true,
        orderedQty: true,
        expectedCompletionDate: true,
      },
    });

    const activeStatuses = ['APPROVED', 'IN_PRODUCTION', 'QUALITY_INSPECTION', 'READY_FOR_DELIVERY', 'PARTIALLY_DELIVERED'];
    const activeProjects = projects.filter((p) => activeStatuses.includes(p.status)).length;
    const totalUnitsOrdered = projects.reduce((sum, p) => sum + p.orderedQty, 0);

    const now = new Date();
    const overdueProjects = projects.filter(
      (p) => activeStatuses.includes(p.status) && new Date(p.expectedCompletionDate) < now
    ).length;

    // 2. Production, Quality and Delivery Aggregations
    const prodAggregate = await prisma.productionRecord.aggregate({
      _sum: { producedQty: true },
    });
    const totalProducedUnits = prodAggregate._sum.producedQty || 0;

    const qcAggregate = await prisma.qualityInspection.aggregate({
      _sum: {
        inspectedQty: true,
        approvedQty: true,
        rejectedQty: true,
        reworkQty: true,
      },
    });
    const unitsQualityApproved = qcAggregate._sum.approvedQty || 0;
    const rejectedUnits = qcAggregate._sum.rejectedQty || 0;
    const reworkUnits = qcAggregate._sum.reworkQty || 0;

    const deliveryList = await prisma.delivery.findMany({
      select: {
        id: true,
        status: true,
        deliveryQty: true,
        expectedArrivalDate: true,
      },
    });

    const pendingDeliveries = deliveryList.filter(
      (d) => ['PLANNED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED'].includes(d.status)
    ).length;
    const completedDeliveries = deliveryList.filter((d) => d.status === 'DELIVERED').length;

    // 3. Financial Calculations
    // Invoices
    const invoices = await prisma.invoice.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: {
        id: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        amountReceived: true,
        outstandingBalance: true,
        status: true,
      },
    });

    let totalInvoicedRevenue = new Decimal(0);
    let totalOutstandingReceivables = new Decimal(0);
    let overdueInvoicesCount = 0;

    invoices.forEach((inv) => {
      totalInvoicedRevenue = totalInvoicedRevenue.plus(new Decimal(inv.totalAmount.toString()));
      totalOutstandingReceivables = totalOutstandingReceivables.plus(new Decimal(inv.outstandingBalance.toString()));
      if (new Date(inv.dueDate) < now && inv.status !== 'PAID') {
        overdueInvoicesCount++;
      }
    });

    // Payments Received
    const payments = await prisma.payment.findMany({
      where: { status: 'COMPLETED' },
      select: { amount: true },
    });
    const totalCollectedRevenue = payments.reduce(
      (sum, p) => sum.plus(new Decimal(p.amount.toString())),
      new Decimal(0)
    );

    // Expenses
    const expenses = await prisma.expense.findMany({
      where: { approvalStatus: 'APPROVED' },
      select: { amount: true, category: true },
    });
    const totalRecordedExpenses = expenses.reduce(
      (sum, e) => sum.plus(new Decimal(e.amount.toString())),
      new Decimal(0)
    );

    // Payroll
    const payroll = await prisma.payrollRecord.findMany({
      where: { status: { in: ['APPROVED', 'PAID'] } },
      select: { netSalary: true },
    });
    const totalPayrollExpenditure = payroll.reduce(
      (sum, p) => sum.plus(new Decimal(p.netSalary.toString())),
      new Decimal(0)
    );

    // Retainer Revenue
    const retainers = await prisma.retainer.findMany({
      where: { status: 'ACTIVE' },
      select: { recurringFee: true, renewalDate: true },
    });
    const activeRetainerMonthlyRevenue = retainers.reduce(
      (sum, r) => sum.plus(new Decimal(r.recurringFee.toString())),
      new Decimal(0)
    );

    // 4. Alerts
    const alerts: Array<{ id: string; type: 'WARNING' | 'CRITICAL' | 'INFO'; message: string; link: string }> = [];

    if (overdueInvoicesCount > 0) {
      alerts.push({
        id: 'alt-inv',
        type: 'CRITICAL',
        message: `${overdueInvoicesCount} invoices are overdue for payment. Immediate follow-up required.`,
        link: '/billing',
      });
    }

    if (overdueProjects > 0) {
      alerts.push({
        id: 'alt-prj',
        type: 'WARNING',
        message: `${overdueProjects} active manufacturing projects have surpassed their expected completion date.`,
        link: '/projects',
      });
    }

    const upcomingDeliveries = deliveryList.filter((d) => {
      const diff = new Date(d.expectedArrivalDate).getTime() - now.getTime();
      return diff > 0 && diff < 86400000 * 2 && d.status !== 'DELIVERED';
    }).length;

    if (upcomingDeliveries > 0) {
      alerts.push({
        id: 'alt-del',
        type: 'INFO',
        message: `${upcomingDeliveries} delivery dispatches are due within the next 48 hours.`,
        link: '/delivery',
      });
    }

    res.json({
      operational: {
        activeProjects,
        totalUnitsOrdered,
        unitsInProduction: Math.max(0, totalUnitsOrdered - totalProducedUnits),
        totalProducedUnits,
        unitsQualityApproved,
        rejectedUnits,
        reworkUnits,
        pendingDeliveries,
        completedDeliveries,
        overdueProjects,
      },
      financial: {
        totalInvoicedRevenue: totalInvoicedRevenue.toNumber(),
        totalCollectedRevenue: totalCollectedRevenue.toNumber(),
        outstandingReceivables: totalOutstandingReceivables.toNumber(),
        overdueInvoicesCount,
        recordedExpenses: totalRecordedExpenses.toNumber(),
        payrollExpenditure: totalPayrollExpenditure.toNumber(),
        activeRetainerMonthlyRevenue: activeRetainerMonthlyRevenue.toNumber(),
      },
      alerts,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'DASHBOARD_ERROR', message: err.message });
  }
});

