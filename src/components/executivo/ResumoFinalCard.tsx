import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award } from 'lucide-react';
import { ResumoFinal } from '@/components/executivo/constants';

interface ResumoFinalCardProps {
  resumo: ResumoFinal;
}

export const ResumoFinalCard = memo(function ResumoFinalCard({ resumo }: ResumoFinalCardProps) {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" /> Resumo Final do Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4">
            <p className="text-3xl font-bold">{resumo.totalLeads}</p>
            <p className="text-sm text-muted-foreground">Total de Leads</p>
          </div>
          <div className="text-center p-4">
            <p className="text-3xl font-bold">{resumo.totalAgendamentos}</p>
            <p className="text-sm text-muted-foreground">Total Agendamentos</p>
          </div>
          <div className="text-center p-4">
            <p className="text-3xl font-bold">{resumo.totalComparecimentos}</p>
            <p className="text-sm text-muted-foreground">Total Comparecimentos</p>
          </div>
          <div className="text-center p-4">
            <p className="text-3xl font-bold text-green-600">{resumo.totalMatriculas}</p>
            <p className="text-sm text-muted-foreground">Total Matrículas</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
          <div className="text-center p-4">
            <p className="text-2xl font-bold text-cyan-600">{resumo.conversaoGeral.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Conversão Geral</p>
          </div>
          <div className="text-center p-4">
            <p className="text-2xl font-bold text-amber-600">{resumo.mediaNoShow.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Média No-Show</p>
          </div>
          <div className="text-center p-4">
            <p className="text-lg font-bold">{resumo.melhorCadastrador}</p>
            <p className="text-sm text-muted-foreground">Melhor Cadastrador</p>
          </div>
          <div className="text-center p-4">
            <p className="text-lg font-bold">{resumo.melhorFechador}</p>
            <p className="text-sm text-muted-foreground">Melhor Fechador</p>
          </div>
          <div className="text-center p-4">
            <p className="text-lg font-bold">{resumo.melhorTreinador}</p>
            <p className="text-sm text-muted-foreground">Melhor Treinador</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
