import { useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarDays, Users, Trash2, UserCheck, FileText, FileDown, Paperclip,
  Upload, Download, Loader2, FileType,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Reuniao } from '@/hooks/useReunioesData';
import { ReuniaoStatusBadge } from './EncaminhamentoStatusBadge';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import DOMPurify from 'dompurify';
import { useReuniaoAnexos, type ReuniaoAnexo, ACCEPTED_ANEXO_ATTR, ACCEPTED_ANEXO_LABEL } from '@/hooks/useReuniaoAnexos';
import { exportPautaToPdf, exportPautaToTxt } from '@/lib/exportPauta';
import { toast } from '@/hooks/use-toast';

interface Props {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => Promise<void>;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

function renderRich(value: string) {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(value);
  const html = looksLikeHtml ? value : value.replace(/\n/g, '<br />');
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReuniaoDetalheDrawer({ reuniao, open, onOpenChange, onDelete }: Props) {
  const { unidades } = useUnidade();
  const { isAdmin, userRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { anexos, loading: loadingAnexos, uploading, uploadAnexo, downloadAnexo, deleteAnexo } =
    useReuniaoAnexos(reuniao?.id ?? null, reuniao?.unidade_id ?? null);

  if (!reuniao) return null;

  const unidadeNome = unidades.find((u) => u.id === reuniao.unidade_id)?.nome ?? '—';
  const canEdit = isAdmin || userRole === 'coordenador';

  const handleExportPdf = async () => {
    try {
      await exportPautaToPdf({
        tipo: reuniao.tipo,
        data: formatDate(reuniao.data),
        unidade: unidadeNome,
        responsavel: reuniao.responsavel,
        participantes: reuniao.participantes,
        pauta: reuniao.pauta || '',
        feedback: reuniao.feedback,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar PDF', description: err.message, variant: 'destructive' });
    }
  };

  const handleExportTxt = () => {
    exportPautaToTxt({
      tipo: reuniao.tipo,
      data: formatDate(reuniao.data),
      unidade: unidadeNome,
      responsavel: reuniao.responsavel,
      participantes: reuniao.participantes,
      pauta: reuniao.pauta || '',
      feedback: reuniao.feedback,
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAnexo(file);
    e.target.value = '';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-left">{reuniao.tipo}</SheetTitle>
            <ReuniaoStatusBadge status={reuniao.status} />
          </div>
          <SheetDescription className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {formatDate(reuniao.data)}</span>
            <span>•</span>
            <span>{unidadeNome}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            {reuniao.responsavel && (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" /> Responsável pela reunião
                </h4>
                <p className="text-sm font-medium">{reuniao.responsavel}</p>
              </section>
            )}

            <Separator />

            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Participantes
              </h4>
              {reuniao.participantes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum participante registrado.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {reuniao.participantes.map((p, i) => (
                    <Badge key={i} variant="secondary" className="font-normal">{p}</Badge>
                  ))}
                </div>
              )}
            </section>

            {reuniao.pauta && (
              <>
                <Separator />
                <section>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Pauta da reunião</h4>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleExportPdf}>
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleExportTxt}>
                        <FileText className="w-3.5 h-3.5" /> TXT
                      </Button>
                    </div>
                  </div>
                  <div
                    className="tiptap-editor prose prose-sm max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderRich(reuniao.pauta) }}
                  />
                </section>
              </>
            )}

            {reuniao.feedback && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Feedback da reunião</h4>
                  <p className="text-sm whitespace-pre-wrap">{reuniao.feedback}</p>
                </section>
              </>
            )}

            <Separator />

            <section>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> Anexos
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Anexar arquivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_ANEXO_ATTR}
                  className="hidden"
                  onChange={handleFile}
                />
              </div>

              {loadingAnexos ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : anexos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum arquivo anexado.</p>
              ) : (
                <ul className="space-y-1.5">
                  {anexos.map((a: ReuniaoAnexo) => {
                    const mine = false; // server enforces; show delete for admin/coord
                    const canDelete = isAdmin || userRole === 'coordenador' || mine;
                    return (
                      <li key={a.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 bg-muted/30">
                        <FileType className="w-4 h-4 text-destructive shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{a.file_name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatSize(a.size_bytes)}
                            {a.uploaded_by_name ? ` • ${a.uploaded_by_name}` : ''}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => downloadAnexo(a)} title="Baixar">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {canDelete && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm('Remover este anexo?')) deleteAnexo(a); }}
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">Somente PDF • até 15 MB.</p>
            </section>
          </div>
        </ScrollArea>

        {canEdit && onDelete && (
          <div className="border-t pt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (confirm('Excluir esta reunião?')) {
                  await onDelete(reuniao.id);
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Excluir reunião
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
