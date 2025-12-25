import { ReactNode, useMemo, forwardRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Columns, 
  LogOut,
  DollarSign,
  BarChart3,
  Settings,
  FileText,
  Database,
  Building2,
  Gift,
  Package,
  CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

interface LayoutProps {
  children: ReactNode;
}

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/dashboard-executivo', label: 'Executivo', icon: BarChart3, roles: ['admin'] },
  { href: '/crm', label: 'CRM', icon: Users, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/kanban', label: 'Funil', icon: Columns, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/comissoes', label: 'Comissões', icon: DollarSign, roles: ['admin'] },
  { href: '/indicacoes', label: 'Indicações', icon: Gift, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/estoque', label: 'Estoque', icon: Package, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/escala', label: 'Escala', icon: CalendarDays, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/relatorio', label: 'Relatório Vendas', icon: FileText, roles: ['admin'] },
  { href: '/relatorio-gerencial', label: 'Gerencial', icon: Building2, roles: ['admin'] },
  { href: '/backups', label: 'Backups', icon: Database, roles: ['admin'] },
  { href: '/admin-users', label: 'Usuários', icon: Settings, roles: ['admin'] },
];

export const Layout = forwardRef<HTMLDivElement, LayoutProps>(function Layout({ children }, ref) {
  const { signOut, user, userRole } = useAuth();
  const { unidadeAtual, unidadesPermitidas, setUnidadeAtual, hasMultipleUnidades, loading: unidadeLoading } = useUnidade();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Filter nav items based on user role
  const navItems = useMemo(() => {
    if (!userRole) {
      // If no role, show all items (fallback for users without role set)
      return allNavItems;
    }
    return allNavItems.filter(item => item.roles.includes(userRole));
  }, [userRole]);

  return (
    <div ref={ref} className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-10 h-10 rounded-lg" />
            <div>
              <h1 className="font-bold text-sidebar-foreground">IRON CLUB</h1>
              <p className="text-xs text-muted-foreground">CRM</p>
            </div>
          </div>
        </div>

        {/* Unit Selector - Visual cards for multiple units */}
        {hasMultipleUnidades && unidadeAtual && (
          <div className="px-3 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 px-1">
              <Building2 className="w-3 h-3" />
              <span className="uppercase tracking-wider font-medium">Unidade</span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
              {unidadesPermitidas.map((unidade) => {
                const isSelected = unidadeAtual.id === unidade.id;
                return (
                  <button
                    key={unidade.id}
                    onClick={() => setUnidadeAtual(unidade)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      'border text-left',
                      isSelected
                        ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                        : 'bg-sidebar-accent/30 border-transparent hover:bg-sidebar-accent/60 text-sidebar-foreground hover:border-sidebar-border'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold',
                      isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-sidebar-accent text-muted-foreground'
                    )}>
                      {unidade.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium truncate',
                        isSelected ? 'text-primary' : 'text-sidebar-foreground'
                      )}>
                        {unidade.nome}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Show current unit badge if only one unit */}
        {!hasMultipleUnidades && unidadeAtual && !unidadeLoading && (
          <div className="px-3 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-sidebar-foreground">{unidadeAtual.nome}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
              (item.href === '/relatorio-gerencial' && location.pathname === '/relatorio-gerencial-zn');
            return (
              <Link
                key={item.href}
                to={item.href === '/relatorio-gerencial' ? '/relatorio-gerencial-zn' : item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3 px-4">
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            {userRole && (
              <p className="text-xs text-muted-foreground/70 capitalize">{userRole}</p>
            )}
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
});
