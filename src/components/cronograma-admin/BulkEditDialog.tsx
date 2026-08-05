import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DIAS_SEMANA } from '@/lib/cronUtils';
import { NOME_TOKEN, inserirToken } from '@/lib/mensagemPlaceholder';
import type { CronogramaAtividadeAdmin } from '@/hooks/useCronogramaAdmin';

export type BulkField =
  | 'ativar' | 'pausar'
  | 'horario' | 'responsavel_id' | 'unidade_id' | 'turno' | 'mensagem' | 'dias'
  | 'duplicar' | 'excluir';

const FIELD_TITLES: Record<BulkField, string> = {
  ativar: 'Ativar automações',
  pausar: 'Pausar automações',
  horario: 'Alterar horário',
  responsavel_id: 'Alterar responsável',
  unidade_id: 'Alterar unidade',
  turno: 'Alterar turno',
  mensagem: 'Alterar mensagem / modelo',
  dias: 'Alterar dias da semana',
  duplicar: 'Duplicar automações',
  excluir: 'Excluir automações',
};

interface Option { id: string; label: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  field: BulkField | null;
  selected: CronogramaAtividadeAdmin[];
  unidadesOptions: Option[];
  responsaveisOptions: Option[];
  loading: boolean;
  onSubmit: (payload: {
    patch?: Record<string, any>;
    add_dias?: number[] | null;
    replace_dias?: number[] | null;
    duplicate?: boolean;
    delete?: boolean;
  }) => Promise<void> | void;
}

export function BulkEditDialog({ open, onOpenChange, field, selected, unidadesOptions, responsaveisOptions, loading, onSubmit }: Props) {
  const [horario, setHorario] = useState('');
  const [respId, setRespId] = useState('');
  const [uniId, setUniId] = useState('');
  const [turno, setTurno] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [dias, setDias] = useState<number[]>([]);
  const mensagemRef = useRef<HTMLTextAreaElement | null>(null);
  const [diasMode, setDiasMode] = useState<'replace' | 'add'>('replace');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setHorario(''); setRespId(''); setUniId(''); setTurno(''); setMensagem('');
      setDias([]); setDiasMode('replace'); setConfirmed(false);
    }
  }, [open, field]);

  if (!field) return null;

  const n = selected.length;
  const unidadesEnv = Array.from(new Set(selected.map(s => s.unidades?.nome).filter(Boolean))).join(', ');
  const respEnv = Array.from(new Set(selected.map(s => s.cronograma_funcionarios?.nome).filter(Boolean))).join(', ');

  const toggleDia = (v: number) => setDias(d => d.includes(v) ? d.filter(x => x !== v) : [...d, v]);

  async function handleSubmit() {
    if (field === 'ativar') return onSubmit({ patch: { ativo: true } });
    if (field === 'pausar') return onSubmit({ patch: { ativo: false } });
    if (field === 'excluir') return onSubmit({ delete: true });
    if (field === 'duplicar') return onSubmit({ duplicate: true });
    if (field === 'horario') return onSubmit({ patch: { horario: horario ? `${horario}:00` : '' } });
    if (field === 'responsavel_id') return onSubmit({ patch: { responsavel_id: respId } });
    if (field === 'unidade_id') return onSubmit({ patch: { unidade_id: uniId } });
    if (field === 'turno') return onSubmit({ patch: { turno } });
    if (field === 'mensagem') return onSubmit({ patch: { mensagem } });
    if (field === 'dias') {
      return onSubmit(diasMode === 'replace' ? { replace_dias: dias } : { add_dias: dias });
    }
  }

  const isDestructive = field === 'excluir';
  const needsConfirm = n > 5 || isDestructive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{FIELD_TITLES[field]}</DialogTitle>
          <DialogDescription>
            {n} automação{n !== 1 ? 'ões' : ''} selecionada{n !== 1 ? 's' : ''}
            {unidadesEnv && <><br/>Unidades: <b>{unidadesEnv}</b></>}
            {respEnv && <><br/>Responsáveis: <b>{respEnv}</b></>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {field === 'horario' && (
            <div>
              <Label>Novo horário</Label>
              <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} />
            </div>
          )}
          {field === 'responsavel_id' && (
            <div>
              <Label>Novo responsável</Label>
              <Select value={respId} onValueChange={setRespId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {responsaveisOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {field === 'unidade_id' && (
            <div>
              <Label>Nova unidade</Label>
              <Select value={uniId} onValueChange={setUniId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {unidadesOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {field === 'turno' && (
            <div>
              <Label>Novo turno</Label>
              <Input value={turno} onChange={e => setTurno(e.target.value.toUpperCase())} placeholder="Ex: TURNO 1" />
            </div>
          )}
          {field === 'mensagem' && (
            <div className="space-y-2">
              <Label>Nova mensagem</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => inserirToken(mensagemRef.current, mensagem, NOME_TOKEN, setMensagem)}
                >
                  + Inserir nome
                </Button>
                <span className="text-xs text-muted-foreground normal-case">
                  [NOME] é trocado pelo primeiro nome do responsável no envio.
                </span>
              </div>
              <Textarea
                ref={mensagemRef}
                preserveCase
                rows={5}
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
              />
              {contemNomeToken(mensagem) && (
                <div className="text-xs bg-muted/40 rounded-md px-3 py-2 normal-case">
                  A variável será trocada, em cada envio, pelo primeiro nome do responsável
                  daquela linha selecionada.
                </div>
              )}
            </div>
          )}


          {field === 'dias' && (
            <div className="space-y-3">
              <RadioGroup value={diasMode} onValueChange={(v: any) => setDiasMode(v)} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="replace" id="rep" /><Label htmlFor="rep">Substituir dias atuais</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="add" id="add" /><Label htmlFor="add">Adicionar aos dias existentes</Label></div>
              </RadioGroup>
              <div className="grid grid-cols-4 gap-2">
                {DIAS_SEMANA.map(d => (
                  <label key={d.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={dias.includes(d.value)} onCheckedChange={() => toggleDia(d.value)} />
                    {d.label}
                  </label>
                ))}
              </div>
              {diasMode === 'replace' && (
                <p className="text-xs text-muted-foreground">O primeiro dia manterá o registro original; os demais serão criados como cópias.</p>
              )}
              {diasMode === 'add' && (
                <p className="text-xs text-muted-foreground">Duplica cada automação selecionada nos dias marcados.</p>
              )}
            </div>
          )}
          {field === 'duplicar' && (
            <p className="text-sm">Serão criadas <b>{n}</b> cópias com os mesmos horários e dias.</p>
          )}
          {field === 'ativar' && <p className="text-sm">Todas as <b>{n}</b> automações selecionadas serão <b>ativadas</b>.</p>}
          {field === 'pausar' && <p className="text-sm">Todas as <b>{n}</b> automações selecionadas serão <b>pausadas</b>.</p>}
          {field === 'excluir' && <p className="text-sm text-destructive">Você está prestes a excluir <b>{n}</b> automações. Elas serão movidas para inativas.</p>}

          {needsConfirm && (
            <label className="flex items-start gap-2 text-sm p-2 bg-muted rounded">
              <Checkbox checked={confirmed} onCheckedChange={(v: any) => setConfirmed(!!v)} />
              <span>Confirmo que quero alterar {n} automações.</span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            disabled={loading || (needsConfirm && !confirmed)}
            onClick={handleSubmit}
          >
            {loading ? 'Aplicando...' : 'Aplicar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
