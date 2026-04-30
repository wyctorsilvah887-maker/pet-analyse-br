
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PawPrint, LogOut, User as UserIcon, Loader2, LogIn, Sparkles, Crown, Shield } from 'lucide-react';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export default function Header() {
  const auth = useAuth();
  const db = useFirestore();
  const { user, loading: authLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const userProfileRef = useMemo(() => {
    return (user && db) ? doc(db, 'users', user.uid) : null;
  }, [user, db]);
  
  const { data: profile, loading: profileLoading } = useDoc(userProfileRef);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const photoURL = profile?.photoURL || user?.photoURL || null;
  const displayName = profile?.displayName || user?.displayName || 'Usuário';
  const email = profile?.email || user?.email;
  const userPlan = profile?.plan || 'free';

  const planInfo = useMemo(() => {
    switch (userPlan) {
      case 'pro': return { label: 'PRO', icon: <Crown className="h-3 w-3" />, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      case 'premium': return { label: 'PREMIUM', icon: <Sparkles className="h-3 w-3" />, color: 'bg-primary/10 text-primary border-primary/20' };
      default: return { label: 'FREE', icon: <Shield className="h-3 w-3" />, color: 'bg-muted text-muted-foreground border-transparent' };
    }
  }, [userPlan]);

  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-14 md:h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2 transition-opacity hover:opacity-80 active:scale-95 duration-200">
          <PawPrint className="h-5 w-5 md:h-6 md:w-6 text-foreground shrink-0" />
          <span className="font-headline text-base md:text-xl font-bold tracking-tight text-foreground whitespace-nowrap">
            Vet <span className="text-primary">IA</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user && !profileLoading && (
            <Badge variant="outline" className={`hidden sm:flex items-center gap-1.5 text-[9px] font-bold tracking-widest py-1 ${planInfo.color}`}>
              {planInfo.icon}
              {planInfo.label}
            </Badge>
          )}

          {authLoading ? (
            <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse flex items-center justify-center">
              <Loader2 className="h-3 w-3 animate-spin text-primary/40" />
            </div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 h-9 p-1 pr-2 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group">
                  <Avatar className="h-7 w-7 md:h-8 md:w-8 ring-1 ring-primary/20 group-hover:ring-primary/40 transition-all">
                    {photoURL && (
                      <AvatarImage 
                        src={photoURL} 
                        alt={displayName} 
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <AvatarFallback className="bg-muted">
                      {profileLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary/40" />
                      ) : (
                        <UserIcon className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-bold text-foreground truncate max-w-[60px] md:max-w-[100px] hidden sm:block">
                    {displayName.split(' ')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-white/10 p-1 shadow-2xl rounded-xl">
                <div className="flex flex-col space-y-1 p-3 mb-1">
                  <p className="text-xs font-bold leading-none text-foreground truncate">{displayName}</p>
                  <p className="text-[10px] leading-none text-muted-foreground truncate mt-1">{email}</p>
                </div>
                <div className="p-2 sm:hidden">
                  <Badge variant="outline" className={`w-full flex items-center justify-center gap-1.5 text-[8px] font-bold tracking-widest py-1.5 ${planInfo.color}`}>
                    {planInfo.icon}
                    PLANO {planInfo.label}
                  </Badge>
                </div>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="text-destructive focus:text-destructive cursor-pointer hover:bg-destructive/10 rounded-lg transition-colors p-2.5"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs font-bold uppercase tracking-widest gap-2 hover:bg-white/5 rounded-full px-4 h-9">
                <LogIn className="h-3.5 w-3.5" />
                <span>Entrar</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
