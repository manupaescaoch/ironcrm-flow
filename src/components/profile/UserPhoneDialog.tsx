import { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserProfile } from '@/hooks/useUserProfile';

interface UserPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserPhoneDialog({ open, onOpenChange }: UserPhoneDialogProps) {
  const { profile, loading, saving, updatePhone } = useUserProfile();
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (profile?.telefone) {
      setPhone(profile.telefone);
    }
  }, [profile?.telefone]);

  const debouncedSave = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(async () => {
      await updatePhone(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  }, [updatePhone]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
    setSaved(false);
    debouncedSave(value);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Meu Telefone
          </DialogTitle>
          <DialogDescription>
            Informe seu telefone para receber notificações de tarefas via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (com DDD)</Label>
              <div className="relative">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {saved && !saving && <Check className="w-4 h-4 text-green-500" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ex: (11) 99999-9999 ou 11999999999 • Salva automaticamente
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
