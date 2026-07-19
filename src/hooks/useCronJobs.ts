import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
}

export function useCronJobs() {
  const qc = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-cron-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_cron_jobs' as any);
      if (error) throw error;
      return (data || []) as CronJob[];
    },
  });

  const toggleJob = useMutation({
    mutationFn: async ({ jobid, active }: { jobid: number; active: boolean }) => {
      const { error } = await supabase.rpc('admin_toggle_cron_job' as any, { p_jobid: jobid, p_active: active });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cron-jobs'] });
      toast({ title: 'Job atualizado' });
    },
    onError: (e: any) => toast({ title: 'Erro ao alterar job', description: e.message, variant: 'destructive' }),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ jobid, schedule }: { jobid: number; schedule: string }) => {
      const { error } = await supabase.rpc('admin_update_cron_schedule' as any, { p_jobid: jobid, p_schedule: schedule });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cron-jobs'] });
      toast({ title: 'Horário atualizado' });
    },
    onError: (e: any) => toast({ title: 'Erro ao atualizar horário', description: e.message, variant: 'destructive' }),
  });

  return { jobs, isLoading, toggleJob, updateSchedule };
}
