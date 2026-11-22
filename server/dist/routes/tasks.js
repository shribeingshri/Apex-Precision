"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const audit_1 = require("../utils/audit");
exports.tasksRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
const TaskCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().optional(),
    projectId: zod_1.z.string().uuid().optional().nullable(),
    assignedEmployeeId: zod_1.z.string().uuid().optional().nullable(),
    priority: zod_1.z.nativeEnum(client_1.TaskPriority).default(client_1.TaskPriority.MEDIUM),
    startDate: zod_1.z.string().optional().nullable(),
    deadline: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(client_1.TaskStatus).default(client_1.TaskStatus.TODO),
    progress: zod_1.z.number().int().min(0).max(100).default(0),
});
exports.tasksRouter.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status, projectId, assignedEmployeeId } = req.query;
        const where = {};
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        if (projectId && typeof projectId === 'string')
            where.projectId = projectId;
        if (assignedEmployeeId && typeof assignedEmployeeId === 'string') {
            where.assignedEmployeeId = assignedEmployeeId;
        }
        const tasks = await db_1.prisma.task.findMany({
            where,
            include: {
                project: { select: { id: true, projectCode: true, name: true } },
                assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
                createdBy: { select: { id: true, fullName: true } },
                _count: { select: { comments: true } },
            },
            orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
        });
        res.json(tasks);
    }
    catch (err) {
        res.status(500).json({ error: 'TASKS_FETCH_ERROR', message: err.message });
    }
});
exports.tasksRouter.post('/', auth_1.authenticateToken, (0, auth_1.requirePermission)('MANAGE_TASKS'), async (req, res) => {
    try {
        const data = TaskCreateSchema.parse(req.body);
        const count = await db_1.prisma.task.count();
        const taskCode = `TSK-${String(count + 1).padStart(4, '0')}`;
        const task = await db_1.prisma.task.create({
            data: {
                taskCode,
                title: data.title,
                description: data.description,
                projectId: data.projectId,
                assignedEmployeeId: data.assignedEmployeeId,
                priority: data.priority,
                startDate: data.startDate ? new Date(data.startDate) : null,
                deadline: data.deadline ? new Date(data.deadline) : null,
                status: data.status,
                progress: data.progress,
                createdById: req.user.id,
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'CREATE_TASK',
            entity: 'Task',
            entityId: task.id,
            details: `Created task ${task.taskCode}: ${task.title}`,
            ipAddress: req.ip,
        });
        res.status(201).json(task);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
            return;
        }
        res.status(500).json({ error: 'TASK_CREATE_ERROR', message: err.message });
    }
});
async function handleTaskStatusUpdate(req, res) {
    try {
        const id = getParamId(req);
        const { status, progress } = req.body;
        const task = await db_1.prisma.task.update({
            where: { id },
            data: {
                status: status,
                progress: progress !== undefined ? Number(progress) : (status === 'COMPLETED' ? 100 : undefined),
            },
        });
        await (0, audit_1.logActivity)({
            userId: req.user.id,
            userName: req.user.fullName,
            action: 'UPDATE_TASK_STATUS',
            entity: 'Task',
            entityId: task.id,
            details: `Updated task ${task.taskCode} status to ${task.status} (${task.progress}%)`,
            ipAddress: req.ip,
        });
        res.json(task);
    }
    catch (err) {
        res.status(500).json({ error: 'TASK_STATUS_ERROR', message: err.message });
    }
}
exports.tasksRouter.put('/:id/status', auth_1.authenticateToken, handleTaskStatusUpdate);
exports.tasksRouter.patch('/:id/status', auth_1.authenticateToken, handleTaskStatusUpdate);
