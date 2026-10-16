import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, UserX, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/common/Avatar';
import { UserStatusBadge, RoleBadge } from '../../components/common/Badges';
import { EmptyState } from '../../components/common/EmptyState';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { UserDetailModal } from './UserDetailModal';
import type { Role, User, UserStatus } from '../../types';
import { getRoleLabel, getUserStatusLabel, canManageUser, canCreateUsers } from '../../utils/roleUtils';
import { formatDate } from '../../utils/dateUtils';
import { toast } from 'sonner';

type SortField = 'name' | 'employeeId' | 'role' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

export const UsersPage: React.FC = () => {
  const { users, deactivateUser, activateUser, resendInvitation } = useAppStore();
  const { currentUser } = useAuthStore();

  // User-management hierarchy (roleUtils): Admin manages every role,
  // PM manages Team Leaders & Members, TL manages Members, Member manages none.
  const actorRole = currentUser?.role;
  const canCreate = canCreateUsers(actorRole);
  const canEditUser = (target: User) => canManageUser(actorRole, target.role);

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ACTIVE');
  const [authFilter, setAuthFilter] = useState<'ALL' | 'SSO' | 'PASSWORD'>('ALL');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ type: string; userId: string; userName: string } | null>(null);

  const hasFilters = search || roleFilter !== 'ALL' || statusFilter !== 'ACTIVE' || authFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ACTIVE');
    setAuthFilter('ALL');
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#1a73e8]" />
      : <ArrowDown className="w-3 h-3 text-[#1a73e8]" />;
  };

  const filtered = useMemo(() => {
    let result = users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.employeeId.toLowerCase().includes(q);
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;
      const isSSO = u.authProvider && u.authProvider !== 'PASSWORD';
      const matchAuth =
        authFilter === 'ALL' ||
        (authFilter === 'SSO' && isSSO) ||
        (authFilter === 'PASSWORD' && !isSSO);
      return matchSearch && matchRole && matchStatus && matchAuth;
    });
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'employeeId': cmp = a.employeeId.localeCompare(b.employeeId); break;
        case 'role': cmp = a.role.localeCompare(b.role); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [users, search, roleFilter, statusFilter, authFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const roles: (Role | 'ALL')[] = ['ALL', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'MEMBER'];
  const statuses: (UserStatus | 'ALL')[] = ['ALL', 'ACTIVE', 'INVITATION_PENDING', 'INACTIVE'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} total users · {users.filter(u=>u.status==='ACTIVE').length} active</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or employee ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as Role | 'ALL'); setPage(1); }}
          className="select w-auto"
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r === 'ALL' ? 'All Roles' : getRoleLabel(r as Role)}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as UserStatus | 'ALL'); setPage(1); }}
          className="select w-auto"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : getUserStatusLabel(s as UserStatus)}</option>
          ))}
        </select>
        <select
          value={authFilter}
          onChange={(e) => { setAuthFilter(e.target.value as 'ALL' | 'SSO' | 'PASSWORD'); setPage(1); }}
          className="select w-auto"
        >
          <option value="ALL">All Auth Methods</option>
          <option value="SSO">SSO Only (Federated)</option>
          <option value="PASSWORD">Password Only</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="btn-ghost btn-sm text-[#1a73e8] flex items-center gap-1 whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try adjusting your search or filters"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th
                      className="text-left text-xs font-semibold text-slate-500 px-4 py-3 cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => handleSort('name')}
                    >
                      <span className="flex items-center gap-1">User <SortIcon field="name" /></span>
                    </th>
                    <th
                      className="text-left text-xs font-semibold text-slate-500 px-4 py-3 cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => handleSort('employeeId')}
                    >
                      <span className="flex items-center gap-1">Employee ID <SortIcon field="employeeId" /></span>
                    </th>
                    <th
                      className="text-left text-xs font-semibold text-slate-500 px-4 py-3 cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => handleSort('role')}
                    >
                      <span className="flex items-center gap-1">Role <SortIcon field="role" /></span>
                    </th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Auth Method</th>
                    <th
                      className="text-left text-xs font-semibold text-slate-500 px-4 py-3 cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                    </th>
                    <th
                      className="text-left text-xs font-semibold text-slate-500 px-4 py-3 cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => handleSort('createdAt')}
                    >
                      <span className="flex items-center gap-1">Joined <SortIcon field="createdAt" /></span>
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setViewingUser(user)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} color={user.avatarColor} size="sm" />
                          <div>
                            <div className="text-sm font-medium text-slate-800">{user.name}</div>
                            <div className="text-xs text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{user.employeeId}</code>
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                      <td className="px-4 py-3">
                        {user.authProvider === 'GOOGLE' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Google SSO
                          </span>
                        )}
                        {user.authProvider === 'MICROSOFT' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            Microsoft SSO
                          </span>
                        )}
                        {(user.authProvider === 'OKTA' || user.authProvider === 'SAML') && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            Okta SAML
                          </span>
                        )}
                        {(!user.authProvider || user.authProvider === 'PASSWORD') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                            Password
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><UserStatusBadge status={user.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        {canEditUser(user) && (
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-ghost btn-sm text-slate-500"
                            onClick={() => setEditingUser(user)}
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user.status === 'INVITATION_PENDING' && (
                            <button
                              className="btn-ghost btn-sm text-amber-700"
                              onClick={() => { resendInvitation(user.id); toast.success('Invitation resent'); }}
                              title="Resend Invitation"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {user.status === 'ACTIVE' ? (
                            <button
                              className="btn-ghost btn-sm text-red-600"
                              onClick={() => setConfirmAction({ type: 'deactivate', userId: user.id, userName: user.name })}
                              title="Deactivate"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : user.status === 'INACTIVE' ? (
                            <button
                              className="btn-ghost btn-sm text-emerald-600"
                              onClick={() => setConfirmAction({ type: 'activate', userId: user.id, userName: user.name })}
                              title="Activate"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} users
                </span>
                <div className="flex items-center gap-1">
                  <button
                    className="btn-ghost btn-sm px-2"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      className={`btn-ghost btn-sm px-2.5 text-xs font-semibold ${p === safePage ? 'bg-[#e8f0fe] text-[#0b57d0]' : 'text-slate-500'}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className="btn-ghost btn-sm px-2"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />}
      {viewingUser && <UserDetailModal user={viewingUser} onClose={() => setViewingUser(null)} />}

      <ConfirmDialog
        isOpen={confirmAction?.type === 'deactivate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            deactivateUser(confirmAction.userId);
            toast.success(`${confirmAction.userName} deactivated`);
          }
          setConfirmAction(null);
        }}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${confirmAction?.userName}? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        danger
      />
      <ConfirmDialog
        isOpen={confirmAction?.type === 'activate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            activateUser(confirmAction.userId);
            toast.success(`${confirmAction.userName} activated`);
          }
          setConfirmAction(null);
        }}
        title="Activate User"
        message={`Are you sure you want to activate ${confirmAction?.userName}?`}
        confirmLabel="Activate"
      />
    </div>
  );
};
