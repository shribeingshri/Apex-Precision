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
const client_1 = require("@prisma/client");
const rbac_1 = require("../utils/rbac");
const audit_1 = require("../utils/audit");
exports.authRouter = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'manufacturing_erp_enterprise_jwt_super_secret_key_2026';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;
const StrongPasswordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid work email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    rememberMe: zod_1.z.boolean().optional().default(false),
});
const RegisterSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Full name is required'),
    email: zod_1.z.string().email('Valid email address is required'),
    password: StrongPasswordSchema,
});
const CreateUserSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: StrongPasswordSchema,
    role: zod_1.z.nativeEnum(client_1.Role).default(client_1.Role.EMPLOYEE),
});
const ChangePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: StrongPasswordSchema,
});
exports.authRouter.post('/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = LoginSchema.parse(req.body);
        const normalizedEmail = email.trim().toLowerCase();
        const user = await db_1.prisma.user.findUnique({
            where: { email: normalizedEmail },
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
        if (!user) {
            res.status(401).json({
                error: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password. Please verify your work credentials.',
            });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({
                error: 'ACCOUNT_DISABLED',
                message: 'This account has been deactivated by an administrator.',
            });
            return;
        }
        // Check account lockout
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remainingSeconds = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000);
            res.status(429).json({
                error: 'ACCOUNT_LOCKED',
                message: `Too many failed login attempts. Account locked for ${remainingSeconds} seconds.`,
                lockedUntil: user.lockedUntil,
                remainingSeconds,
            });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            const attempts = (user.failedLoginAttempts || 0) + 1;
            const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
            const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: attempts,
                    lockedUntil,
                },
            });
            await (0, audit_1.logActivity)({
                userId: user.id,
                userName: user.fullName,
                action: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
                entity: 'User',
                entityId: user.id,
                details: shouldLock
                    ? `Account locked for ${LOCKOUT_MINUTES} minutes after ${attempts} failed login attempts`
                    : `Failed login attempt ${attempts}/${MAX_FAILED_ATTEMPTS} for ${user.email}`,
                ipAddress: req.ip,
            });
            if (shouldLock) {
                res.status(429).json({
                    error: 'ACCOUNT_LOCKED',
                    message: `Account locked for ${LOCKOUT_MINUTES} minutes due to ${MAX_FAILED_ATTEMPTS} consecutive failed attempts.`,
                    lockedUntil,
                });
                return;
            }
            res.status(401).json({
                error: 'INVALID_CREDENTIALS',
                message: `Invalid password. ${MAX_FAILED_ATTEMPTS - attempts} attempt(s) remaining before temporary lockout.`,
                attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts,
            });
            return;
        }
        // Successful login: reset failed attempts & update lastLoginAt
        const now = new Date();
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: now,
            },
        });
        const expiresIn = rememberMe ? '7d' : '12h';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn });
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
            sessionExpiresIn: expiresIn,
            lastLoginAt: now.toISOString(),
            serverAuthStatus: 'POSTGRES_VERIFIED',
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
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: err.errors[0]?.message || 'Email and password are required.',
            });
            return;
        }
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});
exports.authRouter.post('/register', async (req, res) => {
    try {
        const data = RegisterSchema.parse(req.body);
        const normalizedEmail = data.email.trim().toLowerCase();
        const existing = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            res.status(409).json({
                error: 'EMAIL_EXISTS',
                message: 'An account with this work email already exists.',
            });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const user = await db_1.prisma.user.create({
            data: {
                email: normalizedEmail,
                fullName: data.fullName.trim(),
                passwordHash,
                role: client_1.Role.EMPLOYEE,
                isActive: true,
                lastLoginAt: new Date(),
            },
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
        await (0, audit_1.logActivity)({
            userId: user.id,
            userName: user.fullName,
            action: 'REGISTER',
            entity: 'User',
            entityId: user.id,
            details: `New employee account registered: ${user.email}`,
            ipAddress: req.ip,
        });
        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                permissions: rbac_1.ROLE_PERMISSIONS[user.role],
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: err.errors[0]?.message || 'Invalid registration data.',
                details: err.errors,
            });
            return;
        }
        res.status(500).json({ error: 'REGISTER_ERROR', message: err.message });
    }
});
exports.authRouter.post('/change-password', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = ChangePasswordSchema.parse(req.body);
        const user = await db_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(data.currentPassword, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ error: 'INVALID_PASSWORD', message: 'Current password is incorrect.' });
            return;
        }
        const newHash = await bcryptjs_1.default.hash(data.newPassword, 12);
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash },
        });
        await (0, audit_1.logActivity)({
            userId: user.id,
            userName: user.fullName,
            action: 'PASSWORD_CHANGED',
            entity: 'User',
            entityId: user.id,
            details: `Password updated securely for ${user.email}`,
            ipAddress: req.ip,
        });
        res.json({ message: 'Password updated successfully.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: err.errors[0]?.message || 'Weak password.',
            });
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
                lastLoginAt: user.lastLoginAt,
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
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                failedLoginAttempts: true,
                lockedUntil: true,
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
exports.authRouter.post('/users', auth_1.authenticateToken, (0, auth_1.requireRole)([client_1.Role.SUPER_ADMIN]), async (req, res) => {
    try {
        const data = CreateUserSchema.parse(req.body);
        const normalizedEmail = data.email.trim().toLowerCase();
        const existing = await db_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            res.status(409).json({ error: 'EMAIL_EXISTS', message: 'Email already registered.' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const created = await db_1.prisma.user.create({
            data: {
                email: normalizedEmail,
                fullName: data.fullName.trim(),
                passwordHash,
                role: data.role,
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_USER',
            entity: 'User',
            entityId: created.id,
            details: `Admin created user ${created.email} with role ${created.role}`,
            ipAddress: req.ip,
        });
        res.status(201).json(created);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: err.errors[0]?.message, details: err.errors });
            return;
        }
        res.status(500).json({ error: 'USER_CREATE_ERROR', message: err.message });
    }
});
exports.authRouter.patch('/users/:id/status', auth_1.authenticateToken, (0, auth_1.requireRole)([client_1.Role.SUPER_ADMIN]), async (req, res) => {
    try {
        const { isActive, unlock } = req.body;
        const updated = await db_1.prisma.user.update({
            where: { id: String(req.params.id) },
            data: {
                ...(typeof isActive === 'boolean' ? { isActive } : {}),
                ...(unlock ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
            },
            select: { id: true, email: true, isActive: true, failedLoginAttempts: true, lockedUntil: true },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'USER_UPDATE_ERROR', message: err.message });
    }
});
