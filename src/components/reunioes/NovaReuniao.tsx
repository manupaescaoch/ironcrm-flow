import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReunioesData, type EncaminhamentoInput } from '@/hooks/useReunioesData';
import { TIPOS_REUNIAO, NUMEROS_PERIODO_CAMPOS, STATUS_ENCAMINHAMENTO } from './constants';

interface Props {
  onSaved?: () => void;
}

export function NovaReuniao({ onSaved }: Props) {
  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  const { isAdmin } = useAuth();
  const { createReuniao } = useReunioesData();

  const [tipo, setTipo] = useState<string>('');
  const [unidadeId, setUnidadeId] = useState<string>(unidadeAtual?.id ?? '');
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [participanteInput, setParticipanteInput] = useState('');
  const [numeros, setNumeros] = useState<Record<string, string>>({});
  const [pauta, setPauta] = useState('');
  const [decisoes, setDecisoes] = useState('');
  const [resumo, setResumo] = useState('');
  const [encaminhamentos, setEncaminhamentos] = useState<EncaminhamentoInput[]>([]);
  const [saving, setSaving] = useState(false);

  const addParticipante = () => {
    const v = participanteInput.trim().toUpperCase();
    if (v && !participantes.includes(v)) {
      setParticipantes([...participantes, v]);
    }
    setParticipanteInput('');
  };

  const addEncaminhamento = () => {
    setEncaminhamentos([
      ...encaminhamentos,
      { acao: '', responsavel_nome: '', prazo: null, status: 'aberto' },
    ]);
  };

  const updateEnc = (i: number, patch: Partial<EncaminhamentoInput>) => {
    setEncaminhamentos(encaminhamentos.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const removeEnc = (i: number) => {
    setEncaminhamentos(encaminhamentos.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!tipo) return toast({ title: 'Selecione o tipo da reunião', variant: 'destructive' });
    if (!unidadeId) return toast({ title: 'Selecione a unidade', variant: 'destructive' });
    if (!data) return toast({ title: 'Informe a data', variant: 'destructive' });
    if (participantes.length === 0) return toast({ title: 'Adicione ao menos um participante', variant: 'destructive' });
    if (!pauta.trim()) return toast({ title: 'Informe a pauta', variant: 'destructive' });

    const invalidEnc = encaminhamentos.find((e) => !e.acao?.trim());
    if (invalidEnc) return toast({ title: 'Encaminhamentos precisam ter uma ação', variant: 'destructive' });

    const numerosPayload: Record<string, number> = {};
    for (const { key } of NUMEROS_PERIODO_CAMPOS) {
      const v = numeros[key];
      if (v !== undefined && v !== '') {
        const n = Number(v);
        if (!isNaN(n)) numerosPayload[key] = n;
      }
    }

    setSaving(true);
    try {
      await createReuniao({
        tipo,
        unidade_id: unidadeId,
        data,
        participantes,
        numeros_periodo: numerosPayload,
        pauta: pauta.trim() || null,
        decisoes: decisoes.trim() || null,
        resumo: resumo.trim() || null,
        status: 'aberta',
        encaminhamentos: encaminhamentos.map((e) => ({
          acao: e.acao.trim(),
          responsavel_nome: e.responsavel_nome?.trim().toUpperCase() || null,
          prazo: e.prazo || null,
          status: e.status || 'aberto',
        })),
      });
      toast({ title: 'Reunião registrada com sucesso' });
      // reset
      setTipo('');
      setParticipantes([]);
      setNumeros({});
      setPauta('');
      setDecisoes('');
      setResumo('');
      setEncaminhamentos([]);
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const unidadeOptions = isAdmin ? unidadesPermitidas : unidadesPermitidas;

  return (
    <Card className="p-4 md:p-6 space-y-5">
      {/* Dados gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo *</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {TIPOS_REUNIAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Unidade *</Label>
          <Select value={unidadeId} onValueChange={setUnidadeId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {unidadeOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Data *</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>

      {/* Participantes */}
      <div className="space-y-1.5">
        <Label>Participantes *</Label>
        <div className="flex gap-2">
          <Input
            value={participanteInput}
            onChange={(e) => setParticipanteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addParticipante();
              }
            }}
            placeholder="Digite o nome e pressione Enter"
          />
          <Button type="button" variant="outline" onClick={addParticipante}>Adicionar</Button>
        </div>
        {participantes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {participantes.map((p, i) => (
              <Badge key={i} variant="secondary" className="font-normal gap-1">
                {p}
                <button onClick={() => setParticipantes(participantes.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Números do período */}
      <div className="space-y-2">
        <Label>Números do período</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {NUMEROS_PERIODO_CAMPOS.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <Input
                type="number"
                value={numeros[key] ?? ''}
                onChange={(e) => setNumeros({ ...numeros, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pauta / Decisões / Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Pauta *</Label>
          <Textarea rows={4} value={pauta} onChange={(e) => setPauta(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Decisões</Label>
          <Textarea rows={4} value={decisoes} onChange={(e) => setDecisoes(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Resumo (aparece na listagem)</Label>
        <Input value={resumo} onChange={(e) => setResumo(e.target.value)} maxLength={200} />
      </div>

      {/* Encaminhamentos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Encaminhamentos</Label>
          <Button type="button" size="sm" variant="outline" onClick={addEncaminhamento}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
        {encaminhamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
            Nenhum encaminhamento. Clique em "Adicionar".
          </p>
        ) : (
          <div className="space-y-2">
            {encaminhamentos.map((e, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start border rounded-md p-2">
                <div className="col-span-12 md:col-span-5 space-y-1">
                  <label className="text-xs text-muted-foreground">Ação *</label>
                  <Input value={e.acao} onChange={(ev) => updateEnc(i, { acao: ev.target.value })} />
                </div>
                <div className="col-span-6 md:col-span-3 space-y-1">
                  <label className="text-xs text-muted-foreground">Responsável</label>
                  <Input value={e.responsavel_nome ?? ''} onChange={(ev) => updateEnc(i, { responsavel_nome: ev.target.value.toUpperCase() })} />
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Prazo</label>
                  <Input type="date" value={e.prazo ?? ''} onChange={(ev) => updateEnc(i, { prazo: ev.target.value })} />
                </div>
                <div className="col-span-10 md:col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={e.status ?? 'aberto'} onValueChange={(v) => updateEnc(i, { status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_ENCAMINHAMENTO.filter((s) => s.value !== 'atrasado').map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 md:col-span-12 flex md:justify-end pt-5 md:pt-0">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeEnc(i)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar reunião
        </Button>
      </div>
    </Card>
  );
}
