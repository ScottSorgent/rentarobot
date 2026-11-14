export type RobotCategory = 'commercial' | 'residential';
export type RobotStatus = 'available' | 'rented' | 'maintenance';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Robot {
  id: string;
  name: string;
  slug: string;
  category: RobotCategory;
  tagline: string;
  description: string;
  image_url: string;
  daily_rate: number;
  weekly_rate: number;
  rating: number;
  reviews_count: number;
  location: string;
  specs: Record<string, string>;
  features: string[];
  status: RobotStatus;
}

export interface Booking {
  id: string;
  robot_id: string;
  renter_name: string;
  renter_email: string;
  renter_phone: string | null;
  usage_type: RobotCategory;
  start_date: string;
  end_date: string;
  days: number;
  total_price: number;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  robots?: Robot | Robot[];
}

export interface NewBooking {
  robot_id: string;
  renter_name: string;
  renter_email: string;
  renter_phone?: string;
  usage_type: RobotCategory;
  start_date: string;
  end_date: string;
  days: number;
  total_price: number;
  notes?: string;
}

export function daysBetween(start: string, end: string): number {
  const ms = new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export function quoteTotal(robot: Robot, days: number): number {
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return Math.round(weeks * Number(robot.weekly_rate) + remainder * Number(robot.daily_rate) * 100) / 100;
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
