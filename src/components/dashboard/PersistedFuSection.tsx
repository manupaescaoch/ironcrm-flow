import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Eye, Loader2, MessageCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUnidade } from '@/contexts/UnidadeContext';
import { fuItemLink, fuItemMessage, pendingFuMessages, type FuTaskItem } from '@/lib/fuTaskState';
import { fuDate } from '@/lib/fuBusinessDays';
import { useAuth } from '@/contexts/AuthContext';
import { useInternalFuConfirmation } from '@/hooks/useInternalFuConfirmation';
import { confirmationDevelopmentEnabled } from '@/lib/fuConfirmationClient';

export function PersistedFuSection({ title, items, loading, error, refetch, confirmationEnabled = confirmationDevelopmentEnabled }: { title: string; items: FuTaskItem[]; loading: boolean; error: string | null; refetch: () => void; confirmationEnabled?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const { userRole } = useAuth();
  const confirmation = useInternalFuConfirmation(refetch);
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = items.filter(item => item.unitId === unidadeAtual?.id);
  const pending = pendingFuMessages(visible);
  const confirmedOpen = visible.filter(item => !!item.confirmedAt && item.open);
  const rows = [...pending, ...confirmedOpen];
  const selected = visible.find(item => item.id === selectedId);
  const canConfirm = selected && (userRole === 'admin' || (selected.family === 'recepcao' ? userRole === 'comercial' : selected.family === 'gerencia' ? userRole === 'gerente' : userRole === 'gerente' || userRole === 'coordenador'));
  const select = (id: string | null) => { confirmation.select(id); setSelectedId(id); };
  const unitName = unidadeAtual?.nome ?? '';
  const index = rows.findIndex(item => item.id === selectedId);
  return <Card>
    <CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-base"><span>{title}</span><Badge variant="outline">{pending.length}</Badge></CardTitle></CardHeader>
    <CardContent>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3"><span>{pending.length} mensagens pendentes</span><span>{confirmedOpen.length} enviados · acompanhamento aberto</span></div>
      {error ? <div role="alert">{error}<Button variant="outline" size="sm" onClick={refetch}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button></div> : loading ? <p role="status" className="flex gap-2"><Loader2 className="w-4 h-4 animate-spin" />Carregando…</p> : rows.length === 0 ? <p className="py-6 text-center text-muted-foreground">Nenhuma mensagem pendente para hoje.</p> : <div className="max-h-[500px] overflow-y-auto space-y-2">{rows.map(item => <div key={item.id} className="flex flex-wrap justify-between items-center gap-3 border border-border rounded-md p-3">
        <div className="min-w-0"><div className="flex gap-2 items-center"><Badge variant="outline">{item.stage === 'BV' ? 'Boas-vindas' : item.stage}</Badge><span className="font-semibold break-words">{item.lead.nome}</span></div><p className="text-xs text-muted-foreground mt-1">{fuDate(item.due).toLocaleDateString('pt-BR')} · {item.confirmedAt ? `Enviado${item.confirmedName ? ` por ${item.confirmedName}` : ''} · acompanhamento aberto` : 'Envio pendente'}</p></div>
        <div className="flex gap-1"><Button variant="ghost" size="icon" title="Ver aluno" onClick={() => navigate(`/lead/${item.leadId}`)}><Eye className="w-4 h-4" /></Button><Button variant="outline" size="sm" onClick={() => select(item.id)}><MessageCircle className="w-4 h-4 mr-2" />Contato</Button><Button variant="ghost" size="icon" title="Acompanhamento" onClick={() => navigate(`/tarefas?task=${item.id}`)}><Check className="w-4 h-4" /></Button></div>
      </div>)}</div>}
      <Dialog open={!!selected && selected.unitId === unidadeAtual?.id} onOpenChange={open => { if (!open) select(null); }}><DialogContent><DialogHeader><DialogTitle>{selected?.lead.nome} · {selected?.stage}</DialogTitle></DialogHeader>{selected && <>
        <p className="text-sm">{selected.confirmedAt ? `Envio confirmado em ${new Date(selected.confirmedAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}` : 'Envio pendente'}</p>
        <p className="whitespace-pre-wrap text-sm">{fuItemMessage(selected, unitName)}</p>
        {confirmation.error && <p role="alert" className="text-sm text-destructive">{confirmation.error}</p>}
        <div className="flex flex-wrap gap-2">{fuItemLink(selected, unitName) ? <Button variant="outline" asChild><a href={fuItemLink(selected, unitName) ?? undefined} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4 mr-2" />Abrir WhatsApp</a></Button> : <span className="text-destructive text-sm">Telefone inválido ou ausente.</span>}{confirmationEnabled && canConfirm && !selected.confirmedAt && <Button disabled={loading || confirmation.saving || !selected.open || !fuItemLink(selected, unitName)} onClick={() => { void confirmation.confirm(selected); }}>{confirmation.saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Enviado</Button>}<Button variant="outline" onClick={() => navigate(`/tarefas?task=${selected.id}`)}>Acompanhamento</Button><Button variant="ghost" size="icon" title="Próximo aluno" disabled={confirmation.saving || index < 0 || index >= rows.length - 1} onClick={() => select(rows[index + 1]?.id ?? null)}><ChevronRight className="w-4 h-4" /></Button></div>
      </>}</DialogContent></Dialog>
    </CardContent>
  </Card>;
}