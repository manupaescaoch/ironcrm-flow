import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Lead, Interacao, StatusFunil, PlanoEscolhido } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusOptions: { value: StatusFunil; label: string }[] = [
  { value: 'novo', label: 'Novo' },
  { value: 'contato_inicial', label: 'Contato Inicial' },
  { value: 'aula_agendada', label: 'Aula Agendada' },
  { value: 'aula_realizada', label: 'Aula Realizada' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'perdido', label: 'Perdido' },
];

const planoOptions: PlanoEscolhido[] = [
  'Executivo Mensal',
  'Mensal',
  'Trimestral',
  'Semestral',
  'Anual',
  'Executivo Anual',
];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [novaInteracao, setNovaInteracao] = useState({ tipo: '', descricao: '' });

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchInteracoes();
    }
  }, [id]);

  const fetchLead = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Lead não encontrado', variant: 'destructive' });
      navigate('/crm');
      return;
    }
    setLead(data as unknown as Lead);
    setLoading(false);
  };

  const fetchInteracoes = async () => {
    const { data } = await supabase
      .from('interacoes')
      .select('*')
      .eq('lead_id', id)
      .order('data_interacao', { ascending: false });

    setInteracoes((data as unknown as Interacao[]) || []);
  };

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);

    const { error } = await supabase
      .from('leads')
      .update({
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        origem: lead.origem,
        status_funil: lead.status_funil,
        plano_escolhido: lead.plano_escolhido,
        data_aula_experimental: lead.data_aula_experimental,
        observacoes: lead.observacoes,
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } else {
      toast({ title: 'Lead atualizado!' });
    }
  };

  const handleAddInteracao = async () => {
    if (!novaInteracao.tipo.trim()) {
      toast({ title: 'Tipo da interação é obrigatório', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('interacoes').insert({
      lead_id: id,
      tipo: novaInteracao.tipo.trim(),
      descricao: novaInteracao.descricao.trim() || null,
      data_interacao: new Date().toISOString(),
    });

    if (error) {
      toast({ title: 'Erro ao adicionar interação', variant: 'destructive' });
    } else {
      toast({ title: 'Interação adicionada!' });
      setNovaInteracao({ tipo: '', descricao: '' });
      fetchInteracoes();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!lead) return null;

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/crm')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">{lead.nome}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Lead</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={lead.nome}
                      onChange={(e) => setLead({ ...lead, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={lead.email || ''}
                      onChange={(e) => setLead({ ...lead, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={lead.telefone || ''}
                      onChange={(e) => setLead({ ...lead, telefone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Input
                      value={lead.origem || ''}
                      onChange={(e) => setLead({ ...lead, origem: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={lead.status_funil}
                      onValueChange={(v) => setLead({ ...lead, status_funil: v as StatusFunil })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Select
                      value={lead.plano_escolhido || ''}
                      onValueChange={(v) => setLead({ ...lead, plano_escolhido: v as PlanoEscolhido })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {planoOptions.map((plano) => (
                          <SelectItem key={plano} value={plano}>
                            {plano}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data Aula Experimental</Label>
                    <Input
                      type="datetime-local"
                      value={lead.data_aula_experimental?.slice(0, 16) || ''}
                      onChange={(e) =>
                        setLead({ ...lead, data_aula_experimental: e.target.value || null })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    rows={4}
                    value={lead.observacoes || ''}
                    onChange={(e) => setLead({ ...lead, observacoes: e.target.value })}
                    placeholder="Anotações sobre o lead..."
                  />
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Interações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Tipo (ex: Ligação, WhatsApp)"
                    value={novaInteracao.tipo}
                    onChange={(e) =>
                      setNovaInteracao({ ...novaInteracao, tipo: e.target.value })
                    }
                  />
                  <Textarea
                    placeholder="Descrição..."
                    rows={2}
                    value={novaInteracao.descricao}
                    onChange={(e) =>
                      setNovaInteracao({ ...novaInteracao, descricao: e.target.value })
                    }
                  />
                  <Button size="sm" onClick={handleAddInteracao} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {interacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma interação registrada
                    </p>
                  ) : (
                    interacoes.map((int) => (
                      <div
                        key={int.id}
                        className="p-3 bg-muted/50 rounded-lg space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{int.tipo}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(int.data_interacao), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        {int.descricao && (
                          <p className="text-sm text-muted-foreground">{int.descricao}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
