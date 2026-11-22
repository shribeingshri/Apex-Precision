import { Router, Request, Response } from 'express';
import { prisma } from '../utils/db';
import { authenticateToken } from '../middleware/auth';

export const messagesRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

messagesRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = await prisma.message.findMany({
      include: {
        conversation: {
          include: {
            client: { select: { id: true, companyName: true, clientCode: true } },
            project: { select: { id: true, name: true, projectCode: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      sender: m.senderName,
      recipient: m.conversation?.client?.companyName || m.conversation?.title || 'Operations Team',
      content: m.content,
      timestamp: m.createdAt,
      isInternal: m.isInternal,
      client: m.conversation?.client || null,
      project: m.conversation?.project || null,
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: 'MESSAGES_FETCH_ERROR', message: err.message });
  }
});

messagesRouter.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipient, content, clientId, projectId, isInternal } = req.body;
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Message content is required.' });
      return;
    }

    const message = await prisma.$transaction(async (tx) => {
      let conversation = await tx.conversation.findFirst({
        where: {
          ...(clientId ? { clientId } : {}),
          ...(projectId ? { projectId } : {}),
        },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            title: recipient || 'General Communication',
            clientId: clientId || null,
            projectId: projectId || null,
          },
        });
      }

      const msg = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: req.user!.id,
          senderName: `${req.user!.fullName} (${req.user!.role})`,
          content,
          isInternal: Boolean(isInternal),
        },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return msg;
    });

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: 'MESSAGE_SEND_ERROR', message: err.message });
  }
});

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
