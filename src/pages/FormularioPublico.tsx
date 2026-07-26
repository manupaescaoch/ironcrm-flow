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

const MAX_TEXT = 2000;

const isRange0a10 = (label: string) =>
  /0\s*[-a]\s*10|0\s*a\s*10|escala\s*0.*10/i.test(label);

export default function FormularioPublico() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  const setResp = (label: string, value: any) => {
    setRespostas(r => ({ ...r, [label]: value }));
    setFieldErrors(fe => {
      if (!fe[label]) return fe;
      const { [label]: _, ...rest } = fe;
      return rest;
    });
  };

  const validate = (): { ok: boolean; firstErrorId?: string; errors: Record<string, string> } => {
    const errs: Record<string, string> = {};
    let firstErrorId: string | undefined;

    if (!nome.trim() || nome.trim().length < 2) {
      errs.__nome = 'Informe seu nome (mínimo 2 caracteres).';
      firstErrorId = firstErrorId || 'field-nome';
    }
    const digits = telefone.replace(/\D/g, '');
    if (digits && (digits.length < 10 || digits.length > 11)) {
      errs.__telefone = 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).';
      firstErrorId = firstErrorId || 'field-telefone';
    }

    for (const c of campos) {
      const raw = respostas[c.label];
      const val = typeof raw === 'string' ? raw.trim() : raw;

      if (c.obrigatorio && (val === undefined || val === null || val === '')) {
        errs[c.label] = 'Campo obrigatório.';
        firstErrorId = firstErrorId || `field-${c.id}`;
        continue;
      }
      if (val === undefined || val === null || val === '') continue;

      if (c.tipo === 'numero') {
        const n = Number(val);
        if (!Number.isFinite(n)) {
          errs[c.label] = 'Informe um número válido.';
        } else if (isRange0a10(c.label) && (n < 0 || n > 10)) {
          errs[c.label] = 'Valor deve estar entre 0 e 10.';
        } else if (n < 0) {
          errs[c.label] = 'Valor não pode ser negativo.';
        }
        if (errs[c.label]) firstErrorId = firstErrorId || `field-${c.id}`;
      } else if (c.tipo === 'select' && c.opcoes?.length) {
        if (!c.opcoes.includes(String(val))) {
          errs[c.label] = 'Selecione uma opção válida.';
          firstErrorId = firstErrorId || `field-${c.id}`;
        }
      } else if (c.tipo === 'sim_nao') {
        if (!['SIM', 'NÃO'].includes(String(val))) {
          errs[c.label] = 'Selecione SIM ou NÃO.';
          firstErrorId = firstErrorId || `field-${c.id}`;
        }
      } else if (typeof val === 'string' && val.length > MAX_TEXT) {
        errs[c.label] = `Máximo de ${MAX_TEXT} caracteres.`;
        firstErrorId = firstErrorId || `field-${c.id}`;
      }
    }

    return { ok: Object.keys(errs).length === 0, firstErrorId, errors: errs };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const { ok, firstErrorId, errors } = validate();
    setFieldErrors(errors);
    if (!ok) {
      toast.error('Revise os campos destacados antes de enviar.');
      if (firstErrorId) {
        const el = document.getElementById(firstErrorId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Normaliza respostas: trim em strings
    const cleanRespostas: Record<string, any> = {};
    for (const c of campos) {
      const raw = respostas[c.label];
      if (raw === undefined || raw === null || raw === '') continue;
      cleanRespostas[c.label] = typeof raw === 'string' ? raw.trim() : raw;
    }

    setSaving(true);
    const digits = telefone.replace(/\D/g, '');
    const { error: ie } = await supabase.from('formulario_respostas').insert({
      formulario_id: form.id,
      unidade_id: form.unidade_id,
      respondido_por_nome: nome.trim().toUpperCase(),
      respondido_por_telefone: digits || null,
      respostas: cleanRespostas,
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

  const errClass = (has: boolean) => (has ? 'border-destructive focus-visible:ring-destructive' : '');

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{form?.titulo}</CardTitle>
            {form?.descricao && <p className="text-sm text-muted-foreground whitespace-pre-line">{form.descricao}</p>}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div id="field-nome" className="space-y-2">
                <Label>Seu nome *</Label>
                <Input
                  value={nome}
                  onChange={e => { setNome(e.target.value.toUpperCase()); if (fieldErrors.__nome) setFieldErrors(({ __nome, ...r }) => r); }}
                  maxLength={120}
                  className={errClass(!!fieldErrors.__nome)}
                  aria-invalid={!!fieldErrors.__nome}
                />
                {fieldErrors.__nome && <p className="text-xs text-destructive">{fieldErrors.__nome}</p>}
              </div>
              <div id="field-telefone" className="space-y-2">
                <Label>Telefone (opcional)</Label>
                <Input
                  value={telefone}
                  onChange={e => { setTelefone(e.target.value); if (fieldErrors.__telefone) setFieldErrors(({ __telefone, ...r }) => r); }}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  maxLength={20}
                  className={errClass(!!fieldErrors.__telefone)}
                  aria-invalid={!!fieldErrors.__telefone}
                />
                {fieldErrors.__telefone && <p className="text-xs text-destructive">{fieldErrors.__telefone}</p>}
              </div>

              {campos.map(c => {
                const err = fieldErrors[c.label];
                const range = c.tipo === 'numero' && isRange0a10(c.label);
                return (
                  <div key={c.id} id={`field-${c.id}`} className="space-y-2">
                    <Label>{c.label}{c.obrigatorio && ' *'}</Label>
                    {c.tipo === 'select' && c.opcoes?.length ? (
                      <Select value={respostas[c.label] || ''} onValueChange={v => setResp(c.label, v)}>
                        <SelectTrigger className={errClass(!!err)} aria-invalid={!!err}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {c.opcoes.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : c.tipo === 'numero' ? (
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={range ? 0 : 0}
                        max={range ? 10 : undefined}
                        step="1"
                        value={respostas[c.label] ?? ''}
                        onChange={e => setResp(c.label, e.target.value)}
                        className={errClass(!!err)}
                        aria-invalid={!!err}
                      />
                    ) : c.tipo === 'sim_nao' ? (
                      <Select value={respostas[c.label] || ''} onValueChange={v => setResp(c.label, v)}>
                        <SelectTrigger className={errClass(!!err)} aria-invalid={!!err}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SIM">SIM</SelectItem>
                          <SelectItem value="NÃO">NÃO</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={respostas[c.label] ?? ''}
                        onChange={e => setResp(c.label, e.target.value.toUpperCase())}
                        maxLength={MAX_TEXT}
                        className={errClass(!!err)}
                        aria-invalid={!!err}
                      />
                    )}
                    {err && <p className="text-xs text-destructive">{err}</p>}
                  </div>
                );
              })}

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
