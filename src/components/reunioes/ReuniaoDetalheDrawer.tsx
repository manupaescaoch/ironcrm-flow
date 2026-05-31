import { useRef, useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarDays, Users, Trash2, UserCheck, FileText, FileDown, Paperclip,
  Upload, Download, Loader2, FileType, MessageSquare, Building2,
  Pencil, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Reuniao, ReuniaoInput } from '@/hooks/useReunioesData';
import { ReuniaoStatusBadge } from './EncaminhamentoStatusBadge';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import DOMPurify from 'dompurify';
import { useReuniaoAnexos, type ReuniaoAnexo, ACCEPTED_ANEXO_ATTR, ACCEPTED_ANEXO_LABEL } from '@/hooks/useReuniaoAnexos';
import { useReuniaoComentarios } from '@/hooks/useReuniaoComentarios';
import { ReuniaoComentarios } from './ReuniaoComentarios';
import { exportPautaToPdf, exportPautaToTxt } from '@/lib/exportPauta';
import { toast } from '@/hooks/use-toast';
import { TIPOS_REUNIAO, STATUS_REUNIAO } from './constants';
import { RichTextEditor, isRichTextEmpty } from '@/components/ui/rich-text-editor';
import { useUnidadeUsers } from '@/hooks/useUnidadeUsers';

