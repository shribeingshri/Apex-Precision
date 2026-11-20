"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const decimal_js_1 = require("decimal.js");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.get('/metrics', auth_1.authenticateToken, async (req, res) => {
    try {
        // 1. Projects Breakdown
        const projects = await db_1.prisma.project.findMany({
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
        const overdueProjects = projects.filter((p) => activeStatuses.includes(p.status) && new Date(p.expectedCompletionDate) < now).length;
        // 2. Production, Quality and Delivery Aggregations
        const prodAggregate = await db_1.prisma.productionRecord.aggregate({
            _sum: { producedQty: true },
        });
        const totalProducedUnits = prodAggregate._sum.producedQty || 0;
        const qcAggregate = await db_1.prisma.qualityInspection.aggregate({
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
        const deliveryList = await db_1.prisma.delivery.findMany({
            select: {
                id: true,
                status: true,
                deliveryQty: true,
                expectedArrivalDate: true,
            },
        });
        const pendingDeliveries = deliveryList.filter((d) => ['PLANNED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED'].includes(d.status)).length;
        const completedDeliveries = deliveryList.filter((d) => d.status === 'DELIVERED').length;
        // 3. Financial Calculations
        // Invoices
        const invoices = await db_1.prisma.invoice.findMany({
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
        let totalInvoicedRevenue = new decimal_js_1.Decimal(0);
        let totalOutstandingReceivables = new decimal_js_1.Decimal(0);
        let overdueInvoicesCount = 0;
        invoices.forEach((inv) => {
            totalInvoicedRevenue = totalInvoicedRevenue.plus(new decimal_js_1.Decimal(inv.totalAmount.toString()));
            totalOutstandingReceivables = totalOutstandingReceivables.plus(new decimal_js_1.Decimal(inv.outstandingBalance.toString()));
            if (new Date(inv.dueDate) < now && inv.status !== 'PAID') {
                overdueInvoicesCount++;
            }
        });
        // Payments Received
        const payments = await db_1.prisma.payment.findMany({
            where: { status: 'COMPLETED' },
            select: { amount: true },
        });
        const totalCollectedRevenue = payments.reduce((sum, p) => sum.plus(new decimal_js_1.Decimal(p.amount.toString())), new decimal_js_1.Decimal(0));
        // Expenses
        const expenses = await db_1.prisma.expense.findMany({
            where: { approvalStatus: 'APPROVED' },
            select: { amount: true, category: true },
        });
        const totalRecordedExpenses = expenses.reduce((sum, e) => sum.plus(new decimal_js_1.Decimal(e.amount.toString())), new decimal_js_1.Decimal(0));
        // Payroll
        const payroll = await db_1.prisma.payrollRecord.findMany({
            where: { status: { in: ['APPROVED', 'PAID'] } },
            select: { netSalary: true },
        });
        const totalPayrollExpenditure = payroll.reduce((sum, p) => sum.plus(new decimal_js_1.Decimal(p.netSalary.toString())), new decimal_js_1.Decimal(0));
        // Retainer Revenue
        const retainers = await db_1.prisma.retainer.findMany({
            where: { status: 'ACTIVE' },
            select: { recurringFee: true, renewalDate: true },
        });
        const activeRetainerMonthlyRevenue = retainers.reduce((sum, r) => sum.plus(new decimal_js_1.Decimal(r.recurringFee.toString())), new decimal_js_1.Decimal(0));
        // 4. Alerts
        const alerts = [];
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
    }
    catch (err) {
        res.status(500).json({ error: 'DASHBOARD_ERROR', message: err.message });
    }
});
