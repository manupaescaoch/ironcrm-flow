import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Formulario {
  id: string;
  titulo: string;
  descricao: string | null;
  unidade_id: string;
  ativo: boolean;
}
interface Campo {
  id: string;
  tipo: string;
  label: string;
  opcoes: string[] | null;
  ordem: number;
  obrigatorio: boolean;
}

export default function FormularioPublico() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) { setError('Link inválido.'); setLoading(false); return; }
      const { data: f, error: fe } = await supabase
        .from('formularios').select('id,titulo,descricao,unidade_id,ativo')
        .eq('id', id).maybeSingle();
      if (fe || !f) { setError('Formulário não encontrado.'); setLoading(false); return; }
      if (!f.ativo) { setError('Este formulário está inativo.'); setLoading(false); return; }
      const { data: cs } = await supabase
        .from('formulario_campos').select('*')
        .eq('formulario_id', id).order('ordem', { ascending: true });
      setForm(f as Formulario);
      setCampos((cs || []) as Campo[]);
      setLoading(false);
    })();
  }, [id]);

  const setResp = (label: string, value: any) => setRespostas(r => ({ ...r, [label]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!nome.trim()) { toast.error('Informe seu nome.'); return; }
    for (const c of campos) {
      if (c.obrigatorio && !respostas[c.label]) {
        toast.error(`Campo obrigatório: ${c.label}`); return;
      }
    }
    setSaving(true);
    const { error: ie } = await supabase.from('formulario_respostas').insert({
      formulario_id: form.id,
      unidade_id: form.unidade_id,
      respondido_por_nome: nome.trim().toUpperCase(),
      respondido_por_telefone: telefone.replace(/\D/g, '') || null,
      respostas,
    });
    setSaving(false);
    if (ie) { toast.error('Erro ao enviar: ' + ie.message); return; }
    setDone(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center p-4"><Card className="max-w-md w-full"><CardContent className="py-10 text-center"><FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">{error}</p></CardContent></Card></div>;
  }
  if (done) {
    return <div className="min-h-screen flex items-center justify-center p-4"><Card className="max-w-md w-full"><CardContent className="py-10 text-center"><CheckCircle2 className="w-14 h-14 mx-auto text-green-600 mb-3" /><h2 className="text-xl font-semibold mb-2">Resposta enviada!</h2><p className="text-muted-foreground">Obrigado pela sua contribuição.</p></CardContent></Card></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{form?.titulo}</CardTitle>
            {form?.descricao && <p className="text-sm text-muted-foreground">{form.descricao}</p>}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Seu nome *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value.toUpperCase())} required />
              </div>
              <div className="space-y-2">
                <Label>Telefone (opcional)</Label>
                <Input value={telefone} onChange={e => setTelefone(e.target.value)} inputMode="tel" placeholder="(00) 00000-0000" />
              </div>

              {campos.map(c => (
                <div key={c.id} className="space-y-2">
                  <Label>{c.label}{c.obrigatorio && ' *'}</Label>
                  {c.tipo === 'select' && c.opcoes?.length ? (
                    <Select value={respostas[c.label] || ''} onValueChange={v => setResp(c.label, v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {c.opcoes.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : c.tipo === 'numero' ? (
                    <Input type="number" value={respostas[c.label] ?? ''} onChange={e => setResp(c.label, e.target.value)} required={c.obrigatorio} />
                  ) : c.tipo === 'sim_nao' ? (
                    <Select value={respostas[c.label] || ''} onValueChange={v => setResp(c.label, v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SIM">SIM</SelectItem>
                        <SelectItem value="NÃO">NÃO</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={respostas[c.label] ?? ''}
                      onChange={e => setResp(c.label, e.target.value.toUpperCase())}
                      required={c.obrigatorio}
                    />
                  )}
                </div>
              ))}

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Enviar resposta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
