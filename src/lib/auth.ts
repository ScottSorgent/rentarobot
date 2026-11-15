import { supabase } from './supabase';

export async function signUp(email: string, password: string, fullName: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });
  if (error) throw new Error(error.message);
  if (data.session === null) {
    throw new Error(
      'This email already has an account. Try signing in or reset your password.'
    );
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    if (error.message === 'Invalid login credentials or email not confirmed') {
      throw new Error('Wrong email or password. Try again, or reset your password.');
    }
    throw new Error(error.message);
  }
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
