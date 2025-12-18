import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Users, Shield, UserCheck, Briefcase, Trash2, AlertTriangle, ShieldX, RefreshCw, UserPlus, Pencil, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserRole } from '@/contexts/AuthContext';

interface Unidade {
  id: string;
  nome: string;
}

interface UserData {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
  created_at: string;
  last_sign_in_at: string | null;
  unidade_ids: string[];
}

type FetchError = {
  type: 'unauthorized' | 'forbidden' | 'server_error' | null;
  message: string;
};

const roleOptions: { value: string; label: string; icon: typeof Shield }[] = [
  { value: 'admin', label: 'Admin', icon: Shield },
  { value: 'recepcao', label: 'Recepção', icon: UserCheck },
  { value: 'comercial', label: 'Comercial', icon: Briefcase },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<FetchError>({ type: null, message: '' });
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  
  // Create user state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('comercial');
  const [newUserUnidades, setNewUserUnidades] = useState<string[]>([]);
  
  // Edit name state
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editName, setEditName] = useState('');
  const [updatingName, setUpdatingName] = useState(false);

  // Edit unidades state
  const [editUnidadesDialogOpen, setEditUnidadesDialogOpen] = useState(false);
  const [editingUnidadesUser, setEditingUnidadesUser] = useState<UserData | null>(null);
  const [editUnidadeIds, setEditUnidadeIds] = useState<string[]>([]);
  const [updatingUnidades, setUpdatingUnidades] = useState(false);
  
  const { toast } = useToast();
  const { user: currentUser, session, canAccessAdminUsers } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if not admin
    if (!canAccessAdminUsers && !loading) {
      navigate('/dashboard');
      toast({
        title: 'Acesso negado',
        description: 'Apenas administradores podem acessar esta página.',
        variant: 'destructive',
      });
    }
  }, [canAccessAdminUsers, loading, navigate, toast]);

  useEffect(() => {
    if (session) {
      fetchUnidades();
      fetchUsers();
    }
  }, [session]);

  const fetchUnidades = async () => {
    const { data, error } = await supabase
      .from('unidades')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    
    if (!error && data) {
      setUnidades(data);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setFetchError({ type: null, message: '' });

    try {
      // Get fresh session to ensure token is available
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session?.access_token) {
        setFetchError({
          type: 'unauthorized',
          message: 'Sessão expirada. Faça login novamente.',
        });
        setLoading(false);
        return;
      }

      // Pass token explicitly to ensure it's included
      const { data, error } = await supabase.functions.invoke('list-users', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      // Handle invoke errors (network issues, function not found, etc.)
      if (error) {
        console.error('Function invoke error:', error);
        setFetchError({
          type: 'server_error',
          message: 'Erro ao conectar com o servidor. Tente novamente.',
        });
        return;
      }

      // Handle application-level errors from the function response
      if (data?.error) {
        console.log('Function returned error:', data.error, data.message);
        
        if (data.error === 'Unauthorized') {
          setFetchError({
            type: 'unauthorized',
            message: data.message || 'Sessão expirada. Faça login novamente.',
          });
        } else if (data.error === 'Forbidden') {
          setFetchError({
            type: 'forbidden',
            message: data.message || 'Você não tem permissão para acessar esta página.',
          });
        } else {
          setFetchError({
            type: 'server_error',
            message: data.message || 'Erro ao carregar usuários.',
          });
        }
        return;
      }

      // Success - set users (handle empty/null gracefully)
      const usersList = Array.isArray(data?.users) ? data.users : [];
      setUsers(usersList);
      
    } catch (error: any) {
      console.error('Unexpected error fetching users:', error);
      setFetchError({
        type: 'server_error',
        message: 'Erro inesperado ao carregar usuários. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail || !newUserPassword) {
      toast({
        title: 'Preencha todos os campos',
        description: 'Nome, email e senha são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (newUserPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { 
          name: newUserName.trim(),
          email: newUserEmail, 
          password: newUserPassword,
          role: newUserRole,
          unidade_ids: newUserUnidades
        },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Usuário criado!',
        description: `${newUserEmail} foi criado com sucesso.`,
      });

      // Reset form and close dialog
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('comercial');
      setNewUserUnidades([]);
      setCreateDialogOpen(false);

      // Refresh list
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('update-user-role', {
        body: { userId, role: newRole },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUsers(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, role: newRole as UserRole } : user
        )
      );

      toast({
        title: 'Role atualizado',
        description: `Usuário atualizado para ${newRole}`,
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro ao atualizar role',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingUserId(userToDelete.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.id },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUsers(prev => prev.filter(user => user.id !== userToDelete.id));

      toast({
        title: 'Usuário excluído',
        description: `${userToDelete.email} foi removido com sucesso`,
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Erro ao excluir usuário',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setDeletingUserId(null);
      setUserToDelete(null);
    }
  };

  const handleEditName = (user: UserData) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditNameDialogOpen(true);
  };

  const handleUpdateName = async () => {
    if (!editingUser || !editName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe o nome do usuário.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingName(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('update-user-name', {
        body: { userId: editingUser.id, name: editName.trim() },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update local state
      setUsers(prev =>
        prev.map(user =>
          user.id === editingUser.id ? { ...user, name: editName.trim() } : user
        )
      );

      toast({
        title: 'Nome atualizado!',
        description: `O nome foi alterado para "${editName.trim()}".`,
      });

      setEditNameDialogOpen(false);
      setEditingUser(null);
      setEditName('');
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast({
        title: 'Erro ao atualizar nome',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingName(false);
    }
  };

  const handleEditUnidades = (user: UserData) => {
    setEditingUnidadesUser(user);
    setEditUnidadeIds(user.unidade_ids || []);
    setEditUnidadesDialogOpen(true);
  };

  const handleUpdateUnidades = async () => {
    if (!editingUnidadesUser) return;

    setUpdatingUnidades(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('update-user-unidades', {
        body: { userId: editingUnidadesUser.id, unidade_ids: editUnidadeIds },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update local state
      setUsers(prev =>
        prev.map(user =>
          user.id === editingUnidadesUser.id ? { ...user, unidade_ids: editUnidadeIds } : user
        )
      );

      toast({
        title: 'Unidades atualizadas!',
        description: 'As unidades do usuário foram atualizadas.',
      });

      setEditUnidadesDialogOpen(false);
      setEditingUnidadesUser(null);
      setEditUnidadeIds([]);
    } catch (error: any) {
      console.error('Error updating unidades:', error);
      toast({
        title: 'Erro ao atualizar unidades',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUnidades(false);
    }
  };

  const getUnidadeNames = (unidadeIds: string[]) => {
    if (!unidadeIds || unidadeIds.length === 0) return 'Nenhuma';
    return unidadeIds
      .map(id => unidades.find(u => u.id === id)?.nome || 'Desconhecida')
      .join(', ');
  };

  const getRoleBadge = (role: UserRole | null) => {
    if (!role) {
      return <Badge variant="outline" className="text-muted-foreground">Sem role</Badge>;
    }

    const config = {
      admin: { className: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'Admin' },
      recepcao: { className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'Recepção' },
      comercial: { className: 'bg-green-500/10 text-green-600 border-green-500/20', label: 'Comercial' },
    };

    const { className, label } = config[role];
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const canDeleteUser = (userId: string) => {
    return currentUser?.id !== userId;
  };

  // Render error states
  if (fetchError.type) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Administração de Usuários</h1>
              <p className="text-muted-foreground">Gerencie os roles e permissões dos usuários</p>
            </div>
          </div>

          <Alert variant="destructive" className="max-w-2xl">
            {fetchError.type === 'unauthorized' && <ShieldX className="h-4 w-4" />}
            {fetchError.type === 'forbidden' && <Shield className="h-4 w-4" />}
            {fetchError.type === 'server_error' && <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>
              {fetchError.type === 'unauthorized' && 'Não autorizado'}
              {fetchError.type === 'forbidden' && 'Acesso negado'}
              {fetchError.type === 'server_error' && 'Erro no servidor'}
            </AlertTitle>
            <AlertDescription className="mt-2">
              {fetchError.message}
            </AlertDescription>
            <div className="mt-4">
              {fetchError.type === 'unauthorized' && (
                <Button variant="outline" onClick={() => navigate('/login')}>
                  Fazer login
                </Button>
              )}
              {fetchError.type === 'forbidden' && (
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Voltar ao Dashboard
                </Button>
              )}
              {fetchError.type === 'server_error' && (
                <Button variant="outline" onClick={fetchUsers}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar novamente
                </Button>
              )}
            </div>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Administração de Usuários</h1>
              <p className="text-muted-foreground">Gerencie os roles e permissões dos usuários</p>
            </div>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Role Legend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Permissões por Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-600">Admin</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso total: Dashboard, Executivo, CRM, Funil, Comissões, Relatório, Usuários
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-600">Recepção</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso: Dashboard, CRM, Funil. Edita apenas leads próprios.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-600">Comercial</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso: Dashboard, CRM, Funil. Edita apenas leads próprios.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuários ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Role Atual</TableHead>
                    <TableHead>Alterar Role</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={user.name ? 'font-medium' : 'text-muted-foreground italic'}>
                            {user.name || 'Sem nome'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleEditName(user)}
                            title="Editar nome"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.email}
                        {currentUser?.id === user.id && (
                          <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground max-w-32 truncate" title={getUnidadeNames(user.unidade_ids)}>
                            {getUnidadeNames(user.unidade_ids)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleEditUnidades(user)}
                            title="Editar unidades"
                          >
                            <Building2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role || ''}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                          disabled={updatingUserId === user.id}
                        >
                          <SelectTrigger className="w-40">
                            {updatingUserId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <SelectValue placeholder="Selecionar role" />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <span className="flex items-center gap-2">
                                  <option.icon className="w-4 h-4" />
                                  {option.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setUserToDelete(user)}
                          disabled={!canDeleteUser(user.id) || deletingUserId === user.id}
                          title={!canDeleteUser(user.id) ? 'Você não pode excluir seu próprio usuário' : 'Excluir usuário'}
                        >
                          {deletingUserId === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Nome completo do usuário"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Este nome aparecerá em "Cadastrado por" nos leads
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Permissão</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidades</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {unidades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada</p>
                ) : (
                  unidades.map((unidade) => (
                    <div key={unidade.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-unidade-${unidade.id}`}
                        checked={newUserUnidades.includes(unidade.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewUserUnidades([...newUserUnidades, unidade.id]);
                          } else {
                            setNewUserUnidades(newUserUnidades.filter(id => id !== unidade.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`new-unidade-${unidade.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {unidade.nome}
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione as unidades que o usuário terá acesso
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.email}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita. O usuário perderá todo o acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Name Dialog */}
      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nome do Usuário</DialogTitle>
            <DialogDescription>
              Altere o nome que aparecerá em "Cadastrado por" nos leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Nome</Label>
              <Input
                id="editName"
                type="text"
                placeholder="Nome completo do usuário"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Usuário: {editingUser?.email}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateName} disabled={updatingName}>
              {updatingName && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Unidades Dialog */}
      <Dialog open={editUnidadesDialogOpen} onOpenChange={setEditUnidadesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Unidades do Usuário</DialogTitle>
            <DialogDescription>
              Selecione as unidades que o usuário terá acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              {unidades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada</p>
              ) : (
                unidades.map((unidade) => (
                  <div key={unidade.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-unidade-${unidade.id}`}
                      checked={editUnidadeIds.includes(unidade.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditUnidadeIds([...editUnidadeIds, unidade.id]);
                        } else {
                          setEditUnidadeIds(editUnidadeIds.filter(id => id !== unidade.id));
                        }
                      }}
                    />
                    <label
                      htmlFor={`edit-unidade-${unidade.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {unidade.nome}
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Usuário: {editingUnidadesUser?.email}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUnidadesDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUnidades} disabled={updatingUnidades}>
              {updatingUnidades && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
