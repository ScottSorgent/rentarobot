import { supabase } from './supabase';
import type {
  Booking,
  GuardedBookingResult,
  NewBooking,
  OnboardingInput,
  OwnerListingInput,
  ProviderProfile,
  Robot,
} from './types';
import type { CityInfo } from './types';
import type { Hub, PricingSettings, RobotPricing } from './pricing';
import { DEFAULT_SETTINGS } from './pricing';

export async function fetchRobots(): Promise<Robot[]> {
  const { data, error } = await supabase
    .from('robots')
    .select('*')
    .order('category', { ascending: true })
    .order('monthly_rate', { ascending: false });

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

// ---------- Marketplace: city lookup, guarded booking, owner + admin listings ----------

export async function lookupZip(zip: string): Promise<CityInfo[]> {
  const { data, error } = await supabase.rpc('lookup_zip', { p_zip: zip });
  if (error) throw new Error('Could not look up that ZIP code.');
  return (data ?? []) as CityInfo[];
}

export async function fetchCities(): Promise<CityInfo[]> {
  const { data, error } = await supabase.from('cities').select('*').order('name');
  if (error) throw new Error('Could not load the list of supported cities.');
  return (data ?? []).map((c: { id: string; name: string; state: string; state_code: string }) => ({
    city_id: c.id,
    city_name: c.name,
    state: c.state,
    state_code: c.state_code,
  }));
}

// The city-filtered catalog: published listings in the customer's city plus
// the curated fleet. Works for signed-out visitors too.
export async function fetchBookableRobots(cityId: string): Promise<Robot[]> {
  const { data, error } = await supabase.rpc('bookable_robots', { p_city_id: cityId });
  if (error) throw new Error('Could not load robots for your city.');
  return (data ?? []) as Robot[];
}

export async function createBookingGuarded(input: {
  robotId: string;
  start: string;
  months: number;
  renterName: string;
  renterEmail: string;
  renterPhone: string;
  usageType: string;
  cityId: string;
  notes: string;
  damageProtection: boolean;
  delivery: boolean;
}): Promise<GuardedBookingResult> {
  const { data, error } = await supabase.rpc('create_booking_guarded', {
    p_robot_id: input.robotId,
    p_start: input.start,
    p_months: input.months,
    p_renter_name: input.renterName,
    p_renter_email: input.renterEmail.trim().toLowerCase(),
    p_renter_phone: input.renterPhone,
    p_usage_type: input.usageType,
    p_city_id: input.cityId,
    p_notes: input.notes,
    p_damage_protection: input.damageProtection,
    p_delivery: input.delivery,
  });
  if (error) throw new Error(error.message);
  return data as GuardedBookingResult;
}

export async function cancelBookingGuarded(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_booking_guarded', { p_booking_id: bookingId });
  if (error) {
    if (error.message.includes('own bookings')) {
      throw new Error('You can only cancel your own reservations.');
    }
    throw new Error('Could not cancel the reservation. Please try again.');
  }
}

export async function savePreferredCity(cityId: string | null, zip: string): Promise<void> {
  const { error } = await supabase
    .from('provider_profiles')
    .update({ preferred_city_id: cityId, home_zip: zip })
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
  if (error) throw new Error('Could not save your city. Please try again.');
}

export async function uploadListingPhoto(file: File): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Sign in to upload photos.');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('listing-photos')
    .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) throw new Error('The photo upload failed. Try a smaller JPG or PNG.');
  return supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
}

