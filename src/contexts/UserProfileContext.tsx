import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";

export type BodyType = "thin" | "average" | "athletic" | "overweight" | "obese";
export type DietPreference = "vegan" | "vegetarian" | "non-veg";

export interface UserProfile {
  currentBodyType: BodyType;
  targetBodyType: BodyType;
  weight: number;
  height: number; // in cm
  age: number;
  allergies: string[];
  dietPreference: DietPreference;
  hasCompletedOnboarding: boolean;
}

export const calculateBMI = (weight: number, heightCm: number): number => {
  if (weight <= 0 || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return weight / (heightM * heightM);
};

export const getBMICategory = (bmi: number): { label: string; color: string; description: string } => {
  if (bmi < 18.5) return { label: "Underweight", color: "text-amber-500", description: "Consider gaining healthy weight" };
  if (bmi < 25) return { label: "Normal", color: "text-green-500", description: "Healthy weight range" };
  if (bmi < 30) return { label: "Overweight", color: "text-amber-500", description: "Consider moderate weight loss" };
  return { label: "Obese", color: "text-red-500", description: "Weight management recommended" };
};

interface UserProfileContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  resetProfile: () => Promise<void>;
  session: Session | null;
  loading: boolean;
}

const defaultProfile: UserProfile = {
  currentBodyType: "average",
  targetBodyType: "athletic",
  weight: 70,
  height: 170,
  age: 25,
  allergies: [],
  dietPreference: "non-veg",
  hasCompletedOnboarding: false,
};

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile from database
  const loadProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile:", error);
      } else if (data) {
        setProfile({
          currentBodyType: (data.current_body_type as BodyType) || "average",
          targetBodyType: (data.target_body_type as BodyType) || "athletic",
          weight: Number(data.weight) || 70,
          height: Number(data.height) || 170,
          age: Number(data.age) || 25,
          allergies: data.allergies || [],
          dietPreference: (data.diet_preference as DietPreference) || "non-veg",
          hasCompletedOnboarding: !!data.has_completed_onboarding,
        });
      } else {
        // Profile does not exist yet (first time login)
        // Upsert current local storage profile or default profile
        const saved = localStorage.getItem("userProfile");
        const initialProfile = saved ? JSON.parse(saved) : defaultProfile;
        
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            current_body_type: initialProfile.currentBodyType,
            target_body_type: initialProfile.targetBodyType,
            weight: initialProfile.weight,
            height: initialProfile.height,
            age: initialProfile.age,
            allergies: initialProfile.allergies,
            diet_preference: initialProfile.dietPreference,
            has_completed_onboarding: initialProfile.hasCompletedOnboarding,
          });

        if (insertError) {
          console.error("Error creating initial profile:", insertError);
        } else {
          setProfile(initialProfile);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        // For guest user, load from localStorage
        const saved = localStorage.getItem("userProfile");
        if (saved) {
          try {
            setProfile({ ...defaultProfile, ...JSON.parse(saved) });
          } catch {
            setProfile(defaultProfile);
          }
        }
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        // User logged out - load from localStorage or default
        const saved = localStorage.getItem("userProfile");
        if (saved) {
          try {
            setProfile({ ...defaultProfile, ...JSON.parse(saved) });
          } catch {
            setProfile(defaultProfile);
          }
        } else {
          setProfile(defaultProfile);
        }
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    // Update local state
    const updated = { ...profile, ...updates };
    setProfile(updated);
    localStorage.setItem("userProfile", JSON.stringify(updated));

    // If logged in, update Supabase
    if (session?.user) {
      const dbUpdates: any = {};
      if (updates.currentBodyType !== undefined) dbUpdates.current_body_type = updates.currentBodyType;
      if (updates.targetBodyType !== undefined) dbUpdates.target_body_type = updates.targetBodyType;
      if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
      if (updates.height !== undefined) dbUpdates.height = updates.height;
      if (updates.age !== undefined) dbUpdates.age = updates.age;
      if (updates.allergies !== undefined) dbUpdates.allergies = updates.allergies;
      if (updates.dietPreference !== undefined) dbUpdates.diet_preference = updates.dietPreference;
      if (updates.hasCompletedOnboarding !== undefined) dbUpdates.has_completed_onboarding = updates.hasCompletedOnboarding;

      const { error } = await supabase
        .from("profiles")
        .update(dbUpdates)
        .eq("id", session.user.id);

      if (error) {
        console.error("Error syncing profile:", error);
        toast.error("Failed to sync profile changes to database.");
      }
    }
  };

  const resetProfile = async () => {
    localStorage.removeItem("userProfile");
    setProfile(defaultProfile);
    if (session) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
      }
    }
  };

  return (
    <UserProfileContext.Provider value={{ profile, updateProfile, resetProfile, session, loading }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
};
