import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import ironClubLogo from '@/assets/iron-club-logo.png';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async () => {
    setErrorMsg(null);
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      const raw = error.message || '';
      let message = raw;
      if (raw.includes('Invalid login credentials')) {
        message = 'Email ou senha incorretos. Verifique se digitou a senha corretamente — evite usar o preenchimento automático do navegador, que pode estar com uma senha antiga salva.';
      } else if (raw.includes('Email not confirmed')) {
        message = 'Email ainda não confirmado. Verifique sua caixa de entrada.';
      } else if (raw.toLowerCase().includes('too many') || raw.toLowerCase().includes('rate')) {
        message = 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
      }
      setErrorMsg(message);
      setFailedAttempts((n) => n + 1);
      toast({
        title: 'Não foi possível entrar',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 rounded-xl overflow-hidden mb-4 shadow-md">
            <img src={ironClubLogo} alt="Iron Club" className="w-full h-full object-cover" />
          </div>
          <CardTitle className="text-2xl font-bold">IRON CLUB</CardTitle>
          <CardDescription>Sistema de CRM para gestão de leads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Dica: digite a senha manualmente. O preenchimento automático do navegador pode usar uma senha antiga.
            </p>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro ao entrar</AlertTitle>
              <AlertDescription>
                {errorMsg}
                {failedAttempts >= 2 && (
                  <div className="mt-2">
                    Continua sem conseguir? <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="underline font-medium">Redefina sua senha</Link>.
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full" 
            onClick={handleLogin}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
          <div className="text-center">
            <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
              Esqueci minha senha
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
