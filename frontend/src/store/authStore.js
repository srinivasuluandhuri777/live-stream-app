import { create } from 'zustand';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const useAuthStore = create((set) => {
  // Check for existing session on load
  supabase.auth.getSession().then(({ data: { session } }) => {
    set({ user: session?.user || null });
  });

  // Listen for auth state changes
  supabase.auth.onAuthStateChange((_event, session) => {
    set({ user: session?.user || null });
  });

  return {
    user: null,
    supabase,
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (data?.user) {
        set({ user: data.user });
      }
      return { data, error };
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      if (data?.user) {
        set({ user: data.user });
      }
      return { data, error };
    },
    signOut: async () => {
      await supabase.auth.signOut();
      set({ user: null });
    }
  };
});

