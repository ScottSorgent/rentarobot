import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  CircleDollarSign,
  Calendar,
  MapPin,
  Truck,
} from 'lucide-react';
import type { BlackoutRange, CityInfo, EquipmentCategory, OwnerCondition, OwnerListingInput } from '@/lib/types';
import { formatMoney } from '@/lib/types';
import { lookupZip, ownerCreateListing, uploadListingPhoto } from '@/lib/api';
import AppHeader from '@/components/AppHeader';

interface Props {
  userEmail: string;
  onBack: () => void;
  onSubmitted: () => void;
  onSignOut: () => void;
  onGoHome: () => void;
  onOpenBookings: () => void;
}

const equipmentOptions: [EquipmentCategory, string][] = [
  ['vacuum_mop', 'Vacuum / mop (floor washing)'],
  ['window_cleaning', 'Window / glass cleaning'],
  ['floor_polishing', 'Floor polishing / waxing'],
  ['carpet_deep_cleaning', 'Carpet deep cleaning'],
  ['humanoid', 'Humanoid household robot'],
  ['other_specialized', 'Other specialized equipment'],
];

const conditionOptions: [OwnerCondition, string][] = [
  ['new', 'New'],
  ['refurbished', 'Refurbished'],
  ['used', 'Used'],
];

// Platform keeps 20% commission; the customer price already includes it, so
// the owner's estimated payout is 80% of the listed monthly rate.
const COMMISSION_PCT = 0.20;

