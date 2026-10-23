import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUp, Loader2, Plus, ScanText, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ContaFormPayload } from '@/hooks/useContasPagar';
import { CATEGORIAS, ContaPagar } from './constants';
import { contaFormToPayload, emptyContaForm, parseValor } from './ContaFormFields';
import { DocumentoFiscalItem, DocumentosFiscaisInput, MSG_DOCUMENTO_OBRIGATORIO } from './DocumentosFiscaisInput';
import { DuplicidadeDialog } from './DuplicidadeDialog';
import { descreverErroConta } from './erros';
import { uploadContaArquivo } from './uploadHelpers';

interface Extraido {
  fornecedor: string | null;
  cpf_cnpj: string | null;
  descricao: string | null;
  valor: number | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  numero_documento: string | null;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  codigo_pix: string | null;
  chave_pix: string | null;
  categoria: string | null;
  parcelas: { numero: number | null; valor: number | null; vencimento: string | null }[];
}

interface Campos {
  fornecedor: string;
  cpf_cnpj: string;
  descricao: string;
  data_emissao: string;
  numero_documento: string;
  categoria: string;
  linha_digitavel: string;
  codigo_barras: string;
  codigo_pix: string;
  chave_pix: string;
  observacoes: string;
}

interface Parcela {
  valor: string;
  vencimento: string;
}

const camposVazios: Campos = {
  fornecedor: '',
  cpf_cnpj: '',
  descricao: '',
  data_emissao: '',
  numero_documento: '',
  categoria: '',
  linha_digitavel: '',
  codigo_barras: '',
  codigo_pix: '',
  chave_pix: '',
  observacoes: '',
};

const isoOk = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const valorStr = (v: number | null | undefined) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v.toFixed(2).replace('.', ',') : '';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

interface Props {
  unidadeId: string | null;
  unidadeNome: string;
  canManage: boolean;
  onCriar: (payload: ContaFormPayload) => Promise<ContaPagar>;
  onInserirImportada: (payload: ContaFormPayload) => Promise<ContaPagar>;
  buscarDuplicidade: (p: {
    descricao: string;
    valor: number;
    data_vencimento: string;
    codigo_pix?: string | null;
    linha_digitavel?: string | null;
    numero_fatura?: string | null;
    fornecedor?: string | null;
    ignorarImportPrefix?: string | null;
  }) => Promise<ContaPagar[]>;
  onConcluido: (conta: ContaPagar, qtdParcelas: number) => void;
  onVerConta: (conta: ContaPagar) => void;
  onCancelar: () => void;
}

