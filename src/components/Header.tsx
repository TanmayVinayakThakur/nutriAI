import { Link } from "react-router-dom";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Cloud, User, Sparkles } from "lucide-react";

const Header = () => {
  const { session, profile, resetProfile, loading } = useUserProfile();

  const handleSignOut = async () => {
    await resetProfile();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-all">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            NutriAI
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {loading ? (
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          ) : session?.user ? (
            <div className="flex items-center gap-3">
              {/* Cloud Sync Status Badge */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-medium border border-green-500/20">
                <Cloud className="h-3 w.5" />
                <span>Synced</span>
              </div>

              {/* User badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border/60 rounded-lg max-w-[180px] sm:max-w-xs">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground truncate">
                  {session.user.email}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/5 gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-semibold border border-amber-500/20">
                Guest Mode
              </div>
              <Link to="/auth">
                <Button size="sm" className="text-xs gap-1.5 font-medium">
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
