import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Reuniao } from '@/hooks/useReunioesData';
import { NUMEROS_PERIODO_CAMPOS } from './constants';
import { ReuniaoStatusBadge, EncaminhamentoStatusBadge } from './EncaminhamentoStatusBadge';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  reuniao: Reuniao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => Promise<void>;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export function ReuniaoDetalheDrawer({ reuniao, open, onOpenChange, onDelete }: Props) {
  const { unidades } = useUnidade();
  const { isAdmin, userRole } = useAuth();
  if (!reuniao) return null;

  const unidadeNome = unidades.find((u) => u.id === reuniao.unidade_id)?.nome ?? '—';
  const canEdit = isAdmin || userRole === 'coordenador';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-left">{reuniao.tipo}</SheetTitle>
            <ReuniaoStatusBadge status={reuniao.status} />
          </div>
          <SheetDescription className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {formatDate(reuniao.data)}</span>
            <span>•</span>
            <span>{unidadeNome}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            {/* Participantes */}
            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Participantes
              </h4>
              {reuniao.participantes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum participante registrado.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {reuniao.participantes.map((p, i) => (
                    <Badge key={i} variant="secondary" className="font-normal">{p}</Badge>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* Números do período */}
            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Números do período</h4>
              <div className="grid grid-cols-2 gap-2">
                {NUMEROS_PERIODO_CAMPOS.map(({ key, label }) => {
                  const value = reuniao.numeros_periodo?.[key];
                  if (value === undefined || value === null || value === '') return null;
                  return (
                    <div key={key} className="rounded-md border bg-muted/30 px-3 py-2">
                      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold">{String(value)}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {reuniao.pauta && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pauta</h4>
                  <p className="text-sm whitespace-pre-wrap">{reuniao.pauta}</p>
                </section>
              </>
            )}

            {reuniao.decisoes && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Decisões</h4>
                  <p className="text-sm whitespace-pre-wrap">{reuniao.decisoes}</p>
                </section>
              </>
            )}

            <Separator />

            {/* Encaminhamentos */}
            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Encaminhamentos ({reuniao.encaminhamentos?.length ?? 0})
              </h4>
              {!reuniao.encaminhamentos || reuniao.encaminhamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum encaminhamento.</p>
              ) : (
                <div className="space-y-2">
                  {reuniao.encaminhamentos.map((e) => (
                    <div key={e.id} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{e.acao}</p>
                        <EncaminhamentoStatusBadge status={e.status} prazo={e.prazo} />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {e.responsavel_nome && <span>👤 {e.responsavel_nome}</span>}
                        {e.prazo && <span>📅 {formatDate(e.prazo)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        {canEdit && onDelete && (
          <div className="border-t pt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (confirm('Excluir esta reunião e todos os encaminhamentos?')) {
                  await onDelete(reuniao.id);
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Excluir reunião
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
