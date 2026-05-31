import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send, Trash2, Pencil, X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useReuniaoComentarios, type ReuniaoComentario } from '@/hooks/useReuniaoComentarios';

interface Props {
  reuniaoId: string;
  unidadeId: string;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function ReuniaoComentarios({ reuniaoId, unidadeId }: Props) {
  const { isAdmin, userRole } = useAuth();
  const { comentarios, loading, sending, adicionar, editar, remover } = useReuniaoComentarios(reuniaoId, unidadeId);
  const [texto, setTexto] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const canModerate = isAdmin || userRole === 'coordenador';

  const send = async () => {
    if (!texto.trim()) return;
    await adicionar(texto);
    setTexto('');
  };

  const startEdit = (c: ReuniaoComentario) => {
    setEditingId(c.id);
    setEditingText(c.conteudo);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await editar(editingId, editingText);
    setEditingId(null);
    setEditingText('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : comentarios.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-muted-foreground">
            <MessageSquare className="w-5 h-5" />
            <p className="text-xs">Nenhum comentário ainda. Seja o primeiro a comentar.</p>
          </div>
        ) : (
          comentarios.map((c) => {
            const mine = uid === c.autor_id;
            const canEdit = mine;
            const canDelete = mine || canModerate;
            const isEditing = editingId === c.id;
            const edited = c.updated_at && c.updated_at !== c.created_at;
            return (
              <div key={c.id} className="flex gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold">
                  {initials(c.autor_nome || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium">{c.autor_nome}</span>
                      <span className="text-muted-foreground">• {formatWhen(c.created_at)}</span>
                      {edited && <span className="text-[10px] text-muted-foreground italic">(editado)</span>}
                    </div>
                    {!isEditing && (canEdit || canDelete) && (
                      <div className="flex gap-0.5">
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEdit(c)} title="Editar">
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm('Remover este comentário?')) remover(c.id); }}
                            title="Remover"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1.5 space-y-1.5">
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="min-h-[60px] text-sm"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setEditingId(null)}>
                          <X className="w-3 h-3" /> Cancelar
                        </Button>
                        <Button size="sm" className="h-7 gap-1" onClick={saveEdit}>
                          <Check className="w-3 h-3" /> Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">{c.conteudo}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="ESCREVA UM COMENTÁRIO..."
          className="min-h-[70px] text-sm"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter para enviar</span>
          <Button size="sm" className="gap-1.5" disabled={!texto.trim() || sending} onClick={send}>
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Comentar
          </Button>
        </div>
      </div>
    </div>
  );
}
