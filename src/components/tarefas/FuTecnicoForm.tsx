import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { linkTecnico, mensagemTecnica, STATUS_TECNICOS, type RegistroTecnico, type StatusTecnico } from '@/lib/fuTecnico';
import type { Task } from '@/hooks/useTarefasData';

export function FuTecnicoForm({ task, status, registro, onStatus, onRegistro }: {
  task: Task; status: StatusTecnico; registro: RegistroTecnico;
  onStatus: (value: StatusTecnico) => void; onRegistro: (value: RegistroTecnico) => void;
}) {
  const { unidadeAtual } = useUnidade();
  const { role } = useAuth();
  const [aluno, setAluno] = useState<{ nome: string; telefone: string | null } | null>(null);
  const [treinador, setTreinador] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [anteriores, setAnteriores] = useState<{ titulo: string; status: string | null; registro: unknown }[]>([]);
  const terminal = ['concluido', 'dispensado', 'cancelado'].includes(task.fu_tecnico_status ?? '');
  const permitido = ['admin', 'gerente', 'coordenador'].includes(role ?? '') && !terminal;
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!task.fu_tecnico_lead_id || !task.fu_tecnico_matricula_id || !task.fu_tecnico_etapa || !unidadeAtual) return;
      const [leadResult, enrollmentResult, historyResult] = await Promise.all([
        supabase.from('leads').select('nome,telefone').eq('id', task.fu_tecnico_lead_id).eq('unidade_id', unidadeAtual.id).maybeSingle(),
        supabase.from('interacoes').select('treinador_responsavel').eq('id', task.fu_tecnico_matricula_id).maybeSingle(),
        supabase.from('tasks').select('titulo,fu_tecnico_status,fu_tecnico_registro').eq('fu_tecnico_lead_id', task.fu_tecnico_lead_id).neq('id', task.id).order('created_at'),
      ]);
      if (!alive) return;
      setAluno(leadResult.data);
      setTreinador(enrollmentResult.data?.treinador_responsavel ?? null);
      setAnteriores((historyResult.data ?? []).map(t => ({ titulo: t.titulo, status: t.fu_tecnico_status, registro: t.fu_tecnico_registro })));
      if (leadResult.data) setMensagem(mensagemTecnica(task.fu_tecnico_etapa, leadResult.data.nome, unidadeAtual.nome, task.responsavel));
    })();
    return () => { alive = false; };
  }, [task.id, task.fu_tecnico_lead_id, task.fu_tecnico_matricula_id, task.fu_tecnico_etapa, task.responsavel, unidadeAtual]);
  const link = linkTecnico(aluno?.telefone, mensagem);
  const change = (key: keyof RegistroTecnico, value: string) => onRegistro({ ...registro, [key]: value });
  return <div className="space-y-4 border-t border-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Acompanhamento técnico · {task.fu_tecnico_etapa}</h3>
      <Button type="button" variant="outline" size="sm" asChild><Link to={`/lead/${task.fu_tecnico_lead_id}`}>Histórico do aluno</Link></Button>
    </div>
    <div className="text-sm space-y-1">
      <p>{aluno?.nome ?? task.titulo} · {unidadeAtual?.nome}</p>
      <p className="text-muted-foreground">Treinador: {treinador ?? 'Não identificado'}</p>
      {task.fu_tecnico_envio_erro && <p className="text-destructive">{task.fu_tecnico_envio_erro}</p>}
    </div>
    {anteriores.length > 0 && <details className="text-sm">
      <summary className="cursor-pointer font-medium">Acompanhamentos anteriores e pendências</summary>
      {anteriores.map((item, index) => <div key={index} className="border-l border-border pl-3 mt-2">
        <p>{item.titulo} · {item.status}</p><pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.registro ? JSON.stringify(item.registro, null, 2) : 'Sem registro técnico'}</pre>
      </div>)}
    </details>}
    <Label htmlFor="fu-mensagem">Mensagem proposta</Label>
    <Textarea id="fu-mensagem" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={7} />
    {link ? <Button type="button" variant="outline" asChild><a href={link} target="_blank" rel="noopener noreferrer">Falar com o aluno</a></Button> : <p className="text-destructive text-sm">Telefone inválido ou ausente — acompanhamento presencial disponível.</p>}
    <div className="space-y-2"><Label>Situação do acompanhamento</Label>
      <Select value={status} onValueChange={v => onStatus(v as StatusTecnico)} disabled={!permitido}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_TECNICOS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-2"><Label htmlFor="fu-data">Data do acompanhamento</Label><Input id="fu-data" type="date" value={registro.data} onChange={e => change('data', e.target.value)} disabled={!permitido} /></div>
      <div className="space-y-2"><Label htmlFor="fu-coord">Coordenador responsável</Label><Input id="fu-coord" value={registro.coordenador} onChange={e => change('coordenador', e.target.value.toUpperCase())} disabled={!permitido} /></div>
    </div>
    <div className="space-y-2"><Label>Canal utilizado</Label>
      <Select value={registro.canal} onValueChange={v => change('canal', v)} disabled={!permitido}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent></Select>
    </div>
    {(['observacoes', 'dificuldades', 'ajustes', 'encaminhamentos'] as const).map((key, index) => <div key={key} className="space-y-2"><Label htmlFor={`fu-${key}`}>{['Observações', 'Dificuldades identificadas', 'Ajustes necessários', 'Pendências encaminhadas'][index]}</Label><Textarea id={`fu-${key}`} rows={2} value={registro[key]} onChange={e => change(key, e.target.value.toUpperCase())} disabled={!permitido} /></div>)}
  </div>;
}