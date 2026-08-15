import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Hash, Info } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface DetailedLogData {
  weight: number;
  pieces?: number;
  servingSize: string;
  customIngredients?: { name: string; quantity: number }[];
}

interface DetailedFoodLogProps {
  foodName: string;
  onChange: (data: DetailedLogData) => void;
}

const getNonVegItems = (name: string): boolean => {
  const nonVegKeywords = [
    "chicken", "mutton", "fish", "egg", "prawn", "shrimp", 
    "meat", "lamb", "beef", "pork", "crab", "lobster", "bacon",
    "sausage", "ham", "turkey", "duck", "goat", "venison"
  ];
  return nonVegKeywords.some(k => name.toLowerCase().includes(k));
};

const getIngredientSuggestions = (name: string): { name: string; placeholder: string }[] => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes("shake") || lowerName.includes("smoothie")) {
    if (lowerName.includes("banana")) {
      return [
        { name: "Bananas", placeholder: "Number of bananas used" },
        { name: "Milk (ml)", placeholder: "Amount of milk" },
      ];
    }
    if (lowerName.includes("mango")) {
      return [
        { name: "Mangoes", placeholder: "Number of mangoes used" },
        { name: "Milk (ml)", placeholder: "Amount of milk" },
      ];
    }
    return [
      { name: "Fruits (pieces)", placeholder: "Number of fruits" },
      { name: "Milk (ml)", placeholder: "Amount of milk" },
    ];
  }
  
  if (lowerName.includes("biryani") || lowerName.includes("pulao")) {
    return [
      { name: "Rice (cups)", placeholder: "Cups of rice" },
      { name: "Oil (tbsp)", placeholder: "Tablespoons of oil" },
    ];
  }

  if (lowerName.includes("curry") || lowerName.includes("masala")) {
    return [
      { name: "Oil (tbsp)", placeholder: "Tablespoons of oil" },
      { name: "Cream (tbsp)", placeholder: "Tablespoons of cream (if any)" },
    ];
  }

  if (lowerName.includes("rice") || lowerName.includes("roti") || lowerName.includes("naan") || lowerName.includes("chapati")) {
    return [
      { name: "Ghee/Butter (tsp)", placeholder: "Teaspoons of ghee/butter" },
    ];
  }

  if (lowerName.includes("salad")) {
    return [
      { name: "Dressing (tbsp)", placeholder: "Tablespoons of dressing" },
    ];
  }

  if (lowerName.includes("sandwich") || lowerName.includes("burger")) {
    return [
      { name: "Sauce (tbsp)", placeholder: "Tablespoons of sauce" },
      { name: "Cheese slices", placeholder: "Number of cheese slices" },
    ];
  }

  return [];
};

// Custom debounce hook for stable callback
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  
  // Keep callback ref fresh
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

export const DetailedFoodLog = ({ foodName, onChange }: DetailedFoodLogProps) => {
  const [weight, setWeight] = useState<number>(100);
  const [pieces, setPieces] = useState<number | undefined>(undefined);
  const [servingSize, setServingSize] = useState<string>("100g");
  const [ingredients, setIngredients] = useState<{ [key: string]: number }>({});
  
  const isNonVeg = getNonVegItems(foodName);
  const ingredientSuggestions = getIngredientSuggestions(foodName);

  // Build current data object
  const buildLogData = useCallback((): DetailedLogData => {
    const customIngredients = Object.entries(ingredients)
      .filter(([_, qty]) => qty > 0)
      .map(([name, quantity]) => ({ name, quantity }));
    
    return {
      weight,
      pieces: isNonVeg ? pieces : undefined,
      servingSize,
      customIngredients: customIngredients.length > 0 ? customIngredients : undefined,
    };
  }, [weight, pieces, servingSize, ingredients, isNonVeg]);

  // Debounced emit to parent - prevents rapid fire during typing
  const debouncedEmit = useDebouncedCallback((data: DetailedLogData) => {
    onChange(data);
  }, 150);

  // Emit initial data on mount
  const hasEmittedInitial = useRef(false);
  useEffect(() => {
    if (!hasEmittedInitial.current) {
      hasEmittedInitial.current = true;
      // Emit synchronously on mount so parent has data immediately
      onChange(buildLogData());
    }
  }, []);

  // Emit changes whenever values update (after initial)
  useEffect(() => {
    if (hasEmittedInitial.current) {
      debouncedEmit(buildLogData());
    }
  }, [weight, pieces, servingSize, ingredients, buildLogData, debouncedEmit]);

  const handleWeightChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 5000) {
      setWeight(num);
    } else if (val === "") {
      setWeight(0);
    }
  };

  const handlePiecesChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setPieces(num);
    } else if (val === "") {
      setPieces(undefined);
    }
  };

  const handleIngredientChange = (name: string, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setIngredients(prev => ({ ...prev, [name]: num }));
    } else if (val === "") {
      setIngredients(prev => ({ ...prev, [name]: 0 }));
    }
  };

  const handleServingSizeChange = (size: string) => {
    setServingSize(size);
    // Also update weight based on serving size for convenience
    const sizeToWeight: Record<string, number> = {
      "50g": 50,
      "100g": 100,
      "150g": 150,
      "200g": 200,
      "1 cup": 240,
      "1 plate": 300,
      "1 bowl": 200,
    };
    if (sizeToWeight[size]) {
      setWeight(sizeToWeight[size]);
    }
  };

  return (
    <Card className="p-4 bg-muted/30 border-border/50 space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4" />
        <span>Log details for accurate calorie calculation</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Weight Input */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-foreground">
            <Scale className="h-4 w-4" />
            Weight (grams)
          </Label>
          <Input
            type="number"
            value={weight || ""}
            onChange={(e) => handleWeightChange(e.target.value)}
            min={1}
            max={5000}
            placeholder="100"
          />
        </div>

        {/* Pieces (for non-veg) */}
        {isNonVeg && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-foreground">
              <Hash className="h-4 w-4" />
              Pieces
            </Label>
            <Input
              type="number"
              value={pieces ?? ""}
              onChange={(e) => handlePiecesChange(e.target.value)}
              min={1}
              max={100}
              placeholder="e.g., 2 pieces"
            />
          </div>
        )}
      </div>

      {/* Serving Size Selector */}
      <div className="space-y-2">
        <Label className="text-foreground">Serving Size</Label>
        <div className="flex flex-wrap gap-2">
          {["50g", "100g", "150g", "200g", "1 cup", "1 plate", "1 bowl"].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => handleServingSizeChange(size)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                servingSize === size
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Ingredient Inputs */}
      {ingredientSuggestions.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <Label className="text-foreground text-sm font-medium">Ingredients Used</Label>
          {ingredientSuggestions.map((ing) => (
            <div key={ing.name} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24 shrink-0">{ing.name}</span>
              <Input
                type="number"
                placeholder={ing.placeholder}
                value={ingredients[ing.name] || ""}
                onChange={(e) => handleIngredientChange(ing.name, e.target.value)}
                className="flex-1"
                step="0.5"
                min={0}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
