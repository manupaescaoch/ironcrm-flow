import { BellRing, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOpsPush } from '@/hooks/useOpsPush';

const TEXTO: Record<string, { titulo: string; descricao: string }> = {
  carregando: { titulo: 'Notificações no celular', descricao: 'Verificando este aparelho...' },
  nao_suportado: {
    titulo: 'Notificações no celular',
    descricao: 'Este navegador não suporta notificações push.',
  },
  abrir_em_nova_aba: {
    titulo: 'Notificações no celular',
    descricao: 'Abra o EVO OPS em uma aba própria ou pelo app instalado para ativar.',
  },
  bloqueado: {
    titulo: 'Notificações bloqueadas',
    descricao: 'Libere as notificações deste site nas configurações do navegador.',
  },
  nao_configurado: {
    titulo: 'Notificações no celular',
    descricao: 'O envio de push ainda não está configurado.',
  },
  desativado: {
    titulo: 'Ativar notificações no celular',
    descricao: 'Receba avisos de novas atividades, lembretes e atrasos mesmo com o app fechado.',
  },
  ativado: {
    titulo: 'Notificações ativadas',
    descricao: 'Este aparelho vai receber os avisos do EVO OPS.',
  },
};

export function OpsPushCard() {
  const { estado, processando, ativar, desativar, enviarTeste } = useOpsPush();
  const texto = TEXTO[estado] ?? TEXTO.desativado;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {estado === 'ativado' ? <BellRing className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{texto.titulo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{texto.descricao}</p>

          {(estado === 'desativado' || estado === 'ativado') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {estado === 'desativado' ? (
                <Button size="sm" className="h-8 text-xs" disabled={processando} onClick={() => ativar()}>
                  {processando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Ativar
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={processando}
                    onClick={() => enviarTeste()}
                  >
                    {processando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Enviar teste
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    disabled={processando}
                    onClick={() => desativar()}
                  >
                    Desativar
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
