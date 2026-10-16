import React, { useState } from 'react';
import { Check, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import type { CustomFieldDefinition, CustomFieldValue, Task } from '../../types';
import {
  isCustomValueEmpty,
  getIssueCustomFields,
  customFieldValueForDraft,
  validateCustomFieldValues,
  effectiveCustomFieldValue,
  fieldLabel,
} from '../../utils/customFields';
import { IssueField } from './IssueField';
import { CustomFieldValueInput } from './CustomFieldValueInput';
import { CustomFieldFormModal } from './CustomFieldFormModal';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface CustomFieldTaskProps {
  task: Task;
}

/**
 * Role gate for custom fields (spec):
 *  - Admin + Project Manager: add / edit definition / delete definition.
 *  - Everyone (incl. Members): sees fields + values inside Details; value
 *    editing follows the issue's existing edit rights (manager, assignee,
 *    reporter). Fields are never role-specific once created.
 */
const useCustomFieldAccess = (task: Task) => {
  const { currentUser } = useAuthStore();
  const role = currentUser?.role;
  const canManage = role === 'ADMIN' || role === 'PROJECT_MANAGER';
  const canEditValues =
    canManage ||
    (!!currentUser && (currentUser.id === task.assigneeId || currentUser.id === task.createdById));
  return { canManage, canEditValues };
};

/** "Add Field" action rendered inside the Details card header (role-gated). */
export const CustomFieldHeaderAction: React.FC<CustomFieldTaskProps> = ({ task }) => {
  const { canManage } = useCustomFieldAccess(task);
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-[#99f6e4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#0d9488] hover:bg-[#f0fdfa] transition-colors"
        title="Add a custom field to this issue"
      >
        <Plus className="w-3 h-3" /> Add Field
      </button>
      <CustomFieldFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        projectId={task.projectId}
        taskId={task.id}
      />
    </>
  );
}

/**
 * Custom-field rows for the Details card: returns plain IssueField nodes
 * (text/chips/link/user cells with hover edit + menu) for the caller to merge
 * into the existing Details grid, plus the Edit/Delete overlays to render once
 * beside it. Saved fields are read-only rows — never permanent inputs.
 */
export function useCustomFieldRows(task: Task): {
  rows: React.ReactNode[];
  modals: React.ReactNode;
} {
  const { users, customFieldDefinitions, setTaskCustomFieldValue, deleteCustomField } =
    useAppStore();
  const { canManage, canEditValues } = useCustomFieldAccess(task);

  const stored: Record<string, CustomFieldValue | undefined> = task.customFieldValues ?? {};
  const hasStored = (field: CustomFieldDefinition): boolean => {
    const v = stored[field.id];
    return v !== undefined && !isCustomValueEmpty(field, v);
  };
  // Show enabled fields, plus disabled ones that still hold data for this issue.
  const rows = getIssueCustomFields(customFieldDefinitions, task).filter(
    (f) => f.enabled || hasStored(f)
  );

  const [editId, setEditId] = useState<string | null>(null);
  const [value, setValue] = useState<CustomFieldValue>('');
  const [error, setError] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editDef, setEditDef] = useState<CustomFieldDefinition | null>(null);
  const [deleteDef, setDeleteDef] = useState<CustomFieldDefinition | null>(null);

  if (rows.length === 0) return { rows: [], modals: null };

  const startEdit = (field: CustomFieldDefinition) => {
    setMenuId(null);
    setError('');
    setValue(
      customFieldValueForDraft({
        ...field,
        defaultValue: effectiveCustomFieldValue(field, stored),
      })
    );
    setEditId(field.id);
  };

  const saveEdit = (field: CustomFieldDefinition) => {
    const validationErrors = validateCustomFieldValues([field], { [field.id]: value });
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }
    setTaskCustomFieldValue(task.id, field.id, value);
    setEditId(null);
    setError('');
    toast.success(`${fieldLabel(field)} updated`);
  };

  const displayValue = (
    field: CustomFieldDefinition,
    raw: CustomFieldValue | undefined
  ): React.ReactNode => {
    if (raw === undefined) return undefined;
    // An explicit false is a real answer for checkboxes ("No"), not emptiness.
    if (field.type === 'checkbox') return raw === true ? 'Yes' : 'No';
    if (isCustomValueEmpty(field, raw)) return undefined;
    switch (field.type) {
      case 'multi_select':
        return (
          <span className="flex flex-wrap gap-1.5">
            {(raw as string[]).map((v) => (
              <span
                key={v}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#f1f5f9] border border-[#e2e8f0] text-[11px] font-semibold text-slate-600"
              >
                {v}
              </span>
            ))}
          </span>
        );
      case 'url':
        return (
          <a
            href={String(raw)}
            target="_blank"
            rel="noreferrer"
            className="text-[#0d9488] hover:underline break-all font-semibold"
          >
            {String(raw)}
          </a>
        );
      case 'user':
        return users.find((u) => u.id === raw)?.name ?? String(raw);
      default:
        return String(raw);
    }
  };

  const renderRow = (field: CustomFieldDefinition) => {
    const label = fieldLabel(field);

    if (editId === field.id) {
      return (
        <IssueField key={field.id} label={label}>
          <span className="flex flex-col items-start gap-1.5 w-full">
            <CustomFieldValueInput
              field={field}
              value={value}
              onChange={(v) => {
                setValue(v);
                setError('');
              }}
              users={users}
              autoFocus
            />
            {error && <span className="text-[11px] font-semibold text-red-500">{error}</span>}
            <span className="flex gap-1.5">
              <button
                type="button"
                onClick={() => saveEdit(field)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#0d9488] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0f766e]"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setError('');
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e2e5ea] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </span>
          </span>
        </IssueField>
      );
    }

    const content = displayValue(field, effectiveCustomFieldValue(field, stored));
    const editable = canEditValues && field.enabled;

    return (
      <IssueField key={field.id} label={label}>
        <span className="group/cf flex items-start gap-1 min-w-0">
          <span className="min-w-0 break-words flex-1">
            {content ?? <span className="text-slate-300 font-normal">&#8212;</span>}
          </span>
          {editable && (
            <button
              type="button"
              onClick={() => startEdit(field)}
              className="p-0.5 rounded text-slate-300 opacity-0 group-hover/cf:opacity-100 focus:opacity-100 hover:text-[#0d9488] hover:bg-slate-100 transition-opacity"
              title={`Edit ${label}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {canManage && (
            <span className="relative">
              <button
                type="button"
                onClick={() => setMenuId(menuId === field.id ? null : field.id)}
                className="p-0.5 rounded text-slate-300 opacity-0 group-hover/cf:opacity-100 focus:opacity-100 hover:text-slate-600 hover:bg-slate-100 transition-opacity"
                title="Field actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuId === field.id && (
                <>
                  <span
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuId(null)}
                    aria-hidden
                  />
                  <span className="absolute right-0 top-5 z-30 w-32 py-1 rounded-lg border border-[#e2e5ea] bg-white shadow-modal flex flex-col text-xs font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null);
                        setEditDef(field);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 hover:text-[#0d9488]"
                    >
                      <Pencil className="w-3 h-3" /> Edit Field
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null);
                        setDeleteDef(field);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-left hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" /> Delete Field
                    </button>
                  </span>
                </>
              )}
            </span>
          )}
        </span>
      </IssueField>
    );
  };

  return {
    rows: rows.map(renderRow),
    modals: (
      <div className="contents">
        <CustomFieldFormModal
          isOpen={editDef !== null}
          onClose={() => setEditDef(null)}
          projectId={task.projectId}
          existing={editDef}
        />

        <ConfirmDialog
          isOpen={deleteDef !== null}
          onClose={() => setDeleteDef(null)}
          onConfirm={() => {
            if (!deleteDef) return;
            deleteCustomField(deleteDef.id);
            toast.success(`"${fieldLabel(deleteDef)}" deleted`);
            setDeleteDef(null);
          }}
          title="Delete field?"
          message={
            deleteDef
              ? `"${fieldLabel(deleteDef)}" will be removed from this project's Details. Stored values are kept on work items but no longer displayed.`
              : ''
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
        />
      </div>
    ),
  };
}
