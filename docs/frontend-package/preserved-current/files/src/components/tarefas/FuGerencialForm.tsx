import { useCallback, useEffect, useState } from 'react';
import { useFuContact } from '@/hooks/useFuContact';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { linkGerencial, mensagemGerencial, STATUS_GERENCIAIS, type RegistroGerencial, type StatusGerencial } from '@/lib/fuGerencial';
import type { Task } from '@/hooks/useTarefasData';

export function FuGerencialForm({ task, status, registro, onStatus, onRegistro }: {
  task: Task; status: StatusGerencial; registro: RegistroGerencial;
  onStatus: (value: StatusGerencial) => void; onRegistro: (value: RegistroGerencial) => void;
}) {
  const { unidadeAtual } = useUnidade();
  const { userRole: role } = useAuth();
  const makeMessage = useCallback((nome: string) => mensagemGerencial(nome, unidadeAtual?.nome ?? '', task.responsavel, task.fu_gerencial_etapa ?? 'M+30'), [task.fu_gerencial_etapa, task.responsavel, unidadeAtual?.nome]);
  const { aluno, mensagem, setMensagem, ready, error } = useFuContact({ taskId: task.id, leadId: task.fu_gerencial_lead_id ?? '', enrollmentId: task.fu_gerencial_matricula_id ?? '', unitId: task.unidade_id === unidadeAtual?.id ? unidadeAtual.id : '', stage: task.fu_gerencial_etapa ?? '' }, makeMessage);
  const [anteriores, setAnteriores] = useState<{ titulo: string; status: string | null; registro: unknown }[]>([]);
  const terminal = ['concluido', 'dispensado', 'cancelado'].includes(task.fu_gerencial_status ?? '');
  const permitido = ['admin', 'gerente'].includes(role ?? '') && !terminal;
  useEffect(() => {
    let alive = true;
    setAnteriores([]);
    (async () => {
      if (!task.fu_gerencial_lead_id || !task.fu_gerencial_matricula_id || !task.fu_gerencial_etapa || !unidadeAtual) return;
      const historyResult = await supabase.from('tasks').select('titulo,fu_gerencial_status,fu_gerencial_registro').eq('fu_gerencial_lead_id', task.fu_gerencial_lead_id).eq('unidade_id', unidadeAtual.id).neq('id', task.id).order('created_at');
      if (!alive) return;
      setAnteriores((historyResult.data ?? []).map(t => ({ titulo: t.titulo, status: t.fu_gerencial_status, registro: t.fu_gerencial_registro })));
    })().catch(() => { if (alive) setAnteriores([]); });
    return () => { alive = false; };
  }, [task.id, task.fu_gerencial_lead_id, task.fu_gerencial_matricula_id, task.fu_gerencial_etapa, task.responsavel, unidadeAtual]);
  const link = ready ? linkGerencial(aluno?.telefone, mensagem) : null;
  const change = (key: keyof RegistroGerencial, value: string) => onRegistro({ ...registro, [key]: value });
  return <div className="space-y-4 border-t border-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Acompanhamento gerencial · {task.fu_gerencial_etapa}</h3>
      <Button type="button" variant="outline" size="sm" asChild><Link to={`/lead/${task.fu_gerencial_lead_id}`}>Histórico do aluno</Link></Button>
    </div>
    <div className="text-sm space-y-1">
      <p>{aluno?.nome ?? task.titulo} · {unidadeAtual?.nome}</p>
      {task.fu_gerencial_contexto?.avisos?.map((aviso, index) => <p key={index} className="text-destructive">{aviso}</p>)}
      <p>Envio ao aluno: <strong>{task.fu_gerencial_confirmado_em ? 'Enviado' : 'Pendente'}</strong></p>
      {task.fu_gerencial_confirmado_em && <p className="text-muted-foreground">Confirmado por {task.fu_gerencial_confirmado_nome} em {new Date(task.fu_gerencial_confirmado_em).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}</p>}
      {task.fu_gerencial_envio_erro && <p className="text-destructive">{task.fu_gerencial_envio_erro}</p>}
    </div>
    {anteriores.length > 0 && <details className="text-sm">
      <summary className="cursor-pointer font-medium">Acompanhamentos anteriores e pendências</summary>
      {anteriores.map((item, index) => <div key={index} className="border-l border-border pl-3 mt-2">
        <p>{item.titulo} · {item.status}</p><pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.registro ? JSON.stringify(item.registro, null, 2) : 'Sem registro gerencial'}</pre>
      </div>)}
    </details>}
    {task.fu_gerencial_concluido_em && <p className="text-sm text-muted-foreground">Concluído em {new Date(task.fu_gerencial_concluido_em).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}</p>}
    <Label htmlFor="fu-mensagem">Mensagem proposta</Label>
    <Textarea id="fu-mensagem" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={7} disabled={!ready} />
    {link ? <Button type="button" variant="outline" asChild><a href={link} target="_blank" rel="noopener noreferrer">Falar com o aluno</a></Button> : <p role="status" className="text-muted-foreground text-sm">{error ?? (ready ? 'Telefone inválido ou ausente — acompanhamento presencial disponível.' : 'Carregando contato…')}</p>}
    <div className="space-y-2"><Label>Situação do acompanhamento</Label>
      <Select value={status} onValueChange={v => onStatus(v as StatusGerencial)} disabled={!permitido}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_GERENCIAIS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-2"><Label htmlFor="fu-data">Data do acompanhamento</Label><Input id="fu-data" type="date" value={registro.data} onChange={e => change('data', e.target.value)} disabled={!permitido} /></div>
      <div className="space-y-2"><Label htmlFor="fu-coord">Gerente responsável</Label><Input id="fu-coord" value={registro.gerente} onChange={e => change('gerente', e.target.value.toUpperCase())} disabled={!permitido} /></div>
    </div>
    <div className="space-y-2"><Label>Canal utilizado</Label>
      <Select value={registro.canal} onValueChange={v => change('canal', v)} disabled={!permitido}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent></Select>
    </div>
    {(['percepcao', 'reclamacoes', 'melhorias', 'providencias'] as const).map((key, index) => <div key={key} className="space-y-2"><Label htmlFor={`fu-${key}`}>{['Percepção do aluno', 'Reclamações identificadas', 'Oportunidades de melhoria', 'Providências necessárias'][index]}</Label><Textarea id={`fu-${key}`} rows={2} value={registro[key]} onChange={e => change(key, e.target.value.toUpperCase())} disabled={!permitido} /></div>)}
  </div>;
}