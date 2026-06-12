import { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  unidadeId: string | undefined;
  refreshKey?: number;
  onChange?: () => void;
}

export function AlunosAtivosKPI({ unidadeId, refreshKey, onChange }: Props) {
  const [metaId, setMetaId] = useState<string | null>(null);
  const [ativos, setAtivos] = useState(0);
  const [anterior, setAnterior] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editAtivos, setEditAtivos] = useState(0);
  const [editAnterior, setEditAnterior] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!unidadeId) return;
    setLoading(true);
    supabase
      .from('gestao_metas')
      .select('id, alunos_ativos_manual, alunos_ativos_semana_anterior')
      .eq('unidade_id', unidadeId)
      .maybeSingle()
      .then(({ data }) => {
        setMetaId(data?.id ?? null);
        setAtivos(data?.alunos_ativos_manual ?? 0);
        setAnterior(data?.alunos_ativos_semana_anterior ?? 0);
        setLoading(false);
      });
  }, [unidadeId, refreshKey]);

  const startEdit = () => {
    setEditAtivos(ativos);
    setEditAnterior(anterior);
    setEditing(true);
  };

  const save = async () => {
    if (!unidadeId) return;
    setSaving(true);
    const payload = {
      alunos_ativos_manual: editAtivos,
      alunos_ativos_semana_anterior: editAnterior,
    };
    let error;
    let updatedRows: any[] | null = null;
    if (metaId) {
      const res = await supabase.from('gestao_metas').update(payload).eq('id', metaId).select();
      error = res.error;
      updatedRows = res.data;
    } else {
      const res = await supabase.from('gestao_metas').insert({ unidade_id: unidadeId, ...payload }).select();
      error = res.error;
      updatedRows = res.data;
      if (!error && res.data && res.data[0]) setMetaId(res.data[0].id);
    }
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    if (!updatedRows || updatedRows.length === 0) {
      toast.error('Não foi possível salvar: sem permissão para esta unidade.');
      return;
    }
    setAtivos(editAtivos);
    setAnterior(editAnterior);
    setEditing(false);
    toast.success('Alunos ativos atualizado');
    onChange?.();
  };

  return (
    <Card className="relative">
      <CardContent className="p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Alunos Ativos</span>
          <Users className="w-4 h-4 text-indigo-500" />
        </div>
        {editing ? (
          <div className="space-y-1.5 mt-1">
            <div>
              <label className="text-[10px] text-muted-foreground">Ativos</label>
              <Input type="number" value={editAtivos} onChange={e => setEditAtivos(+e.target.value)} className="h-7 text-base font-bold" autoFocus />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Semana anterior</label>
              <Input type="number" value={editAnterior} onChange={e => setEditAnterior(+e.target.value)} className="h-7 text-sm" />
            </div>
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl font-bold text-indigo-600">{loading ? '—' : ativos}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={startEdit} disabled={!unidadeId}>Editar</Button>
            </div>
            <span className="text-[11px] text-muted-foreground">Semana anterior: {anterior}</span>
          </>
        )}
      </CardContent>
    </Card>
  );
}
