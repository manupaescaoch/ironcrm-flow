import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  BarChart3, 
  DollarSign, 
  FileText, 
  ShoppingCart, 
  TrendingUp 
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EstoquePage = 'insumos' | 'dashboard' | 'financeiro' | 'gastos' | 'compras' | 'consumo';

interface EstoqueNavigationProps {
  currentPage: EstoquePage;
}

const navItems: { page: EstoquePage; path: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { page: 'insumos', path: '/estoque', label: 'Insumos', icon: Package },
  { page: 'dashboard', path: '/estoque/dashboard', label: 'Dashboard', icon: BarChart3 },
  { page: 'financeiro', path: '/estoque/financeiro', label: 'Financeiro', icon: DollarSign },
  { page: 'gastos', path: '/estoque/gastos', label: 'Gastos', icon: FileText },
  { page: 'compras', path: '/estoque/previsao-compras', label: 'Compras', icon: ShoppingCart },
  { page: 'consumo', path: '/estoque/relatorio-consumo', label: 'Consumo', icon: TrendingUp },
];

export function EstoqueNavigation({ currentPage }: EstoqueNavigationProps) {
  const navigate = useNavigate();

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
              isActive 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => !isActive && navigate(item.path)}
            disabled={isActive}
          >
            <Icon className="w-4 h-4 mr-1.5" />
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