export default function ListYourRobotPage({
  userEmail,
  onBack,
  onSubmitted,
  onSignOut,
  onGoHome,
  onOpenBookings,
}: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentCategory, setEquipmentCategory] = useState<EquipmentCategory>('vacuum_mop');
  const [condition, setCondition] = useState<OwnerCondition>('used');
  const [accessories, setAccessories] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [pickupZip, setPickupZip] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [zipMatches, setZipMatches] = useState<CityInfo[] | null>(null);
  const [cityId, setCityId] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [returnInstructions, setReturnInstructions] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [blackouts, setBlackouts] = useState<BlackoutRange[]>([]);
  const [specsText, setSpecsText] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthly = Number(monthlyRate) || 0;
  const estimatedPayout = monthly * (1 - COMMISSION_PCT);

  async function checkZip(zip: string) {
    const cleaned = zip.trim();
    setPickupZip(zip);
    if (cleaned.length < 5) {
      setZipMatches(null);
      setCityId('');
      return;
    }
    try {
      const matches = await lookupZip(cleaned);
      setZipMatches(matches);
      setCityId(matches[0]?.city_id ?? '');
    } catch {
      setZipMatches(null);
      setCityId('');
    }
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        urls.push(await uploadListingPhoto(file));
      }
      setPhotos((current) => [...current, ...urls].slice(0, 8));
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'The photo upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function addBlackout() {
    setBlackouts((current) => [...current, { start: '', end: '' }]);
  }

  function updateBlackout(index: number, patch: Partial<BlackoutRange>) {
    setBlackouts((current) => current.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  async function submit() {
    setError(null);
    if (photos.length === 0) return setError('Add at least one photo of your robot.');
    if (name.trim().length < 3) return setError('Give your listing a name.');
    if (monthly <= 0) return setError('Enter a monthly rental price.');
    if (!cityId) return setError('Enter a valid pickup ZIP code in a supported city.');
    if (!description.trim()) return setError('Describe what the robot can do.');

    const specs: Record<string, string> = {};
    if (manufacturer.trim()) specs.Manufacturer = manufacturer.trim();
    if (model.trim()) specs.Model = model.trim();
    for (const line of specsText.split('\n')) {
      const [key, ...rest] = line.split(':');
      if (key.trim() && rest.length > 0) specs[key.trim()] = rest.join(':').trim();
    }

    setSubmitting(true);
    try {
      const listing: OwnerListingInput = {
        name: name.trim(),
        tagline: tagline.trim() || 'Available for rent in your city.',
        description: description.trim(),
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        category: 'residential',
        equipment_category: equipmentCategory,
        monthly_rate: monthly,
        daily_rate: null,
        weekly_rate: null,
        condition,
        accessories: accessories.split(',').map((a) => a.trim()).filter(Boolean),
        pickup_zip: pickupZip.replace(/\D/g, '').slice(0, 5),
        location_label: locationLabel.trim() || `${cityId.replace(/-([a-z]{2})$/, (_, s) => `, ${s.toUpperCase()}`)}`,
        pickup_instructions: pickupInstructions.trim(),
        return_instructions: returnInstructions.trim(),
        blackout_dates: blackouts.filter((b) => b.start && b.end),
        delivery_available: deliveryAvailable,
        delivery_fee: Number(deliveryFee) || 0,
        specs,
        features: [],
      };
      await ownerCreateListing(listing, photos);
      onSubmitted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <AppHeader
        userEmail={userEmail}
        active="list"
        onHome={onGoHome}
        onBrowse={onBack}
        onList={() => window.scrollTo({ top: 0 })}
        onBookings={onOpenBookings}
        onSignOut={onSignOut}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-28 md:pb-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to catalog
        </button>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">List Your Robot</p>
          <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight text-ink-950">
            Rent out your robot to customers in your city.
          </h1>
          <p className="mt-3 text-sm text-ink-500 leading-relaxed">
            You keep 80% of the rental price; the platform keeps a 20% commission. The price customers
            see already includes the commission, so enter the full monthly amount you want to receive
            plus commission — or simply the price you want customers to pay and check the estimate below.
          </p>
        </div>

        <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8 space-y-6">
          <Section title="Photos" icon={<Camera size={17} />}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((url) => (
                <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-ink-100">
                  <img src={url} alt="Listing" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos((current) => current.filter((p) => p !== url))}
                    className="absolute top-1.5 right-1.5 bg-white/95 rounded-full p-1 text-ink-700 hover:text-red-600 shadow"
                    aria-label="Remove photo"
                  >
                    <Check size={13} className="rotate-45" />
                  </button>
                </div>
              ))}
              {photos.length < 8 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-xl border-2 border-dashed border-ink-200 text-ink-400 hover:border-brand-400 hover:text-brand-600 flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-colors"
                >
                  <Camera size={20} />
                  {uploading ? 'Uploading...' : 'Add photo'}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => void handlePhotoUpload(event.target.files)}
            />
            {uploadError && <p className="mt-2 text-xs text-red-700">{uploadError}</p>}
            <p className="mt-2 text-xs text-ink-500">Up to 8 photos. Use real photos of your own robot.</p>
          </Section>

          <Section title="Robot details" icon={<Check size={17} />}>
            <Field label="Listing name" value={name} onChange={setName} placeholder="e.g. AuroraHome Butler H1" required />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Manufacturer" value={manufacturer} onChange={setManufacturer} placeholder="e.g. Aurora Robotics" />
              <Field label="Model" value={model} onChange={setModel} placeholder="e.g. H1" />
            </div>
            <Field label="Short tagline" value={tagline} onChange={setTagline} placeholder="Laundry, folding, dishes and tidy-up — one household butler." />
            <label className="block">
              <span className="text-xs font-semibold text-ink-700">What can the robot do? *</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe its capabilities, what tasks it handles, and anything the renter should know."
                className="mt-1.5 w-full border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <Select
                label="Equipment category"
                value={equipmentCategory}
                onChange={(value) => setEquipmentCategory(value as EquipmentCategory)}
                options={equipmentOptions}
              />
              <Select
                label="Condition"
                value={condition}
                onChange={(value) => setCondition(value as OwnerCondition)}
                options={conditionOptions}
              />
            </div>
            <Field
              label="Included accessories (comma separated)"
              value={accessories}
              onChange={setAccessories}
              placeholder="Charging dock, power cable, spare brushes"
              hint="List only accessories you actually have. Complete systems with docks are prioritized."
            />
            <label className="block">
              <span className="text-xs font-semibold text-ink-700">Extra specifications (one per line, "Label: value")</span>
              <textarea
                value={specsText}
                onChange={(event) => setSpecsText(event.target.value)}
                rows={3}
                placeholder={'Battery life: 4 hours\nWeight: 28 kg'}
                className="mt-1.5 w-full border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </label>
          </Section>

          <Section title="Pricing" icon={<CircleDollarSign size={17} />}>
            <Field label="Monthly rental price (what customers pay)" value={monthlyRate} onChange={setMonthlyRate} type="number" placeholder="249" required />
            {monthly > 0 && (
              <div className="rounded-2xl bg-brand-50 border border-brand-100 p-4 text-sm">
                <p className="font-semibold text-brand-950">Your estimated earnings</p>
                <p className="mt-1 text-brand-900/90 leading-relaxed">
                  {formatMoney(monthly)} customer price − 20% platform commission ={' '}
                  <strong>{formatMoney(estimatedPayout)}</strong> to you each month booked. Marketing and
                  hosting costs are never taken out of your payout.
                </p>
              </div>
            )}
          </Section>

          <Section title="Pickup location" icon={<MapPin size={17} />}>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Field
                  label="Pickup ZIP code"
                  value={pickupZip}
                  onChange={(value) => void checkZip(value)}
                  placeholder="95202"
                  required
                />
                {zipMatches && zipMatches.length > 0 && (
                  <p className="mt-1.5 text-xs font-medium text-green-700">
                    {zipMatches.length === 1
                      ? `${zipMatches[0].city_name}, ${zipMatches[0].state_code}`
                      : 'This ZIP covers several cities — the first was picked.'}
                  </p>
                )}
                {zipMatches && zipMatches.length === 0 && (
                  <p className="mt-1.5 text-xs text-red-700">We don't serve that ZIP yet.</p>
                )}
              </div>
              <Field label="Neighborhood label (optional)" value={locationLabel} onChange={setLocationLabel} placeholder="Downtown Stockton" hint="Shown to renters. Your exact address stays private until a booking is confirmed." />
            </div>
            <Field
              label="Pickup instructions"
              value={pickupInstructions}
              onChange={setPickupInstructions}
              placeholder="Meet at the front lobby, weekdays after 5pm."
            />
            <Field
              label="Return instructions"
              value={returnInstructions}
              onChange={setReturnInstructions}
              placeholder="Return with a full battery and the same accessories."
            />
          </Section>

          <Section title="Delivery (optional)" icon={<Truck size={17} />}>
            <label className="flex items-center gap-3 rounded-2xl border border-ink-200 p-4 cursor-pointer hover:border-ink-400 transition-colors">
              <input
                type="checkbox"
                checked={deliveryAvailable}
                onChange={(event) => setDeliveryAvailable(event.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-semibold text-ink-900">I can deliver within my city</span>
                <span className="mt-0.5 block text-xs text-ink-500">Optional. Rentals default to local pickup at your location.</span>
              </span>
            </label>
            {deliveryAvailable && (
              <Field label="Delivery fee" value={deliveryFee} onChange={setDeliveryFee} type="number" placeholder="25" />
            )}
          </Section>

          <Section title="Blackout dates" icon={<Calendar size={17} />}>
            {blackouts.length === 0 && (
              <p className="text-sm text-ink-500">Optional. Block out dates when the robot isn't available.</p>
            )}
            {blackouts.map((b, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-ink-700">From</span>
                  <input
                    type="date"
                    value={b.start}
                    onChange={(event) => updateBlackout(index, { start: event.target.value })}
                    className="mt-1.5 border border-ink-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-700">Through</span>
                  <input
                    type="date"
                    value={b.end}
                    onChange={(event) => updateBlackout(index, { end: event.target.value })}
                    className="mt-1.5 border border-ink-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </label>
                <button
                  onClick={() => setBlackouts((current) => current.filter((_, i) => i !== index))}
                  className="text-sm font-semibold text-red-600 hover:text-red-700 pb-3"
                >
                  Remove
                </button>
              </div>
            ))}
            <button onClick={addBlackout} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              + Add blackout dates
            </button>
          </Section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold px-5 py-3.5 rounded-xl transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit for review'}
          </button>
          <p className="text-xs text-ink-500 text-center">
            Our team reviews every listing before it appears in the catalog. You'll see its status in your owner dashboard.
          </p>
        </section>
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-ink-100 pt-6 first:border-t-0 first:pt-0">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink-950">
        <span className="text-brand-700">{icon}</span> {title}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}{required && ' *'}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
      {hint && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <span className="relative mt-1.5 block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>{optionLabel}</option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      </span>
    </label>
  );
}
