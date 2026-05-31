import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Users, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Reuniao } from '@/hooks/useReunioesData';
import { ReuniaoStatusBadge } from './EncaminhamentoStatusBadge';
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
            {reuniao.responsavel && (
              <section>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" /> Responsável pela reunião
                </h4>
                <p className="text-sm font-medium">{reuniao.responsavel}</p>
              </section>
            )}

            <Separator />

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

            {reuniao.pauta && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pauta da reunião</h4>
                  <p className="text-sm whitespace-pre-wrap">{reuniao.pauta}</p>
                </section>
              </>
            )}

            {reuniao.feedback && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Feedback da reunião</h4>
                  <p className="text-sm whitespace-pre-wrap">{reuniao.feedback}</p>
                </section>
              </>
            )}
          </div>
        </ScrollArea>

        {canEdit && onDelete && (
          <div className="border-t pt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (confirm('Excluir esta reunião?')) {
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
