import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Task, Project, Employee } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatDate } from '../utils/format';
import { CheckSquare, Plus, Clock, User, AlertCircle, RefreshCw } from 'lucide-react';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: 'Calibrate CNC Milling Spindles for High Tolerance Batch',
    description: 'Ensure micrometer variance is under 0.02mm before mass production',
    projectId: '',
    assignedEmployeeId: '',
    priority: 'HIGH',
    deadline: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [taskList, projs, emps] = await Promise.all([
        apiRequest<Task[]>('/api/tasks'),
        apiRequest<Project[]>('/api/projects'),
        apiRequest<Employee[]>('/api/employees'),
      ]);
      setTasks(taskList);
      setProjects(projs);
      setEmployees(emps);
      if (projs.length > 0 && !formData.projectId) {
        setFormData((prev) => ({
          ...prev,
          projectId: projs[0].id,
          assignedEmployeeId: emps[0]?.id || '',
        }));
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

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Task assigned successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create task');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await apiRequest(`/api/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update task status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workload & Task Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Operational milestones, engineering work orders, and deadline tracking
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Create Work Order / Task
        </button>
      </div>

      {/* Tasks Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Task / Project</th>
                <th className="px-6 py-3.5">Assigned Engineer</th>
                <th className="px-6 py-3.5">Priority</th>
                <th className="px-6 py-3.5">Deadline</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Loading task queue...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No active tasks assigned.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{task.title}</div>
                      <div className="text-xs text-sky-400">{task.project?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="font-medium text-slate-200">{task.assignedEmployee?.name || 'Unassigned'}</div>
                      <div className="text-slate-500">{task.assignedEmployee?.designation}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'danger' : 'default'}>
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {formatDate(task.deadline)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={task.status}
                        onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded px-2.5 py-1 focus:outline-none"
                      >
                        <option value="TO_DO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="UNDER_REVIEW">Under Review</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Assign Work Order / Task"
        subtitle="Link deliverables directly to project timelines"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Project Link *</label>
              <select
                required
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} &bull; {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Assign Engineer</label>
              <select
                value={formData.assignedEmployeeId}
                onChange={(e) => setFormData({ ...formData, assignedEmployeeId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.designation})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Deadline *</label>
              <input
                type="date"
                required
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-sm font-semibold transition"
            >
              Assign Work Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

