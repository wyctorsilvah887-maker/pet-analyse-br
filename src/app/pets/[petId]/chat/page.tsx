
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limitToLast, 
  updateDoc,
  where,
  Timestamp
} from 'firebase/firestore';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  PawPrint, 
  Bot, 
  User as UserIcon, 
  AlertCircle, 
  Paperclip, 
  Camera, 
  Image as ImageIcon,
  X,
  History,
  Trash2,
  Sparkles,
  Infinity as InfinityIcon
} from 'lucide-react';
import { petChat } from '@/ai/flows/pet-chat-flow';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

const PLAN_LIMITS: Record<string, number> = {
  free: 6,
  premium: 30,
  pro: 999999,
};

const compressImage = (dataUrl: string, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
};

export default function PetChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const db = useFirestore();
  const petId = params.petId as string;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [messageLimit, setMessageLimit] = useState(15);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [shouldMaintainScroll, setShouldMaintainScroll] = useState(false);

  const userRef = useMemo(() => (user && db ? doc(db, 'users', user.uid) : null), [user, db]);
  const { data: profile } = useDoc(userRef);

  const userPlan = profile?.subscriptionPlan || 'free';
  const dailyLimit = PLAN_LIMITS[userPlan] || 6;
  const isPro = userPlan === 'pro';

  const dailyUsage = useMemo(() => {
    if (!profile?.dailyIAUsage) return 0;
    const today = new Date().toISOString().split('T')[0];
    if (profile.dailyIAUsage.date !== today) return 0;
    return profile.dailyIAUsage.count || 0;
  }, [profile]);

  const messagesRemaining = Math.max(0, dailyLimit - dailyUsage);
  const isLimitReached = !isPro && messagesRemaining <= 0;

  const threshold48h = useMemo(() => {
    return Timestamp.fromDate(new Date(Date.now() - 48 * 60 * 60 * 1000));
  }, []);

  const petRef = useMemo(() => {
    if (!user || !db || !petId) return null;
    return doc(db, 'users', user.uid, 'pets', petId);
  }, [user, db, petId]);
  const { data: pet, loading: petLoading } = useDoc(petRef);

  const messagesQuery = useMemo(() => {
    if (!user || !db || !petId || !pet) return null;
    
    let finalThreshold = threshold48h;
    if (pet.chatClearedAt instanceof Timestamp) {
      if (pet.chatClearedAt.toMillis() > threshold48h.toMillis()) {
        finalThreshold = pet.chatClearedAt;
      }
    }

    return query(
      collection(db, 'users', user.uid, 'pets', petId, 'chatMessages'),
      where('timestamp', '>=', finalThreshold),
      orderBy('timestamp', 'asc'),
      limitToLast(messageLimit)
    );
  }, [user, db, petId, messageLimit, pet, threshold48h]);
  
  const { data: messages, loading: messagesLoading } = useCollection(messagesQuery);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior
          });
        }
      });
    }
  };

  useEffect(() => {
    if (messagesLoading) return;

    if (shouldMaintainScroll) {
      const element = scrollRef.current;
      if (element) {
        const newHeight = element.scrollHeight;
        const diff = newHeight - lastScrollHeight.current;
        if (diff > 0) {
          element.scrollTop = diff;
          setShouldMaintainScroll(false);
          setIsLoadingMore(false);
        }
      }
    } else {
      scrollToBottom();
    }
  }, [messages.length, isSending, shouldMaintainScroll, messagesLoading]);

  useEffect(() => {
    const handleResize = () => scrollToBottom();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLoadMore = () => {
    if (!scrollRef.current || isSending || isLoadingMore) return;
    lastScrollHeight.current = scrollRef.current.scrollHeight;
    setIsLoadingMore(true);
    setShouldMaintainScroll(true);
    setMessageLimit(prev => prev + 15);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const compressed = await compressImage(base64);
        setPendingImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearChat = async () => {
    if (!user || !petId || isDeleting || !petRef) return;
    
    setIsDeleting(true);
    try {
      await updateDoc(petRef, {
        chatClearedAt: serverTimestamp()
      });
      
      toast({
        title: "Chat redefinido",
        description: "As mensagens visíveis foram limpas.",
      });
      
      setMessageLimit(15);
    } catch (error) {
      console.error('Erro ao limpar chat:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) {
      toast({
        variant: "destructive",
        title: "Limite Atingido",
        description: `Seu plano ${userPlan} atingiu o limite diário de mensagens.`,
      });
      return;
    }

    if ((!input.trim() && !pendingImage) || !user || !pet || isSending) return;

    const userText = input || "Enviei uma foto para análise.";
    const currentPhoto = pendingImage;
    
    setInput('');
    setPendingImage(null);
    setIsSending(true);
    setShouldMaintainScroll(false);

    const messagesRef = collection(db, 'users', user.uid, 'pets', petId, 'chatMessages');

    try {
      await addDoc(messagesRef, {
        role: 'user' as const,
        text: userText,
        photoURL: currentPhoto,
        timestamp: serverTimestamp(),
      });

      if (userRef) {
        const today = new Date().toISOString().split('T')[0];
        const newUsage = {
          date: today,
          count: dailyUsage + 1
        };
        updateDoc(userRef, { dailyIAUsage: newUsage });
      }

      const history = messages.map(m => ({
        role: m.role as 'user' | 'model',
        text: m.text,
      }));

      const response = await petChat({
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed,
        petAge: pet.age,
        history,
        userMessage: userText,
        photoDataUri: currentPhoto || undefined
      });

      await addDoc(messagesRef, {
        role: 'model' as const,
        text: response.text,
        timestamp: serverTimestamp(),
      });

    } catch (error) {
      console.error('Erro no processamento:', error);
      toast({
        variant: "destructive",
        title: "Erro na resposta",
        description: "A IA encontrou um problema ao processar sua mensagem.",
      });
    } finally {
      setIsSending(false);
      scrollToBottom('smooth');
    }
  };

  if (petLoading || (messagesLoading && messages.length === 0)) {
    return (
      <div className="flex flex-col h-screen h-[100dvh] bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex flex-col h-screen h-[100dvh] bg-background">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">Pet não encontrado</h2>
          <Button onClick={() => router.push('/')} variant="outline">Voltar para Início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-black overflow-hidden selection:bg-primary/30">
      <Header />

      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto overflow-hidden relative">
        <div className="flex items-center justify-between p-2 md:p-4 bg-black/40 backdrop-blur-md border-b border-white/5 z-20">
          <div className="flex items-center gap-2 md:gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="h-8 w-8 text-white/70 hover:text-white shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <Avatar className="h-9 w-9 md:h-12 md:w-12 border-2 border-primary/20 ring-2 ring-black shrink-0">
                <AvatarImage src={pet.photoURL} alt={pet.name} className="object-cover" />
                <AvatarFallback className="bg-muted">
                  <PawPrint className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <h1 className="font-bold text-xs md:text-lg text-primary leading-tight truncate">{pet.name.toLowerCase()}</h1>
                <p className="text-[8px] md:text-xs text-white/40 uppercase font-bold tracking-[0.2em] truncate">
                  {pet.species} • {pet.breed || 'SRD'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 md:gap-2">
             <Badge 
              variant="secondary" 
              className={cn(
                "bg-primary/10 text-primary border-none text-[8px] md:text-[10px] font-bold py-1 md:py-1.5 px-2 md:px-3 flex items-center gap-1 md:gap-1.5 transition-all shrink-0",
                isLimitReached && "bg-destructive/10 text-destructive",
                isPro && "bg-amber-500/10 text-amber-500"
              )}
             >
                <Sparkles className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 fill-current" />
                <span className="uppercase tracking-wider">
                  {isPro ? (
                    <span className="flex items-center gap-1">PRO <InfinityIcon className="h-2.5 w-2.5" /></span>
                  ) : (
                    `${messagesRemaining}/${dailyLimit}`
                  )}
                </span>
             </Badge>
             
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={isDeleting}
                    className="h-8 w-8 md:h-9 md:w-9 text-white/30 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                 </Button>
               </AlertDialogTrigger>
               <AlertDialogContent className="bg-card border-white/10 text-foreground rounded-2xl w-[90vw] max-w-[400px]">
                 <AlertDialogHeader>
                   <AlertDialogTitle className="text-xl font-bold">Limpar Chat?</AlertDialogTitle>
                   <AlertDialogDescription className="text-muted-foreground text-sm">
                     Esta ação ocultará as mensagens atuais. O perfil de <strong>{pet.name}</strong> permanecerá salvo.
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter className="gap-2">
                   <AlertDialogCancel className="bg-transparent border-white/10 text-white/60 hover:text-white rounded-full">Cancelar</AlertDialogCancel>
                   <AlertDialogAction 
                    onClick={handleClearChat}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full font-bold"
                   >
                     Confirmar
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
             </AlertDialog>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 md:p-8 space-y-4 md:space-y-10 bg-black no-scrollbar overscroll-contain relative"
        >
          {/* Marca d'água discreta de fundo para prints */}
          <div className="fixed inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none z-0">
             <div className="flex flex-col items-center rotate-[-15deg]">
               <PawPrint className="h-40 w-40 md:h-64 md:w-64 text-white" />
               <span className="font-headline text-4xl md:text-6xl font-black uppercase tracking-[0.5em] text-white">Vet IA</span>
             </div>
          </div>

          {messages.length >= messageLimit && (
            <div className="flex justify-center pb-2 relative z-10">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLoadMore}
                className="text-[8px] md:text-[10px] uppercase font-bold tracking-[0.2em] text-white/20 hover:text-primary h-7 md:h-8 gap-1.5 bg-transparent border border-white/5 px-3 md:px-4 rounded-full"
                disabled={isSending || isLoadingMore}
              >
                {isLoadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
                Anteriores
              </Button>
            </div>
          )}

          {messages.length === 0 && !isSending && (
            <div className="flex flex-col items-center justify-center h-full py-10 md:py-20 space-y-4 md:space-y-6 text-center opacity-40 relative z-10">
              <div className="bg-primary/5 p-4 md:p-6 rounded-full ring-1 ring-primary/10">
                <Bot className="h-7 w-7 md:h-10 md:w-10 text-primary" />
              </div>
              <p className="text-[10px] md:text-sm font-medium text-white/60 max-w-[200px] md:max-w-[280px] leading-relaxed italic">
                Olá! Sou o Vet IA da WS Studios. Como posso ajudar o <strong>{pet.name}</strong> hoje?
              </p>
            </div>
          )}

          {messages.map((msg: any, idx) => (
            <div
              key={msg.id || idx}
              className={cn(
                "flex items-start gap-2 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-10",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "flex-shrink-0 h-7 w-7 md:h-9 md:w-9 rounded-full flex items-center justify-center border transition-all",
                msg.role === 'user' 
                  ? "bg-primary border-primary/20 text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.2)]" 
                  : "bg-black border-white/10 text-primary"
              )}>
                {msg.role === 'user' ? <UserIcon className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <Bot className="h-3.5 w-3.5 md:h-4 md:w-4" />}
              </div>
              
              <div className={cn(
                "relative max-w-[85%] md:max-w-[75%] p-3 md:p-6 rounded-[1.2rem] md:rounded-[2rem] text-xs md:text-base shadow-lg leading-relaxed space-y-2 md:space-y-3",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-white/[0.03] border border-white/10 text-white/80 rounded-tl-none"
              )}>
                {msg.photoURL && (
                  <div className="relative aspect-video w-full max-w-[240px] md:max-w-[320px] rounded-lg overflow-hidden border border-white/10 mb-1.5">
                    <Image 
                      src={msg.photoURL} 
                      alt="Anexo" 
                      fill 
                      className="object-cover"
                    />
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          
          {isSending && (
            <div className="flex items-start gap-2 md:gap-4 animate-in fade-in relative z-10">
              <div className="bg-black border border-white/10 h-7 w-7 md:h-9 md:w-9 rounded-full flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
              </div>
              <div className="bg-white/[0.03] border border-white/10 p-2.5 md:p-5 rounded-[1.2rem] md:rounded-[2rem] rounded-tl-none">
                <div className="flex gap-1">
                  <span className="h-1 w-1 md:h-1.5 md:w-1.5 bg-primary rounded-full animate-bounce"></span>
                  <span className="h-1 w-1 md:h-1.5 md:w-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-1 w-1 md:h-1.5 md:w-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}

          {/* Selo discreto no final para prints de divulgação */}
          <div className="pt-8 pb-4 flex items-center justify-center opacity-20 relative z-10">
            <div className="flex items-center gap-2 border border-white/10 px-3 py-1.5 rounded-full">
              <PawPrint className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white">IA PREVENTIVA • WS STUDIOS</span>
            </div>
          </div>
        </div>

        {pendingImage && (
          <div className="px-3 py-2 bg-black/90 backdrop-blur-lg border-t border-white/5 flex items-center gap-3 animate-in slide-in-from-bottom-4 z-30">
            <div className="relative h-12 w-12 md:h-20 md:w-20 rounded-lg overflow-hidden border-2 border-primary/30 shadow-2xl shrink-0">
              <Image src={pendingImage} alt="Preview" fill className="object-cover" />
              <button 
                onClick={() => setPendingImage(null)}
                className="absolute top-0.5 right-0.5 bg-destructive text-white p-0.5 rounded-full shadow-lg hover:scale-110 transition-transform"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
            <p className="text-[9px] md:text-xs text-primary/80 font-bold uppercase tracking-widest italic animate-pulse">Imagem pronta para análise...</p>
          </div>
        )}

        <div className="p-2 md:p-6 bg-transparent relative z-30">
          <form onSubmit={handleSendMessage} className="flex gap-1.5 md:gap-3 max-w-4xl mx-auto items-center bg-white/[0.05] border border-white/10 p-1 md:p-3 rounded-[1.8rem] md:rounded-[2.5rem] shadow-2xl">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              className="hidden" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileChange}
            />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:h-12 md:w-12 shrink-0 rounded-full text-white/40 hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <Paperclip className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 bg-card border-white/10 p-1.5 rounded-xl shadow-2xl mb-2">
                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()} className="gap-2.5 cursor-pointer py-2 rounded-lg focus:bg-primary/10 focus:text-primary text-[11px] md:text-sm font-medium">
                  <Camera className="h-3.5 w-3.5" /> Câmera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2.5 cursor-pointer py-2 rounded-lg focus:bg-primary/10 focus:text-primary text-[11px] md:text-sm font-medium">
                  <ImageIcon className="h-3.5 w-3.5" /> Galeria
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              placeholder={isLimitReached ? "Limite diário atingido" : "Diga algo..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending || isLimitReached}
              className="flex-1 bg-transparent border-none focus-visible:ring-0 h-8 md:h-12 text-xs md:text-base text-white/80 placeholder:text-white/20 px-1"
            />
            
            <Button 
              type="submit" 
              size="icon" 
              disabled={isSending || (!input.trim() && !pendingImage) || isLimitReached}
              className="h-8 w-8 md:h-12 md:w-12 shrink-0 rounded-full shadow-[0_0_20px_rgba(var(--primary),0.3)] bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" /> : <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />}
            </Button>
          </form>
          <div className="flex flex-col items-center mt-2 md:mt-4 pointer-events-none">
             <div className="flex items-center gap-1 opacity-20">
                <PawPrint className="h-2 w-2 md:h-3 md:w-3 text-white" />
                <span className="text-[6px] md:text-[8px] uppercase font-bold tracking-[0.3em] text-white">Vet IA • WS Studios</span>
             </div>
             <p className="text-[5px] md:text-[6px] text-white/5 uppercase font-bold tracking-[0.4em] mt-1">Versão 2.5 • Antiviral & Preventive Tech</p>
          </div>
        </div>
      </main>
    </div>
  );
}
