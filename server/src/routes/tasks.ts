import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const tasksRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

const TaskCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  projectId: z.string().uuid().optional().nullable(),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  startDate: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  progress: z.number().int().min(0).max(100).default(0),
});

tasksRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, projectId, assignedEmployeeId } = req.query;
    const where: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status as TaskStatus;
    }
    if (projectId && typeof projectId === 'string') where.projectId = projectId;
    if (assignedEmployeeId && typeof assignedEmployeeId === 'string') {
      where.assignedEmployeeId = assignedEmployeeId;
    }

    const tasks = await prisma.task.findMany({
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
  } catch (err: any) {
    res.status(500).json({ error: 'TASKS_FETCH_ERROR', message: err.message });
  }
});

tasksRouter.post('/', authenticateToken, requirePermission('MANAGE_TASKS'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = TaskCreateSchema.parse(req.body);
    const count = await prisma.task.count();
    const taskCode = `TSK-${String(count + 1).padStart(4, '0')}`;

    const task = await prisma.task.create({
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
        createdById: req.user!.id,
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CREATE_TASK',
      entity: 'Task',
      entityId: task.id,
      details: `Created task ${task.taskCode}: ${task.title}`,
      ipAddress: req.ip,
    });

    res.status(201).json(task);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'TASK_CREATE_ERROR', message: err.message });
  }
});

tasksRouter.put('/:id/status', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const { status, progress } = req.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: status as TaskStatus,
        progress: progress !== undefined ? Number(progress) : (status === 'COMPLETED' ? 100 : undefined),
      },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'UPDATE_TASK_STATUS',
      entity: 'Task',
      entityId: task.id,
      details: `Updated task ${task.taskCode} status to ${task.status} (${task.progress}%)`,
      ipAddress: req.ip,
    });

    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: 'TASK_STATUS_ERROR', message: err.message });
  }
});
