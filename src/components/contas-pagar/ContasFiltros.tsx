import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { CATEGORIAS, FORMAS_PAGAMENTO, PRIORIDADES, STATUS_VIEW } from './constants';

interface Props {
  busca: string;
  setBusca: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  categoria: string;
  setCategoria: (v: string) => void;
  prioridade: string;
  setPrioridade: (v: string) => void;
  forma: string;
  setForma: (v: string) => void;
}

export function ContasFiltros({
  busca,
  setBusca,
  status,
  setStatus,
  categoria,
  setCategoria,
  prioridade,
  setPrioridade,
  forma,
  setForma,
}: Props) {
  return (
    <div className="flex flex-col lg:flex-row gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar descrição ou fornecedor..."
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 lg:flex gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="lg:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_VIEW.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="lg:w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger className="lg:w-36">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {PRIORIDADES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={forma} onValueChange={setForma}>
          <SelectTrigger className="lg:w-44">
            <SelectValue placeholder="Forma de pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {FORMAS_PAGAMENTO.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
