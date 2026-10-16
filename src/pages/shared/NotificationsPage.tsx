import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, Mail, FolderKanban, CheckSquare, RefreshCw, Bug,
  AlertTriangle, CalendarRange, Users, Shield, Clock, Filter,
  Settings, MessageSquare
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { formatTimeAgo } from '../../utils/dateUtils';
import { toUrlId, matchId, getProjectUrl } from '../../utils/idUtils';
import { issuePath } from '../../utils/issueUrl';
import { EmptyState } from '../../components/common/EmptyState';
import type { NotificationType } from '../../types';

const notifIcon: Record<NotificationType, React.ElementType> = {
  INVITATION: Mail,
  PROJECT_ASSIGNED: FolderKanban,
  TEAM_ASSIGNED: Users,
  TASK_ASSIGNED: CheckSquare,
  TASK_STATUS_CHANGED: RefreshCw,
  STAGE_CHANGED: RefreshCw,
  SPRINT_STARTED: CalendarRange,
  SPRINT_COMPLETED: CheckSquare,
  BUG_REPORTED: Bug,
  BUG_ASSIGNED: Bug,
  RETEST_REQUIRED: AlertTriangle,
  TASK_DUE_SOON: Clock,
  TASK_OVERDUE: AlertTriangle,
};

const notifColor: Record<NotificationType, string> = {
  INVITATION: 'text-amber-600 bg-amber-50',
  PROJECT_ASSIGNED: 'text-blue-600 bg-blue-50',
  TEAM_ASSIGNED: 'text-indigo-600 bg-indigo-50',
  TASK_ASSIGNED: 'text-blue-600 bg-blue-50',
  TASK_STATUS_CHANGED: 'text-purple-600 bg-purple-50',
  STAGE_CHANGED: 'text-purple-600 bg-purple-50',
  SPRINT_STARTED: 'text-green-600 bg-green-50',
  SPRINT_COMPLETED: 'text-green-600 bg-green-50',
  BUG_REPORTED: 'text-red-600 bg-red-50',
  BUG_ASSIGNED: 'text-red-600 bg-red-50',
  RETEST_REQUIRED: 'text-orange-600 bg-orange-50',
  TASK_DUE_SOON: 'text-amber-600 bg-amber-50',
  TASK_OVERDUE: 'text-red-600 bg-red-50',
};

const notifPriority: Record<NotificationType, 'high' | 'medium' | 'low'> = {
  TASK_OVERDUE: 'high',
  BUG_REPORTED: 'high',
  BUG_ASSIGNED: 'high',
  RETEST_REQUIRED: 'high',
  TASK_DUE_SOON: 'medium',
  SPRINT_STARTED: 'medium',
  SPRINT_COMPLETED: 'medium',
  TASK_ASSIGNED: 'medium',
  TASK_STATUS_CHANGED: 'low',
  STAGE_CHANGED: 'low',
  PROJECT_ASSIGNED: 'medium',
  TEAM_ASSIGNED: 'medium',
  INVITATION: 'low',
};

const getNavigationPath = (entityType?: string, entityId?: string, projects?: any[], role?: string): string | null => {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case 'TASK':
    case 'BUG':
      return issuePath(entityId);
    case 'PROJECT': {
      const proj = projects?.find((p) => matchId(p.id, entityId));
      return proj ? getProjectUrl(proj, role) : `/pm/projects/${toUrlId(entityId)}`;
    }
    case 'SPRINT': {
      const proj = projects?.find((p) => matchId(p.id, entityId));
      return proj ? `${getProjectUrl(proj, role)}/iterations` : `/pm/projects/${toUrlId(entityId)}/iterations`;
    }
    case 'USER':
      return `/admin/users`;
    default:
      return null;
  }
};

