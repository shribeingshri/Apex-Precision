"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
exports.reportsRouter = (0, express_1.Router)();
exports.reportsRouter.get('/summary', auth_1.authenticateToken, (0, auth_1.requirePermission)('VIEW_REPORTS'), async (req, res) => {
    try {
        // 1. Projects Breakdown
        const projects = await db_1.prisma.project.findMany({
            where: { isArchived: false },
            include: {
                client: { select: { companyName: true } },
                productionRecords: { select: { producedQty: true, materialCost: true, labourCost: true, otherCost: true } },
                inspections: { select: { inspectedQty: true, approvedQty: true, rejectedQty: true, reworkQty: true } },
                deliveries: { select: { deliveryQty: true, status: true } },
                invoices: { select: { totalAmount: true, amountReceived: true, outstandingBalance: true, status: true } },
            },
        });
        const projectReports = projects.map((p) => {
            const producedQty = p.productionRecords.reduce((sum, r) => sum + r.producedQty, 0);
            const approvedQty = p.inspections.reduce((sum, r) => sum + r.approvedQty, 0);
            const rejectedQty = p.inspections.reduce((sum, r) => sum + r.rejectedQty, 0);
            const deliveredQty = p.deliveries
                .filter((d) => d.status === 'DELIVERED')
                .reduce((sum, r) => sum + r.deliveryQty, 0);
            const totalInvoiced = p.invoices
                .filter((i) => i.status !== 'CANCELLED')
                .reduce((sum, i) => sum + Number(i.totalAmount), 0);
            const totalReceived = p.invoices
                .filter((i) => i.status !== 'CANCELLED')
                .reduce((sum, i) => sum + Number(i.amountReceived), 0);
            const manufacturingCost = p.productionRecords.reduce((sum, r) => sum + Number(r.materialCost) + Number(r.labourCost) + Number(r.otherCost), 0);
            return {
                projectId: p.id,
                projectCode: p.projectCode,
                name: p.name,
                clientName: p.client.companyName,
                orderedQty: p.orderedQty,
                producedQty,
                approvedQty,
                rejectedQty,
                deliveredQty,
                remainingDeliveryQty: Math.max(0, p.orderedQty - deliveredQty),
                status: p.status,
                totalInvoiced,
                totalReceived,
                manufacturingCost,
            };
        });
        // 2. Expenses Category Breakdown
        const expensesByCategory = await db_1.prisma.expense.groupBy({
            by: ['category'],
            where: { approvalStatus: 'APPROVED' },
            _sum: { amount: true },
            _count: true,
        });
        // 3. Quality Metrics Aggregate
        const qcAgg = await db_1.prisma.qualityInspection.aggregate({
            _sum: {
                inspectedQty: true,
                approvedQty: true,
                rejectedQty: true,
                reworkQty: true,
            },
        });
        const totalInspected = qcAgg._sum.inspectedQty || 0;
        const totalApproved = qcAgg._sum.approvedQty || 0;
        const totalRejected = qcAgg._sum.rejectedQty || 0;
        const totalRework = qcAgg._sum.reworkQty || 0;
        const qualityYieldPercentage = totalInspected > 0 ? Math.round((totalApproved / totalInspected) * 100) : 100;
        res.json({
            projects: projectReports,
            expensesByCategory: expensesByCategory.map((e) => ({
                category: e.category,
                totalAmount: Number(e._sum.amount || 0),
                count: e._count,
            })),
            quality: {
                totalInspected,
                totalApproved,
                totalRejected,
                totalRework,
                qualityYieldPercentage,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'REPORTS_ERROR', message: err.message });
    }
});
