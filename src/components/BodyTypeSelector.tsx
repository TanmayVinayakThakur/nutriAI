import { useState, useEffect } from "react";
import { BodyType } from "@/contexts/UserProfileContext";
import { cn } from "@/lib/utils";

interface BodyTypeSelectorProps {
  value: BodyType;
  onChange: (value: BodyType) => void;
  label: string;
}

const bodyTypes: { type: BodyType; label: string; emoji: string; width: number }[] = [
  { type: "thin", label: "Thin", emoji: "🧍", width: 24 },
  { type: "average", label: "Average", emoji: "🧍", width: 32 },
  { type: "athletic", label: "Athletic", emoji: "🏋️", width: 40 },
  { type: "overweight", label: "Overweight", emoji: "🧍", width: 48 },
  { type: "obese", label: "Obese", emoji: "🧍", width: 56 },
];

export const BodyTypeSelector = ({ value, onChange, label }: BodyTypeSelectorProps) => {
  const [animatedIndex, setAnimatedIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const currentIndex = bodyTypes.findIndex((b) => b.type === value);

  const handleSelect = (type: BodyType) => {
    const newIndex = bodyTypes.findIndex((b) => b.type === type);
    if (newIndex !== currentIndex) {
      setIsAnimating(true);
      // Animate through body types
      const step = newIndex > currentIndex ? 1 : -1;
      let current = currentIndex;
      
      const animate = () => {
        current += step;
        setAnimatedIndex(current);
        if (current !== newIndex) {
          setTimeout(animate, 150);
        } else {
          setIsAnimating(false);
          onChange(type);
        }
      };
      animate();
    }
  };

  useEffect(() => {
    setAnimatedIndex(currentIndex);
  }, [currentIndex]);

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-foreground">{label}</label>
      
      {/* Animated Body Silhouette */}
      <div className="flex justify-center py-6">
        <div className="relative h-32 flex items-end justify-center">
          <div
            className={cn(
              "transition-all duration-300 ease-out flex flex-col items-center",
              isAnimating && "animate-pulse"
            )}
            style={{
              width: `${bodyTypes[animatedIndex].width * 2}px`,
            }}
          >
            {/* Body silhouette using SVG */}
            <svg
              viewBox="0 0 100 180"
              className="h-28 transition-all duration-300"
              style={{
                width: `${bodyTypes[animatedIndex].width * 1.5}px`,
              }}
            >
              {/* Head */}
              <circle cx="50" cy="20" r="18" className="fill-primary" />
              {/* Body */}
              <ellipse
                cx="50"
                cy="85"
                rx={15 + bodyTypes[animatedIndex].width * 0.5}
                ry={45 + bodyTypes[animatedIndex].width * 0.2}
                className="fill-primary transition-all duration-300"
              />
              {/* Left Arm */}
              <ellipse
                cx={30 - bodyTypes[animatedIndex].width * 0.2}
                cy="75"
                rx="8"
                ry="35"
                className="fill-primary transition-all duration-300"
              />
              {/* Right Arm */}
              <ellipse
                cx={70 + bodyTypes[animatedIndex].width * 0.2}
                cy="75"
                rx="8"
                ry="35"
                className="fill-primary transition-all duration-300"
              />
              {/* Left Leg */}
              <ellipse
                cx={40}
                cy="155"
                rx={8 + bodyTypes[animatedIndex].width * 0.1}
                ry="30"
                className="fill-primary transition-all duration-300"
              />
              {/* Right Leg */}
              <ellipse
                cx={60}
                cy="155"
                rx={8 + bodyTypes[animatedIndex].width * 0.1}
                ry="30"
                className="fill-primary transition-all duration-300"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Selection Buttons */}
      <div className="flex justify-between gap-2">
        {bodyTypes.map((body, idx) => (
          <button
            key={body.type}
            onClick={() => handleSelect(body.type)}
            className={cn(
              "flex-1 py-3 px-2 rounded-lg text-xs font-medium transition-all duration-200",
              "border-2",
              value === body.type
                ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105"
                : "bg-muted/50 text-muted-foreground border-transparent hover:border-primary/30 hover:bg-muted"
            )}
          >
            {body.label}
          </button>
        ))}
      </div>

      {/* Progress Indicator */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 rounded-full"
          style={{
            width: `${((animatedIndex + 1) / bodyTypes.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};
