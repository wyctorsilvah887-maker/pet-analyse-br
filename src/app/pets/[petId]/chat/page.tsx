
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
      toast({ title: "Chat limpo" });
      setMessageLimit(15);
    } catch (error) {
      console.error('Erro ao limpar chat:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return;
    if ((!input.trim() && !pendingImage) || !user || !pet || isSending) return;

    const userText = input || "Enviei uma foto.";
    const currentPhoto = pendingImage;
    
    setInput('');
    setPendingImage(null);
    setIsSending(true);

    const messagesRef = collection(db, 'users', user.uid, 'pets', petId, 'chatMessages');

    try {
      await addDoc(messagesRef, {
        role: 'user',
        text: userText,
        photoURL: currentPhoto,
        timestamp: serverTimestamp(),
      });

      if (userRef) {
        updateDoc(userRef, { 
          'dailyIAUsage.date': new Date().toISOString().split('T')[0],
          'dailyIAUsage.count': dailyUsage + 1 
        });
      }

      const response = await petChat({
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed,
        petAge: pet.age,
        history: messages.slice(-5).map(m => ({ role: m.role as 'user' | 'model', text: m.text })),
        userMessage: userText,
        photoDataUri: currentPhoto || undefined
      });

      await addDoc(messagesRef, {
        role: 'model',
        text: response.text,
        timestamp: serverTimestamp(),
      });

    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
      scrollToBottom('smooth');
    }
  };

  if (petLoading || (messagesLoading && messages.length === 0)) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-black overflow-hidden">
      <Header />

      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto overflow-hidden">
        {/* Header do Chat */}
        <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/40 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white/70">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage src={pet?.photoURL} className="object-cover" />
                <AvatarFallback className="bg-muted"><PawPrint className="h-5 w-5 text-primary" /></AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <h1 className="font-bold text-sm text-primary leading-none uppercase">{pet?.name}</h1>
                <p className="text-[10px] text-white/40 font-bold tracking-widest mt-1">IA PREVENTIVA • WS STUDIOS</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold">
                {isPro ? 'PRO ∞' : `${messagesRemaining}/${dailyLimit}`}
             </Badge>
             <Button variant="ghost" size="icon" onClick={handleClearChat} className="text-white/30 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
             </Button>
          </div>
        </div>

        {/* Área de Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
             <PawPrint className="h-64 w-64 text-white" />
          </div>

          {messages.map((msg: any, idx) => (
            <div key={msg.id || idx} className={cn("flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center border transition-all",
                msg.role === 'user' 
                  ? "bg-primary border-primary/40 text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)] ring-2 ring-primary/20" 
                  : "bg-black border-white/10 text-primary"
              )}>
                {msg.role === 'user' ? <UserIcon className="h-5 w-5 stroke-[3]" /> : <Bot className="h-5 w-5" />}
              </div>
              
              <div className={cn(
                "max-w-[80%] p-4 rounded-[1.5rem] text-sm md:text-base leading-relaxed",
                msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white/[0.05] border border-white/10 text-white/90 rounded-tl-none"
              )}>
                {msg.photoURL && (
                  <div className="relative aspect-square w-40 rounded-lg overflow-hidden border border-white/10 mb-2">
                    <Image src={msg.photoURL} alt="Anexo" fill className="object-cover" />
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isSending && <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />}
        </div>

        {/* Input */}
        <div className="p-4 bg-transparent">
          {pendingImage && (
            <div className="mb-2 p-2 bg-white/5 rounded-xl flex items-center gap-2">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-primary">
                <Image src={pendingImage} alt="Preview" fill className="object-cover" />
              </div>
              <Button size="icon" variant="ghost" onClick={() => setPendingImage(null)} className="h-6 w-6"><X className="h-3 w-3" /></Button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2 items-center bg-white/[0.05] border border-white/10 p-2 rounded-full">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="rounded-full text-white/40">
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Input
              placeholder="Diga algo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending || isLimitReached}
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-white"
            />
            <Button type="submit" size="icon" disabled={isSending || isLimitReached} className="rounded-full bg-primary text-primary-foreground">
              <Send className="h-5 w-5" />
            </Button>
          </form>
          <div className="flex flex-col items-center mt-4">
             <p className="text-[7px] md:text-[8px] text-white/10 uppercase font-bold tracking-[0.2em]">Versão 2.5 • Antiviral & Preventive Tech • WS Studios</p>
          </div>
        </div>
      </main>
    </div>
  );
}