export async function ownerCreateListing(input: OwnerListingInput, photoUrls: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('owner_create_listing', {
    p_listing: input,
    p_photo_urls: photoUrls,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function ownerUpdateListing(robotId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc('owner_update_listing', {
    p_robot_id: robotId,
    p_patch: patch,
  });
  if (error) throw new Error(error.message);
}

export async function ownerSetListingStatus(robotId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('owner_set_listing_status', {
    p_robot_id: robotId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function adminReviewListing(robotId: string, action: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_review_listing', {
    p_robot_id: robotId,
    p_action: action,
    p_note: note,
  });
  if (error) {
    if (error.message.includes('Not authorized')) {
      throw new Error('Only designated administrators can review listings.');
    }
    throw new Error('Could not record that review decision.');
  }
}

export interface AdminReviewRow {
  id: string;
  name: string;
  listing_status: string;
  equipment_category: string | null;
  monthly_rate: number | null;
  daily_rate: number | null;
  weekly_rate: number | null;
  condition: string | null;
  pickup_zip: string | null;
  city_id: string | null;
  image_url: string;
  description: string;
  accessories: string[] | null;
  review_note: string | null;
  submitted_at: string | null;
  owner_email: string | null;
}

export async function fetchAdminReviewQueue(): Promise<AdminReviewRow[]> {
  const { data, error } = await supabase.rpc('admin_list_reviews');
  if (error) {
    if (error.message.includes('Not authorized')) {
      throw new Error('Only designated administrators can view the review queue.');
    }
    throw new Error('Could not load the listing review queue.');
  }
  return (data ?? []) as AdminReviewRow[];
}

// Owner's own listings, readable through the SELECT policy's owner clause.
export async function fetchMyListings(): Promise<Robot[]> {
  const { data, error } = await supabase
    .from('robots')
    .select('*')
    .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Could not load your listings.');
  return (data ?? []) as Robot[];
}

// Reservations on the owner's listings (via the bookings robots join).
export async function fetchOwnerReservations(): Promise<Booking[]> {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? '';
  const { data, error } = await supabase
    .from('bookings')
    .select('*, robots!inner(id, name, owner_id, image_url)')
    .eq('robots.owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Could not load reservations for your listings.');
  return (data ?? []) as unknown as Booking[];
}

export async function createNotifyRequest(cityId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('notify_requests')
    .insert({ city_id: cityId, email: email.trim().toLowerCase() });
  if (error) throw new Error('Could not save your notification request.');
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
  rates: { monthly_rate: number },
  summary: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_apply_catalog_rates', {
    p_robot_id: robotId,
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

export interface HandoffDetails {
  bookingId: string;
  pickupAt: string;
  handoffLocation: string;
  handoffCode: string;
}

export async function scheduleHandoff(input: HandoffDetails): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({
      pickup_at: input.pickupAt,
      handoff_location: input.handoffLocation,
      handoff_code: input.handoffCode,
      handoff_status: 'scheduled',
    })
    .eq('id', input.bookingId);
  if (error) throw new Error('Could not schedule the handoff. Please try again.');
  const { error: eventError } = await supabase.from('handoff_events').insert({
    booking_id: input.bookingId,
    event_type: 'scheduled',
    notes: `Pickup ${input.pickupAt} at ${input.handoffLocation}`,
  });
  if (eventError) console.error('handoff event log failed', eventError);
}

export async function confirmHandoffSide(
  bookingId: string,
  side: 'outgoing' | 'incoming',
  checklist: { checklistDone: boolean; batteryConfirmed: boolean; photoCount: number },
): Promise<void> {
  const now = new Date().toISOString();
  const patch = side === 'outgoing'
    ? { outgoing_confirmed_at: now, checklist_done: checklist.checklistDone, battery_confirmed: checklist.batteryConfirmed }
    : { incoming_confirmed_at: now };
  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', bookingId)
    .select('outgoing_confirmed_at, incoming_confirmed_at, handoff_status');
  if (error) throw new Error('Could not record the confirmation. Please try again.');
  const row = data?.[0];
  const bothConfirmed = row?.outgoing_confirmed_at && row?.incoming_confirmed_at;
  if (bothConfirmed && row?.handoff_status !== 'completed') {
    const { error: completeError } = await supabase
      .from('bookings')
      .update({ handoff_status: 'completed' })
      .eq('id', bookingId);
    if (completeError) throw new Error('Could not complete the handoff.');
    await supabase.from('handoff_events').insert({
      booking_id: bookingId,
      event_type: 'custody_transferred',
      notes: 'Both parties confirmed the transfer.',
    });
  } else {
    await supabase.from('handoff_events').insert({
      booking_id: bookingId,
      event_type: side === 'outgoing' ? 'cleaning_confirmed' : 'accepted',
      notes: `Checklist ${checklist.checklistDone ? 'complete' : 'incomplete'}, battery ${checklist.batteryConfirmed ? 'confirmed' : 'unconfirmed'}, ${checklist.photoCount} photo(s).`,
    });
  }
}

export interface MaintenanceIssue {
  equipmentRecordId: string | null;
  bookingId: string | null;
  issueType: 'battery' | 'brushes' | 'filter' | 'sensor' | 'other';
  description: string;
  severity: 'minor' | 'major' | 'unsafe';
}

export async function reportMaintenanceIssue(issue: MaintenanceIssue): Promise<void> {
  const { error } = await supabase.from('maintenance_reports').insert({
    equipment_record_id: issue.equipmentRecordId,
    booking_id: issue.bookingId,
    issue_type: issue.issueType,
    description: issue.description,
    severity: issue.severity,
  });
  if (error) throw new Error('Could not submit the maintenance report. Please try again.');
}

export async function fetchEquipmentRecords() {
  const { data, error } = await supabase
    .from('equipment_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Could not load the equipment records.');
  return data ?? [];
}

export async function fetchMaintenanceReports() {
  const { data, error } = await supabase
    .from('maintenance_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Could not load maintenance reports.');
  return data ?? [];
}

export async function fetchHandoffEvents(bookingId: string) {
  const { data, error } = await supabase
    .from('handoff_events')
    .select('*')
    .eq('booking_id', bookingId)
    .order('occurred_at', { ascending: true });
  if (error) throw new Error('Could not load the handoff history.');
  return data ?? [];
}
