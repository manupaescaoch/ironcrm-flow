import { Hourglass } from 'lucide-react';
import { OpsLayout } from '@/components/ops/OpsLayout';

export default function OpsEmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <OpsLayout title={titulo}>
      <div className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
        <div className="rounded-2xl bg-card p-10 text-center shadow-sm">
          <Hourglass className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Em preparação</p>
          <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
    </OpsLayout>
  );
}
