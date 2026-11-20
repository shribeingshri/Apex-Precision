import { Router, Request, Response } from 'express';
import { prisma } from '../utils/db';
import { authenticateToken } from '../middleware/auth';

export const messagesRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

messagesRouter.get('/conversations', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const conversations = await prisma.conversation.findMany({
      include: {
        client: { select: { id: true, companyName: true, clientCode: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(conversations);
  } catch (err: any) {
    res.status(500).json({ error: 'CONVERSATIONS_FETCH_ERROR', message: err.message });
  }
});

messagesRouter.get('/conversations/:id/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: 'MESSAGES_FETCH_ERROR', message: err.message });
  }
});

messagesRouter.post('/conversations/:id/messages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParamId(req);
    const { content, isInternal } = req.body;
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Message content is required.' });
      return;
    }

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: id,
          senderId: req.user!.id,
          senderName: `${req.user!.fullName} (${req.user!.role})`,
          content,
          isInternal: Boolean(isInternal),
        },
      });

      await tx.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return msg;
    });

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: 'MESSAGE_SEND_ERROR', message: err.message });
  }
});
