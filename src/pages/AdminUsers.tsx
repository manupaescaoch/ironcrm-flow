import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Shield, UserCheck, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserRole } from '@/contexts/AuthContext';

interface UserData {
  id: string;
  email: string;
  role: UserRole | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const roleOptions: { value: string; label: string; icon: typeof Shield }[] = [
  { value: 'admin', label: 'Admin', icon: Shield },
  { value: 'recepcao', label: 'Recepção', icon: UserCheck },
  { value: 'comercial', label: 'Comercial', icon: Briefcase },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-users');

      if (error) throw error;

      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('update-user-role', {
        body: { userId, role: newRole || null },
      });

      if (error) throw error;

      // Update local state
      setUsers(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, role: newRole as UserRole } : user
        )
      );

      toast({
        title: 'Role atualizado',
        description: `Usuário atualizado para ${newRole || 'sem role'}`,
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro ao atualizar role',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
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
                  Acesso total: Dashboard, Executivo, CRM, Funil, Comissões
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-600">Recepção</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso: Dashboard, CRM, Funil
                </p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-600">Comercial</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso: Dashboard, CRM, Funil
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
                    <TableHead>Email</TableHead>
                    <TableHead>Role Atual</TableHead>
                    <TableHead>Alterar Role</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Último login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
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
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.last_sign_in_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
