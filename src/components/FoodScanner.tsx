import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FoodScanModeSelector, ScanMode } from "./FoodScanModeSelector";
import { DetailedFoodLog, DetailedLogData } from "./DetailedFoodLog";
import { useUserProfile } from "@/contexts/UserProfileContext";

interface FoodScannerProps {
  onAnalysis: (result: any) => void;
}

export const FoodScanner = ({ onAnalysis }: FoodScannerProps) => {
  const { profile } = useUserProfile();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("quick");
  const [identifiedFood, setIdentifiedFood] = useState<string>("");
  const [detailedLog, setDetailedLog] = useState<DetailedLogData | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const invokeAnalyzeFood = async (body: any, retries = 1) => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const { data, error } = await supabase.functions.invoke("analyze-food", { body });

      if (!error) return data;

      lastError = error;
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      const retryable = [429, 500, 502, 503, 504].includes(status);

      if (attempt < retries && retryable) {
        await sleep(800 * (attempt + 1));
        continue;
      }

      break;
    }

    throw lastError;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Very large photos can cause the backend request to fail/time out.
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image is too large. Please choose a smaller photo.");
      return;
    }

    // Create preview (fast path)
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Backend payload (optimized/compressed)
    const base64 = await fileToOptimizedBase64(file);

    if (scanMode === "detailed") {
      // For detailed mode, first identify the food, then allow user to enter details
      setPendingImage(base64);
      await identifyFoodOnly(base64);
    } else {
      // Quick scan - analyze immediately
      await analyzeFood(base64, null);
    }
  };

  const identifyFoodOnly = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      const data = await invokeAnalyzeFood(
        {
          image: base64,
          identifyOnly: true,
          userProfile: {
            dietPreference: profile.dietPreference,
            allergies: profile.allergies,
            currentBodyType: profile.currentBodyType,
            targetBodyType: profile.targetBodyType,
            weight: profile.weight,
            age: profile.age,
          },
        },
        1
      );

      setIdentifiedFood(data?.identifiedFood || "Unknown Food");
    } catch (error) {
      console.error("Identification error:", error);
      toast.error("Failed to identify food. Please try again.");
      setIdentifiedFood("Food Item");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeFood = async (base64: string, logData: DetailedLogData | null) => {
    setIsAnalyzing(true);
    try {
      const data = await invokeAnalyzeFood(
        {
          image: base64,
          detailedLog: logData,
          userProfile: {
            dietPreference: profile.dietPreference,
            allergies: profile.allergies,
            currentBodyType: profile.currentBodyType,
            targetBodyType: profile.targetBodyType,
            weight: profile.weight,
            age: profile.age,
          },
        },
        1
      );

      onAnalysis(data);
      toast.success("Food analyzed successfully!");

      // Reset state
      setIdentifiedFood("");
      setPendingImage(null);
      setDetailedLog(null);
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze food. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeWithDetails = () => {
    if (pendingImage) {
      analyzeFood(pendingImage, detailedLog);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const fileToOptimizedBase64 = async (file: File): Promise<string> => {
    try {
      return await fileToOptimizedDataUrl(file);
    } catch (err) {
      console.warn("Image optimization failed, using original image", err);
      return await fileToBase64(file);
    }
  };

  const fileToOptimizedDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        try {
          const maxDim = 1280;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));

          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D context not available");

          ctx.drawImage(img, 0, 0, width, height);

          // JPEG is much smaller than PNG for photos; this improves reliability.
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      };

      img.src = objectUrl;
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const resetScanner = () => {
    setPreview(null);
    setIdentifiedFood("");
    setPendingImage(null);
    setDetailedLog(null);
  };

  return (
    <Card className="p-8 bg-gradient-to-br from-card to-muted/30 border-border/50 shadow-card">
      {/* Scan Mode Selector */}
      <FoodScanModeSelector value={scanMode} onChange={setScanMode} />

      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept="image/*"
          onChange={handleFileInput}
          disabled={isAnalyzing}
        />

        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="Food preview"
              className="max-h-64 mx-auto rounded-lg shadow-elevated"
            />
            
            {isAnalyzing && !identifiedFood && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{scanMode === "detailed" ? "Identifying food..." : "Analyzing your food..."}</span>
              </div>
            )}

            {/* Detailed Log Form (shown after food is identified in detailed mode) */}
            {scanMode === "detailed" && identifiedFood && !isAnalyzing && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <p className="text-lg font-semibold text-foreground">
                  Identified: <span className="text-primary">{identifiedFood}</span>
                </p>
                
                <DetailedFoodLog
                  foodName={identifiedFood}
                  onChange={(data) => setDetailedLog(data)}
                />

                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={resetScanner}>
                    Scan Different Food
                  </Button>
                  <Button onClick={handleAnalyzeWithDetails} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      "Analyze with Details"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center gap-4"
          >
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                Drop your food photo here
              </p>
              <p className="text-sm text-muted-foreground">
                {scanMode === "quick" 
                  ? "Best for packaged food with nutritional labels"
                  : "Log weight and ingredients for homemade food"
                }
              </p>
            </div>
            <Button type="button" variant="outline" size="lg" disabled={isAnalyzing}>
              Select Image
            </Button>
          </label>
        )}
      </div>
    </Card>
  );
};
