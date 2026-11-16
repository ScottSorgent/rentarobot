export type DurationType = 'daily' | 'weekly' | 'monthly';

export type RobotCategory = 'commercial' | 'residential';
export type RobotStatus = 'available' | 'rented' | 'maintenance';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PlanType = 'rental' | 'lease';
export type ProviderType = 'individual' | 'sole_proprietor' | 'cleaning_company' | 'company_employee' | 'homeowner' | 'renter';
export type ContactMethod = 'email' | 'phone' | 'sms';

export interface Robot {
  id: string;
  name: string;
  slug: string;
  category: RobotCategory;
  tagline: string;
  description: string;
  image_url: string;
  monthly_rate: number;
  daily_rate: number | null;
  weekly_rate: number | null;
  rating: number;
  reviews_count: number;
  location: string;
  specs: Record<string, string>;
  features: string[];
  status: RobotStatus;
}

export interface ProviderProfile {
  user_id: string;
  full_legal_name: string;
  display_name: string;
  mobile_phone: string;
  preferred_contact_method: ContactMethod;
  preferred_language: string;
  provider_type: ProviderType;
  legal_business_name: string | null;
  public_business_name: string | null;
  business_structure: string | null;
  business_address: string | null;
  business_website: string | null;
  ein_status: 'not_provided' | 'pending_external' | 'verified_external';
  owner_representative_name: string | null;
  team_size: number;
  service_types: string[];
  other_specialties: string | null;
  home_zip: string;
  service_area_zips: string[];
  rates_include_platform_fee: boolean;
  owned_equipment: boolean;
  equipment_models: string | null;
  automation_experience: string | null;
  training_completed: string | null;
  payment_account_id: string | null;
  payment_verification_status: 'not_connected' | 'pending' | 'verified';
  onboarding_completed: boolean;
  provider_agreement_accepted_at: string | null;
  platform_terms_accepted_at: string | null;
  privacy_policy_accepted_at: string | null;
}

export interface OnboardingInput {
  full_legal_name: string;
  display_name: string;
  mobile_phone: string;
  preferred_contact_method: ContactMethod;
  preferred_language: string;
  provider_type: ProviderType;
  legal_business_name?: string;
  public_business_name?: string;
  business_structure?: string;
  business_address?: string;
  business_website?: string;
  ein_status: 'not_provided' | 'pending_external';
  owner_representative_name?: string;
  team_size: number;
  service_types: string[];
  other_specialties?: string;
  home_zip: string;
  service_area_zips: string[];
  rates_include_platform_fee: boolean;
  owned_equipment: boolean;
  equipment_models?: string;
  automation_experience: string;
  training_completed?: string;
}

export interface Booking {
  id: string;
  robot_id: string;
  renter_name: string;
  renter_email: string;
  renter_phone: string | null;
  usage_type: RobotCategory;
  plan_type: PlanType;
  start_date: string;
  end_date: string;
  days: number;
  total_price: number;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  pricing_snapshot: PricingSnapshot | null;
  duration_type: DurationType | null;
  minimum_term_months: number | null;
  deposit_amount: number;
  delivery_fee: number;
  damage_protection_fee: number;
  checkout_handling_cost: number;
  return_handling_cost: number;
  tax_amount: number;
  hub_id: string | null;
  pickup_at: string | null;
  handoff_location: string | null;
  handoff_status: string | null;
  handoff_code: string | null;
  handoff_fee: number;
  checklist_done: boolean;
  battery_confirmed: boolean;
  outgoing_confirmed_at: string | null;
  incoming_confirmed_at: string | null;
  robots?: Robot | Robot[];
}

export interface PricingSnapshot {
  duration_type: DurationType;
  unit_price: number;
  units: number;
  base_price: number;
  tax_amount: number;
  deposit_amount: number;
  delivery_fee: number;
  damage_protection_fee: number;
  total_price: number;
  service_fee: number;
  minimum_term_months: number | null;
  pricing_version: string;
  recorded_at: string;
}

export interface NewBooking {
  robot_id: string;
  renter_name: string;
  renter_email: string;
  renter_phone?: string;
  usage_type: RobotCategory;
  plan_type: PlanType;
  start_date: string;
  end_date: string;
  days: number;
  total_price: number;
  notes?: string;
  pricing_snapshot?: PricingSnapshot;
  duration_type?: DurationType;
  minimum_term_months?: number | null;
  deposit_amount?: number;
  delivery_fee?: number;
  damage_protection_fee?: number;
  tax_amount?: number;
  hub_id?: string | null;
}

export function daysBetween(start: string, end: string): number {
  const ms = new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// Calendar-month lease length: a start-to-end span produced by datePlusMonths
// must bill as exactly that many months, even though the inclusive day count
// exceeds 30 per month.
export function monthsBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 1;
  let months = (ey - sy) * 12 + (em - sm);
  if (ed > sd) months += 1;
  return Math.max(1, months);
}

// Whole weeks in an inclusive date span, floored at 1.
export function weeksBetween(start: string, end: string): number {
  return Math.max(1, Math.ceil(daysBetween(start, end) / 7));
}

export function quoteTotal(robot: Robot, months: number): number {
  return Math.ceil(Math.max(1, months)) * Number(robot.monthly_rate);
}

export const PRICING_VERSION = '2026-11-marketplace-20pct-v4';

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// True when the robot supports daily/weekly/monthly rentals (humanoid
// household robots); false when it only lists monthly (specialized cleaning
// robots).
export function isHumanoid(robot: Robot): boolean {
  return Boolean(robot.daily_rate || robot.weekly_rate);
}

export function statusLabel(status: RobotStatus): string {
  switch (status) {
    case 'available': return 'Available';
    case 'rented': return 'Reserved';
    case 'maintenance': return 'Unavailable';
    default: return 'Available';
  }
}
