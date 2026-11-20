"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagesRouter = void 0;
const express_1 = require("express");
const db_1 = require("../utils/db");
const auth_1 = require("../middleware/auth");
exports.messagesRouter = (0, express_1.Router)();
function getParamId(req) {
    const { id } = req.params;
    return Array.isArray(id) ? id[0] : id;
}
exports.messagesRouter.get('/conversations', auth_1.authenticateToken, async (req, res) => {
    try {
        const conversations = await db_1.prisma.conversation.findMany({
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
    }
    catch (err) {
        res.status(500).json({ error: 'CONVERSATIONS_FETCH_ERROR', message: err.message });
    }
});
exports.messagesRouter.get('/conversations/:id/messages', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = getParamId(req);
        const messages = await db_1.prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
        });
        res.json(messages);
    }
    catch (err) {
        res.status(500).json({ error: 'MESSAGES_FETCH_ERROR', message: err.message });
    }
});
exports.messagesRouter.post('/conversations/:id/messages', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = getParamId(req);
        const { content, isInternal } = req.body;
        if (!content || typeof content !== 'string') {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Message content is required.' });
            return;
        }
        const message = await db_1.prisma.$transaction(async (tx) => {
            const msg = await tx.message.create({
                data: {
                    conversationId: id,
                    senderId: req.user.id,
                    senderName: `${req.user.fullName} (${req.user.role})`,
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
    }
    catch (err) {
        res.status(500).json({ error: 'MESSAGE_SEND_ERROR', message: err.message });
    }
});
