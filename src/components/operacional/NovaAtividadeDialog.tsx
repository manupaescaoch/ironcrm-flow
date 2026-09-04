import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCronogramaAtividades } from '@/hooks/useCronogramaAtividades';
import { useCronogramaFuncionarios } from '@/hooks/useCronogramaFuncionarios';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { PrioridadeSelect, SetorSelect, SEM_SETOR } from '@/components/cronograma/AtividadeCampos';
import { cn } from '@/lib/utils';

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const SEM_RESPONSAVEL = '__sem_resp__';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Dia pré-selecionado (0-6) */
  diaSemana?: number;
}

export function NovaAtividadeDialog({ open, onOpenChange, diaSemana }: Props) {
  const { unidadeId } = useUnidadeFilter();
  const { createAtividade } = useCronogramaAtividades();
  const { ativos: funcionarios } = useCronogramaFuncionarios();

  const [titulo, setTitulo] = useState('');
  const [horario, setHorario] = useState('');
  const [dias, setDias] = useState<number[]>(diaSemana === undefined ? [] : [diaSemana]);
  const [responsavelId, setResponsavelId] = useState(SEM_RESPONSAVEL);
  const [prioridade, setPrioridade] = useState('normal');
  const [setor, setSetor] = useState<string>(SEM_SETOR);

  const reset = () => {
    setTitulo('');
    setHorario('');
    setDias(diaSemana === undefined ? [] : [diaSemana]);
    setResponsavelId(SEM_RESPONSAVEL);
    setPrioridade('normal');
    setSetor(SEM_SETOR);
  };

  const toggleDia = (d: number) =>
    setDias((cur) => (cur.includes(d) ? cur.filter((v) => v !== d) : [...cur, d].sort()));

  const handleSave = () => {
    if (!titulo.trim() || !unidadeId) return;
    const base = {
      unidade_id: unidadeId,
      titulo: titulo.trim().toUpperCase(),
      horario: horario || undefined,
      responsavel_id: responsavelId === SEM_RESPONSAVEL ? undefined : responsavelId,
      prioridade,
      setor: setor === SEM_SETOR ? null : setor,
    };
    const payload = dias.length ? dias.map((d) => ({ ...base, dia_semana: d })) : [{ ...base }];
    createAtividade.mutate(payload, {
      onSuccess: () => {
        reset();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova atividade</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value.toUpperCase())} placeholder="EX: CONFERIR RECEPÇÃO" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDia(i)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    dias.includes(i) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {dias.length === 0 ? 'Nenhum dia selecionado: valerá para todos os dias.' : `${dias.length} dia(s) selecionado(s).`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <PrioridadeSelect value={prioridade} onValueChange={setPrioridade} />
            </div>
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <SetorSelect value={setor} onValueChange={setSetor} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!titulo.trim() || createAtividade.isPending}>
            Criar atividade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
