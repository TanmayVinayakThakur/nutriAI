import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Sparkles, Heart, Brain, ArrowRight, CheckCircle2 } from "lucide-react";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import Header from "@/components/Header";

const Home = () => {
  const { profile, resetProfile } = useUserProfile();

  // Show onboarding if not completed
  if (!profile.hasCompletedOnboarding) {
    return <OnboardingFlow />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32 flex-1">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full animate-pulse">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-primary">
              AI-Powered Health Intelligence
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            Make{" "}
            <span className="bg-gradient-to-r from-primary via-primary-glow to-secondary bg-clip-text text-transparent">
              Smarter
            </span>
            <br />
            Food Choices
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Snap a photo of your food and discover healthier alternatives instantly. 
            Powered by Explainable AI that shows you exactly why each suggestion is better.
          </p>

          {/* User Profile Summary */}
          <Card className="inline-flex items-center gap-4 px-6 py-3 bg-card/80 backdrop-blur">
            <span className="text-sm text-muted-foreground">
              Profile: <span className="font-medium text-foreground capitalize">{profile.dietPreference}</span> • 
              Goal: <span className="font-medium text-foreground capitalize">{profile.targetBodyType}</span>
            </span>
            <Link to="/" onClick={async () => {
              await resetProfile();
              window.location.reload();
            }}>
              <Button variant="ghost" size="sm" className="text-xs">
                Edit Profile
              </Button>
            </Link>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link to="/analyze">
              <Button size="lg" className="text-lg px-8 py-6 shadow-[0_0_20px_rgba(142,71,45,0.3)] hover:shadow-[0_0_30px_rgba(142,71,45,0.5)] transition-all">
                <Camera className="mr-2 h-5 w-5" />
                Start Analyzing
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="p-8 bg-card border-border/50 hover:border-primary/50 transition-all hover:shadow-card">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Camera className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Instant Analysis</h3>
              <p className="text-muted-foreground leading-relaxed">
                Simply upload a photo of any food item and get comprehensive nutritional 
                analysis in seconds using advanced AI vision technology.
              </p>
            </div>
          </Card>

          <Card className="p-8 bg-card border-border/50 hover:border-primary/50 transition-all hover:shadow-card">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center">
                <Heart className="h-7 w-7 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Personalized Suggestions</h3>
              <p className="text-muted-foreground leading-relaxed">
                Get healthier alternatives filtered by your diet preference ({profile.dietPreference}) 
                and allergies. Tailored to your body goals.
              </p>
            </div>
          </Card>

          <Card className="p-8 bg-card border-border/50 hover:border-primary/50 transition-all hover:shadow-card">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Brain className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Explainable AI</h3>
              <p className="text-muted-foreground leading-relaxed">
                Understand exactly why each recommendation is better with SHAP-inspired 
                feature analysis showing calorie, protein, and nutrient comparisons.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                1
              </div>
              <h4 className="text-xl font-semibold text-foreground">Upload Photo</h4>
              <p className="text-muted-foreground">
                Take a picture of your food or upload an existing photo. Choose quick scan or detailed logging.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xl font-bold">
                2
              </div>
              <h4 className="text-xl font-semibold text-foreground">AI Analysis</h4>
              <p className="text-muted-foreground">
                Our trained ML model analyzes nutritional content and calculates total calories based on your portion.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold">
                3
              </div>
              <h4 className="text-xl font-semibold text-foreground">Get Best Result</h4>
              <p className="text-muted-foreground">
                Discover healthier alternatives with our top pick highlighted. Filtered for your allergies and diet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="p-12 bg-gradient-to-br from-primary/5 to-secondary/5 border-border/50 max-w-4xl mx-auto">
          <div className="space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground">
              Why Choose Our Food Advisor?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                "Real-time food identification using advanced AI",
                "Personalized suggestions based on your profile",
                "Trained ML model with Open Food Facts data",
                "Explainable recommendations you can trust",
                "Allergy-aware alternative filtering",
                "Detailed calorie tracking for homemade food"
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground text-lg">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-8 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Ready to Eat Healthier?
          </h2>
          <p className="text-xl text-muted-foreground">
            Start making better food choices today with AI-powered insights
          </p>
          <Link to="/analyze">
            <Button size="lg" className="text-lg px-8 py-6 shadow-[0_0_20px_rgba(142,71,45,0.3)] hover:shadow-[0_0_30px_rgba(142,71,45,0.5)] transition-all">
              <Camera className="mr-2 h-5 w-5" />
              Analyze Your Food Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
