import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { User } from '../../types';
import { Avatar } from './Avatar';
import { RoleBadge } from './Badges';

interface SearchableUserSelectProps {
  users: User[];
  value?: string;
  onChange: (userId: string, user: User) => void;
  placeholder?: string;
  label?: string;
  filterRole?: User['role'][];
  filterTeamId?: string;
  filterIds?: string[];
  disabled?: boolean;
  className?: string;
}

export const SearchableUserSelect: React.FC<SearchableUserSelectProps> = ({
  users,
  value,
  onChange,
  placeholder = 'Search by name, email, or ID...',
  label,
  filterRole,
  filterTeamId,
  filterIds,
  disabled = false,
  className = '',
}) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = users
    .filter((u) => u.status === 'ACTIVE')
    .filter((u) => !filterRole || filterRole.includes(u.role))
    .filter((u) => !filterTeamId || u.teamId === filterTeamId)
    .filter((u) => !filterIds || filterIds.includes(u.id))
    .filter((u) => {
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.employeeId.toLowerCase().includes(q)
      );
    });

  const selectedUser = users.find((u) => u.id === value);

  return (
    <div className={`relative ${className}`}>
      {label && <label className="input-label">{label}</label>}

      {selectedUser && !open ? (
        <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white">
          <Avatar name={selectedUser.name} color={selectedUser.avatarColor} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800">{selectedUser.name}</div>
            <div className="text-xs text-slate-500">{selectedUser.employeeId} · {selectedUser.email}</div>
          </div>
          {!disabled && (
            <button
              className="text-slate-400 hover:text-slate-600"
              onClick={() => { onChange('', selectedUser); setSearch(''); }}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            className="input pl-9"
            disabled={disabled}
          />
        </div>
      )}

      {open && !selectedUser && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-modal overflow-hidden animate-scale-in">
          <div className="max-h-60 overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">No users found</div>
            ) : (
              filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                  onMouseDown={() => { onChange(user.id, user); setSearch(''); setOpen(false); }}
                >
                  <Avatar name={user.name} color={user.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.employeeId} · {user.email}</div>
                  </div>
                  <RoleBadge role={user.role} />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
