import type { Provider, Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { supabase } from "./supabase";

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Fires INITIAL_SESSION once supabase-js has restored the session (or exchanged the ?code=
    // from a sign-in redirect), then on every sign-in and sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return use(AuthContext);
}

// Where to send someone after the sign-in redirect. localStorage (not sessionStorage) because a
// magic link opens in a new tab.
const NEXT_KEY = "fulloffload:auth-next";

function callbackUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/auth/callback`;
}

function rememberNext(next: string) {
  try {
    localStorage.setItem(NEXT_KEY, next);
  } catch {
    // Storage can be unavailable (private mode); sign-in still works, it just lands on home.
  }
}

/**
 * The path to return to after sign-in. Reading doesn't clear it (effects can run twice); every
 * new sign-in overwrites it.
 */
export function authNext(): string {
  try {
    const next = localStorage.getItem(NEXT_KEY);
    return next?.startsWith("/") ? next : "/";
  } catch {
    return "/";
  }
}

export async function signInWithProvider(
  provider: Extract<Provider, "github" | "google">,
  next: string,
) {
  rememberNext(next);
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl() },
  });
  if (error) throw error;
}

export async function sendMagicLink(email: string, next: string) {
  rememberNext(next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** A sign-in error Supabase Auth put in the URL, if any. */
export function authErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  // Either "#error=...&error_description=..." or "#/auth/callback?error=...".
  const hash = window.location.hash.slice(1);
  const hashParams = new URLSearchParams(
    hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash,
  );
  return (
    params.get("error_description") ??
    hashParams.get("error_description") ??
    params.get("error") ??
    hashParams.get("error")
  );
}
