import { supabase } from "./supabaseClient.js";

/** Повертає поточну сесію (або null), якщо користувач ще не залогінений. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Надсилає magic link на email. Користувач переходить по посиланню з листа назад на цей сайт. */
export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Підписка на зміни стану автентифікації (логін/логаут/відновлення сесії). */
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
