import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  BarChart3, 
  DollarSign, 
  FileText, 
  ShoppingCart, 
  TrendingUp,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

type EstoquePage = 'insumos' | 'dashboard' | 'financeiro' | 'gastos' | 'compras' | 'consumo';

interface EstoqueNavigationProps {
  currentPage: EstoquePage;
}

interface NavItem {
  page: EstoquePage;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { page: 'insumos', path: '/estoque', label: 'Insumos', icon: Package },
  { page: 'dashboard', path: '/estoque/dashboard', label: 'Dashboard', icon: BarChart3, adminOnly: true },
  { page: 'financeiro', path: '/estoque/financeiro', label: 'Financeiro', icon: DollarSign, adminOnly: true },
  { page: 'gastos', path: '/estoque/gastos', label: 'Gastos', icon: FileText, adminOnly: true },
  { page: 'compras', path: '/estoque/previsao-compras', label: 'Compras', icon: ShoppingCart },
  { page: 'consumo', path: '/estoque/relatorio-consumo', label: 'Consumo', icon: TrendingUp },
];

export function EstoqueNavigation({ currentPage }: EstoqueNavigationProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const navItems = useMemo(() => {
    return allNavItems.filter(item => !item.adminOnly || isAdmin);
  }, [isAdmin]);

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.page === currentPage;
        
        return (
          <Button
            key={item.page}
            variant="ghost"
            size="sm"
            className={cn(
              "relative",
              isActive 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => !isActive && navigate(item.path)}
            disabled={isActive}
          >
            <Icon className="w-4 h-4 mr-1.5" />
            {item.label}
            {item.adminOnly && (
              <Shield className="w-3 h-3 ml-1 text-amber-500" />
            )}
          </Button>
        );
      })}
    </div>
  );
}
