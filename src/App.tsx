import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DashboardExecutivo from "./pages/DashboardExecutivo";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import Kanban from "./pages/Kanban";
import Comissoes from "./pages/Comissoes";
import RelatorioVendas from "./pages/RelatorioVendas";
import GestaoTarefas from "./pages/GestaoTarefas";
import Indicacoes from "./pages/Indicacoes";
import AdminUsers from "./pages/AdminUsers";
import Backups from "./pages/Backups";
import EstoqueInterno from "./pages/EstoqueInterno";
import RelatorioConsumo from "./pages/RelatorioConsumo";
import RelatorioPrevisaoCompras from "./pages/RelatorioPrevisaoCompras";
import VisaoFinanceiraEstoque from "./pages/VisaoFinanceiraEstoque";
import DashboardExecutivoEstoque from "./pages/DashboardExecutivoEstoque";
import RelatorioGastosEstoque from "./pages/RelatorioGastosEstoque";
import Escala from "./pages/Escala";
import Operacional from "./pages/Operacional";
import ControleVencimentos from "./pages/ControleVencimentos";
import AnamneseExperimental from "./pages/AnamneseExperimental";
import AnamnesePublica from "./pages/AnamnesePublica";
import AnamnesePublicaUniversal from "./pages/AnamnesePublicaUniversal";
import EncerramentoTurno from "./pages/EncerramentoTurno";
import EncerramentoCoordenador from "./pages/EncerramentoCoordenador";
import EncerramentoHorario from "./pages/EncerramentoHorario";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, userRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has a role set and is not admin, redirect to dashboard
  if (userRole && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const MASTER_ADMIN_EMAIL = 'emanuel.paes@gmail.com';

function MasterAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Only master admin can access
  if (user.email !== MASTER_ADMIN_EMAIL) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/anamnese" element={<AnamnesePublicaUniversal />} />
    <Route path="/encerramento-turno" element={<EncerramentoTurno />} />
    <Route path="/encerramento-coordenador" element={<EncerramentoCoordenador />} />
    <Route path="/encerramento-horario" element={<EncerramentoHorario />} />
    <Route path="/anamnese-publica/:id" element={<AnamnesePublica />} />
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route
      path="/login"
      element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard-executivo"
      element={
        <AdminRoute>
          <DashboardExecutivo />
        </AdminRoute>
      }
    />
    <Route
      path="/crm"
      element={
        <ProtectedRoute>
          <CRM />
        </ProtectedRoute>
      }
    />
    <Route
      path="/lead/:id"
      element={
        <ProtectedRoute>
          <LeadDetail />
        </ProtectedRoute>
      }
    />
    <Route
      path="/lead/:id/anamnese"
      element={
        <ProtectedRoute>
          <AnamneseExperimental />
        </ProtectedRoute>
      }
    />
    <Route
      path="/kanban"
      element={
        <ProtectedRoute>
          <Kanban />
        </ProtectedRoute>
      }
    />
    <Route
      path="/comissoes"
      element={
        <ProtectedRoute>
          <Comissoes />
        </ProtectedRoute>
      }
    />
    <Route
      path="/relatorio"
      element={
        <AdminRoute>
          <RelatorioVendas />
        </AdminRoute>
      }
    />
    <Route
      path="/indicacoes"
      element={
        <ProtectedRoute>
          <Indicacoes />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin-users"
      element={
        <MasterAdminRoute>
          <AdminUsers />
        </MasterAdminRoute>
      }
    />
    <Route
      path="/backups"
      element={
        <AdminRoute>
          <Backups />
        </AdminRoute>
      }
    />
    <Route
      path="/estoque"
      element={
        <ProtectedRoute>
          <EstoqueInterno />
        </ProtectedRoute>
      }
    />
    <Route
      path="/estoque/relatorio-consumo"
      element={
        <ProtectedRoute>
          <RelatorioConsumo />
        </ProtectedRoute>
      }
    />
    <Route
      path="/estoque/previsao-compras"
      element={
        <ProtectedRoute>
          <RelatorioPrevisaoCompras />
        </ProtectedRoute>
      }
    />
    <Route
      path="/estoque/financeiro"
      element={
        <ProtectedRoute>
          <VisaoFinanceiraEstoque />
        </ProtectedRoute>
      }
    />
    <Route
      path="/estoque/dashboard"
      element={
        <ProtectedRoute>
          <DashboardExecutivoEstoque />
        </ProtectedRoute>
      }
    />
    <Route
      path="/estoque/gastos"
      element={
        <ProtectedRoute>
          <RelatorioGastosEstoque />
        </ProtectedRoute>
      }
    />
    <Route
      path="/escala"
      element={
        <ProtectedRoute>
          <Escala />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tarefas"
      element={
        <ProtectedRoute>
          <GestaoTarefas />
        </ProtectedRoute>
      }
    />
    <Route
      path="/operacional"
      element={
        <ProtectedRoute>
          <Operacional />
        </ProtectedRoute>
      }
    />
    <Route
      path="/vencimentos"
      element={
        <ProtectedRoute>
          <ControleVencimentos />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <UnidadeProvider>
            <AppRoutes />
          </UnidadeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
