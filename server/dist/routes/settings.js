"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.settingsRouter = (0, express_1.Router)();
exports.settingsRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const settings = await db_1.prisma.systemSetting.findMany({
            orderBy: { key: 'asc' },
        });
        res.json(settings);
    }
    catch (err) {
        res.status(500).json({ error: 'SETTINGS_ERROR', message: err.message });
    }
});
exports.settingsRouter.put('/:key', auth_1.authenticateToken, (0, auth_1.requireRole)([client_1.Role.SUPER_ADMIN, client_1.Role.MANAGEMENT]), async (req, res) => {
    try {
        const { value, description } = req.body;
        const rawKey = req.params.key;
        const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
        const setting = await db_1.prisma.systemSetting.upsert({
            where: { key },
            update: { value, description },
            create: { key, value, description },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'UPDATE_SETTING',
            entity: 'SystemSetting',
            entityId: key,
            details: `Updated system setting ${key} to ${value}`,
            ipAddress: req.ip,
        });
        res.json(setting);
    }
    catch (err) {
        res.status(500).json({ error: 'SETTING_UPDATE_ERROR', message: err.message });
    }
});
