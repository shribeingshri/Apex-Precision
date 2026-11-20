"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityRouter = void 0;
const express_1 = require("express");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
exports.activityRouter = (0, express_1.Router)();
// Append-only chronological activity stream
exports.activityRouter.get('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('VIEW_ACTIVITY_LOGS'), async (req, res) => {
    try {
        const { entity, action, limit } = req.query;
        const where = {};
        if (entity && typeof entity === 'string' && entity !== 'ALL') {
            where.entity = entity;
        }
        if (action && typeof action === 'string' && action !== 'ALL') {
            where.action = action;
        }
        const take = limit ? Math.min(100, Number(limit)) : 50;
        const logs = await db_1.prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
        });
        res.json(logs);
    }
    catch (err) {
        res.status(500).json({ error: 'ACTIVITY_LOGS_ERROR', message: err.message });
    }
});
