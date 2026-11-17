import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Calendar,
  MapPin,
  Truck,
} from 'lucide-react';
import type { BlackoutRange, CityInfo, EquipmentCategory, OwnerCondition, OwnerListingInput } from '@/lib/types';
import { formatMoney } from '@/lib/types';
import { lookupZip, ownerCreateListing, ownerUpdateListing, uploadListingPhoto, ownerPhotoCanDelete, deleteListingPhotoFile } from '@/lib/api';
import { MONTHLY_RATE_PCT_OF_VALUE, monthlyRateFromValue } from '@/lib/pricing';
import type { Robot } from '@/lib/types';
import AppHeader from '@/components/AppHeader';

interface Props {
  userEmail: string;
  onBack: () => void;
  onSubmitted: () => void;
  onSignOut: () => void;
  onGoHome: () => void;
  onOpenBookings: () => void;
  // When set, the form opens pre-filled to edit this existing listing.
  editingRobot?: Robot | null;
  onFinished?: () => void;
}

const equipmentOptions: [EquipmentCategory, string][] = [
  ['vacuum_mop', 'Vacuum / Mop (Floor Washing)'],
  ['window_cleaning', 'Window / Glass Cleaning'],
  ['floor_polishing', 'Floor Polishing / Waxing'],
  ['carpet_deep_cleaning', 'Carpet Deep Cleaning'],
  ['humanoid', 'Humanoid Chef Robot'],
  ['humanoid_household', 'Humanoid Household Task Robot'],
  ['other_specialized', 'Other Specialized Equipment'],
];

