"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../utils/rbac");
const audit_1 = require("../utils/audit");
exports.authRouter = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'manufacturing_erp_enterprise_jwt_super_secret_key_2026';
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
exports.authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);
        const user = await db_1.prisma.user.findUnique({
            where: { email },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        designation: true,
                        department: { select: { name: true } },
                    },
                },
            },
        });
        if (!user || !user.isActive) {
            res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
        await (0, audit_1.logActivity)({
            userId: user.id,
            userName: user.fullName,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            details: `Successful login for user ${user.email} (${user.role})`,
            ipAddress: req.ip,
        });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                permissions: rbac_1.ROLE_PERMISSIONS[user.role],
                employee: user.employee,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required.' });
            return;
        }
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});
exports.authRouter.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        designation: true,
                        department: { select: { name: true } },
                    },
                },
            },
        });
        if (!user) {
            res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
            return;
        }
        res.json({
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                permissions: rbac_1.ROLE_PERMISSIONS[user.role],
                employee: user.employee,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});
exports.authRouter.get('/users', auth_1.authenticateToken, async (req, res) => {
    try {
        const users = await db_1.prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        designation: true,
                    },
                },
            },
            orderBy: { fullName: 'asc' },
        });
        res.json(users);
    }
    catch (err) {
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});
