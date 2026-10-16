import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link2, Highlighter, Palette,
  AlignLeft, AlignCenter, AlignRight,
  Smile, Code, Quote, Undo2, Redo2, X, Paperclip, Image as ImageIcon
} from 'lucide-react';
import { Avatar } from './Avatar';
import type { User } from '../../types';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  minHeight?: string;
  onFileSelect?: () => void;
  /** Ctrl+V screenshot handler: when provided the image is handed back to the parent
   *  (rendered as an attachment preview) instead of being inserted into the document. */
  onImagePaste?: (dataUrl: string) => void;
  /** Focus the editable area as soon as the editor mounts. */
  autoFocus?: boolean;
  /** Extra attributes applied to the editable (contenteditable) element. */
  editableAttributes?: Record<string, string>;
  /**
   * Project/team members eligible for @ mention in this editor. When provided
   * (and non-empty), typing "@" opens a filtered suggestion dropdown; selecting
   * a member inserts a structured, non-editable mention atom (not plain text)
   * that renders identically wherever the comment HTML is displayed.
   */
  mentionableUsers?: User[];
}

/**
 * Structured @ mention node: an atomic, non-editable inline element carrying the
 * mentioned user's id, so a stored comment always renders a real mention — never
 * plain "@Name" text — in the editor and in `CommentContent`.
 */
const MentionNode = TiptapNode.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-mention-id]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-mention-id': node.attrs.id,
        class: 'mention',
        title: `@${node.attrs.label ?? ''}`,
        style:
          'background:rgba(13,148,136,0.12);color:#0f766e;padding:1px 5px;border-radius:6px;font-weight:600;white-space:nowrap;cursor:default;',
      }),
      `@${node.attrs.label}`,
    ];
  },
});

const filterMentionUsers = (users: User[], query: string): User[] => {
  const q = query.toLowerCase().trim();
  return users
    .filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    })
    .slice(0, 8);
};

const EMOJI_LIST = [
  '😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', '✅', '❌',
  '🎉', '🚀', '💡', '⚡', '📌', '🔧', '🐛', '💪', '🙌', '👏',
  '🔗', '📋', '📝', '⭐', '🏆', '💬', '🔔', '📅', '🎯', '💻',
];

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        isActive
          ? 'bg-brand-100 text-brand-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5" />;
}

