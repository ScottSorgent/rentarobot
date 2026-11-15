import { supabase } from './supabase';
import type { Booking, NewBooking, OnboardingInput, ProviderProfile, Robot } from './types';
import type { Hub, PricingSettings, RobotPricing } from './pricing';
import { DEFAULT_SETTINGS } from './pricing';

export async function fetchRobots(): Promise<Robot[]> {
  const { data, error } = await supabase
    .from('robots')
    .select('*')
    .order('category', { ascending: true })
    .order('daily_rate', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Robot[];
}

export async function fetchMyBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, robots(*)')
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

export async function fetchProviderProfile(): Promise<ProviderProfile | null> {
  const { data, error } = await supabase.from('provider_profiles').select('*').maybeSingle();
  if (error) throw new Error('Could not load your provider profile.');
  return data as ProviderProfile | null;
}

export async function completeProviderOnboarding(input: OnboardingInput): Promise<void> {
  const { error } = await supabase.rpc('complete_provider_onboarding', { p_profile: input });
  if (error) throw new Error('Could not save your onboarding details. Please try again.');
}

export async function fetchPricingSettings(): Promise<PricingSettings> {
  const { data, error } = await supabase.from('pricing_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...data } as PricingSettings;
}

export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_app_admin');
  if (error) return false;
  return data === true;
}

export async function fetchAdminList(): Promise<{ user_id: string; email: string | null; created_at: string }[]> {
  const { data, error } = await supabase.rpc('admin_list_admins');
  if (error) throw new Error('Could not load the administrator list.');
  return (data ?? []) as { user_id: string; email: string | null; created_at: string }[];
}

export async function addAdminByEmail(email: string): Promise<void> {
  const { error } = await supabase.rpc('admin_add_admin_by_email', { p_email: email });
  if (error) {
    if (error.message.includes('No account found')) {
      throw new Error('No account found with that email.');
    }
    if (error.message.includes('valid email')) {
      throw new Error('Enter a valid email address.');
    }
    throw new Error('Could not designate that administrator.');
  }
}

export async function removeAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_remove_admin', { p_user_id: userId });
  if (error) throw new Error('Could not remove that administrator.');
}

export async function fetchRobotPricing(): Promise<RobotPricing[]> {
  const { data, error } = await supabase.from('robot_pricing').select('*').order('robot_id');
  if (error) throw new Error(error.message);
  return (data ?? []) as RobotPricing[];
}

export async function fetchHubs(): Promise<Hub[]> {
  const { data, error } = await supabase.from('hubs').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as Hub[];
}

export async function saveRobotPricing(
  robotId: string,
  patch: Partial<RobotPricing>,
  summary: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_update_robot_pricing', {
    p_robot_id: robotId,
    p_patch: patch,
    p_summary: summary,
  });
  if (error) {
    if (error.message.includes('Not authorized')) {
      throw new Error('Only designated administrators can change pricing.');
    }
    throw new Error('Could not save the pricing changes. Please check the values and try again.');
  }
}

export async function savePlatformSettings(settings: PricingSettings, summary: string): Promise<void> {
  const { error } = await supabase.rpc('admin_save_pricing_settings', {
    p_settings: settings,
    p_summary: summary,
  });
  if (error) {
    if (error.message.includes('Not authorized')) {
      throw new Error('Only designated administrators can change pricing defaults.');
    }
    throw new Error('Could not save the pricing defaults. Please check the values and try again.');
  }
}

export async function fetchPricingAudit(limit = 50) {
  const { data, error } = await supabase
    .from('pricing_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function applyCatalogRates(
  robotId: string,
  rates: { daily_rate: number; weekly_rate: number; monthly_rate: number },
  summary: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_apply_catalog_rates', {
    p_robot_id: robotId,
    p_daily: rates.daily_rate,
    p_weekly: rates.weekly_rate,
    p_monthly: rates.monthly_rate,
    p_summary: summary,
  });
  if (error) {
    if (error.message.includes('Not authorized')) {
      throw new Error('Only designated administrators can update catalog prices.');
    }
    throw new Error('Could not update catalog prices.');
  }
}
