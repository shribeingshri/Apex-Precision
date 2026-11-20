"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const db_1 = require("./db");
async function logActivity(params) {
    try {
        await db_1.prisma.activityLog.create({
            data: {
                userId: params.userId,
                userName: params.userName,
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                details: params.details,
                ipAddress: params.ipAddress,
            },
        });
    }
    catch (err) {
        console.error('Failed to write activity log:', err);
    }
}
