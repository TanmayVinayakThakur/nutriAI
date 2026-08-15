import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft, Loader2, Sparkles } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Registration successful! You can now log in or check your email for confirmation.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background blobs for premium feel */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-secondary/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: "2s" }} />

      {/* Floating Back Button */}
      <div className="absolute top-8 left-8">
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-md p-8 bg-card/70 backdrop-blur-md border-border/50 shadow-2xl space-y-6 relative">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-xs font-semibold text-primary mb-2">
            <Sparkles className="h-3 w-3" />
            <span>NutriAI Cloud Sync</span>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            {isSignUp ? "Create an Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isSignUp
              ? "Sign up to save your body profile, preferences, and logs"
              : "Log in to access your synced preferences and food history"}
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="grid grid-cols-2 p-1 bg-muted/55 rounded-lg border border-border/20">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`py-2 text-sm font-medium rounded-md transition-all ${
              !isSignUp
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`py-2 text-sm font-medium rounded-md transition-all ${
              isSignUp
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-background/50 border-border/50"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-background/50 border-border/50"
                disabled={loading}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full text-md py-6 shadow-md hover:shadow-lg transition-all"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSignUp ? "Creating account..." : "Signing in..."}
              </span>
            ) : isSignUp ? (
              "Sign Up"
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground border-t border-border/20 pt-4">
          By continuing, you agree to store your nutritional profile details securely in NutriAI database.
        </div>
      </Card>
    </div>
  );
};

export default Auth;
