import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Play, CheckCircle2, Paperclip, MessageSquare, Loader2, RotateCcw, FileText } from 'lucide-react';
import { useOpsExecucao, toDateKey } from '@/hooks/useOpsExecucao';
import { OpsStatusBadge, deriveOpsStatus } from '@/components/ops/OpsStatusBadge';

interface Props {
  atividadeId: string;
  unidadeId: string;
  data: Date;
  horario?: string | null;
  prazo?: string | null;
  exigeEvidencia?: boolean;
  exigeConfirmacao?: boolean;
  instrucao?: string | null;
}

function formatHora(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function AtividadeExecucaoPanel({
  atividadeId,
  unidadeId,
  data,
  horario,
  prazo,
  exigeEvidencia,
  exigeConfirmacao,
  instrucao,
}: Props) {
  const dataKey = toDateKey(data);
  const {
    execucao, comentarios, anexos, loading, saving, uploading, status,
    iniciar, concluir, reabrir, comentar, anexarEvidencia, abrirEvidencia,
  } = useOpsExecucao({ atividadeId, unidadeId, data: dataKey, exigeEvidencia, exigeConfirmacao });

  const [observacao, setObservacao] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const statusVisual = deriveOpsStatus(status, { data: dataKey, horario, prazo });
  const concluida = status === 'concluida';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execução do dia</span>
        <OpsStatusBadge status={statusVisual} />
      </div>

      {instrucao && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground whitespace-pre-line">{instrucao}</p>
        </div>
      )}

      {execucao && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {execucao.iniciado_em && <p>Iniciada às {formatHora(execucao.iniciado_em)}</p>}
          {execucao.concluido_em && <p>Concluída às {formatHora(execucao.concluido_em)}</p>}
          {execucao.observacao && <p className="text-foreground">Observação: {execucao.observacao}</p>}
        </div>
      )}

      {!concluida && (
        <div className="space-y-3">
          {(exigeEvidencia || exigeConfirmacao) && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              {exigeEvidencia && (
                <p className="text-xs text-muted-foreground">
                  Esta atividade exige evidência anexada para ser concluída.
                </p>
              )}
              {exigeConfirmacao && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={confirmado} onCheckedChange={(v) => setConfirmado(v === true)} />
                  Confirmo que a atividade foi executada conforme a instrução
                </label>
              )}
            </div>
          )}

          <Textarea
            placeholder="OBSERVAÇÃO DA EXECUÇÃO (OPCIONAL)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
          />

          <div className="flex flex-wrap gap-2">
            {status !== 'em_andamento' && (
              <Button size="sm" variant="outline" onClick={iniciar} disabled={saving || loading}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
                Iniciar
              </Button>
            )}
            <Button
              size="sm"
              onClick={async () => {
                const ok = await concluir({ observacao, confirmado });
                if (ok) { setObservacao(''); setConfirmado(false); }
              }}
              disabled={saving || loading}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Concluir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Paperclip className="mr-1.5 h-4 w-4" />}
              Evidência
            </Button>
          </div>
        </div>
      )}

      {concluida && (
        <Button size="sm" variant="outline" onClick={reabrir} disabled={saving}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Reabrir execução
        </Button>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) anexarEvidencia(file);
          e.target.value = '';
        }}
      />

      {anexos.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidências</p>
          {anexos.map((a) => (
            <button
              key={a.id}
              onClick={() => abrirEvidencia(a)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{a.nome_arquivo || 'Evidência'}</span>
            </button>
          ))}
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Comentários
        </p>
        {comentarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
        {comentarios.map((c) => (
          <div key={c.id} className="rounded-lg bg-muted/60 p-2.5">
            <p className="text-xs text-muted-foreground">
              {c.usuario_nome || 'USUÁRIO'} · {new Date(c.created_at).toLocaleString('pt-BR')}
            </p>
            <p className="text-sm whitespace-pre-line">{c.comentario}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <Textarea
            placeholder="ESCREVER COMENTÁRIO"
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            rows={1}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!novoComentario.trim()}
            onClick={async () => { await comentar(novoComentario); setNovoComentario(''); }}
          >
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
