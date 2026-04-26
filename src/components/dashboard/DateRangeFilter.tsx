import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type PeriodType = 'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom';

interface DateRangeFilterProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  periodType: PeriodType;
  onPeriodTypeChange: (type: PeriodType) => void;
}

const periodOptions = [
  { value: 'all', label: 'Todo Histórico' },
  { value: 'last7days', label: 'Últimos 7 dias' },
  { value: 'currentMonth', label: 'Mês Atual' },
  { value: 'lastMonth', label: 'Mês Anterior' },
  { value: 'custom', label: 'Período Customizado' },
];

export function DateRangeFilter({ 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange,
  periodType,
  onPeriodTypeChange
}: DateRangeFilterProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const handlePeriodChange = (value: PeriodType) => {
    onPeriodTypeChange(value);
    
    const today = new Date();
    
    switch (value) {
      case 'all':
        // Data muito antiga para pegar todo histórico
        onStartDateChange(new Date(2020, 0, 1));
        onEndDateChange(today);
        break;
      case 'last7days':
        onStartDateChange(startOfDay(subDays(today, 6)));
        onEndDateChange(endOfDay(today));
        break;
      case 'currentMonth':
        onStartDateChange(startOfMonth(today));
        onEndDateChange(endOfMonth(today));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        onStartDateChange(startOfMonth(lastMonth));
        onEndDateChange(endOfMonth(lastMonth));
        break;
      case 'custom':
        // Mantém as datas atuais para customização
        break;
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Período:</span>
      
      <Select value={periodType} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {periodType === 'custom' && (
        <>
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  if (date) {
                    onStartDateChange(date);
                    setStartOpen(false);
                  }
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">até</span>

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => {
                  if (date) {
                    onEndDateChange(date);
                    setEndOpen(false);
                  }
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
