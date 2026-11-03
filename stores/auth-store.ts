"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

interface AuthState {
  ready: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  cloud: boolean;
  init: () => void;
  setProfile: (p: Profile | null) => void;
}

let started = false;

export const useAuth = create<AuthState>((set) => ({
  ready: !isCloudConfigured,
  user: null,
  session: null,
  profile: null,
  cloud: isCloudConfigured,
  setProfile: (profile) => set({ profile }),
  init: () => {
    if (started) return;
    started = true;
    const sb = getSupabase();
    if (!sb) {
      set({ ready: true });
      return;
    }
    const loadProfile = async (user: User | null) => {
      if (!user) return set({ profile: null });
      const { data } = await sb.from("profiles").select("id, username, display_name, bio, avatar_url").eq("id", user.id).maybeSingle();
      set({ profile: (data as Profile) ?? null });
    };
    sb.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, ready: true });
      loadProfile(data.session?.user ?? null);
    });
    sb.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, ready: true });
      loadProfile(session?.user ?? null);
    });
  },
}));
