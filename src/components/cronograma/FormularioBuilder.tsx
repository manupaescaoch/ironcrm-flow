import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useCreateFormulario, useUpdateFormulario, useFormularioCampos, FormularioCampo } from '@/hooks/useFormulariosData';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppGroup {
  id: string;
  name: string;
}

interface FormularioBuilderProps {
  formularioId?: string | null;
  onBack: () => void;
}

const TIPOS_CAMPO = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'foto', label: 'Foto' },
  { value: 'selecao', label: 'Seleção' },
];

const SETORES = [
  { value: 'geral', label: 'Geral' },
  { value: 'recepcao', label: 'Recepção' },
  { value: 'musculacao', label: 'Musculação' },
  { value: 'limpeza', label: 'Limpeza' },
];

const TURNOS = [
  { value: 'integral', label: 'Integral' },
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
];

export function FormularioBuilder({ formularioId, onBack }: FormularioBuilderProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setor, setSetor] = useState('geral');
  const [turno, setTurno] = useState('integral');
  const [whatsappGrupo, setWhatsappGrupo] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [campos, setCampos] = useState<FormularioCampo[]>([]);
  const [loading, setLoading] = useState(false);

  const createFormulario = useCreateFormulario();
  const updateFormulario = useUpdateFormulario();
  const { data: existingCampos } = useFormularioCampos(formularioId || null);

  useEffect(() => {
    if (formularioId) {
      supabase.from('formularios').select('*').eq('id', formularioId).single().then(({ data }) => {
        if (data) {
          setTitulo(data.titulo);
          setDescricao(data.descricao || '');
          setSetor(data.setor || 'geral');
          setTurno(data.turno || 'integral');
          setWhatsappGrupo(data.whatsapp_grupo || '');
          setAtivo(data.ativo);
        }
      });
    }
  }, [formularioId]);

  useEffect(() => {
    if (existingCampos && existingCampos.length > 0) {
      setCampos(existingCampos.map(c => ({
        tipo: c.tipo,
        label: c.label,
        opcoes: c.opcoes as string[] | null,
        ordem: c.ordem,
        obrigatorio: c.obrigatorio,
      })));
    }
  }, [existingCampos]);

  const addCampo = () => {
    setCampos(prev => [...prev, { tipo: 'texto', label: '', opcoes: null, ordem: prev.length, obrigatorio: false }]);
  };

  const removeCampo = (index: number) => {
    setCampos(prev => prev.filter((_, i) => i !== index));
  };

  const updateCampo = (index: number, updates: Partial<FormularioCampo>) => {
    setCampos(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const handleSave = async () => {
    if (!titulo.trim()) return;
    if (campos.length === 0) return;

    setLoading(true);
    try {
      if (formularioId) {
        await updateFormulario.mutateAsync({ id: formularioId, titulo, descricao, setor, turno, whatsapp_grupo: whatsappGrupo, ativo, campos });
      } else {
        await createFormulario.mutateAsync({ titulo, descricao, setor, turno, whatsapp_grupo: whatsappGrupo, campos });
      }
      onBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h3 className="text-lg font-semibold">
          {formularioId ? 'Editar Formulário' : 'Novo Formulário'}
        </h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Checklist Abertura" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional..." rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Setor</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETORES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TURNOS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>WhatsApp do Grupo para Respostas</Label>
            <Input value={whatsappGrupo} onChange={e => setWhatsappGrupo(e.target.value)} placeholder="ID do grupo WhatsApp" />
            <p className="text-xs text-muted-foreground mt-1">ID do grupo onde as respostas serão enviadas automaticamente</p>
          </div>
          {formularioId && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Formulário Ativo</Label>
                <p className="text-xs text-muted-foreground">Formulários inativos não aparecem para preenchimento</p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Campos do Formulário</CardTitle>
            <Button size="sm" variant="outline" onClick={addCampo}>
              <Plus className="w-4 h-4 mr-1" />
              Campo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {campos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Adicione campos ao formulário clicando no botão acima.
            </p>
          )}

          {campos.map((campo, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <GripVertical className="w-4 h-4 mt-3 text-muted-foreground shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Label *</Label>
                    <Input
                      value={campo.label}
                      onChange={e => updateCampo(index, { label: e.target.value })}
                      placeholder="Nome do campo"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={campo.tipo} onValueChange={v => updateCampo(index, { tipo: v })}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_CAMPO.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {campo.tipo === 'selecao' && (
                  <div>
                    <Label className="text-xs">Opções (separadas por vírgula)</Label>
                    <Input
                      value={(campo.opcoes || []).join(', ')}
                      onChange={e => updateCampo(index, { opcoes: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                      placeholder="Opção 1, Opção 2, Opção 3"
                      className="h-9"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    checked={campo.obrigatorio}
                    onCheckedChange={v => updateCampo(index, { obrigatorio: v })}
                    id={`obrigatorio-${index}`}
                  />
                  <Label htmlFor={`obrigatorio-${index}`} className="text-xs">Obrigatório</Label>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0 mt-1" onClick={() => removeCampo(index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleSave} disabled={loading || !titulo.trim() || campos.length === 0}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
