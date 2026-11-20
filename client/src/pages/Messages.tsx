import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Message, Client, Project } from '../types';
import { formatDateTime } from '../utils/format';
import { MessageSquare, Send, User, Building2, Briefcase, RefreshCw } from 'lucide-react';

export const Messages: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New message form
  const [content, setContent] = useState('');
  const [recipient, setRecipient] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [msgList, cls, projs] = await Promise.all([
        apiRequest<Message[]>('/api/messages'),
        apiRequest<Client[]>('/api/clients'),
        apiRequest<Project[]>('/api/projects'),
      ]);
      setMessages(msgList);
      setClients(cls);
      setProjects(projs);
      if (cls.length > 0 && !recipient) {
        setRecipient(cls[0].companyName);
        setClientId(cls[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipient,
          content,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
          isInternal: false,
        }),
      });
      setContent('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Client & Operational Communications</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Threaded stakeholder messages linked to manufacturing orders & supply chain partners
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-sm transition flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-sky-400" /> Refresh Feed
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Feed */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[600px] shadow-sm">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {isLoading ? (
              <div className="py-20 text-center text-slate-500">Loading conversation history...</div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center text-slate-500">No communication logs recorded yet.</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{msg.sender}</span>
                      <span className="text-slate-500">&rarr;</span>
                      <span className="font-semibold text-sky-400">{msg.recipient}</span>
                    </div>
                    <span className="text-slate-500 text-[11px]">{formatDateTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.content}</p>
                  {(msg.client || msg.project) && (
                    <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3 text-[11px] text-slate-400">
                      {msg.client && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500" /> {msg.client.companyName}
                        </span>
                      )}
                      {msg.project && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-slate-500" /> {msg.project.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSendMessage} className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Type dispatch notice or technical coordination note..."
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        </div>

        {/* Message Context & Targeting */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Target Stakeholder</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Select Client</label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  const cl = clients.find((c) => c.id === e.target.value);
                  if (cl) setRecipient(cl.companyName);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:border-sky-500 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.contactPerson})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Related Manufacturing Order</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:border-sky-500 focus:outline-none"
              >
                <option value="">No Direct Project Tag</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} &bull; {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200">Integration Boundary Notice</div>
              <p>
                All communications sent here are permanently logged into the immutable activity audit log and client timeline.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
