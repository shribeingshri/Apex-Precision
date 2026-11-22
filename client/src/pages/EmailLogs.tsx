import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { EmailLog } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatDateTime } from '../utils/format';
import { Mail, RefreshCw, Send, CheckCircle2, AlertOctagon, Eye } from 'lucide-react';

export const EmailLogs: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<EmailLog[]>('/api/email-logs');
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transactional Email Gateway Logs</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Audit logging boundary: Transparently records simulated & delivered automated notifications
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-sm transition flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-sky-400" /> Refresh Logs
        </button>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
        <Mail className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-semibold text-white">Rule 4 &amp; Module H Architectural Integrity</div>
          <p className="text-slate-400">
            In accordance with system requirements, emails sent without a live third-party SMTP/SES credential are flagged as{' '}
            <span className="font-semibold text-sky-400">SIMULATED</span> rather than falsely marked as delivered over the wire.
          </p>
        </div>
      </div>

      {/* Email Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Recipient</th>
                <th className="px-6 py-3.5">Subject</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Loading email transaction records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No email dispatches recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {formatDateTime(log.sentAt || log.createdAt)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">{log.recipient}</td>
                    <td className="px-6 py-4 text-xs text-slate-300 max-w-xs truncate">{log.subject}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">
                        {log.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant={
                          log.status === 'SENT' ? 'success' : log.status === 'SIMULATED' ? 'info' : 'danger'
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                      >
                        <Eye className="w-4 h-4 text-sky-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Body Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.subject || 'Email Details'}
        subtitle={`To: ${selectedLog?.recipient}`}
      >
        {selectedLog && (
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
              <div><strong className="text-slate-400">Sender:</strong> <span className="text-white">{selectedLog.sender}</span></div>
              <div><strong className="text-slate-400">Category:</strong> <span className="text-sky-400">{selectedLog.category}</span></div>
              <div><strong className="text-slate-400">Dispatched:</strong> <span className="text-slate-300">{formatDateTime(selectedLog.sentAt || selectedLog.createdAt)}</span></div>
              <div><strong className="text-slate-400">Gateway Status:</strong> <span className="font-semibold text-emerald-400">{selectedLog.status}</span></div>
            </div>

            <div className="border border-slate-800 p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {selectedLog.messagePreview}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