const DEFAULT_PREFS: Record<NotificationType, boolean> = {
  INVITATION: true,
  PROJECT_ASSIGNED: true,
  TEAM_ASSIGNED: true,
  TASK_ASSIGNED: true,
  TASK_STATUS_CHANGED: true,
  STAGE_CHANGED: true,
  SPRINT_STARTED: true,
  SPRINT_COMPLETED: true,
  BUG_REPORTED: true,
  BUG_ASSIGNED: true,
  RETEST_REQUIRED: true,
  TASK_DUE_SOON: true,
  TASK_OVERDUE: true,
};

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { notifications, projects, markNotificationRead, markAllNotificationsRead } = useAppStore();
  const [filterType, setFilterType] = useState<string>('');
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(() => {
    try {
      const saved = localStorage.getItem('notif_prefs');
      return saved ? JSON.parse(saved) : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const savePrefs = (newPrefs: Record<NotificationType, boolean>) => {
    setPrefs(newPrefs);
    localStorage.setItem('notif_prefs', JSON.stringify(newPrefs));
  };

  const userNotifs = notifications.filter((n) => n.userId === currentUser?.id);
  const unreadCount = userNotifs.filter((n) => !n.read).length;

  const filteredNotifs = userNotifs.filter((notif) => {
    if (filterType && notif.type !== filterType) return false;
    if (filterRead === 'unread' && notif.read) return false;
    if (filterRead === 'read' && !notif.read) return false;
    if (!prefs[notif.type]) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Stay updated on project assignments, task changes, and bugs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary btn-sm"
            onClick={() => setShowPrefs(!showPrefs)}
          >
            <Settings className="w-4 h-4" /> Preferences
          </button>
          {unreadCount > 0 && (
            <button
              className="btn-secondary btn-sm"
              onClick={() => currentUser && markAllNotificationsRead(currentUser.id)}
            >
              <Check className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notification Preferences */}
      {showPrefs && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Notification Preferences
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(Object.keys(prefs) as NotificationType[]).map((type) => {
              const Icon = notifIcon[type] || Bell;
              return (
                <label key={type} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${prefs[type] ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <input
                    type="checkbox"
                    checked={prefs[type]}
                    onChange={(e) => savePrefs({ ...prefs, [type]: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Icon className={`w-4 h-4 ${notifColor[type]?.split(' ')[0] || 'text-slate-500'}`} />
                  <span className="text-xs font-medium text-slate-700">{type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#747775]" />
          <span className="text-xs font-bold text-[#747775]">Filter:</span>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="select text-xs py-1.5"
        >
          <option value="">All Types</option>
          <option value="TASK_ASSIGNED">Task Assigned</option>
          <option value="TASK_OVERDUE">Task Overdue</option>
          <option value="TASK_DUE_SOON">Task Due Soon</option>
          <option value="SPRINT_STARTED">Iteration Started</option>
          <option value="SPRINT_COMPLETED">Iteration Completed</option>
          <option value="BUG_REPORTED">Bug Reported</option>
          <option value="BUG_ASSIGNED">Bug Assigned</option>
          <option value="PROJECT_ASSIGNED">Project Assigned</option>
          <option value="RETEST_REQUIRED">Retest Required</option>
          <option value="TASK_STATUS_CHANGED">Status Changed</option>
        </select>
        <select
          value={filterRead}
          onChange={(e) => setFilterRead(e.target.value as 'all' | 'unread' | 'read')}
          className="select text-xs py-1.5"
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <span className="text-xs text-[#747775]">
          {filteredNotifs.length} notification{filteredNotifs.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {filteredNotifs.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
        ) : (
          filteredNotifs.map((notif) => {
            const Icon = notifIcon[notif.type] || Bell;
            const colorCls = notifColor[notif.type] || 'text-slate-600 bg-slate-50';
            const priority = notifPriority[notif.type] || 'low';
            const navPath = getNavigationPath(notif.relatedEntityType, notif.relatedEntityId, projects, currentUser?.role);

            return (
              <div
                key={notif.id}
                className={`p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                  !notif.read ? 'bg-brand-50/40 font-medium' : 'hover:bg-slate-50'
                }`}
                onClick={() => {
                  markNotificationRead(notif.id);
                  if (navPath) navigate(navPath);
                }}
              >
                {!notif.read && <div className="w-2.5 h-2.5 rounded-full bg-brand-600 flex-shrink-0 mt-1.5" />}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{notif.title}</span>
                    {priority === 'high' && (
                      <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">High</span>
                    )}
                    {notif.type.includes('MENTION') || notif.type === 'TASK_STATUS_CHANGED' ? (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <MessageSquare className="w-2.5 h-2.5" /> Comment
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{notif.message}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400">{formatTimeAgo(notif.createdAt)}</span>
                    {navPath && (
                      <span className="text-[10px] text-[#1a73e8] font-semibold hover:underline">View Details →</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