const conditionOptions: [OwnerCondition, string][] = [
  ['like_new', 'Like New (barely used, no visible wear)'],
  ['good', 'Good (light wear, fully functional)'],
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
  editingRobot = null,
  onFinished,
}: Props) {
  const isEdit = Boolean(editingRobot);
  const [photos, setPhotos] = useState<string[]>(() => {
    if (!editingRobot) return [];
    const urls = (editingRobot.photo_urls ?? []).filter(Boolean);
    if (urls.length === 0) return editingRobot.image_url ? [editingRobot.image_url] : [];
    return urls.includes(editingRobot.image_url) ? urls : [editingRobot.image_url, ...urls];
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [name, setName] = useState(editingRobot?.name ?? '');
  const [manufacturer, setManufacturer] = useState(editingRobot?.specs?.Manufacturer ?? '');
  const [model, setModel] = useState(editingRobot?.specs?.Model ?? '');
  const [tagline, setTagline] = useState(editingRobot?.tagline ?? '');
  const [description, setDescription] = useState(editingRobot?.description ?? '');
  const [equipmentCategory, setEquipmentCategory] = useState<EquipmentCategory>(editingRobot?.equipment_category ?? 'vacuum_mop');
  const [condition, setCondition] = useState<OwnerCondition>(editingRobot?.condition ?? 'like_new');
  const [accessories, setAccessories] = useState((editingRobot?.accessories ?? []).join(', '));
  const [robotValue, setRobotValue] = useState(
    editingRobot ? String(Math.round(Number(editingRobot.monthly_rate) / MONTHLY_RATE_PCT_OF_VALUE)) : '',
  );
  const [pickupZip, setPickupZip] = useState(editingRobot?.pickup_zip ?? '');
  const [locationLabel, setLocationLabel] = useState(editingRobot?.location ?? '');
  const [zipMatches, setZipMatches] = useState<CityInfo[] | null>(null);
  const [cityId, setCityId] = useState(editingRobot?.listing_city_id ?? '');
  const [pickupInstructions, setPickupInstructions] = useState(editingRobot?.pickup_instructions ?? '');
  const [returnInstructions, setReturnInstructions] = useState(editingRobot?.return_instructions ?? '');
  const [deliveryAvailable, setDeliveryAvailable] = useState(Boolean(editingRobot?.delivery_available));
  const [deliveryFee, setDeliveryFee] = useState(editingRobot?.delivery_fee != null ? String(editingRobot.delivery_fee) : '');
  const [blackouts, setBlackouts] = useState<BlackoutRange[]>(editingRobot?.blackout_dates ?? []);
  const [specsText, setSpecsText] = useState(
    () => editingRobot ? Object.entries(editingRobot.specs ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join('\n') : '',
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthly = Number(robotValue) > 0
    ? monthlyRateFromValue(Number(robotValue))
    : Number(editingRobot?.monthly_rate) || 0;
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

  // Reorder: swap the photo at index with its neighbor. The first photo is
  // the primary thumbnail shown in the catalog.
  function movePhoto(index: number, delta: number) {
    setPhotos((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // Remove a photo from the list; if it was already uploaded and no listing
  // references it anymore, the storage file is deleted server-gated.
  async function removePhoto(url: string) {
    const remaining = photos.filter((p) => p !== url);
    setPhotos(remaining);
    if (!url.includes('/listing-photos/')) return; // not an owner upload
    try {
      const stillReferenced = editingRobot
        ? (remaining.length === 0 || url === editingRobot.image_url || (editingRobot.photo_urls ?? []).includes(url))
        : false;
      // During edit the listing still references old photos until saved, so
      // only clean up files the server confirms are unreferenced.
      if (!stillReferenced || remaining.length === 0) {
        if (await ownerPhotoCanDelete(url)) {
          await deleteListingPhotoFile(url);
        }
      }
    } catch {
      // File cleanup is best-effort; the photo is already removed from the list.
    }
  }

  function updateBlackout(index: number, patch: Partial<BlackoutRange>) {
    setBlackouts((current) => current.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  async function submit() {
    setError(null);
    if (photos.length === 0) return setError('Add at least one photo of your robot.');
    if (name.trim().length < 3) return setError('Give your listing a name.');
    if (Number(robotValue) <= 0) return setError('Enter what your robot is worth.');
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

  async function saveEdit() {
    setError(null);
    if (photos.length === 0) return setError('Keep at least one photo of your robot.');
    if (name.trim().length < 3) return setError('Give your listing a name.');
    if (Number(robotValue) <= 0) return setError('Enter what your robot is worth.');
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
      const needsReview = editingRobot!.listing_status === 'rejected' || editingRobot!.listing_status === 'changes_requested';
      await ownerUpdateListing(editingRobot!.id, {
        name: name.trim(),
        tagline: tagline.trim() || 'Available for rent in your city.',
        description: description.trim(),
        monthly_rate: monthly,
        condition,
        accessories: accessories.split(',').map((a) => a.trim()).filter(Boolean),
        pickup_zip: pickupZip.replace(/\D/g, '').slice(0, 5),
        pickup_instructions: pickupInstructions.trim(),
        return_instructions: returnInstructions.trim(),
        blackout_dates: blackouts.filter((b) => b.start && b.end),
        delivery_available: deliveryAvailable,
        delivery_fee: Number(deliveryFee) || 0,
        equipment_category: equipmentCategory,
        specs,
        photo_urls: photos,
      });
      onFinished?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your changes. Please try again.');
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
          <ArrowLeft size={16} /> Back to Catalog
        </button>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            {isEdit ? 'Edit Listing' : 'List Your Robot'}
          </p>
          <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight text-ink-950">
            {isEdit ? `Update “${editingRobot!.name}”.` : 'Rent Out Your Robot to Customers in Your City'}
          </h1>
          {isEdit ? (
            <p className="mt-3 text-sm text-ink-500 leading-relaxed">
              Update the details, value, and photos below. Your changes save to the same listing — existing
              reservations and rental history are untouched.
              {editingRobot!.listing_status === 'rejected' || editingRobot!.listing_status === 'changes_requested'
                ? ' Saving will send the listing back to our team for review before it appears in the catalog again.'
                : ''}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-500 leading-relaxed">
              You keep 80% of the rental price; the platform keeps a 20% commission. The price customers
              see already includes the commission, so enter the full monthly amount you want to receive
              plus commission — or simply the price you want customers to pay and check the estimate below.
            </p>
          )}
        </div>

        <section className="mt-6 bg-white rounded-3xl border border-ink-100 shadow-sm p-6 sm:p-8 space-y-6">
          <Section title="Photos" icon={<Camera size={17} />}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((url, i) => (
                <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-ink-100">
                  <img src={url} alt={`Listing photo ${i + 1}`} className="w-full h-full object-cover" />
                  {i === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 bg-ink-950/75 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Cover
                    </span>
                  )}
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      onClick={() => void removePhoto(url)}
                      className="bg-white/95 rounded-full p-1 text-ink-700 hover:text-red-600 shadow"
                      aria-label="Remove photo"
                    >
                      <Check size={13} className="rotate-45" />
                    </button>
                  </div>
                  {i > 0 && (
                    <button
                      onClick={() => movePhoto(i, -1)}
                      className="absolute left-1.5 top-1.5 bg-white/95 rounded-full p-1 text-ink-700 hover:text-ink-900 shadow"
                      aria-label="Move photo earlier"
                    >
                      <ChevronLeft size={13} />
                    </button>
                  )}
                  {i < photos.length - 1 && (
                    <button
                      onClick={() => movePhoto(i, 1)}
                      className="absolute bottom-1.5 right-1.5 bg-white/95 rounded-full p-1 text-ink-700 hover:text-ink-900 shadow"
                      aria-label="Move photo later"
                    >
                      <ChevronRight size={13} />
                    </button>
                  )}
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

          <Section title="Robot Details" icon={<Check size={17} />}>
            <Field label="Listing Name" value={name} onChange={setName} placeholder="e.g. AuroraHome Butler H1" required />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Manufacturer" value={manufacturer} onChange={setManufacturer} placeholder="e.g. Aurora Robotics" />
              <Field label="Model" value={model} onChange={setModel} placeholder="e.g. H1" />
            </div>
            <Field label="Short Tagline" value={tagline} onChange={setTagline} placeholder="e.g. Laundry, folding, dishes and tidy-up — one household butler." />
            <label className="block">
              <span className="text-xs font-semibold text-ink-700">What can the robot do?</span>
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
                label="Equipment Category"
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
              <span className="text-xs font-semibold text-ink-700">Extra Specifications (one per line)</span>
              <textarea
                value={specsText}
                onChange={(event) => setSpecsText(event.target.value)}
                rows={3}
                placeholder={'e.g. Battery Life: 4 hours\nWeight: 20 lbs'}
                className="mt-1.5 w-full border border-ink-200 rounded-xl px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </label>
          </Section>

          <Section title="Value" icon={<CircleDollarSign size={17} />}>
            <div className="max-w-md">
              <Field
                label="What the robot is worth"
                value={robotValue}
                onChange={setRobotValue}
                type="number"
                placeholder="2500"
                required
                hint="Sets your rental price automatically. A $2,500 robot rents for $200/month."
              />
            </div>
            {editingRobot && (
              <p className="text-xs text-ink-500">
                Current rental price: {formatMoney(Number(editingRobot.monthly_rate))}/month. Enter the robot's value above and save to re-price the rental from it.
              </p>
            )}
            {monthly > 0 && (
              <div className="rounded-2xl bg-brand-50 border border-brand-100 p-4 text-sm">
                <p className="font-semibold text-brand-950">Your rental price and earnings</p>
                <p className="mt-1 text-brand-900/90 leading-relaxed">
                  Customers pay <strong>{formatMoney(monthly)}/month</strong>. After the 20% platform
                  commission that's about <strong>{formatMoney(estimatedPayout)}</strong> to you each month
                  booked. Marketing and hosting costs are never taken out of your payout.
                </p>
              </div>
            )}
          </Section>

          <Section title="Pickup Location" icon={<MapPin size={17} />}>
            <div className="grid sm:grid-cols-[168px_1fr] gap-3 items-start">
              <div>
                <Field
                  label="Pickup ZIP Code"
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
              <Field
                label="Pickup Instructions"
                value={pickupInstructions}
                onChange={setPickupInstructions}
                placeholder="e.g. Meet at the front lobby, weekdays after 5 PM."
              />
            </div>
            <Field
              label="Return Instructions"
              value={returnInstructions}
              onChange={setReturnInstructions}
              placeholder="e.g. Return with a full battery and the same accessories."
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

          <Section title="Blackout Dates" icon={<Calendar size={17} />}>
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
            onClick={() => void (isEdit ? saveEdit() : submit())}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold px-5 py-3.5 rounded-xl transition-colors"
          >
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Submit'}
          </button>
          <p className="text-xs text-ink-500 text-center">
            {isEdit
              ? 'Changes save immediately to your listing. If it was not approved, saving sends it back for review.'
              : 'Our team has the right to remove listings violating listing policies like inflated values, inappropriate or low-quality images, and missing details.'}
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
      <span className="text-xs font-semibold text-ink-700">{label}</span>
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
