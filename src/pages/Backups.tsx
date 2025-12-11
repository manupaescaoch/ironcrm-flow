import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, RefreshCw, Database, Loader2, FileText, Calendar, HardDrive } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BackupFile {
  name: string;
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface GroupedBackup {
  date: string;
  leadsFile: BackupFile | null;
  interacoesFile: BackupFile | null;
}

export default function Backups() {
  const [backups, setBackups] = useState<GroupedBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('backups_crm_iron')
        .list('', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      // Group files by date
      const grouped: Record<string, GroupedBackup> = {};
      
      (data || []).forEach((file: BackupFile) => {
        // Extract date from filename (YYYY-MM-DD_FULL_CRM_...)
        const dateMatch = file.name.match(/^(\d{4}-\d{2}-\d{2})_FULL_CRM_/);
        if (!dateMatch) return;
        
        const date = dateMatch[1];
        if (!grouped[date]) {
          grouped[date] = { date, leadsFile: null, interacoesFile: null };
        }
        
        if (file.name.includes('LEADS')) {
          grouped[date].leadsFile = file;
        } else if (file.name.includes('INTERACOES')) {
          grouped[date].interacoesFile = file;
        }
      });

      // Sort by date descending and take last 30
      const sortedBackups = Object.values(grouped)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);

      setBackups(sortedBackups);
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os backups.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const generateBackup = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-crm-backup');
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: 'Backup Gerado',
          description: `Backup criado com ${data.files.leads.rows} leads e ${data.files.interacoes.rows} interações.`,
        });
        fetchBackups();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Error generating backup:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o backup.',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const downloadFile = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const { data, error } = await supabase.storage
        .from('backups_crm_iron')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (error) throw error;
      
      if (data?.signedUrl) {
        // Open in new tab to trigger download
        window.open(data.signedUrl, '_blank');
        toast({
          title: 'Download Iniciado',
          description: `Baixando ${fileName}`,
        });
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível baixar o arquivo.',
        variant: 'destructive'
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="w-6 h-6" />
              Backups CRM
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e baixe os backups do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchBackups}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              onClick={generateBackup}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Gerar Backup Agora
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Backups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold">{backups.length}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Último Backup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-lg font-semibold">
                  {backups[0] ? formatDate(backups[0].date) : 'Nenhum'}
                </span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Backup Automático
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Diário às 02:00
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Backups Table */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Backups</CardTitle>
            <CardDescription>
              Últimos 30 backups disponíveis para download
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum backup encontrado</p>
                <p className="text-sm">Clique em "Gerar Backup Agora" para criar o primeiro backup</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo Leads</TableHead>
                    <TableHead>Arquivo Interações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.date}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {formatDate(backup.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {backup.leadsFile ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">{backup.leadsFile.name}</span>
                            {typeof backup.leadsFile.metadata?.size === 'number' && (
                              <Badge variant="outline" className="text-xs">
                                <HardDrive className="w-3 h-3 mr-1" />
                                {formatFileSize(backup.leadsFile.metadata.size as number)}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {backup.interacoesFile ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-500" />
                            <span className="text-sm">{backup.interacoesFile.name}</span>
                            {typeof backup.interacoesFile.metadata?.size === 'number' && (
                              <Badge variant="outline" className="text-xs">
                                <HardDrive className="w-3 h-3 mr-1" />
                                {formatFileSize(backup.interacoesFile.metadata.size as number)}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {backup.leadsFile && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadFile(backup.leadsFile!.name)}
                              disabled={downloadingFile === backup.leadsFile.name}
                            >
                              {downloadingFile === backup.leadsFile.name ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              <span className="ml-1 hidden sm:inline">Leads</span>
                            </Button>
                          )}
                          {backup.interacoesFile && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadFile(backup.interacoesFile!.name)}
                              disabled={downloadingFile === backup.interacoesFile.name}
                            >
                              {downloadingFile === backup.interacoesFile.name ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              <span className="ml-1 hidden sm:inline">Interações</span>
                            </Button>
                          )}
                        </div>
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
