import { Router, Request, Response } from 'express';
import { prisma } from '../utils/db';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';
import { logActivity } from '../utils/audit';

export const settingsRouter = Router();

settingsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
    const configMap: Record<string, any> = {};
    for (const s of settings) {
      configMap[s.key] = s.value === 'true' ? true : s.value === 'false' ? false : !isNaN(Number(s.value)) && s.value.trim() !== '' ? Number(s.value) : s.value;
    }
    res.json(configMap);
  } catch (err: any) {
    res.status(500).json({ error: 'SETTINGS_ERROR', message: err.message });
  }
});

settingsRouter.post('/', authenticateToken, requireRole([Role.SUPER_ADMIN, Role.MANAGEMENT]), async (req: Request, res: Response): Promise<void> => {
  try {
    const entries = Object.entries(req.body || {});
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'UPDATE_SETTINGS',
      entity: 'SystemSetting',
      entityId: 'GLOBAL',
      details: `Updated ${entries.length} system configuration settings`,
      ipAddress: req.ip,
    });

    res.json({ success: true, updated: entries.length });
  } catch (err: any) {
    res.status(500).json({ error: 'SETTING_UPDATE_ERROR', message: err.message });
  }
});

settingsRouter.put('/:key', authenticateToken, requireRole([Role.SUPER_ADMIN, Role.MANAGEMENT]), async (req: Request, res: Response): Promise<void> => {
  try {
    const { value, description } = req.body;
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });

    await logActivity({
      userId: req.user!.id,
      userName: req.user!.fullName,
      action: 'UPDATE_SETTING',
      entity: 'SystemSetting',
      entityId: key,
      details: `Updated system setting ${key} to ${value}`,
      ipAddress: req.ip,
    });

    res.json(setting);
  } catch (err: any) {
    res.status(500).json({ error: 'SETTING_UPDATE_ERROR', message: err.message });
  }
});
