import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import Login from "./pages/Login";
import OAuthConsent from "./pages/OAuthConsent";

import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import DashboardExecutivo from "./pages/DashboardExecutivo";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import Kanban from "./pages/Kanban";
import Comissoes from "./pages/Comissoes";

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
import Equipe from "./pages/Equipe";

import ContasPagar from "./pages/ContasPagar";
import AnamneseExperimental from "./pages/AnamneseExperimental";
import AnamnesePublica from "./pages/AnamnesePublica";
import AnamnesePublicaUniversal from "./pages/AnamnesePublicaUniversal";
import FormularioPublico from "./pages/FormularioPublico";
import EncerramentoTurno from "./pages/EncerramentoTurno";
import EncerramentoCoordenador from "./pages/EncerramentoCoordenador";
import EncerramentoHorario from "./pages/EncerramentoHorario";
import RelatorioDiarioComercial from "./pages/RelatorioDiarioComercial";
import GruposWhatsApp from "./pages/admin/GruposWhatsApp";
import WhatsAppComercial from "./pages/admin/WhatsAppComercial";
import ZapiConexoes from "./pages/admin/ZapiConexoes";
import CronogramaAutomacoes from "./pages/admin/CronogramaAutomacoes";
import DashboardOperacional from "./pages/DashboardOperacional";

import GestaoOperacional from "./pages/GestaoOperacional";
import Reunioes from "./pages/Reunioes";
import NpsPublico from "./pages/NpsPublico";
import NpsRespostas from "./pages/NpsRespostas";
import NpsRespostaDetalhe from "./pages/NpsRespostaDetalhe";
import NpsDashboard from "./pages/NpsDashboard";
import NpsCrm from "./pages/NpsCrm";
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

// MasterAdminRoute removed: hardcoded admin email leaked PII into the client bundle.
// Authorization for the Usuários page is enforced server-side by the admin-only
// edge functions (create-user, list-users, update-user-*, delete-user) which all
// validate has_role(auth.uid(), 'admin'). The route now uses AdminRoute as a
// visual gate; real access control lives in the backend.

function AdminOrComercialRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, userRole } = useAuth();

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

  if (userRole && userRole !== 'admin' && userRole !== 'comercial') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminOrCoordenadorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, userRole } = useAuth();

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

  if (userRole && userRole !== 'admin' && userRole !== 'coordenador') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
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
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    return <Navigate to={next ?? '/dashboard'} replace />;
  }

  return <>{children}</>;
}


const AppRoutes = () => (
  <Routes>
    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
    <Route path="/anamnese" element={<AnamnesePublicaUniversal />} />

    <Route path="/nps" element={<NpsPublico />} />
    <Route path="/formulario/:id" element={<FormularioPublico />} />
    <Route path="/nps/respostas" element={<AdminOrCoordenadorRoute><NpsRespostas /></AdminOrCoordenadorRoute>} />
    <Route path="/nps/respostas/:id" element={<AdminOrCoordenadorRoute><NpsRespostaDetalhe /></AdminOrCoordenadorRoute>} />
    <Route path="/nps/dashboard" element={<AdminOrCoordenadorRoute><NpsDashboard /></AdminOrCoordenadorRoute>} />
    <Route path="/nps/crm" element={<AdminOrCoordenadorRoute><NpsCrm /></AdminOrCoordenadorRoute>} />

    <Route path="/encerramento-turno" element={<EncerramentoTurno />} />
    <Route path="/encerramento-coordenador" element={<EncerramentoCoordenador />} />
    <Route path="/encerramento-horario" element={<EncerramentoHorario />} />
    <Route path="/relatorio-diario-comercial" element={<RelatorioDiarioComercial />} />
    <Route path="/admin/grupos-whatsapp" element={<ProtectedRoute><GruposWhatsApp /></ProtectedRoute>} />
    <Route path="/admin/whatsapp-comercial" element={<ProtectedRoute><WhatsAppComercial /></ProtectedRoute>} />
    <Route path="/admin/zapi-conexoes" element={<AdminRoute><ZapiConexoes /></AdminRoute>} />
    <Route path="/admin/cronograma-automacoes" element={<AdminRoute><CronogramaAutomacoes /></AdminRoute>} />


    <Route path="/dashboard-operacional" element={<ProtectedRoute><DashboardOperacional /></ProtectedRoute>} />
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
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
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
        <AdminOrCoordenadorRoute>
          <DashboardExecutivo />
        </AdminOrCoordenadorRoute>
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
        <AdminRoute>
          <AdminUsers />
        </AdminRoute>
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
      path="/equipe"
      element={
        <ProtectedRoute>
          <Equipe />
        </ProtectedRoute>
      }
    />

    <Route
      path="/contas-pagar"
      element={
        <ProtectedRoute>
          <ContasPagar />
        </ProtectedRoute>
      }
    />
    <Route
      path="/reunioes"
      element={
        <AdminOrComercialRoute>
          <Reunioes />
        </AdminOrComercialRoute>
      }
    />
    <Route
      path="/gestao-operacional"
      element={
        <AdminOrCoordenadorRoute>
          <GestaoOperacional />
        </AdminOrCoordenadorRoute>
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
