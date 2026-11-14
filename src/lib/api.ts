import { supabase } from './supabase';
import type { Booking, NewBooking, Robot } from './types';

export async function fetchRobots(): Promise<Robot[]> {
  const { data, error } = await supabase
    .from('robots')
    .select('*')
    .order('category', { ascending: true })
    .order('daily_rate', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Robot[];
}

export async function fetchBookingsByEmail(email: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, robots(*)')
    .eq('renter_email', email.trim().toLowerCase())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}

export async function createBooking(input: NewBooking): Promise<void> {
  const { error } = await supabase.from('bookings').insert({
    ...input,
    renter_email: input.renter_email.trim().toLowerCase(),
  });
  if (error) throw new Error(error.message);
}
