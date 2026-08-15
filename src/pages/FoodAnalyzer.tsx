import { useState } from "react";
import { Link } from "react-router-dom";
import { FoodScanner } from "@/components/FoodScanner";
import { FoodResults } from "@/components/FoodResults";
import { Utensils, Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";

const FoodAnalyzer = () => {
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background flex flex-col">
      <Header />

      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full">
            <Utensils className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              AI-Powered Nutrition Analysis
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Discover Healthier Food Choices
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload a photo of any food item and get instant healthier alternatives
            powered by Explainable AI. Understand exactly why each recommendation
            is better for you.
          </p>
        </div>

        {/* Scanner */}
        <div className="max-w-2xl mx-auto">
          <FoodScanner onAnalysis={setAnalysisResult} />
        </div>

        {/* Results */}
        {analysisResult && (
          <div className="max-w-7xl mx-auto pt-8">
            <FoodResults data={analysisResult} />
          </div>
        )}

        {/* Explainable AI Badge */}
        {!analysisResult && (
          <div className="text-center pt-8">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>Powered by SHAP-Inspired Explainable AI</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodAnalyzer;
