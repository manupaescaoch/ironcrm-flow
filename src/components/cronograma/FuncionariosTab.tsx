import { useState } from 'react';
import { useCronogramaFuncionarios, CronogramaFuncionario } from '@/hooks/useCronogramaFuncionarios';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Phone, Edit, Trash2, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const SETORES = ['treinador', 'recepção', 'comercial'];
const TURNOS = ['integral', 'manhã', 'tarde', 'noite'];
const CARGOS: { value: 'recepcao' | 'coordenador_unidade' | 'treinador' | 'estagiario_lider'; label: string; descricao: string }[] = [
  { value: 'recepcao', label: 'Recepção', descricao: 'Recebe o Relatório Diário Comercial' },
  { value: 'coordenador_unidade', label: 'Coordenador de Unidade', descricao: 'Recebe o Encerramento — Coordenador de Unidade' },
  { value: 'treinador', label: 'Treinador', descricao: 'Recebe o Encerramento — Coordenador de Horário' },
  { value: 'estagiario_lider', label: 'Estagiário Líder', descricao: 'Recebe o Encerramento — Estagiário Líder' },
];

export function FuncionariosTab() {
  const { funcionarios, isLoading, createFuncionario, updateFuncionario, deleteFuncionario } = useCronogramaFuncionarios();
  const { unidadeId } = useUnidadeFilter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ nome: string; telefone: string; setor: string; turno: string; cargo: '' | 'recepcao' | 'coordenador_unidade' | 'treinador' | 'estagiario_lider' }>({ nome: '', telefone: '', setor: 'treinador', turno: 'integral', cargo: '' });

  const resetForm = () => {
    setForm({ nome: '', telefone: '', setor: 'treinador', turno: 'integral', cargo: '' });
    setEditingId(null);
  };

  const handleEdit = (f: CronogramaFuncionario) => {
    setForm({ nome: f.nome, telefone: f.telefone || '', setor: f.setor, turno: f.turno, cargo: (f.cargo as any) || '' });
    setEditingId(f.id);
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.nome || !unidadeId) return;
    const cargoVal = form.cargo || null;
    if (editingId) {
      updateFuncionario.mutate({ id: editingId, nome: form.nome, telefone: form.telefone || null, setor: form.setor, turno: form.turno, cargo: cargoVal }, {
        onSuccess: () => { setOpen(false); resetForm(); },
      });
    } else {
      createFuncionario.mutate({ unidade_id: unidadeId, nome: form.nome, telefone: form.telefone || null, setor: form.setor, turno: form.turno, cargo: cargoVal, ativo: true }, {
        onSuccess: () => { setOpen(false); resetForm(); },
      });
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Funcionários ({funcionarios.length})
        </h3>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> Novo Funcionário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Funcionário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <Label>Setor</Label>
                <Select value={form.setor} onValueChange={v => setForm(f => ({ ...f, setor: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETORES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cargo (define qual formulário recebe)</Label>
                <Select value={form.cargo || 'none'} onValueChange={v => setForm(f => ({ ...f, cargo: v === 'none' ? '' : v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    {CARGOS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex flex-col">
                          <span>{c.label}</span>
                          <span className="text-xs text-muted-foreground">{c.descricao}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Sem cargo definido, o sistema tenta adivinhar pelo nome — pode dar erro.</p>
              </div>
              <div>
                <Label>Turno</Label>
                <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TURNOS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} disabled={!form.nome} className="w-full">
                {editingId ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {funcionarios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum funcionário cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcionarios.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>
                      {f.telefone ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3" /> {f.telefone}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell><Badge variant="outline">{f.setor}</Badge></TableCell>
                    <TableCell>
                      {f.cargo
                        ? <Badge>{CARGOS.find(c => c.value === f.cargo)?.label || f.cargo}</Badge>
                        : <Badge variant="destructive">não definido</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{f.turno}</Badge></TableCell>
                    <TableCell>
                      <Switch
                        checked={f.ativo}
                        onCheckedChange={checked => updateFuncionario.mutate({ id: f.id, ativo: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFuncionario.mutate(f.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
