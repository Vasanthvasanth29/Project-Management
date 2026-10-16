import React from 'react';
import type { CustomFieldDefinition, CustomFieldValue, User } from '../../types';
import { SearchableUserSelect } from '../common/SearchableUserSelect';
import { fieldLabel } from '../../utils/customFields';

interface CustomFieldValueInputProps {
  field: CustomFieldDefinition;
  value: CustomFieldValue | undefined;
  onChange: (value: CustomFieldValue) => void;
  users: User[];
  autoFocus?: boolean;
  id?: string;
}

const CONTROL_CLASS =
  'input text-xs py-1.5 px-2.5 focus:ring-2 focus:ring-[#0d9488]/30';

/**
 * Type-aware editor for a single custom field value:
 * text/long text, number, decimal, date, date & time, dropdown, multi select,
 * checkbox, URL, user picker (existing app users) and email.
 */
export const CustomFieldValueInput: React.FC<CustomFieldValueInputProps> = ({
  field,
  value,
  onChange,
  users,
  autoFocus = false,
  id,
}) => {
  const textValue = value === undefined || typeof value === 'boolean' || Array.isArray(value) ? '' : String(value);
  const options = field.options ?? [];
  const label = fieldLabel(field).toLowerCase();

  switch (field.type) {
    case 'long_text':
      return (
        <textarea
          id={id}
          autoFocus={autoFocus}
          rows={2}
          className={`${CONTROL_CLASS} resize-y min-h-[44px]`}
          value={textValue}
          placeholder={field.description || `Enter ${label}`}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          id={id}
          autoFocus={autoFocus}
          type="number"
          className={CONTROL_CLASS}
          value={textValue}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'decimal':
      return (
        <input
          id={id}
          autoFocus={autoFocus}
          type="number"
          step="any"
          className={CONTROL_CLASS}
          value={textValue}
          placeholder="0.0"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return (
        <input
          id={id}
          autoFocus={autoFocus}
          type="date"
          className={`${CONTROL_CLASS} max-w-[180px]`}
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'datetime':
      return (
        <input
          id={id}
          autoFocus={autoFocus}
          type="datetime-local"
          className={`${CONTROL_CLASS} max-w-[230px]`}
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'dropdown':
      return (
        <select
          id={id}
          className={`${CONTROL_CLASS} appearance-none cursor-pointer max-w-[280px]`}
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {label}...</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case 'multi_select': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const on = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onChange(on ? selected.filter((o) => o !== option) : [...selected, option])
                }
                className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                  on
                    ? 'border-[#0d9488] bg-[#0d9488]/10 text-[#0f766e]'
                    : 'border-[#e2e5ea] bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }
    case 'checkbox':
      return (
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#0d9488] focus:ring-[#0d9488]/40"
          />
          {value === true ? 'Yes' : 'No'}
        </label>
      );
    case 'user':
      return (
        <SearchableUserSelect
          users={users}
          value={typeof value === 'string' ? value : ''}
          onChange={(userId) => onChange(userId)}
          placeholder={`Select ${label}...`}
          className="max-w-[320px]"
        />
      );
    case 'url':
      return (
        <input
          id={id}
          autoFocus={autoFocus}
          type="url"
          className={CONTROL_CLASS}
          value={textValue}
          placeholder="https://"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'email':
      return (
        <input
          id={id}
          autoFocus={autoFocus}
          type="email"
          className={CONTROL_CLASS}
          value={textValue}
          placeholder="name@example.com"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'text':
    default:
      return (
        <input
          id={id}
          autoFocus={autoFocus}
          type="text"
          className={CONTROL_CLASS}
          value={textValue}
          placeholder={field.description || `Enter ${label}`}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};
