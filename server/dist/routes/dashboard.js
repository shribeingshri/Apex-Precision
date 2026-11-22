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
        // Status distribution
        const statusCounts = {};
        projects.forEach((p) => {
            statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        });
        const projectStatusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count,
        }));
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
        const rejectedQuantities = qcAggregate._sum.rejectedQty || 0;
        const reworkQuantities = qcAggregate._sum.reworkQty || 0;
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
        let overdueInvoicesAmount = new decimal_js_1.Decimal(0);
        // Group invoices by month for chart
        const monthlyMap = {};
        invoices.forEach((inv) => {
            const invTotal = new decimal_js_1.Decimal(inv.totalAmount.toString());
            const invOut = new decimal_js_1.Decimal(inv.outstandingBalance.toString());
            totalInvoicedRevenue = totalInvoicedRevenue.plus(invTotal);
            totalOutstandingReceivables = totalOutstandingReceivables.plus(invOut);
            const monthKey = new Date(inv.invoiceDate).toLocaleDateString('en-US', { month: 'short' });
            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = { invoiced: new decimal_js_1.Decimal(0), collected: new decimal_js_1.Decimal(0) };
            }
            monthlyMap[monthKey].invoiced = monthlyMap[monthKey].invoiced.plus(invTotal);
            if (new Date(inv.dueDate) < now && inv.status !== 'PAID') {
                overdueInvoicesCount++;
                overdueInvoicesAmount = overdueInvoicesAmount.plus(invOut);
            }
        });
        // Payments Received
        const payments = await db_1.prisma.payment.findMany({
            where: { status: 'COMPLETED' },
            select: { amount: true, paymentDate: true },
        });
        let totalCollectedCash = new decimal_js_1.Decimal(0);
        payments.forEach((p) => {
            const amt = new decimal_js_1.Decimal(p.amount.toString());
            totalCollectedCash = totalCollectedCash.plus(amt);
            const monthKey = new Date(p.paymentDate).toLocaleDateString('en-US', { month: 'short' });
            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = { invoiced: new decimal_js_1.Decimal(0), collected: new decimal_js_1.Decimal(0) };
            }
            monthlyMap[monthKey].collected = monthlyMap[monthKey].collected.plus(amt);
        });
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
                severity: 'DANGER',
                title: 'Overdue Invoices',
                message: `${overdueInvoicesCount} invoices are overdue for payment. Immediate follow-up required.`,
                link: '/billing',
            });
        }
        if (overdueProjects > 0) {
            alerts.push({
                id: 'alt-prj',
                severity: 'WARNING',
                title: 'Delayed Projects',
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
                severity: 'INFO',
                title: 'Upcoming Dispatches',
                message: `${upcomingDeliveries} delivery dispatches are due within the next 48 hours.`,
                link: '/delivery',
            });
        }
        // Monthly chart data array
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIdx = now.getMonth();
        const recentMonths = [
            months[(currentMonthIdx - 2 + 12) % 12],
            months[(currentMonthIdx - 1 + 12) % 12],
            months[currentMonthIdx],
        ];
        const monthlyRevenue = recentMonths.map((m) => ({
            month: m,
            invoiced: monthlyMap[m]?.invoiced.toNumber() || (m === months[currentMonthIdx] ? totalInvoicedRevenue.toNumber() : 0),
            collected: monthlyMap[m]?.collected.toNumber() || (m === months[currentMonthIdx] ? totalCollectedCash.toNumber() : 0),
        }));
        res.json({
            operational: {
                activeProjects,
                totalUnitsOrdered,
                unitsInProduction: Math.max(0, totalUnitsOrdered - totalProducedUnits),
                totalProducedUnits,
                unitsQualityApproved,
                rejectedQuantities,
                reworkQuantities,
                pendingDeliveries,
                completedDeliveries,
                overdueProjects,
            },
            financial: {
                totalInvoicedRevenue: totalInvoicedRevenue.toNumber(),
                totalCollectedCash: totalCollectedCash.toNumber(),
                totalCollectedRevenue: totalCollectedCash.toNumber(),
                outstandingReceivables: totalOutstandingReceivables.toNumber(),
                overdueInvoicesAmount: overdueInvoicesAmount.toNumber(),
                overdueInvoicesCount,
                recordedExpenses: totalRecordedExpenses.toNumber(),
                payrollExpenditure: totalPayrollExpenditure.toNumber(),
                retainerRevenue: activeRetainerMonthlyRevenue.toNumber(),
                invoicedCount: invoices.length,
            },
            charts: {
                monthlyRevenue,
                projectStatusDistribution,
            },
            alerts,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'DASHBOARD_ERROR', message: err.message });
    }
});
