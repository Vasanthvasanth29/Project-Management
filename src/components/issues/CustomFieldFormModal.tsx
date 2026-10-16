import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import type { CustomFieldDefinition, CustomFieldType, CustomFieldValue } from '../../types';
import {
  customFieldTypeUsesOptions,
  validateCustomFieldValues,
} from '../../utils/customFields';
import { CustomFieldValueInput } from './CustomFieldValueInput';

interface CustomFieldFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  /** When set, the modal edits this existing definition instead of creating one. */
  existing?: CustomFieldDefinition | null;
  /** Issue receiving the initial value when a new field is created (Add Field). */
  taskId?: string;
}

/** Empty draft value for a freshly selected field type. */
const emptyDraftValue = (type: CustomFieldType): CustomFieldValue =>
  type === 'multi_select' ? [] : type === 'checkbox' ? false : '';

/** Field types offered by the "Add Field" action (labels per product spec). */
const ADD_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown / Select' },
  { value: 'date', label: 'Date' },
  { value: 'user', label: 'User / Assignee' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'long_text', label: 'Long Text' },
];

const INPUT_CLASS = 'input text-xs py-1.5 px-2.5';

/**
 * Compact Add Field / Edit Field modal attached to the Details card header
 * (Admin / Project Manager only). Add mode collects the field name and its
 * initial value — e.g. "Client Name" + "Vasanth" — and saves both in one go,
 * so the new field appears immediately as a normal read-only Details row.
 * Edit mode manages an existing definition's name, type and options.
 */
export const CustomFieldFormModal: React.FC<CustomFieldFormModalProps> = ({
  isOpen,
  onClose,
  projectId,
  existing,
  taskId,
}) => {
  const { currentUser } = useAuthStore();
  const { users, createCustomField, updateCustomField, setTaskCustomFieldValue } = useAppStore();

  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState<string[]>([]);
  const [value, setValue] = useState<CustomFieldValue>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setName(existing?.label ?? existing?.name ?? '');
    setType(existing?.type ?? 'text');
    setOptions(existing?.options ?? []);
    setValue(emptyDraftValue(existing?.type ?? 'text'));
  }, [isOpen, existing]);

  if (!isOpen) return null;

  const usesOptions = customFieldTypeUsesOptions(type);

  // Live definition used by the type-aware Field Value editor (create mode).
  const draftField: CustomFieldDefinition = {
    id: existing?.id ?? '__draft__',
    name: name.trim() || 'field',
    label: name.trim() || 'field',
    type,
    options: usesOptions ? options.map((o) => o.trim()).filter(Boolean) : [],
    required: false,
    enabled: true,
    projectId,
    applicableIssueTypes: [],
    createdBy: currentUser?.id ?? 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleTypeChange = (next: CustomFieldType) => {
    setType(next);
    if (!customFieldTypeUsesOptions(next)) setOptions([]);
    setValue(emptyDraftValue(next));
    setError('');
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Field name is required.');
      return;
    }
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (usesOptions && trimmedOptions.length === 0) {
      setError('Add at least one option for this field type.');
      return;
    }
    const now = new Date().toISOString();

    if (existing) {
      updateCustomField(existing.id, {
        name: trimmedName,
        label: trimmedName,
        type,
        options: usesOptions ? trimmedOptions : [],
        updatedAt: now,
      });
      toast.success(`"${trimmedName}" updated`);
      onClose();
      return;
    }

    const definition: Omit<CustomFieldDefinition, 'id' | 'createdAt'> = {
      name: trimmedName,
      label: trimmedName,
      type,
      options: usesOptions ? trimmedOptions : [],
      required: false,
      enabled: true,
      projectId,
      applicableIssueTypes: [],
      createdBy: currentUser?.id ?? 'system',
      updatedAt: now,
    };
    const draft: CustomFieldDefinition = { id: '__draft__', createdAt: now, ...definition };
    const valueErrors = validateCustomFieldValues([draft], { [draft.id]: value });
    if (valueErrors.length > 0) {
      setError(valueErrors[0]);
      return;
    }
    const created = createCustomField(definition);
    if (taskId) {
      // Always bind the field to this issue — even with an empty value. The
      // stored key is what renders the field here (and only here); an empty
      // value displays as an em-dash until someone fills it in.
      setTaskCustomFieldValue(taskId, created.id, value);
    }
    toast.success(`Custom field "${trimmedName}" added`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-modal border border-slate-200 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#f0fdfa]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#ccfbf1] text-[#0f766e] flex items-center justify-center border border-[#99f6e4]">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 font-display">
              {existing ? 'Edit Field' : 'Add Field'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3.5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="input-label" htmlFor="cf-name">
              Field Name
            </label>
            <input
              id="cf-name"
              className={INPUT_CLASS}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Client Name"
              autoFocus
            />
          </div>

          <div>
            <label className="input-label" htmlFor="cf-type">
              Field Type
            </label>
            <select
              id="cf-type"
              className={`${INPUT_CLASS} appearance-none cursor-pointer`}
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as CustomFieldType)}
            >
              {ADD_FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {usesOptions && (
            <div>
              <span className="input-label">Options</span>
              <div className="space-y-1.5">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <input
                      className={INPUT_CLASS}
                      value={option}
                      placeholder={`Option ${index + 1}`}
                      onChange={(e) =>
                        setOptions(options.map((o, i) => (i === index ? e.target.value : o)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                      className="px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptions([...options, ''])}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0d9488] hover:text-[#0f766e]"
                >
                  <Plus className="w-3 h-3" /> Add option
                </button>
              </div>
            </div>
          )}

          {!existing && (
            <div>
              <label className="input-label" htmlFor="cf-value">
                Field Value
              </label>
              <CustomFieldValueInput
                id="cf-value"
                field={draftField}
                value={value}
                onChange={(v) => {
                  setValue(v);
                  setError('');
                }}
                users={users}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-[#e2e5ea] hover:bg-slate-50"
          >
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn-primary btn-sm">
            {existing ? 'Save Changes' : 'Create Field'}
          </button>
        </div>
      </div>
    </div>
  );
};
