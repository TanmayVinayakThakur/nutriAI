import { Camera, Scale, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScanMode = "quick" | "detailed";

interface FoodScanModeSelectorProps {
  value: ScanMode;
  onChange: (mode: ScanMode) => void;
}

export const FoodScanModeSelector = ({ value, onChange }: FoodScanModeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <button
        onClick={() => onChange("quick")}
        className={cn(
          "p-4 rounded-xl border-2 transition-all duration-200 text-left space-y-2",
          value === "quick"
            ? "border-primary bg-primary/10 shadow-md"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          value === "quick" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <Camera className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">Quick Scan</p>
          <p className="text-xs text-muted-foreground">Best for packaged food</p>
        </div>
      </button>

      <button
        onClick={() => onChange("detailed")}
        className={cn(
          "p-4 rounded-xl border-2 transition-all duration-200 text-left space-y-2",
          value === "detailed"
            ? "border-primary bg-primary/10 shadow-md"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          value === "detailed" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">Detailed Log</p>
          <p className="text-xs text-muted-foreground">Log weight & quantity</p>
        </div>
      </button>
    </div>
  );
};
