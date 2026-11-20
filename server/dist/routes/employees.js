"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../utils/audit");
exports.employeesRouter = (0, express_1.Router)();
const EmployeeSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(7),
    departmentId: zod_1.z.string().uuid(),
    designation: zod_1.z.string().min(2),
    managerId: zod_1.z.string().uuid().optional().nullable(),
    joiningDate: zod_1.z.string(),
    basicSalary: zod_1.z.number().nonnegative().optional(),
});
exports.employeesRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { departmentId, search } = req.query;
        const where = {};
        if (departmentId && typeof departmentId === 'string') {
            where.departmentId = departmentId;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { employeeCode: { contains: search, mode: 'insensitive' } },
                { designation: { contains: search, mode: 'insensitive' } },
            ];
        }
        const employees = await db_1.prisma.employee.findMany({
            where,
            include: {
                department: true,
                manager: { select: { id: true, name: true } },
                _count: {
                    select: {
                        tasks: { where: { status: { in: ['TODO', 'IN_PROGRESS'] } } },
                        projectAssignments: true,
                    },
                },
            },
            orderBy: { employeeCode: 'asc' },
        });
        // Hide basicSalary from non-privileged roles (Only SUPER_ADMIN, MANAGEMENT, FINANCE_MANAGER can view)
        const canViewSalary = ['SUPER_ADMIN', 'MANAGEMENT', 'FINANCE_MANAGER'].includes(req.user.role);
        const sanitized = employees.map((emp) => ({
            ...emp,
            basicSalary: canViewSalary ? emp.basicSalary : undefined,
            activeTasksCount: emp._count.tasks,
            activeProjectsCount: emp._count.projectAssignments,
        }));
        res.json(sanitized);
    }
    catch (err) {
        res.status(500).json({ error: 'EMPLOYEES_FETCH_ERROR', message: err.message });
    }
});
exports.employeesRouter.get('/departments', auth_1.authenticateToken, async (req, res) => {
    try {
        const departments = await db_1.prisma.department.findMany({
            include: {
                _count: { select: { employees: true } },
            },
            orderBy: { name: 'asc' },
        });
        res.json(departments);
    }
    catch (err) {
        res.status(500).json({ error: 'DEPARTMENTS_ERROR', message: err.message });
    }
});
exports.employeesRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_EMPLOYEES'), async (req, res) => {
    try {
        const data = EmployeeSchema.parse(req.body);
        const count = await db_1.prisma.employee.count();
        const employeeCode = `EMP-${String(count + 1).padStart(3, '0')}`;
        const newEmp = await db_1.prisma.employee.create({
            data: {
                employeeCode,
                name: data.name,
                email: data.email,
                phone: data.phone,
                departmentId: data.departmentId,
                designation: data.designation,
                managerId: data.managerId,
                joiningDate: new Date(data.joiningDate),
                basicSalary: data.basicSalary || 0,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_EMPLOYEE',
            entity: 'Employee',
            entityId: newEmp.id,
            details: `Created employee record ${newEmp.employeeCode} (${newEmp.name})`,
            ipAddress: req.ip,
        });
        res.status(201).json(newEmp);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'EMPLOYEE_CREATE_ERROR', message: err.message });
    }
});
