import { ReactNode, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Columns, 
  LogOut,
  Dumbbell,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/dashboard-executivo', label: 'Executivo', icon: BarChart3, roles: ['admin'] },
  { href: '/crm', label: 'CRM', icon: Users, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/kanban', label: 'Funil', icon: Columns, roles: ['admin', 'recepcao', 'comercial'] },
  { href: '/comissoes', label: 'Comissões', icon: DollarSign, roles: ['admin'] },
];

export function Layout({ children }: LayoutProps) {
  const { signOut, user, userRole } = useAuth();
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sidebar-foreground">IRON CLUB</h1>
              <p className="text-xs text-muted-foreground">CRM</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
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
}
