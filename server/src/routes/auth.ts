import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/db';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';
import { ROLE_PERMISSIONS } from '../utils/rbac';
import { logActivity } from '../utils/audit';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'manufacturing_erp_enterprise_jwt_super_secret_key_2026';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    await logActivity({
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
        permissions: ROLE_PERMISSIONS[user.role],
        employee: user.employee,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required.' });
      return;
    }
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

authRouter.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
        permissions: ROLE_PERMISSIONS[user.role],
        employee: user.employee,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

authRouter.get('/users', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
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
  } catch (err: any) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

