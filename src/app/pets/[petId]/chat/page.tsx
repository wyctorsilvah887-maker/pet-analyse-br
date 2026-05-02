
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
  ImageIcon,
  X,
  Trash2
} from 'lucide-react';
import { petChat } from '@/ai/flows/pet-chat-flow';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

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

const renderMessageText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
    }
    return part;
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
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [messageLimit] = useState(15);

  const userRef = useMemo(() => (user && db ? doc(db, 'users', user.uid) : null), [user, db]);
  const { data: profile } = useDoc(userRef);

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
    if (!messagesLoading) {
      scrollToBottom();
    }
  }, [messages.length, isSending, messagesLoading]);

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
      await updateDoc(petRef, { chatClearedAt: serverTimestamp() });
      toast({ title: "Chat limpo" });
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pendingImage) || !user || !pet || isSending) return;

    const userText = input || "Enviei uma foto para análise.";
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

  if (!pet) {
    return (
      <div className="flex h-screen bg-black flex-col items-center justify-center p-4">
        <AlertCircle className="h-10 w-10 text-destructive mb-4" />
        <h2 className="text-white font-bold mb-2">Pet não encontrado</h2>
        <Button onClick={() => router.push('/')} variant="outline">Voltar para Início</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-black overflow-hidden">
      <Header />

      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto overflow-hidden relative">
        <div className="flex items-center justify-between p-2 md:p-3 bg-black/40 backdrop-blur-md border-b border-white/5 z-20">
          <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="h-7 w-7 md:h-8 md:w-8 text-white/70 hover:text-white shrink-0">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
              <Avatar className="h-7 w-7 md:h-9 md:w-9 border-2 border-primary/20 ring-2 ring-black shrink-0">
                <AvatarImage src={pet?.photoURL} alt={pet?.name} className="object-cover" />
                <AvatarFallback className="bg-muted">
                  <PawPrint className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <h1 className="font-bold text-[10px] md:text-sm text-primary leading-tight truncate">{(pet?.name || '').toLowerCase()}</h1>
                </div>
                <p className="text-[7px] md:text-[9px] text-white/40 uppercase font-bold tracking-[0.1em] truncate">
                  {pet?.species} • {pet?.breed || 'SRD'} {pet?.age ? `• ${pet.age} anos` : ''}
                </p>
                <div className="flex items-center gap-1 opacity-40 mt-0.5">
                  <PawPrint className="h-1.5 w-1.5 text-primary" />
                  <span className="text-[5px] md:text-[7px] uppercase font-bold tracking-[0.1em] text-white">IA PREVENTIVA • WS STUDIOS</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" onClick={handleClearChat} className="text-white/30 hover:text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
             </Button>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 md:p-8 space-y-4 md:space-y-10 bg-black no-scrollbar overscroll-contain relative"
        >
          <div className="fixed inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none z-0">
             <div className="flex flex-col items-center rotate-[-15deg]">
               <PawPrint className="h-40 w-40 md:h-64 md:w-64 text-white" />
               <span className="font-headline text-4xl md:text-6xl font-black uppercase tracking-[0.5em] text-white">Vet IA</span>
             </div>
          </div>

          {messages.map((msg: any, idx) => (
            <div key={msg.id || idx} className={cn("flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "flex-shrink-0 h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center border transition-all",
                msg.role === 'user' 
                  ? "bg-primary border-primary/60 text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.4)] ring-2 ring-black/20" 
                  : "bg-black border-white/10 text-primary"
              )}>
                {msg.role === 'user' ? <UserIcon className="h-4 w-4 md:h-5 md:w-5 stroke-[3]" /> : <Bot className="h-3.5 w-3.5 md:h-4 md:w-4" />}
              </div>
              
              <div className={cn(
                "max-w-[85%] p-3.5 rounded-[1.25rem] text-[13px] md:text-sm leading-relaxed shadow-sm",
                msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white/[0.04] border border-white/5 text-white/90 rounded-tl-none"
              )}>
                {msg.photoURL && (
                  <div className="relative aspect-square w-32 md:w-40 rounded-lg overflow-hidden border border-white/10 mb-2">
                    <Image src={msg.photoURL} alt="Anexo" fill className="object-cover" />
                  </div>
                )}
                <div className="whitespace-pre-wrap">{renderMessageText(msg.text)}</div>
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

          <div className="pt-8 pb-4 flex items-center justify-center opacity-20 relative z-10">
            <div className="flex items-center gap-2 border border-white/10 px-3 py-1.5 rounded-full">
              <PawPrint className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white">IA PREVENTIVA • WS STUDIOS</span>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 bg-transparent border-t border-white/5">
          {pendingImage && (
            <div className="mb-2 p-2 bg-white/5 rounded-xl flex items-center gap-2 animate-in zoom-in-95">
              <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-primary/50">
                <Image src={pendingImage} alt="Preview" fill className="object-cover" />
              </div>
              <p className="text-[10px] text-white/40 flex-1">Imagem pronta para envio</p>
              <Button size="icon" variant="ghost" onClick={() => setPendingImage(null)} className="h-6 w-6"><X className="h-3 w-3" /></Button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2 items-center bg-white/[0.05] border border-white/10 p-1.5 rounded-full shadow-inner">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="rounded-full text-white/40 hover:text-primary transition-colors h-9 w-9">
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Input
              placeholder="Diga algo à Vet IA..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending}
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-white text-sm h-9"
            />
            <Button type="submit" size="icon" disabled={isSending} className={cn("rounded-full bg-primary text-primary-foreground h-9 w-9 transition-all", (input || pendingImage) ? "scale-100 opacity-100" : "scale-90 opacity-40")}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="flex flex-col items-center mt-2 md:mt-4 pointer-events-none">
             <p className="text-[6px] md:text-[8px] text-white/10 uppercase font-bold tracking-[0.15em] mt-1 text-center px-4">
               Versão 2.5 • Antiviral & Preventive Tech
             </p>
          </div>
        </div>
      </main>
    </div>
  );
}