interface Props {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (id: string, input: Partial<ReuniaoInput>) => Promise<Reuniao | void>;
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

export function ReuniaoDetalheDrawer({ reuniao, open, onOpenChange, onDelete, onUpdate }: Props) {
  const { unidades } = useUnidade();
  const { isAdmin, userRole, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { users, loading: loadingUsers } = useUnidadeUsers();

  const { anexos, loading: loadingAnexos, uploading, uploadAnexo, downloadAnexo, deleteAnexo } =
    useReuniaoAnexos(reuniao?.id ?? null, reuniao?.unidade_id ?? null);

  const { comentarios } = useReuniaoComentarios(reuniao?.id ?? null, reuniao?.unidade_id ?? null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    tipo: '',
    data: '',
    responsavel: '',
    participantes: [] as string[],
    participanteInput: '',
    pauta: '',
    feedback: '',
    status: '',
  });

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (editing && reuniao) {
      setEditForm({
        tipo: reuniao.tipo,
        data: reuniao.data,
        responsavel: reuniao.responsavel ?? '',
        participantes: [...reuniao.participantes],
        participanteInput: '',
        pauta: reuniao.pauta ?? '',
        feedback: reuniao.feedback ?? '',
        status: reuniao.status,
      });
    }
  }, [editing, reuniao]);

  // Reset editing when drawer closes
  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  if (!reuniao) return null;

  const unidadeNome = unidades.find((u) => u.id === reuniao.unidade_id)?.nome ?? '—';
  const canEdit = isAdmin || userRole === 'coordenador' || user?.id === reuniao.criado_por;

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

  const addParticipante = () => {
    const v = editForm.participanteInput.trim().toUpperCase();
    if (v && !editForm.participantes.includes(v)) {
      setEditForm((prev) => ({ ...prev, participantes: [...prev.participantes, v], participanteInput: '' }));
    } else {
      setEditForm((prev) => ({ ...prev, participanteInput: '' }));
    }
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    if (!editForm.tipo) return toast({ title: 'Selecione o tipo da reunião', variant: 'destructive' });
    if (!editForm.data) return toast({ title: 'Informe a data', variant: 'destructive' });
    if (!editForm.responsavel.trim()) return toast({ title: 'Informe o responsável', variant: 'destructive' });
    if (editForm.participantes.length === 0) return toast({ title: 'Adicione ao menos um participante', variant: 'destructive' });
    if (isRichTextEmpty(editForm.pauta)) return toast({ title: 'Informe a pauta', variant: 'destructive' });

    setSaving(true);
    try {
      await onUpdate(reuniao.id, {
        tipo: editForm.tipo,
        data: editForm.data,
        responsavel: editForm.responsavel.trim().toUpperCase(),
        participantes: editForm.participantes,
        pauta: editForm.pauta,
        feedback: editForm.feedback.trim() || null,
        status: editForm.status,
      });
      toast({ title: 'Reunião atualizada com sucesso' });
      setEditing(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-muted/40 to-transparent">
          <SheetHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-left text-xl leading-tight">
                {editing ? 'Editar reunião' : reuniao.tipo}
              </SheetTitle>
              {editing ? (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                    <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                  </Button>
                </div>
              ) : (
                <ReuniaoStatusBadge status={reuniao.status} />
              )}
            </div>
            <SheetDescription className="sr-only">
              {editing ? 'Editar reunião' : 'Detalhes da reunião'}
            </SheetDescription>

            {!editing && (
              <div className="grid grid-cols-2 gap-2.5">
                <InfoTile icon={<CalendarDays className="w-3.5 h-3.5" />} label="Data" value={formatDateLong(reuniao.data)} />
                <InfoTile icon={<Building2 className="w-3.5 h-3.5" />} label="Unidade" value={unidadeNome} />
                <InfoTile icon={<UserCheck className="w-3.5 h-3.5" />} label="Responsável" value={reuniao.responsavel || '—'} />
                <InfoTile icon={<Users className="w-3.5 h-3.5" />} label="Participantes" value={`${reuniao.participantes.length} pessoa${reuniao.participantes.length === 1 ? '' : 's'}`} />
              </div>
            )}

            {!editing && reuniao.participantes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {reuniao.participantes.map((p, i) => (
                  <Badge key={i} variant="secondary" className="font-normal text-[11px]">{p}</Badge>
                ))}
              </div>
            )}
          </SheetHeader>
        </div>

        {/* Edit form */}
        {editing ? (
          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo *</Label>
                  <Select value={editForm.tipo} onValueChange={(v) => setEditForm((p) => ({ ...p, tipo: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_REUNIAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data *</Label>
                  <Input type="date" value={editForm.data} onChange={(e) => setEditForm((p) => ({ ...p, data: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status *</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {STATUS_REUNIAO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Responsável *</Label>
                {users.length > 0 ? (
                  <Select value={editForm.responsavel} onValueChange={(v) => setEditForm((p) => ({ ...p, responsavel: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingUsers ? 'Carregando...' : 'Selecione o responsável'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={editForm.responsavel}
                    onChange={(e) => setEditForm((p) => ({ ...p, responsavel: e.target.value.toUpperCase() }))}
                    placeholder={loadingUsers ? 'Carregando usuários...' : 'Nome do responsável'}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Participantes *</Label>
                <div className="flex gap-2">
                  <Input
                    value={editForm.participanteInput}
                    onChange={(e) => setEditForm((p) => ({ ...p, participanteInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addParticipante(); }
                    }}
                    placeholder="Digite o nome e pressione Enter"
                  />
                  <Button type="button" variant="outline" onClick={addParticipante}>Adicionar</Button>
                </div>
                {editForm.participantes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editForm.participantes.map((p, i) => (
                      <Badge key={i} variant="secondary" className="font-normal gap-1">
                        {p}
                        <button onClick={() => setEditForm((prev) => ({ ...prev, participantes: prev.participantes.filter((_, idx) => idx !== i) }))} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Pauta *</Label>
                <RichTextEditor
                  value={editForm.pauta}
                  onChange={(v) => setEditForm((p) => ({ ...p, pauta: v }))}
                  placeholder="Digite a pauta..."
                  minHeight={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Feedback</Label>
                <Textarea rows={5} value={editForm.feedback} onChange={(e) => setEditForm((p) => ({ ...p, feedback: e.target.value }))} />
              </div>
            </div>
          </ScrollArea>
        ) : (
          /* Tabs view */
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
                        const canDeleteAnexo = isAdmin || userRole === 'coordenador';
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
                            {canDeleteAnexo && (
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
        )}

        {/* Footer actions */}
        <div className="border-t px-6 py-3 flex justify-between items-center">
          {canEdit && !editing && onUpdate && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
            </Button>
          )}
          {editing && <div />}

          {canEdit && onDelete && !editing && (
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
          )}
          {!editing && !onDelete && <div />}
        </div>
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
