import { useEffect, useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnamneseFinal } from '@/components/anamnese/AnamneseFinal';
import {
  AnamneseWizard,
  AnamneseRespostas,
  initialRespostas,
} from '@/components/anamnese/AnamneseWizard';

type Stage = 'identify' | 'wizard' | 'final' | 'done';

type UnidadeOption = { id: string; nome: string };

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function AnamnesePublicaUniversal() {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>('identify');
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [respostas, setRespostas] = useState<AnamneseRespostas>(initialRespostas);
  const [saving, setSaving] = useState(false);
  const [unidades, setUnidades] = useState<UnidadeOption[]>([]);
  const [unidadeId, setUnidadeId] = useState('');

  useEffect(() => {
    let ativo = true;
    supabase.functions
      .invoke('anamnese-publica', { body: { action: 'unidades' } })
      .then(({ data }) => {
        if (ativo && Array.isArray(data?.unidades)) setUnidades(data.unidades);
      })
      .catch((e) => console.warn('[anamnese] unidades', e));
    return () => {
      ativo = false;
    };
  }, []);

  function isValidDate(value: string): boolean {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d &&
      date <= new Date()
    );
  }

  const podeContinuar =
    nome.trim().length >= 2 &&
    isValidDate(dataNascimento) &&
    telefone.replace(/\D/g, '').length >= 10 &&
    (unidades.length === 0 || !!unidadeId);

  if (stage === 'identify') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-anamnese-bg p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-anamnese-royal">
              EVO TRAINING CLUB
            </p>
            <h1 className="mt-2 font-display text-4xl uppercase tracking-tight">
              Anamnese da Aula Experimental
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Vamos te conhecer melhor antes da sua primeira aula. Leva menos de 2 minutos.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade que deseja treinar</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger id="unidade">
                  <SelectValue placeholder="Escolha a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Seu nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                placeholder="EX: MARIA SILVA"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nascimento">Data de nascimento</Label>
              <Input
                id="nascimento"
                type="date"
                value={dataNascimento}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">WhatsApp</Label>
              <Input
                id="tel"
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                Usamos seu telefone para vincular as respostas ao seu cadastro.
              </p>
            </div>
            <Button
              size="lg"
              disabled={!podeContinuar}
              onClick={() => setStage('wizard')}
              className="w-full bg-anamnese-royal text-anamnese-royal-foreground hover:bg-anamnese-royal-dark"
            >
              Começar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'wizard') {
    return (
      <AnamneseWizard
        initial={{ ...respostas, nome, data_nascimento: dataNascimento }}
        skipNome
        onComplete={(final) => {
          setRespostas(final);
          setStage('final');
        }}
        onBackToIntro={() => setStage('identify')}
      />
    );
  }

  if (stage === 'final') {
    const handleSave = async () => {
      setSaving(true);
      try {
        const { data, error } = await supabase.functions.invoke('anamnese-publica', {
          body: {
            action: 'submit',
            nome,
            telefone,
            unidade_id: unidadeId || undefined,
            respostas: { ...respostas, nome, data_nascimento: dataNascimento },
          },
        });
        console.log('[anamnese] resposta:', { data, error });
        if (error) throw new Error(error.message ?? 'Erro de conexão');
        if (!data?.ok) throw new Error(data?.error ?? 'Resposta inválida do servidor');
        toast({
          title: 'Anamnese enviada!',
          description: 'Obrigado, suas respostas foram registradas.',
        });
        setStage('done');
      } catch (e: any) {
        console.error(e);
        toast({
          title: 'Erro ao salvar',
          description: e?.message ?? 'Tente novamente.',
          variant: 'destructive',
        });
        setSaving(false);
      }
    };
    return <AnamneseFinal onSave={handleSave} saving={saving} />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-anamnese-bg p-8 text-center">
      {saving && <Loader2 className="h-6 w-6 animate-spin text-anamnese-royal" />}
      <h1 className="font-display text-3xl uppercase tracking-tight">Tudo certo! 🎉</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Suas respostas foram enviadas para a equipe da unidade. Você já pode fechar esta página.
      </p>
    </div>
  );
}
