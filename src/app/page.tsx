
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Heart, AlertCircle, MessageCircle, Sparkles, ArrowRight, Loader2, Crown } from 'lucide-react';
import Header from '@/components/Header';
import Image from 'next/image';
import { useUser, useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const { user } = useUser();
  const db = useFirestore();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const userRef = useMemo(() => (user && db ? doc(db, 'users', user.uid) : null), [user, db]);
  const { data: profile, loading: profileLoading } = useDoc(userRef);

  const petsQuery = useMemo(() => {
    if (!user || !db) return null;
    return collection(db, 'users', user.uid, 'pets');
  }, [user, db]);

  const { data: pets, loading: petsLoading, error: petsError } = useCollection(petsQuery);

  useEffect(() => {
    if (!profileLoading && profile && profile.acceptedTerms !== true) {
      setShowTermsModal(true);
    }
  }, [profile, profileLoading]);

  const handleAcceptTerms = async () => {
    if (!userRef) return;
    setIsAccepting(true);
    try {
      await updateDoc(userRef, {
        acceptedTerms: true
      });
      setShowTermsModal(false);
    } catch (error) {
      console.error("Erro ao aceitar termos:", error);
    } finally {
      setIsAccepting(false);
    }
  };

  const userPlan = profile?.subscriptionPlan || 'free';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
        <section className="mb-8 md:mb-12 text-center space-y-3 md:space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] md:text-[10px] font-bold uppercase tracking-widest animate-pulse mb-1">
              <Sparkles className="h-3 w-3 fill-current" />
              IA Preventiva de Saúde
            </div>
            {user && !profileLoading && (
              <div className="animate-in fade-in zoom-in duration-500">
                {userPlan === 'pro' ? (
                  <Badge className="bg-amber-500 text-white border-none px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <Crown className="h-3 w-3 fill-current" />
                    <span className="text-[10px] tracking-[0.2em] font-black uppercase">MEMBRO PRO</span>
                  </Badge>
                ) : userPlan === 'premium' ? (
                  <Badge className="bg-primary text-primary-foreground border-none px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                    <Sparkles className="h-3 w-3 fill-current" />
                    <span className="text-[10px] tracking-[0.2em] font-black uppercase">MEMBRO PREMIUM</span>
                  </Badge>
                ) : null}
              </div>
            )}
          </div>
          
          <h1 className="font-headline text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground px-2 leading-[1.2]">
            Cuidando do seu <span className="text-primary italic">pet</span> com IA
          </h1>
          <p className="mx-auto max-w-lg text-[13px] md:text-sm text-muted-foreground px-4 leading-relaxed opacity-80">
            Acompanhamento inteligente de sintomas e nutrição animal. O bem-estar do seu melhor amigo começa com a prevenção da WS Studios.
          </p>
        </section>

        {user && (
          <div className="grid gap-8 mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                  <div className="bg-primary/20 p-1.5 rounded-lg">
                    <Heart className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  </div>
                  Meus Pets
                </h2>
              </div>
              
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {petsLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl bg-white/[0.02]" />
                  ))
                ) : petsError ? (
                  <Card className="col-span-full border-destructive/20 bg-destructive/5 p-4 text-center rounded-2xl">
                    <p className="text-xs text-destructive flex items-center justify-center gap-2">
                      <AlertCircle className="h-3 w-3" /> Erro ao sincronizar dados.
                    </p>
                  </Card>
                ) : pets.length > 0 ? (
                  pets.map((pet: any) => (
                    <Link key={pet.id} href={`/pets/${pet.id}/chat`} className="group outline-none">
                      <Card className="bg-white/[0.01] border-white/5 hover:border-primary/40 hover:bg-white/[0.03] transition-all duration-300 rounded-xl active:scale-[0.98]">
                        <CardContent className="p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted flex-shrink-0 ring-1 ring-primary/10 group-hover:ring-primary/20 transition-all">
                              {pet.photoURL ? (
                                <Image src={pet.photoURL} alt={pet.name} fill className="object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-muted">
                                  <Heart className="h-4 w-4 text-primary/40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm group-hover:text-primary transition-colors truncate">
                                {pet.name.toLowerCase()}
                              </h3>
                              <p className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">
                                {pet.species} • {pet.breed || 'SRD'}
                              </p>
                            </div>
                          </div>
                          <div className="bg-white/5 p-1 rounded-full group-hover:bg-primary/10 transition-colors">
                            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                ) : (
                  <Card className="col-span-full border-dashed border-white/10 bg-transparent p-10 text-center flex flex-col items-center gap-4 rounded-2xl">
                    <div className="bg-white/5 p-4 rounded-full ring-1 ring-white/10">
                      <Heart className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <div className="space-y-1">
                      <CardDescription className="text-base font-medium text-white/60">Sua lista está vazia</CardDescription>
                      <p className="text-[10px] text-muted-foreground max-w-[200px] mx-auto uppercase tracking-tighter">Cadastre seus animais no sistema para iniciar o chat inteligente.</p>
                    </div>
                  </Card>
                )}
              </div>
            </section>
          </div>
        )}

        <section className="mt-8 rounded-2xl bg-gradient-to-b from-white/[0.02] to-transparent p-5 text-center border border-white/5 max-w-md mx-auto">
          <div className="mb-3 flex justify-center">
            <div className="bg-primary/10 p-2 rounded-full ring-1 ring-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
          </div>
          <h2 className="font-headline mb-1.5 text-sm font-bold">Tecnologia WS Studios</h2>
          <p className="mx-auto max-sm text-[9px] text-muted-foreground leading-relaxed italic opacity-70">
            Nossa missão é antecipar problemas e educar tutores. Lembre-se: o Vet IA orienta através de análise de dados, mas não substitui a consulta profissional.
          </p>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-transparent py-8">
        <div className="container mx-auto px-4 text-center">
           <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.3em] opacity-30">
            &copy; {new Date().getFullYear()} Vet IA • WS Studios • All Rights Reserved
          </p>
        </div>
      </footer>

      <AlertDialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <AlertDialogContent className="bg-card border-white/5 rounded-[2rem] max-w-[400px]">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">Termos de Uso e IA</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm leading-relaxed text-muted-foreground">
              Para continuar utilizando o Vet IA, você deve estar ciente e concordar com nossos{" "}
              <Link href="/terms" className="text-primary font-bold underline underline-offset-4 hover:text-primary/80">
                Termos de Uso
              </Link>.
              Você autoriza o uso de dados para treinamento de IA e reconhece que o sistema está em desenvolvimento constante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <Button 
              onClick={handleAcceptTerms}
              disabled={isAccepting}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-all active:scale-95"
            >
              {isAccepting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ciente e Concordo"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
