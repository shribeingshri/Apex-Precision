"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailLogsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
exports.emailLogsRouter = (0, express_1.Router)();
exports.emailLogsRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status, clientId, projectId } = req.query;
        const where = {};
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        if (clientId && typeof clientId === 'string')
            where.clientId = clientId;
        if (projectId && typeof projectId === 'string')
            where.projectId = projectId;
        const logs = await db_1.prisma.emailLog.findMany({
            where,
            include: {
                client: { select: { id: true, companyName: true } },
                project: { select: { id: true, projectCode: true, name: true } },
                delivery: { select: { id: true, deliveryNumber: true } },
                invoice: { select: { id: true, invoiceNumber: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(logs);
    }
    catch (err) {
        res.status(500).json({ error: 'EMAIL_LOGS_ERROR', message: err.message });
    }
});
