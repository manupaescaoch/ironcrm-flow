import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Rotina, RotinaInsert, SETORES, FREQUENCIAS, PRIORIDADES_ROTINA } from '@/hooks/useRotinasData';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { useUnidadeUsers } from '@/hooks/useUnidadeUsers';

interface AtividadeForm {
  titulo: string;
  responsavel: string;
  horario: string;
  observacao: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rotina?: Rotina | null;
  existingAtividades?: { titulo: string; responsavel: string | null; horario: string | null; observacao: string | null }[];
  onSave: (data: RotinaInsert, atividades: AtividadeForm[]) => Promise<void>;
  saving: boolean;
}

export function RotinaModal({ open, onOpenChange, rotina, existingAtividades, onSave, saving }: Props) {
  const { unidadeId } = useUnidadeFilter();
  const { users } = useUnidadeUsers();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setor, setSetor] = useState('Geral');
  const [responsavelPrincipal, setResponsavelPrincipal] = useState('');
  const [responsavelConferencia, setResponsavelConferencia] = useState('');
  const [frequencia, setFrequencia] = useState('diaria');
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [horarioEsperado, setHorarioEsperado] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [atividades, setAtividades] = useState<AtividadeForm[]>([]);

  useEffect(() => {
    if (rotina) {
      setNome(rotina.nome);
      setDescricao(rotina.descricao || '');
      setSetor(rotina.setor);
      setResponsavelPrincipal(rotina.responsavel_principal || '');
      setResponsavelConferencia(rotina.responsavel_conferencia || '');
      const freqParts = rotina.frequencia.split(':');
      setFrequencia(freqParts[0]);
      setDiasSemana(freqParts[1] ? freqParts[1].split(',') : []);
      setHorarioEsperado(rotina.horario_esperado?.slice(0, 5) || '');
      setPrioridade(rotina.prioridade);
      setAtividades(
        existingAtividades?.map(a => ({
          titulo: a.titulo,
          responsavel: a.responsavel || '',
          horario: a.horario?.slice(0, 5) || '',
          observacao: a.observacao || '',
        })) || []
      );
    } else {
      setNome(''); setDescricao(''); setSetor('Geral'); setResponsavelPrincipal('');
      setResponsavelConferencia(''); setFrequencia('diaria'); setDiasSemana([]);
      setHorarioEsperado(''); setPrioridade('media'); setAtividades([]);
    }
  }, [rotina, existingAtividades, open]);

  const addAtividade = () => setAtividades([...atividades, { titulo: '', responsavel: '', horario: '', observacao: '' }]);
  const removeAtividade = (i: number) => setAtividades(atividades.filter((_, idx) => idx !== i));
  const updateAtividade = (i: number, field: keyof AtividadeForm, value: string) => {
    const updated = [...atividades];
    updated[i] = { ...updated[i], [field]: value };
    setAtividades(updated);
  };

  const DIAS_SEMANA = [
    { value: 'seg', label: 'Seg' },
    { value: 'ter', label: 'Ter' },
    { value: 'qua', label: 'Qua' },
    { value: 'qui', label: 'Qui' },
    { value: 'sex', label: 'Sex' },
    { value: 'sab', label: 'Sáb' },
    { value: 'dom', label: 'Dom' },
  ];

  const toggleDia = (dia: string) => {
    setDiasSemana(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const handleSubmit = async () => {
    if (!nome.trim() || !unidadeId) return;
    let freq = frequencia;
    if (frequencia === 'semanal' && diasSemana.length > 0) {
      freq = `semanal:${diasSemana.join(',')}`;
    }
    await onSave({
      unidade_id: unidadeId,
      nome: nome.trim().toUpperCase(),
      descricao: descricao.trim() || null,
      setor,
      responsavel_principal: responsavelPrincipal || null,
      responsavel_conferencia: responsavelConferencia || null,
      frequencia: freq,
      horario_esperado: horarioEsperado || null,
      prioridade,
    }, atividades.filter(a => a.titulo.trim()));
    onOpenChange(false);
  };

  const userOptions = users.map(u => ({ value: u.name, label: u.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rotina ? 'Editar Rotina' : 'Nova Rotina'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Nome da Rotina *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Vistoria geral da limpeza" />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição da rotina..." className="min-h-[60px]" />
            </div>
            <div>
              <Label>Setor *</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequência *</Label>
              <Select value={frequencia} onValueChange={setFrequencia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {frequencia === 'semanal' && (
              <div className="md:col-span-2">
                <Label className="mb-2 block">Dias da Semana</Label>
                <div className="flex flex-wrap gap-3">
                  {DIAS_SEMANA.map(dia => (
                    <label key={dia.value} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={diasSemana.includes(dia.value)}
                        onCheckedChange={() => toggleDia(dia.value)}
                      />
                      <span className="text-sm">{dia.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Responsável Principal</Label>
              <Select value={responsavelPrincipal || '__none__'} onValueChange={(v) => setResponsavelPrincipal(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {userOptions.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável Conferência</Label>
              <Select value={responsavelConferencia || '__none__'} onValueChange={(v) => setResponsavelConferencia(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {userOptions.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horário Esperado</Label>
              <Input type="time" value={horarioEsperado} onChange={(e) => setHorarioEsperado(e.target.value)} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES_ROTINA.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Atividades / Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Atividades / Checklist</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAtividade}>
                <Plus className="w-4 h-4 mr-1" /> Atividade
              </Button>
            </div>
            {atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma atividade. Clique em "+ Atividade" para adicionar.</p>
            ) : (
              <div className="space-y-3">
                {atividades.map((at, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                    <GripVertical className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input placeholder="Título da atividade *" value={at.titulo} onChange={(e) => updateAtividade(i, 'titulo', e.target.value)} className="md:col-span-2" />
                      <Select value={at.responsavel || '__none__'} onValueChange={(v) => updateAtividade(i, 'responsavel', v === '__none__' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum</SelectItem>
                          {userOptions.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeAtividade(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !nome.trim()}>
            {saving ? 'Salvando...' : rotina ? 'Salvar' : 'Criar Rotina'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
