import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BodyTypeSelector } from "@/components/BodyTypeSelector";
import { useUserProfile, BodyType, DietPreference, calculateBMI, getBMICategory } from "@/contexts/UserProfileContext";
import { ArrowRight, ArrowLeft, Leaf, Drumstick, Salad, X, Sparkles, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const commonAllergies = [
  "Dairy", "Eggs", "Peanuts", "Tree Nuts", "Soy", "Wheat", "Gluten",
  "Fish", "Shellfish", "Sesame", "Mustard", "Lactose"
];

const dietOptions: { value: DietPreference; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "vegan", label: "Vegan", icon: <Leaf className="h-6 w-6" />, description: "No animal products" },
  { value: "vegetarian", label: "Vegetarian", icon: <Salad className="h-6 w-6" />, description: "No meat or fish" },
  { value: "non-veg", label: "Non-Vegetarian", icon: <Drumstick className="h-6 w-6" />, description: "Includes all foods" },
];

export const OnboardingFlow = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useUserProfile();
  const [step, setStep] = useState(1);
  const [customAllergy, setCustomAllergy] = useState("");
  
  // Local state for form
  const [formData, setFormData] = useState({
    currentBodyType: profile.currentBodyType,
    targetBodyType: profile.targetBodyType,
    weight: profile.weight,
    height: profile.height,
    age: profile.age,
    allergies: profile.allergies,
    dietPreference: profile.dietPreference,
  });

  const bmi = calculateBMI(formData.weight, formData.height);
  const bmiCategory = getBMICategory(bmi);

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Complete onboarding
      updateProfile({
        ...formData,
        hasCompletedOnboarding: true,
      });
      toast.success("Profile saved! Let's analyze your food.");
      navigate("/analyze");
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const addAllergy = (allergy: string) => {
    if (allergy && !formData.allergies.includes(allergy)) {
      setFormData({ ...formData, allergies: [...formData.allergies, allergy] });
    }
  };

  const removeAllergy = (allergy: string) => {
    setFormData({
      ...formData,
      allergies: formData.allergies.filter((a) => a !== allergy),
    });
  };

  const handleAddCustomAllergy = () => {
    if (customAllergy.trim()) {
      addAllergy(customAllergy.trim());
      setCustomAllergy("");
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return true; // Diet preference always has a default
      case 2:
        return formData.weight > 0 && formData.height > 0 && formData.age > 0;
      case 3:
        return true; // Body type always has a default
      case 4:
        return true; // Allergies are optional
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg p-8 bg-card/95 backdrop-blur shadow-elevated animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step} of {totalSteps}</span>
            <span>{Math.round((step / totalSteps) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500 ease-out"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Diet Preference */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Let's personalize your experience</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">What's your diet preference?</h2>
              <p className="text-muted-foreground">We'll filter food suggestions accordingly</p>
            </div>

            <div className="grid gap-4">
              {dietOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, dietPreference: option.value })}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                    formData.dietPreference === option.value
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-lg",
                    formData.dietPreference === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {option.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Weight, Height & Age */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Tell us about yourself</h2>
              <p className="text-muted-foreground">For personalized calorie recommendations</p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Weight (kg)</label>
                  <Input
                    type="number"
                    value={formData.weight || ""}
                    onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                    placeholder="70"
                    min={20}
                    max={300}
                    className="text-lg h-12"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Height (cm)</label>
                  <Input
                    type="number"
                    value={formData.height || ""}
                    onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                    placeholder="170"
                    min={100}
                    max={250}
                    className="text-lg h-12"
                  />
                </div>
              </div>

              {/* BMI Display */}
              {formData.weight > 0 && formData.height > 0 && (
                <div className="p-4 bg-muted/50 rounded-xl border border-border animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">{bmi.toFixed(1)}</span>
                        <span className={`text-sm font-semibold ${bmiCategory.color}`}>
                          {bmiCategory.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{bmiCategory.description}</p>
                    </div>
                  </div>
                  {/* BMI Scale Visual */}
                  <div className="mt-3 relative h-2 rounded-full bg-gradient-to-r from-amber-400 via-green-500 via-60% to-red-500 overflow-hidden">
                    <div 
                      className="absolute top-0 w-1 h-full bg-foreground rounded-full shadow-lg transform -translate-x-1/2 transition-all duration-500"
                      style={{ left: `${Math.min(Math.max(((bmi - 15) / 25) * 100, 0), 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>15</span>
                    <span>18.5</span>
                    <span>25</span>
                    <span>30</span>
                    <span>40</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Age (years)</label>
                <Input
                  type="number"
                  value={formData.age || ""}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                  placeholder="Enter your age"
                  min={10}
                  max={120}
                  className="text-lg h-12"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Body Type Selection */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Body Composition Goals</h2>
              <p className="text-muted-foreground">Select your current and target body type</p>
            </div>

            <div className="space-y-8">
              <BodyTypeSelector
                value={formData.currentBodyType}
                onChange={(val) => setFormData({ ...formData, currentBodyType: val })}
                label="Your Current Body Type"
              />
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-4 text-sm text-muted-foreground">Transform to</span>
                </div>
              </div>

              <BodyTypeSelector
                value={formData.targetBodyType}
                onChange={(val) => setFormData({ ...formData, targetBodyType: val })}
                label="Your Target Body Type"
              />
            </div>
          </div>
        )}

        {/* Step 4: Allergies */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Any food allergies?</h2>
              <p className="text-muted-foreground">We'll exclude these from recommendations</p>
            </div>

            {/* Selected Allergies */}
            {formData.allergies.length > 0 && (
              <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg">
                {formData.allergies.map((allergy) => (
                  <Badge
                    key={allergy}
                    variant="secondary"
                    className="pl-3 pr-1 py-1.5 flex items-center gap-1"
                  >
                    {allergy}
                    <button
                      onClick={() => removeAllergy(allergy)}
                      className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Common Allergies */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Common allergies (tap to add)</label>
              <div className="flex flex-wrap gap-2">
                {commonAllergies
                  .filter((a) => !formData.allergies.includes(a))
                  .map((allergy) => (
                    <button
                      key={allergy}
                      onClick={() => addAllergy(allergy)}
                      className="px-3 py-1.5 text-sm rounded-full border border-border hover:border-primary hover:bg-primary/10 transition-all"
                    >
                      + {allergy}
                    </button>
                  ))}
              </div>
            </div>

            {/* Custom Allergy Input */}
            <div className="flex gap-2">
              <Input
                value={customAllergy}
                onChange={(e) => setCustomAllergy(e.target.value)}
                placeholder="Add custom allergy..."
                onKeyPress={(e) => e.key === "Enter" && handleAddCustomAllergy()}
              />
              <Button onClick={handleAddCustomAllergy} variant="outline">
                Add
              </Button>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="gap-2 px-6"
          >
            {step === totalSteps ? "Start Analyzing" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="text-primary hover:underline font-medium">
            Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
};
