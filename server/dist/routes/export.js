"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRouter = void 0;
const express_1 = require("express");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const csv_stringify_1 = require("csv-stringify");
exports.exportRouter = (0, express_1.Router)();
exports.exportRouter.get('/invoices', auth_1.authenticateToken, async (req, res) => {
    try {
        const invoices = await db_1.prisma.invoice.findMany({
            include: {
                client: { select: { companyName: true, clientCode: true } },
                project: { select: { projectCode: true } },
            },
            orderBy: { invoiceDate: 'desc' },
        });
        const rows = invoices.map((inv) => ({
            'Invoice Number': inv.invoiceNumber,
            'Client Code': inv.client.clientCode,
            'Client Name': inv.client.companyName,
            'Project Code': inv.project?.projectCode || 'N/A',
            'Invoice Date': inv.invoiceDate.toISOString().split('T')[0],
            'Due Date': inv.dueDate.toISOString().split('T')[0],
            'Subtotal (INR)': inv.subtotal.toString(),
            'Tax Amount (INR)': inv.taxAmount.toString(),
            'Total Amount (INR)': inv.totalAmount.toString(),
            'Amount Received (INR)': inv.amountReceived.toString(),
            'Outstanding Balance (INR)': inv.outstandingBalance.toString(),
            'Payment Status': inv.status,
        }));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="invoices_export.csv"');
        (0, csv_stringify_1.stringify)(rows, { header: true }).pipe(res);
    }
    catch (err) {
        res.status(500).json({ error: 'EXPORT_ERROR', message: err.message });
    }
});
exports.exportRouter.get('/production', auth_1.authenticateToken, async (req, res) => {
    try {
        const records = await db_1.prisma.productionRecord.findMany({
            include: {
                project: { select: { projectCode: true, name: true } },
                assignedEmployee: { select: { name: true } },
            },
            orderBy: { productionDate: 'desc' },
        });
        const rows = records.map((r) => ({
            'Batch Number': r.batchNumber,
            'Project Code': r.project.projectCode,
            'Product': r.product,
            'Planned Qty': r.plannedQty,
            'Produced Qty': r.producedQty,
            'Production Date': r.productionDate.toISOString().split('T')[0],
            'Shift': r.shift || 'N/A',
            'Machine Line': r.machineLine || 'N/A',
            'Supervisor': r.assignedEmployee?.name || 'N/A',
            'Material Cost (INR)': r.materialCost.toString(),
            'Labour Cost (INR)': r.labourCost.toString(),
            'Other Cost (INR)': r.otherCost.toString(),
        }));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="production_export.csv"');
        (0, csv_stringify_1.stringify)(rows, { header: true }).pipe(res);
    }
    catch (err) {
        res.status(500).json({ error: 'EXPORT_ERROR', message: err.message });
    }
});
exports.exportRouter.get('/deliveries', auth_1.authenticateToken, async (req, res) => {
    try {
        const deliveries = await db_1.prisma.delivery.findMany({
            include: {
                project: { select: { projectCode: true } },
                client: { select: { companyName: true } },
            },
            orderBy: { dispatchDate: 'desc' },
        });
        const rows = deliveries.map((d) => ({
            'Delivery Number': d.deliveryNumber,
            'Project Code': d.project.projectCode,
            'Client Name': d.client.companyName,
            'Product': d.product,
            'Delivery Qty': d.deliveryQty,
            'Dispatch Date': d.dispatchDate.toISOString().split('T')[0],
            'Expected Arrival': d.expectedArrivalDate.toISOString().split('T')[0],
            'Actual Delivery': d.actualDeliveryDate ? d.actualDeliveryDate.toISOString().split('T')[0] : 'Pending',
            'Transport Reference': d.transportReference || 'N/A',
            'Vehicle Details': d.vehicleDetails || 'N/A',
            'Delivery Status': d.status,
        }));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="deliveries_export.csv"');
        (0, csv_stringify_1.stringify)(rows, { header: true }).pipe(res);
    }
    catch (err) {
        res.status(500).json({ error: 'EXPORT_ERROR', message: err.message });
    }
});
