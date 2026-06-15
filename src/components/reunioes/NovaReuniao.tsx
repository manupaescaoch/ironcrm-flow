import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2, Paperclip, Upload, FileType } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useReunioesData } from '@/hooks/useReunioesData';
import { TIPOS_REUNIAO } from './constants';
import { RichTextEditor, isRichTextEmpty } from '@/components/ui/rich-text-editor';
import {
  ACCEPTED_ANEXO_ATTR,
  ACCEPTED_ANEXO_LABEL,
  isAnexoValido,
  uploadReuniaoAnexo,
} from '@/hooks/useReuniaoAnexos';
import { useUnidadeUsers } from '@/hooks/useUnidadeUsers';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  onSaved?: () => void;
}

export function NovaReuniao({ onSaved }: Props) {
  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  const { createReuniao } = useReunioesData();
  const { users, loading: loadingUsers } = useUnidadeUsers();

  const [tipo, setTipo] = useState<string>('');
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [unidadeIds, setUnidadeIds] = useState<string[]>(unidadeAtual ? [unidadeAtual.id] : []);
  const [responsavel, setResponsavel] = useState('');
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [participanteInput, setParticipanteInput] = useState('');
  const [pauta, setPauta] = useState('');
  const [feedback, setFeedback] = useState('');
  const [anexos, setAnexos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addParticipante = () => {
    const v = participanteInput.trim().toUpperCase();
    if (v && !participantes.includes(v)) {
      setParticipantes([...participantes, v]);
    }
    setParticipanteInput('');
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const novos: File[] = [];
    Array.from(files).forEach((f) => {
      const v = isAnexoValido(f);
      if (!v.ok) {
        toast({ title: `Arquivo "${f.name}" ignorado`, description: v.reason, variant: 'destructive' });
        return;
      }
      novos.push(f);
    });
    if (novos.length) setAnexos((prev) => [...prev, ...novos]);
  };

  const handleSubmit = async () => {
    if (!tipo) return toast({ title: 'Selecione o tipo da reunião', variant: 'destructive' });
    if (!data) return toast({ title: 'Informe a data', variant: 'destructive' });
    if (!unidadeId) return toast({ title: 'Selecione a unidade', variant: 'destructive' });
    if (!responsavel.trim()) return toast({ title: 'Informe o responsável pela reunião', variant: 'destructive' });
    if (participantes.length === 0) return toast({ title: 'Adicione ao menos um participante', variant: 'destructive' });
    if (isRichTextEmpty(pauta)) return toast({ title: 'Informe a pauta', variant: 'destructive' });

    setSaving(true);
    try {
      const created: any = await createReuniao({
        tipo,
        unidade_id: unidadeId,
        data,
        responsavel: responsavel.trim().toUpperCase(),
        participantes,
        pauta,
        feedback: feedback.trim() || null,
        status: 'aberta',
      });

      if (anexos.length && created?.id) {
        let okCount = 0;
        for (const f of anexos) {
          try {
            await uploadReuniaoAnexo(created.id, unidadeId, f);
            okCount++;
          } catch (err: any) {
            toast({ title: `Falha ao anexar ${f.name}`, description: err.message, variant: 'destructive' });
          }
        }
        if (okCount) toast({ title: `${okCount} arquivo(s) anexado(s)` });
      }

      toast({ title: 'Reunião registrada com sucesso' });
      setTipo('');
      setResponsavel('');
      setParticipantes([]);
      setPauta('');
      setFeedback('');
      setAnexos([]);
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo de reunião *</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {TIPOS_REUNIAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Data *</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Unidade *</Label>
          <Select value={unidadeId} onValueChange={setUnidadeId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {unidadesPermitidas.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Responsável pela reunião *</Label>
        {users.length > 0 ? (
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger>
              <SelectValue placeholder={loadingUsers ? 'Carregando...' : 'Selecione o responsável'} />
            </SelectTrigger>
            <SelectContent className="max-h-[280px]">
              {users.map((u) => (
                <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value.toUpperCase())}
            placeholder={loadingUsers ? 'Carregando usuários...' : 'Nome do responsável'}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Participantes *</Label>
        <div className="flex gap-2">
          <Input
            value={participanteInput}
            onChange={(e) => setParticipanteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addParticipante();
              }
            }}
            placeholder="Digite o nome e pressione Enter"
          />
          <Button type="button" variant="outline" onClick={addParticipante}>Adicionar</Button>
        </div>
        {participantes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {participantes.map((p, i) => (
              <Badge key={i} variant="secondary" className="font-normal gap-1">
                {p}
                <button onClick={() => setParticipantes(participantes.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Pauta da reunião *</Label>
        <RichTextEditor
          value={pauta}
          onChange={setPauta}
          placeholder="Digite a pauta. Use a barra de ferramentas para formatar e inserir tabelas..."
          minHeight={220}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Feedback da reunião</Label>
        <Textarea rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Anexos
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" /> Anexar arquivo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_ANEXO_ATTR}
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
        {anexos.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {ACCEPTED_ANEXO_LABEL} • até 15 MB cada
          </p>
        ) : (
          <ul className="space-y-1.5">
            {anexos.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 bg-muted/30">
                <FileType className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">{formatSize(f.size)}</div>
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setAnexos((prev) => prev.filter((_, idx) => idx !== i))}
                  title="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar reunião
        </Button>
      </div>
    </Card>
  );
}