function LinkInput({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prevAttrs = editor.getAttributes('link');
    if (prevAttrs.href) setUrl(prevAttrs.href);
  }, [editor]);

  const handleApply = () => {
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let href = url.trim();
      if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
      editor.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run();
    }
    onClose();
  };

  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        className="text-xs px-2 py-1 border border-slate-200 rounded-md w-48 focus:outline-none focus:ring-1 focus:ring-brand-400"
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleApply(); }
          if (e.key === 'Escape') onClose();
        }}
      />
      <button type="button" onClick={handleApply} className="text-xs font-semibold px-2 py-1 rounded-md bg-brand-600 text-white hover:bg-brand-700">
        Apply
      </button>
      <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function StylePicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const options: { label: string; active: boolean; run: () => void }[] = [
    {
      label: 'Paragraph',
      active: editor.isActive('paragraph') && !editor.isActive('heading'),
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: 'Heading 1',
      active: editor.isActive('heading', { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Heading 2',
      active: editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Heading 3',
      active: editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'Quote',
      active: editor.isActive('blockquote'),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="flex flex-col p-1 bg-white border border-slate-200 rounded-lg shadow-sm w-40">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            option.run();
            onClose();
          }}
          className={`text-left text-xs px-2 py-1.5 rounded-md transition-colors ${
            option.active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ColorPicker({ editor }: { editor: Editor }) {
  const colors = [
    '#000000', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#3498db', '#9b59b6', '#1abc9c', '#34495e', '#e91e63',
  ];

  return (
    <div className="flex items-center gap-0.5 p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().setColor(color).run();
          }}
          className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform"
          style={{ backgroundColor: color }}
          title={`Color: ${color}`}
        />
      ))}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().unsetColor().run();
        }}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100"
        title="Reset color"
      >
        Reset
      </button>
    </div>
  );
}

function EmojiPicker({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  return (
    <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm w-64">
      <div className="grid grid-cols-10 gap-1 overflow-y-auto" style={{ maxHeight: '240px' }}>
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().insertContent(emoji).run();
              onClose();
            }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-sm"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Write a comment...',
  onSubmit,
  minHeight = '80px',
  onFileSelect,
  onImagePaste,
  autoFocus = false,
  editableAttributes,
  mentionableUsers,
}: RichTextEditorProps) {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [emojiPos, setEmojiPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  // Ref to guard against infinite loop when programmatically setting content.
  // When we call editor.commands.setContent() in the sync effect below,
  // Tiptap fires onUpdate synchronously, which would call onChange() and
  // trigger a re-render with the same content. This flag prevents that.
  const skipNextOnChange = useRef(false);

  // ---- @ mention suggestion state ----
  // Kept in refs (not state) because `handleKeyDown` below is captured once when
  // the Tiptap editor is created and would otherwise close over stale values.
  // `forceMentionRender` is the escape hatch that re-renders the dropdown whenever
  // a ref changes outside of React's normal state flow.
  const [, forceMentionRender] = useReducer((n: number) => n + 1, 0);
  const mentionStateRef = useRef<{ from: number; to: number; query: string } | null>(null);
  const mentionIndexRef = useRef(0);
  const mentionableUsersRef = useRef<User[]>(mentionableUsers || []);
  mentionableUsersRef.current = mentionableUsers || [];
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  const closeMentionMenu = () => {
    if (!mentionStateRef.current) return;
    mentionStateRef.current = null;
    forceMentionRender();
  };

  // Inserts the selected member as a real mention atom (not text) at the "@query"
  // range, via the raw ProseMirror view so it can be called from `handleKeyDown`
  // (where the Tiptap `editor` wrapper isn't in scope yet) and from the dropdown's
  // click handler alike.
  const insertMentionViaView = (view: EditorView, user: User) => {
    const range = mentionStateRef.current;
    if (!range) return;
    const { schema } = view.state;
    const mentionType = schema.nodes.mention;
    if (!mentionType) return;
    const node = mentionType.create({ id: user.id, label: user.name });
    const tr = view.state.tr.replaceWith(range.from, range.to, [node, schema.text(' ')]);
    view.dispatch(tr);
    view.focus();
    mentionStateRef.current = null;
    forceMentionRender();
  };

  // Scans the text immediately before the cursor for an open "@query" trigger and
  // opens/updates/closes the suggestion dropdown accordingly.
  const updateMentionTrigger = useCallback((e: Editor) => {
    if (mentionableUsersRef.current.length === 0) {
      closeMentionMenu();
      return;
    }
    const { $from } = e.state.selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '￼');
    // The trigger fires on an "@" ANYWHERE before the cursor (start of line,
    // after a space, or mid-text) so typing @ always opens the suggestion
    // menu — never a silent no-op — and the parse can never throw.
    let match: { from: number; query: string } | null = null;
    try {
      const at = textBefore.lastIndexOf('@');
      if (at >= 0) {
        const query = textBefore.slice(at + 1);
        if (query.length <= 32 && !/[\s>]/.test(query)) {
          match = { from: $from.start() + at, query };
        }
      }
    } catch {
      closeMentionMenu();
      return;
    }
    if (!match) {
      closeMentionMenu();
      return;
    }
    mentionStateRef.current = { from: match.from, to: $from.pos, query: match.query };
    mentionIndexRef.current = 0;
    forceMentionRender();
    try {
      const coords = e.view.coordsAtPos($from.pos);
      setMentionPos({ top: coords.bottom + 6, left: coords.left });
    } catch {
      // coords can be unavailable mid-transaction; the reposition effect fixes it.
    }
  }, []);

  const editor = useEditor({
    extensions: [
      MentionNode,
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Link & Underline are registered below with their own configuration.
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-brand-600 underline cursor-pointer hover:text-brand-800' },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full rounded-xl border border-slate-200 my-2 shadow-xs cursor-pointer',
        },
      }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      if (skipNextOnChange.current) return;
      onChange(e.getHTML());
      updateMentionTrigger(e);
    },
    onSelectionUpdate: ({ editor: e }) => updateMentionTrigger(e),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[60px] px-3 py-2 text-xs text-slate-700',
        ...(editableAttributes || {}),
      },
      handleKeyDown: (view, event) => {
        if (mentionStateRef.current) {
          const items = filterMentionUsers(mentionableUsersRef.current, mentionStateRef.current.query);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            mentionIndexRef.current = items.length === 0 ? 0 : (mentionIndexRef.current + 1) % items.length;
            forceMentionRender();
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            mentionIndexRef.current = items.length === 0 ? 0 : (mentionIndexRef.current - 1 + items.length) % items.length;
            forceMentionRender();
            return true;
          }
          if ((event.key === 'Enter' || event.key === 'Tab') && items.length > 0) {
            event.preventDefault();
            insertMentionViaView(view, items[mentionIndexRef.current] || items[0]);
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeMentionMenu();
            return true;
          }
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && onSubmit) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find((item) => item.type.startsWith('image/'));
        if (imageItem) {
          const file = imageItem.getAsFile();
          if (file) {
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              // Delegated paste (transition comment modal): hand the screenshot to the
              // parent so it can show an attachment preview for the comment.
              if (onImagePaste) {
                onImagePaste(dataUrl);
                return;
              }
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({ src: dataUrl })
                )
              );
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.[0]?.type.startsWith('image/')) {
          const file = event.dataTransfer.files[0];
          event.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            const node = view.state.schema.nodes.image.create({ src: dataUrl });
            const transaction = view.state.tr.insert(coordinates ? coordinates.pos : view.state.selection.from, node);
            view.dispatch(transaction);
          };
          reader.readAsDataURL(file);
          return true;
        }
        return false;
      },
    },
  });

  // Sync external content prop changes to the Tiptap editor instance.
  // This is needed because Tiptap's useEditor content option only sets initial content.
  // When the parent clears content (e.g. after submit), the editor must also clear.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === content) return;

    skipNextOnChange.current = true;
    editor.commands.setContent(content, { emitUpdate: false });
    skipNextOnChange.current = false;
  }, [editor, content]);

  // Focus the editable area on mount when requested (transition comment modal opens
  // ready for typing / Ctrl+V screenshot paste).
  useEffect(() => {
    if (!editor || !autoFocus) return;
    const timer = window.setTimeout(() => editor.commands.focus('end'), 40);
    return () => window.clearTimeout(timer);
  }, [editor, autoFocus]);

  // Close popups on outside click
  const mentionMenuRef = useRef<HTMLDivElement>(null);
  // Keep the mention dropdown anchored to the cursor while it is open (page
  // scroll, container scroll, resize). Runs only while the menu is visible.
  const mentionOpen = mentionStateRef.current !== null;
  useEffect(() => {
    if (!mentionOpen || !editor) return;
    const reposition = () => {
      const st = mentionStateRef.current;
      if (!st) return;
      try {
        const coords = editor.view.coordsAtPos(st.to);
        setMentionPos({ top: coords.bottom + 6, left: coords.left });
      } catch {
        // View/doc may be mid-update — keep the last known position.
      }
    };
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [mentionOpen, editor]);

  // Keep the keyboard-highlighted member visible inside the dropdown.
  useLayoutEffect(() => {
    if (!mentionOpen) return;
    const el = mentionMenuRef.current?.querySelector('[data-mention-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  });
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowStylePicker(false);
        setShowLinkInput(false);
        setShowColorPicker(false);
        setShowEmojiPicker(false);
        if (!mentionMenuRef.current?.contains(e.target as Node)) closeMentionMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute emoji picker position relative to the Emoji button using getBoundingClientRect().
  // The picker is rendered via a portal to document.body so position: fixed works correctly
  // even when ancestors have CSS transforms (which would otherwise break fixed positioning).
  const VIEWPORT_PAD = 8;
  const PICKER_GAP = 6;

  const computeEmojiPosition = useCallback(() => {
    const btn = emojiButtonRef.current;
    if (!btn) return;
    const btnRect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Use actual picker dimensions if rendered, otherwise use estimates
    const picker = emojiPickerRef.current;
    const ph = picker ? picker.offsetHeight : 280;
    const pw = picker ? picker.offsetWidth : 256;

    // Vertical: prefer below the button, flip above if insufficient space
    let top = btnRect.bottom + PICKER_GAP;
    if (top + ph + VIEWPORT_PAD > vh) {
      top = btnRect.top - PICKER_GAP - ph;
    }
    if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;

    // Horizontal: align left edge with button, shift left if overflowing right edge
    let left = btnRect.left;
    if (left + pw + VIEWPORT_PAD > vw) {
      left = vw - pw - VIEWPORT_PAD;
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

    setEmojiPos({ top, left });
  }, []);

  // Position picker on open, recalculate on scroll/resize.
  // useLayoutEffect ensures position is computed before the browser paints.
  useLayoutEffect(() => {
    if (!showEmojiPicker) return;

    // Initial position (uses estimated dimensions if picker ref not yet available)
    computeEmojiPosition();

    // After the picker DOM is committed, re-measure with actual dimensions
    // and correct the position. This runs before paint so no visual flash occurs.
    requestAnimationFrame(() => {
      computeEmojiPosition();
    });

    const handler = () => computeEmojiPosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [showEmojiPicker, computeEmojiPosition]);

  if (!editor) return null;

  const mentionRange = mentionStateRef.current;

  return (
    <div ref={containerRef} className="border border-slate-200 rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-400/30 focus-within:border-brand-400 transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50/80 flex-wrap">
        {/* Text Style */}
        <div className="relative">
          <ToolbarButton
            onClick={() => {
              setShowStylePicker(!showStylePicker);
              setShowLinkInput(false);
              setShowColorPicker(false);
              setShowEmojiPicker(false);
            }}
            isActive={showStylePicker}
            title="Style (Paragraph / Heading)"
          >
            <span className="text-[11px] font-semibold leading-none px-0.5">Style</span>
          </ToolbarButton>
          {showStylePicker && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <StylePicker editor={editor} onClose={() => setShowStylePicker(false)} />
            </div>
          )}
        </div>
        <ToolbarDivider />
        <ToolbarButton
          onClick={() => { setShowStylePicker(false); editor.chain().focus().toggleBold().run(); }}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Inline Code"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Color & Highlight */}
        <div className="relative">
          <ToolbarButton
            onClick={() => { setShowColorPicker(!showColorPicker); setShowEmojiPicker(false); setShowLinkInput(false); setShowStylePicker(false); }}
            isActive={showColorPicker}
            title="Text Color"
          >
            <Palette className="w-3.5 h-3.5" />
          </ToolbarButton>
          {showColorPicker && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <ColorPicker editor={editor} />
            </div>
          )}
        </div>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
          isActive={editor.isActive('highlight')}
          title="Highlight"
        >
          <Highlighter className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bulleted List"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Block */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <div className="relative">
          <ToolbarButton
            onClick={() => { setShowLinkInput(!showLinkInput); setShowColorPicker(false); setShowEmojiPicker(false); setShowStylePicker(false); }}
            isActive={editor.isActive('link')}
            title="Insert Link"
          >
            <Link2 className="w-3.5 h-3.5" />
          </ToolbarButton>
          {showLinkInput && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <LinkInput editor={editor} onClose={() => setShowLinkInput(false)} />
            </div>
          )}
        </div>

        {/* Emoji */}
        <div className="relative" ref={emojiButtonRef}>
          <ToolbarButton
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowColorPicker(false); setShowLinkInput(false); setShowStylePicker(false); }}
            isActive={showEmojiPicker}
            title="Emoji"
          >
            <span role="img" aria-label="Emoji">
              <Smile className="w-3.5 h-3.5" />
            </span>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Attachment */}
        {onFileSelect && (
          <ToolbarButton
            onClick={onFileSelect}
            title="Attach File"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </ToolbarButton>
        )}

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} style={{ minHeight }} />

      {/* Emoji picker portal - rendered to document.body to avoid CSS transform
          ancestors breaking position: fixed. Ref is used to measure actual picker
          dimensions for accurate viewport-aware positioning. */}
      {showEmojiPicker && createPortal(
        <div
          ref={emojiPickerRef}
          className="fixed z-[9999]"
          style={{ top: emojiPos.top, left: emojiPos.left }}
        >
          <EmojiPicker editor={editor} onClose={() => setShowEmojiPicker(false)} />
        </div>,
        document.body
      )}

      {/* @ mention suggestion dropdown — portaled to document.body so the
          container's overflow-hidden can never clip it. */}
      {mentionRange && createPortal(
        <div
          ref={mentionMenuRef}
          className="fixed z-[9999] min-w-[240px] max-w-[320px] max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: mentionPos.top, left: mentionPos.left }}
        >
          <div className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Mention someone
          </div>
          {(() => {
            const items = filterMentionUsers(mentionableUsersRef.current, mentionRange.query);
            if (items.length === 0) {
              return (
                <div className="px-2.5 py-2 text-xs text-slate-400">No members match</div>
              );
            }
            const activeIndex = Math.min(mentionIndexRef.current, items.length - 1);
            return items.map((u, i) => (
              <button
                key={u.id}
                type="button"
                data-mention-active={i === activeIndex}
                onMouseDown={(e) => {
                  // preventDefault keeps editor focus so insertion works reliably.
                  e.preventDefault();
                  insertMentionViaView(editor.view, u);
                }}
                onMouseEnter={() => {
                  if (mentionIndexRef.current !== i) {
                    mentionIndexRef.current = i;
                    forceMentionRender();
                  }
                }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                  i === activeIndex ? 'bg-brand-50' : 'hover:bg-slate-50'
                }`}
              >
                <Avatar name={u.name} color={u.avatarColor} imageUrl={u.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-700">{u.name}</span>
                  {u.email && (
                    <span className="block truncate text-[11px] text-slate-400">{u.email}</span>
                  )}
                </span>
              </button>
            ));
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}

export function CommentContent({ html, onImageClick }: { html: string; onImageClick?: (src: string) => void }) {
  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'IMG') {
          const src = (target as HTMLImageElement).src;
          if (src && onImageClick) onImageClick(src);
        }
      }}
      className="prose prose-xs max-w-none text-xs text-slate-700 leading-relaxed
        [&_p]:mb-2 [&_p:last-child]:mb-0
        [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2
        [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2
        [&_li]:mb-0.5
        [&_a]:text-brand-600 [&_a]:underline [&_a]:hover:text-brand-800
        [&_strong]:font-bold [&_em]:italic [&_u]:underline
        [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px]
        [&_pre]:bg-slate-100 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:overflow-x-auto
        [&_blockquote]:border-l-3 [&_blockquote]:border-brand-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-500
        [&_mark]:bg-yellow-100 [&_mark]:px-0.5
        [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 [&_img]:my-3 [&_img]:shadow-xs [&_img]:cursor-pointer [&_img]:hover:shadow-md [&_img]:transition-all"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
