
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PawPrint, Mail, Lock, Loader2 } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, loading } = useUser();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redireciona para a home se o usuário já estiver logado
  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);

      // Criar/Atualizar perfil no Firestore
      await setDoc(userRef, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        updatedAt: serverTimestamp(),
        // Define o plano free se for novo usuário
        ...(!userDoc.exists() && { 
          subscriptionPlan: 'free',
          createdAt: serverTimestamp(),
          acceptedTerms: false 
        })
      }, { merge: true });

    } catch (error: any) {
      console.error("Erro ao fazer login:", error);
      toast({
        variant: "destructive",
        title: "Erro no Login",
        description: error.message || "Não foi possível entrar com Google."
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Garantir que existe um documento de perfil
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Usuário Vet IA',
          createdAt: serverTimestamp(),
          subscriptionPlan: 'free',
          acceptedTerms: false
        });
      }

      toast({
        title: "Bem-vindo de volta!",
        description: `Acesso autorizado.`
      });
    } catch (error: any) {
      console.error("Erro de login:", error);
      toast({
        variant: "destructive",
        title: "Acesso Negado",
        description: "E-mail ou senha inválidos."
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <PawPrint className="h-10 w-10 text-primary animate-pulse" />
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">Verificando...</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-8">
      <div className="mb-10 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center space-x-2 mb-3">
          <PawPrint className="h-8 w-8 text-foreground" />
          <span className="font-headline text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Vet <span className="text-primary">IA</span>
          </span>
        </div>
        <p className="text-[10px] md:text-xs text-muted-foreground text-center max-w-[200px] uppercase font-bold tracking-widest opacity-60">
          WS Studios • Prevenção e Saúde Animal Inteligente
        </p>
      </div>

      <Card className="w-full max-w-[380px] border-white/5 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden rounded-[2rem]">
        <div className="h-1 bg-primary w-full opacity-50" />
        <CardHeader className="space-y-1 p-8 pb-4 text-center">
          <CardTitle className="text-xl font-bold tracking-tight">Entrar</CardTitle>
          <CardDescription className="text-[10px] leading-relaxed uppercase tracking-normal opacity-70">
            Acesse usando seu e-mail e senha da conta <strong>Mundo Pet</strong> ou entre pelo Google com o mesmo e-mail cadastrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-6">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] uppercase font-bold text-muted-foreground ml-1">E-mail Mundo Pet</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="exemplo@mundopet.com" 
                  className="bg-white/[0.03] border-white/5 pl-10 h-12 rounded-2xl focus-visible:ring-primary/30"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoggingIn}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="bg-white/[0.03] border-white/5 pl-10 h-12 rounded-2xl focus-visible:ring-primary/30"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoggingIn}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl transition-all active:scale-[0.98]" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acessar Plataforma"}
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold tracking-[0.2em]">
              <span className="bg-[#050505] px-3 text-white/20">Acesso Mundo Pet</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full h-12 gap-3 font-bold border-white/5 bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl transition-all active:scale-[0.98]"
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Entrar com Google
          </Button>
        </CardContent>
      </Card>
      
      <footer className="mt-12 text-center text-[9px] text-muted-foreground font-bold uppercase tracking-[0.3em] opacity-30">
        &copy; WS Studios • Vet IA • {new Date().getFullYear()}
      </footer>
    </div>
  );
}