export function ImportarDocumentoConta({
  unidadeId,
  unidadeNome,
  canManage,
  onCriar,
  onInserirImportada,
  buscarDuplicidade,
  onConcluido,
  onVerConta,
  onCancelar,
}: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const importId = useRef(`imp-${crypto.randomUUID()}`);
  const [docs, setDocs] = useState<DocumentoFiscalItem[]>([]);
  const [principal, setPrincipal] = useState<DocumentoFiscalItem | null>(null);
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState(false);
  const [campos, setCampos] = useState<Campos>(camposVazios);
  const [parcelas, setParcelas] = useState<Parcela[]>([{ valor: '', vencimento: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docsErro, setDocsErro] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [duplicados, setDuplicados] = useState<ContaPagar[]>([]);

  const set = (k: keyof Campos, v: string) => setCampos((c) => ({ ...c, [k]: v }));

  const escolherArquivo = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      toast({ title: 'Use um arquivo PDF, JPG ou PNG', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'O arquivo passa de 10 MB', variant: 'destructive' });
      return;
    }
    const item: DocumentoFiscalItem = {
      id: `${Date.now()}-${Math.random()}`,
      nome: file.name,
      file,
      previewUrl: URL.createObjectURL(file),
    };
    setDocs((d) => [...d, item]);
    setPrincipal(item);
    setDocsErro(undefined);
    setLendo(true);
    try {
      const file_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('extrair-documento-conta', {
        body: { file_base64, mime_type: file.type, file_name: file.name },
      });
      if (error || !data?.dados) {
        let msg = 'Não foi possível ler o documento. Preencha os dados abaixo.';
        try {
          const ctx = (error as { context?: Response })?.context;
          const body = ctx ? await ctx.json() : data;
          if (body?.error) msg = body.error;
        } catch {
          /* mantém mensagem padrão */
        }
        toast({ title: 'Leitura do documento', description: msg, variant: 'destructive' });
        return;
      }
      const e = data.dados as Extraido;
      setCampos({
        fornecedor: (e.fornecedor || '').toUpperCase(),
        cpf_cnpj: e.cpf_cnpj || '',
        descricao: (e.descricao || '').toUpperCase(),
        data_emissao: isoOk(e.data_emissao),
        numero_documento: e.numero_documento || '',
        categoria: e.categoria && CATEGORIAS.includes(e.categoria) ? e.categoria : '',
        linha_digitavel: e.linha_digitavel || '',
        codigo_barras: e.codigo_barras || '',
        codigo_pix: e.codigo_pix || '',
        chave_pix: e.chave_pix || '',
        observacoes: '',
      });
      const ps = (e.parcelas || []).filter((p) => p.valor || p.vencimento);
      setParcelas(
        ps.length > 1
          ? ps.map((p) => ({ valor: valorStr(p.valor), vencimento: isoOk(p.vencimento) }))
          : [{ valor: valorStr(e.valor ?? ps[0]?.valor), vencimento: isoOk(e.data_vencimento ?? ps[0]?.vencimento) }],
      );
      setErrors({});
      toast({ title: 'Documento lido', description: 'Confira os dados antes de salvar. Campos em branco não foram encontrados.' });
    } catch {
      toast({ title: 'Leitura do documento', description: 'Não foi possível ler o documento. Preencha os dados abaixo.', variant: 'destructive' });
    } finally {
      setLido(true);
      setLendo(false);
    }
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!campos.descricao.trim()) e.descricao = 'Informe a descrição';
    parcelas.forEach((p, i) => {
      const v = parseValor(p.valor);
      if (!p.valor.trim() || Number.isNaN(v) || v <= 0) e[`valor_${i}`] = 'Valor inválido';
      if (!p.vencimento) e[`venc_${i}`] = 'Informe o vencimento';
    });
    return e;
  };

  const montarPayload = (p: Parcela, i: number, paths: string[]): ContaFormPayload => {
    const total = parcelas.length;
    const base = contaFormToPayload(
      {
        ...emptyContaForm,
        descricao: total > 1 ? `${campos.descricao.trim()} (${i + 1}/${total})` : campos.descricao,
        fornecedor: campos.fornecedor,
        categoria: campos.categoria,
        observacoes: campos.observacoes,
        valor: p.valor,
        data_vencimento: p.vencimento,
        numero_fatura: campos.numero_documento,
        linha_digitavel: total > 1 && i > 0 ? '' : campos.linha_digitavel,
        codigo_barras: total > 1 && i > 0 ? '' : campos.codigo_barras,
        codigo_pix: campos.codigo_pix,
        chave_pix: campos.chave_pix,
      },
      paths[0] ?? null,
    );
    return {
      ...base,
      documentos_fiscais: paths,
      fornecedor_documento: campos.cpf_cnpj.trim() || null,
      data_emissao: campos.data_emissao || null,
      import_key: `${importId.current}-${i + 1}`,
    };
  };

  const salvar = async (ignorarDuplicidade: boolean) => {
    if (saving) return;
    if (docs.length === 0) {
      setDocsErro(MSG_DOCUMENTO_OBRIGATORIO);
      toast({ title: 'Documento obrigatório', description: MSG_DOCUMENTO_OBRIGATORIO, variant: 'destructive' });
      return;
    }
    const v = validar();
    setErrors(v);
    if (Object.keys(v).length) {
      toast({ title: 'Corrija antes de salvar', description: 'Os campos em vermelho precisam ser preenchidos.', variant: 'destructive' });
      return;
    }
    if (!unidadeId) {
      toast({ title: 'Nenhuma unidade selecionada', description: 'Escolha a unidade no topo do sistema.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (!ignorarDuplicidade) {
        for (const p of parcelas) {
          const encontrados = await buscarDuplicidade({
            descricao: campos.descricao.toUpperCase(),
            valor: parseValor(p.valor),
            data_vencimento: p.vencimento,
            numero_fatura: campos.numero_documento || null,
            fornecedor: campos.fornecedor || null,
            ignorarImportPrefix: importId.current,
          });
          if (encontrados.length) {
            setDuplicados(encontrados);
            return;
          }
        }
      }

      // 1) Salva os arquivos (os já enviados numa tentativa anterior não são reenviados)
      const enviados: DocumentoFiscalItem[] = [];
      for (const d of docs) {
        if (d.path) enviados.push(d);
        else if (d.file) enviados.push({ ...d, path: await uploadContaArquivo(d.file, unidadeId, 'documentos') });
      }
      setDocs(enviados);
      const paths = enviados.map((d) => d.path as string);

      // 2) Cria a(s) conta(s) vinculadas aos documentos; a chave da importação evita duplicar em nova tentativa
      const primeira = await onCriar(montarPayload(parcelas[0], 0, paths));
      for (let i = 1; i < parcelas.length; i++) {
        await onInserirImportada(montarPayload(parcelas[i], i, paths));
      }
      setDuplicados([]);
      onConcluido(primeira, parcelas.length);
    } catch (error) {
      const { titulo, descricao } = descreverErroConta(error, 'salvar');
      toast({
        title: titulo,
        description: `${descricao} Nada foi duplicado: clique de novo em "Salvar documento e cadastrar conta" para tentar outra vez.`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const campo = (k: keyof Campos, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1">
      <Label className={cn(errors[k] && 'text-destructive')}>{label}</Label>
      <Input
        value={campos[k]}
        onChange={(e) => set(k, e.target.value)}
        className={cn(errors[k] && 'border-destructive')}
        {...props}
      />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  const preview = principal?.previewUrl;
  const isPdf = principal?.file?.type === 'application/pdf';

  return (
    <>
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => escolherArquivo(e.target.files?.[0])}
        />

        {!lido && !lendo ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'w-full rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/50 transition-colors',
              docsErro ? 'border-destructive' : 'border-border',
            )}
          >
            <FileUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">Enviar nota fiscal, cupom fiscal ou boleto</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG ou PNG, até 10 MB. Os dados são lidos automaticamente.</p>
          </button>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border bg-muted/30 min-h-[260px] overflow-hidden">
              {lendo && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Lendo o documento…
                </div>
              )}
              {preview &&
                (isPdf ? (
                  <iframe src={preview} title="Documento" className="w-full h-[420px]" />
                ) : (
                  <img src={preview} alt="Documento enviado" className="w-full h-auto max-h-[420px] object-contain" />
                ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Unidade: <strong>{unidadeNome || '—'}</strong>. Confira e edite os dados. O que não foi encontrado fica em branco.
              </p>
              {campo('fornecedor', 'Fornecedor', { onChange: (e: React.ChangeEvent<HTMLInputElement>) => set('fornecedor', e.target.value.toUpperCase()) })}
              {campo('cpf_cnpj', 'CPF/CNPJ do fornecedor')}
              {campo('descricao', 'Descrição *', { onChange: (e: React.ChangeEvent<HTMLInputElement>) => set('descricao', e.target.value.toUpperCase()) })}
              <div className="grid grid-cols-2 gap-2">
                {campo('data_emissao', 'Emissão', { type: 'date' })}
                {campo('numero_documento', 'Nº do documento')}
              </div>
              <div className="space-y-1">
                <Label>Categoria (sugerida)</Label>
                <Select value={campos.categoria || undefined} onValueChange={(v) => set('categoria', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {lido && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{parcelas.length > 1 ? `Parcelas (${parcelas.length})` : 'Valor e vencimento'}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setParcelas((p) => [...p, { valor: '', vencimento: '' }])}
                >
                  <Plus className="w-4 h-4 mr-1" /> Parcela
                </Button>
              </div>
              {parcelas.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  {parcelas.length > 1 && <span className="text-xs text-muted-foreground w-10 pt-2.5">{i + 1}/{parcelas.length}</span>}
                  <div className="flex-1">
                    <Input
                      placeholder="Valor (R$)"
                      inputMode="decimal"
                      value={p.valor}
                      onChange={(e) => setParcelas((ps) => ps.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                      className={cn(errors[`valor_${i}`] && 'border-destructive')}
                    />
                    {errors[`valor_${i}`] && <p className="text-xs text-destructive">{errors[`valor_${i}`]}</p>}
                  </div>
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={p.vencimento}
                      onChange={(e) => setParcelas((ps) => ps.map((x, j) => (j === i ? { ...x, vencimento: e.target.value } : x)))}
                      className={cn(errors[`venc_${i}`] && 'border-destructive')}
                    />
                    {errors[`venc_${i}`] && <p className="text-xs text-destructive">{errors[`venc_${i}`]}</p>}
                  </div>
                  {parcelas.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setParcelas((ps) => ps.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {campo('linha_digitavel', 'Linha digitável do boleto')}
              {campo('codigo_barras', 'Código de barras')}
              {campo('chave_pix', 'Chave Pix')}
              <div className="space-y-1">
                <Label>Pix copia e cola</Label>
                <Textarea rows={2} value={campos.codigo_pix} onChange={(e) => set('codigo_pix', e.target.value)} className="font-mono text-xs" />
              </div>
            </div>

            <DocumentosFiscaisInput
              docs={docs}
              setDocs={(d) => {
                setDocs(d);
                if (principal && !d.some((x) => x.id === principal.id)) setPrincipal(d[0] ?? null);
                if (d.length) setDocsErro(undefined);
              }}
              error={docsErro}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              A conta é cadastrada como pendente. O comprovante de pagamento é anexado separadamente, na hora da baixa.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-3 border-t">
        <Button variant="outline" onClick={onCancelar} disabled={saving}>
          Cancelar
        </Button>
        {lido && (
          <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={saving || lendo}>
            <ScanText className="w-4 h-4 mr-2" /> Ler outro documento
          </Button>
        )}
        <Button onClick={() => salvar(false)} disabled={saving || lendo || !lido}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar documento e cadastrar conta
        </Button>
      </div>

      <DuplicidadeDialog
        open={duplicados.length > 0}
        duplicados={duplicados}
        canForce={canManage}
        saving={saving}
        onVerExistente={(conta) => {
          setDuplicados([]);
          onVerConta(conta);
        }}
        onCancelar={() => setDuplicados([])}
        onCadastrarMesmoAssim={() => {
          setDuplicados([]);
          salvar(true);
        }}
      />
    </>
  );
}
