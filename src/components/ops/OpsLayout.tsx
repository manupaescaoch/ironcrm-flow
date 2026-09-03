import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, CalendarDays, ListChecks, Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useOpsNotificacoes } from '@/hooks/useOpsNotificacoes';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/ops', label: 'Meu Dia', icon: Sun, end: true },
  { to: '/ops/cronograma', label: 'Cronograma', icon: CalendarDays },
  { to: '/ops/tarefas', label: 'Tarefas', icon: ListChecks },
  { to: '/ops/alertas', label: 'Alertas', icon: Bell },
];

export function OpsLayout({ title, children }: { title?: string; children: ReactNode }) {
  const { signOut } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { naoLidas } = useOpsNotificacoes();

  return (
    <div className="ops-theme min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">EVO OPS</span>
            {unidadeAtual?.nome && (
              <span className="text-xs text-muted-foreground">{unidadeAtual.nome}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        {title && <h1 className="sr-only">{title}</h1>}
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {to === '/ops/alertas' && naoLidas > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {naoLidas > 9 ? '9+' : naoLidas}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
