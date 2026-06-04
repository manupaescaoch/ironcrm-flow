import { ReactNode, useMemo, forwardRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  LayoutDashboard, 
  Users, 
  LogOut,
  DollarSign,
  BarChart3,
  Settings,
  FileText,
  Database,
  Building2,
  Gift,
  Package,
  CalendarDays,
  CalendarClock,
  Shield,
  Menu,
  CheckSquare,
  Phone,
  ClipboardList,
  Handshake,
  MessageCircle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { UserPhoneDialog } from '@/components/profile/UserPhoneDialog';

interface LayoutProps {
  children: ReactNode;
}

const MASTER_ADMIN_EMAIL = 'emanuel.paes@gmail.com';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/gestao-operacional', label: 'CRM', icon: Users, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/vencimentos', label: 'Vencimentos', icon: CalendarClock, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/comissoes', label: 'Comissões', icon: DollarSign, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/indicacoes', label: 'Indicações', icon: Gift, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/operacional', label: 'Operacional', icon: ClipboardList, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/reunioes', label: 'Reuniões', icon: Handshake, roles: ['admin', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/escala', label: 'Escala', icon: CalendarDays, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/estoque', label: 'Estoque', icon: Package, roles: ['admin', 'recepcao', 'comercial', 'coordenador'], masterOnly: false },
  { href: '/dashboard-executivo', label: 'Executivo', icon: BarChart3, roles: ['admin'], masterOnly: false },
  { href: '/backups', label: 'Backups', icon: Database, roles: ['admin'], masterOnly: false },
  { href: '/admin-users', label: 'Usuários', icon: Settings, roles: ['admin'], masterOnly: true },
];

export const Layout = forwardRef<HTMLDivElement, LayoutProps>(function Layout({ children }, ref) {
  const { signOut, user, userRole } = useAuth();
  const { unidadeAtual, unidadesPermitidas, setUnidadeAtual, hasMultipleUnidades, loading: unidadeLoading } = useUnidade();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Filter nav items based on user role and master admin status
  const navItems = useMemo(() => {
    const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;
    
    return allNavItems.filter(item => {
      // If item is master only, check if user is master admin
      if (item.masterOnly && !isMasterAdmin) {
        return false;
      }
      // Check role permission
      if (!userRole) {
        return true; // fallback for users without role
      }
      return item.roles.includes(userRole);
    });
  }, [userRole, user?.email]);

  const SidebarContent = () => (
    <>
      <div className="px-4 py-4 border-b border-sidebar-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Logo" className="w-9 h-9 rounded-lg" />
            <div className="leading-tight">
              <h1 className="font-bold text-[15px] text-sidebar-foreground tracking-tight">IRON CLUB</h1>
              <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">CRM</p>
            </div>
          </div>
          <NotificationBell className="text-sidebar-foreground hover:bg-sidebar-accent/50" />
        </div>
      </div>

      {/* Unit Selector - Visual cards for multiple units */}
      {hasMultipleUnidades && unidadeAtual && (
        <div className="px-3 py-3 border-b border-sidebar-border/60">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 mb-2 px-1">
            <Building2 className="w-3 h-3" />
            <span className="uppercase tracking-wider font-medium">Unidade</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
            {unidadesPermitidas.map((unidade) => {
              const isSelected = unidadeAtual.id === unidade.id;
              return (
                <button
                  key={unidade.id}
                  onClick={() => {
                    setUnidadeAtual(unidade);
                    if (isMobile) setSidebarOpen(false);
                    navigate('/dashboard');
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left',
                    isSelected
                      ? 'bg-primary/15 text-primary'
                      : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-sidebar-accent/70 text-muted-foreground'
                  )}>
                    {unidade.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <span className={cn(
                    'flex-1 min-w-0 text-[13px] font-medium truncate',
                    isSelected ? 'text-primary' : 'text-sidebar-foreground'
                  )}>
                    {unidade.nome}
                  </span>
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Show current unit badge if only one unit */}
      {!hasMultipleUnidades && unidadeAtual && !unidadeLoading && (
        <div className="px-3 py-3 border-b border-sidebar-border/60">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[13px] font-medium text-sidebar-foreground truncate">{unidadeAtual.nome}</span>
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          const isAdminOnly = item.roles.length === 1 && item.roles[0] === 'admin';
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => isMobile && setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors',
                isActive
                  ? 'bg-sidebar-accent/80 text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-sidebar-foreground/70')} />
              <span className="flex-1 truncate">{item.label}</span>
              {(item as any).isNew && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  Novo
                </span>
              )}
              {isAdminOnly && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Shield className="w-3 h-3 text-amber-500/80" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Restrito a administradores</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border/60">
        <div className="mb-2 px-2">
          <p className="text-[11px] text-muted-foreground truncate leading-tight">{user?.email}</p>
          {userRole && (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <p className="text-[10px] text-muted-foreground/70 capitalize">{userRole}</p>
              {user?.email === MASTER_ADMIN_EMAIL ? (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-purple-500/10 text-purple-500 border-purple-500/30">
                  Master
                </Badge>
              ) : userRole === 'admin' && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-amber-500/10 text-amber-500 border-amber-500/30">
                  Admin
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 h-8 px-2 text-[12px] text-sidebar-foreground/85 hover:bg-sidebar-accent/50"
          onClick={() => setPhoneDialogOpen(true)}
        >
          <Phone className="w-3.5 h-3.5" />
          Meu Telefone
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 h-8 px-2 text-[12px] text-sidebar-foreground/85 hover:bg-sidebar-accent/50"
          onClick={handleSignOut}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div ref={ref} className="min-h-screen bg-background flex">
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
              <div className="flex flex-col h-full">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-sidebar-foreground">IRON CLUB</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {unidadeAtual && (
              <Badge variant="outline" className="text-xs">
                {unidadeAtual.nome}
              </Badge>
            )}
            <NotificationBell className="text-sidebar-foreground" />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0 h-screen">
          <SidebarContent />
        </aside>
      )}

      {/* Main content */}
      <main className={cn("flex-1 overflow-auto", isMobile && "pt-16")}>
        {children}
      </main>

      {/* Phone Dialog */}
      <UserPhoneDialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen} />
    </div>
  );
});
