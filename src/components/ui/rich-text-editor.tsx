import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { useEffect } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote,
  Heading2, Heading3, Undo2, Redo2, Link as LinkIcon,
  Table as TableIcon, Rows3, Columns3, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

function ToolbarButton({
  onClick, active, disabled, label, children,
}: { onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <Toggle
      size="sm"
      pressed={!!active}
      onPressedChange={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="h-8 w-8 p-0 data-[state=on]:bg-accent"
    >
      {children}
    </Toggle>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const addLink = () => {
    const previous = editor.getAttributes('link').href;
    const url = window.prompt('URL do link', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const inTable = editor.isActive('table');

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5 rounded-t-md">
      <ToolbarButton label="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton label="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton label="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive('link')} onClick={addLink}>
        <LinkIcon className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton label="Inserir tabela" onClick={insertTable}>
        <TableIcon className="w-3.5 h-3.5" />
      </ToolbarButton>
      {inTable && (
        <>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs"
            onClick={() => editor.chain().focus().addRowAfter().run()} title="Adicionar linha">
            <Rows3 className="w-3.5 h-3.5" />+
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs"
            onClick={() => editor.chain().focus().addColumnAfter().run()} title="Adicionar coluna">
            <Columns3 className="w-3.5 h-3.5" />+
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs"
            onClick={() => editor.chain().focus().deleteRow().run()} title="Remover linha">
            <Rows3 className="w-3.5 h-3.5" />−
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs"
            onClick={() => editor.chain().focus().deleteColumn().run()} title="Remover coluna">
            <Columns3 className="w-3.5 h-3.5" />−
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive"
            onClick={() => editor.chain().focus().deleteTable().run()} title="Excluir tabela">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </>
      )}

      <div className="flex-1" />

      <ToolbarButton label="Desfazer" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Refazer" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 200, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-primary underline' } }),
      Placeholder.configure({ placeholder: placeholder || 'Escreva aqui...' }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'tiptap-table' } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          'tiptap-editor prose prose-sm max-w-none focus:outline-none px-4 py-3',
          'prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
        ),
      },
    },
  });

  // Sync external value (e.g. reset after save)
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn('rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring', className)}>
      <Toolbar editor={editor} />
      <div style={{ minHeight }} className="overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function isRichTextEmpty(html: string | null | undefined) {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length === 0;
}
