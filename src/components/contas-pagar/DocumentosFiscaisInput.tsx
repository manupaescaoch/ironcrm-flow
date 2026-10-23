import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, FileText, Paperclip, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getContaArquivoUrl } from './uploadHelpers';

export const MSG_DOCUMENTO_OBRIGATORIO = 'Anexe a nota fiscal ou o cupom fiscal para cadastrar esta conta.';
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

export interface DocumentoFiscalItem {
  id: string;
  nome: string;
  file?: File; // novo, ainda não enviado
  path?: string; // já salvo
  previewUrl?: string;
}

export function nomeDoPath(path: string): string {
  const base = path.split('/').pop() || path;
  return base.replace(/^\d+_/, '');
}

export function docsFromPaths(paths: string[]): DocumentoFiscalItem[] {
  return paths.filter(Boolean).map((p) => ({ id: p, nome: nomeDoPath(p), path: p }));
}

interface Props {
  docs: DocumentoFiscalItem[];
  setDocs: (docs: DocumentoFiscalItem[]) => void;
  error?: string;
  disabled?: boolean;
}

export function DocumentosFiscaisInput({ docs, setDocs, error, disabled }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef(docs);
  docsRef.current = docs;

  useEffect(
    () => () => {
      docsRef.current.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    },
    [],
  );

  const adicionar = (files: FileList | null) => {
    if (!files) return;
    const novos: DocumentoFiscalItem[] = [];
    for (const f of Array.from(files)) {
      if (!TIPOS_ACEITOS.includes(f.type)) {
        toast({ title: `"${f.name}" não é PDF, JPG ou PNG`, variant: 'destructive' });
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast({ title: `"${f.name}" passa de 10 MB`, variant: 'destructive' });
        continue;
      }
      novos.push({
        id: `${Date.now()}-${Math.random()}`,
        nome: f.name,
        file: f,
        previewUrl: URL.createObjectURL(f),
      });
    }
    if (novos.length) setDocs([...docs, ...novos]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const visualizar = async (d: DocumentoFiscalItem) => {
    const url = d.previewUrl ?? (d.path ? await getContaArquivoUrl(d.path) : null);
    if (url) window.open(url, '_blank', 'noopener');
    else toast({ title: 'Não foi possível abrir o documento', variant: 'destructive' });
  };

  const remover = (d: DocumentoFiscalItem) => {
    if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
    setDocs(docs.filter((x) => x.id !== d.id));
  };

  return (
    <div className="space-y-2">
      <Label className={cn(error && 'text-destructive')}>Nota fiscal / cupom fiscal *</Label>
      <div
        className={cn(
          'rounded-md border border-dashed p-3 space-y-2',
          error ? 'border-destructive bg-destructive/5' : 'border-border',
        )}
      >
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{d.nome}</span>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => visualizar(d)} title="Visualizar">
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => remover(d)}
              disabled={disabled}
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => adicionar(e.target.files)}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Paperclip className="w-4 h-4 mr-1" />
          {docs.length ? 'Anexar outro documento' : 'Anexar nota ou cupom fiscal'}
        </Button>
        <p className="text-xs text-muted-foreground">PDF, JPG ou PNG, até 10 MB cada. Pode anexar mais de um.</p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
