import { useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CalendarDays, Users, Trash2, UserCheck, FileText, FileDown, Paperclip,
  Upload, Download, Loader2, FileType, MessageSquare, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Reuniao } from '@/hooks/useReunioesData';
import { ReuniaoStatusBadge } from './EncaminhamentoStatusBadge';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import DOMPurify from 'dompurify';
import { useReuniaoAnexos, type ReuniaoAnexo, ACCEPTED_ANEXO_ATTR, ACCEPTED_ANEXO_LABEL } from '@/hooks/useReuniaoAnexos';
import { useReuniaoComentarios } from '@/hooks/useReuniaoComentarios';
import { ReuniaoComentarios } from './ReuniaoComentarios';
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

function formatDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
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

  const { comentarios } = useReuniaoComentarios(reuniao?.id ?? null, reuniao?.unidade_id ?? null);

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
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-muted/40 to-transparent">
          <SheetHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-left text-xl leading-tight">{reuniao.tipo}</SheetTitle>
              <ReuniaoStatusBadge status={reuniao.status} />
            </div>
            <SheetDescription className="sr-only">Detalhes da reunião</SheetDescription>

            <div className="grid grid-cols-2 gap-2.5">
              <InfoTile icon={<CalendarDays className="w-3.5 h-3.5" />} label="Data" value={formatDateLong(reuniao.data)} />
              <InfoTile icon={<Building2 className="w-3.5 h-3.5" />} label="Unidade" value={unidadeNome} />
              <InfoTile
                icon={<UserCheck className="w-3.5 h-3.5" />}
                label="Responsável"
                value={reuniao.responsavel || '—'}
              />
              <InfoTile
                icon={<Users className="w-3.5 h-3.5" />}
                label="Participantes"
                value={`${reuniao.participantes.length} pessoa${reuniao.participantes.length === 1 ? '' : 's'}`}
              />
            </div>

            {reuniao.participantes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {reuniao.participantes.map((p, i) => (
                  <Badge key={i} variant="secondary" className="font-normal text-[11px]">{p}</Badge>
                ))}
              </div>
            )}
          </SheetHeader>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pauta" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-4">
            <TabsTrigger value="pauta" className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Pauta
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Feedback
            </TabsTrigger>
            <TabsTrigger value="anexos" className="text-xs gap-1.5">
              <Paperclip className="w-3.5 h-3.5" /> Anexos
              {anexos.length > 0 && <span className="ml-0.5 text-[10px] opacity-70">({anexos.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="comentarios" className="text-xs gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Comentários
              {comentarios.length > 0 && <span className="ml-0.5 text-[10px] opacity-70">({comentarios.length})</span>}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="px-6 py-4">
              <TabsContent value="pauta" className="mt-0">
                {reuniao.pauta ? (
                  <div className="space-y-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleExportPdf}>
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleExportTxt}>
                        <FileText className="w-3.5 h-3.5" /> TXT
                      </Button>
                    </div>
                    <div
                      className="tiptap-editor prose prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: renderRich(reuniao.pauta) }}
                    />
                  </div>
                ) : (
                  <EmptyMsg text="Nenhuma pauta registrada." />
                )}
              </TabsContent>

              <TabsContent value="feedback" className="mt-0">
                {reuniao.feedback ? (
                  <p className="text-sm whitespace-pre-wrap">{reuniao.feedback}</p>
                ) : (
                  <EmptyMsg text="Nenhum feedback registrado." />
                )}
              </TabsContent>

              <TabsContent value="anexos" className="mt-0">
                <div className="flex justify-end mb-3">
                  <Button
                    size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                    onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Anexar arquivo
                  </Button>
                  <input
                    ref={fileInputRef} type="file"
                    accept={ACCEPTED_ANEXO_ATTR} className="hidden" onChange={handleFile}
                  />
                </div>

                {loadingAnexos ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : anexos.length === 0 ? (
                  <EmptyMsg text="Nenhum arquivo anexado." />
                ) : (
                  <ul className="space-y-1.5">
                    {anexos.map((a: ReuniaoAnexo) => {
                      const canDelete = isAdmin || userRole === 'coordenador';
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
                <p className="text-[11px] text-muted-foreground mt-2">{ACCEPTED_ANEXO_LABEL} • até 15 MB.</p>
              </TabsContent>

              <TabsContent value="comentarios" className="mt-0">
                <ReuniaoComentarios reuniaoId={reuniao.id} unidadeId={reuniao.unidade_id} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {canEdit && onDelete && (
          <div className="border-t px-6 py-3 flex justify-end">
            <Button
              variant="ghost" size="sm"
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

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-sm font-medium truncate mt-0.5">{value}</div>
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-4 text-center">{text}</p>;
}
