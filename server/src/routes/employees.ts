import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { logActivity } from '../utils/audit';

export const employeesRouter = Router();

const EmployeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  departmentId: z.string().uuid(),
  designation: z.string().min(2),
  managerId: z.string().uuid().optional().nullable(),
  joiningDate: z.string(),
  basicSalary: z.number().nonnegative().optional(),
});

employeesRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { departmentId, search } = req.query;
    const where: any = {};

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

    const employees = await prisma.employee.findMany({
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
    const canViewSalary = ['SUPER_ADMIN', 'MANAGEMENT', 'FINANCE_MANAGER'].includes(req.user!.role);
    const sanitized = employees.map((emp) => ({
      ...emp,
      basicSalary: canViewSalary ? emp.basicSalary : undefined,
      activeTasksCount: emp._count.tasks,
      activeProjectsCount: emp._count.projectAssignments,
    }));

    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: 'EMPLOYEES_FETCH_ERROR', message: err.message });
  }
});

employeesRouter.get('/departments', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  } catch (err: any) {
    res.status(500).json({ error: 'DEPARTMENTS_ERROR', message: err.message });
  }
});

employeesRouter.post('/', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = EmployeeSchema.parse(req.body);
    const count = await prisma.employee.count();
    const employeeCode = `EMP-${String(count + 1).padStart(3, '0')}`;

    const newEmp = await prisma.employee.create({
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

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'CREATE_EMPLOYEE',
      entity: 'Employee',
      entityId: newEmp.id,
      details: `Created employee record ${newEmp.employeeCode} (${newEmp.name})`,
      ipAddress: req.ip,
    });

    res.status(201).json(newEmp);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'EMPLOYEE_CREATE_ERROR', message: err.message });
  }
});

