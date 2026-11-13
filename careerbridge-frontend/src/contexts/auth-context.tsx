"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { mediaUrl, titleCase } from "@/lib/format";
import { getMe, googleLogin, login as apiLogin, register as apiRegister, clearTokens } from "@/lib/api";

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: "student" | "company" | "university" | "admin";
  profile_photo: string | null;
  gender?: "male" | "female" | "other" | "";
  /** false for a Google sign-up that hasn't picked its role, gender, name and username yet */
  profile_completed?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  /** sign in with an access token from Google's popup */
  loginWithGoogle: (accessToken: string, role?: string) => Promise<{ created: boolean; profileCompleted: boolean }>;
  register: (data: Parameters<typeof apiRegister>[0]) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const me = await getMe() as User;
      setUser({
        ...me,
        first_name: titleCase(me.first_name),
        last_name: titleCase(me.last_name),
        full_name: titleCase(me.full_name),
        profile_photo: mediaUrl(me.profile_photo),
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (username: string, password: string) => {
    await apiLogin(username, password);
    await fetchUser();
  };

  const loginWithGoogle = async (accessToken: string, role?: string) => {
    const { created, user } = await googleLogin(accessToken, role);
    await fetchUser();
    return { created, profileCompleted: user.profile_completed !== false };
  };

  const register = async (data: Parameters<typeof apiRegister>[0]) => {
    await apiRegister(data);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
