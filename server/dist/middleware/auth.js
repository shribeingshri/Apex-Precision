"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../utils/db");
const rbac_1 = require("../utils/rbac");
const JWT_SECRET = process.env.JWT_SECRET || 'manufacturing_erp_enterprise_jwt_super_secret_key_2026';
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication token required.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await db_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true,
                employeeId: true,
            },
        });
        if (!user || !user.isActive) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'User account is inactive or not found.' });
            return;
        }
        req.user = user;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid or expired authentication token.' });
    }
}
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                error: 'ACCESS_DENIED',
                message: `Action requires one of the following roles: ${roles.join(', ')}`,
            });
            return;
        }
        next();
    };
}
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
            return;
        }
        if (!(0, rbac_1.hasPermission)(req.user.role, permission)) {
            res.status(403).json({
                error: 'FORBIDDEN',
                message: `Role ${req.user.role} lacks the required permission: ${permission}`,
            });
            return;
        }
        next();
    };
}
