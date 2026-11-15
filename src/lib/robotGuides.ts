export interface GuideVideo {
  title: string;
  url: string;
}

export interface RobotGuide {
  setup: string[];
  mapping: string[];
  maintenance: { title: string; detail: string }[];
  features: string[];
  videos: GuideVideo[];
  warnings: string[];
  warranty: { coverage: string; duration: string; claims: string };
}

function videosFor(model: string): GuideVideo[] {
  const q = encodeURIComponent(model);
  return [
    { title: `${model} — hands-on setup walkthrough`, url: `https://www.youtube.com/results?search_query=${q}+setup+walkthrough` },
    { title: `${model} — mapping & first run`, url: `https://www.youtube.com/results?search_query=${q}+mapping+first+run` },
    { title: `${model} — maintenance & care`, url: `https://www.youtube.com/results?search_query=${q}+maintenance+care` },
  ];
}

const generic: RobotGuide = {
  setup: [
    'Place the robot on a level, hard floor near a power outlet and remove all shipping film and foam.',
    'Charge fully before first use — the indicator light turns solid green when ready (about 3 hours).',
    'Install the cleaning module (pads, brush or squeegee) until it clicks into place.',
    'Fill the clean-water tank with the approved solution and seat the dirty-water tank firmly.',
    'Press and hold the power button until the status ring lights up, then follow the voice prompts.',
  ],
  mapping: [
    'Clear loose cords, rugs and small items from the area before the first run.',
    'Start a full mapping run from the charging dock and let the robot finish without interruption.',
    'Keep doors open so every room you want cleaned is scanned in one pass.',
    'Review the map in the companion app, name each room and set no-go zones where needed.',
    'Re-run mapping after large furniture changes so routes stay accurate.',
  ],
  maintenance: [
    { title: 'After every job', detail: 'Empty the debris tray, rinse the cleaning pads and wipe the sensors with a dry microfiber cloth.' },
    { title: 'Weekly', detail: 'Wash the water tanks, check the brush for wrapped hair and clean the charging contacts on dock and robot.' },
    { title: 'Monthly', detail: 'Replace worn pads or brushes, inspect wheels for debris and test the full charge cycle end to end.' },
  ],
  features: [
    'Smart route planning that cleans in neat, overlapping rows for full coverage.',
    'Cliff and obstacle sensors that pause the robot near stairs and furniture.',
    'Self-docking: the robot returns to charge automatically between jobs.',
    'App scheduling so recurring client visits run without manual starts.',
  ],
  videos: videosFor('this cleaning robot'),
  warnings: [
    'Never use the robot on wet carpet, standing water or uneven surfaces above the rated slope.',
    'Keep hands, hair and loose clothing away from brushes while the unit is powered.',
    'Only use the manufacturer-approved charger and cleaning solutions.',
    'Do not lift or move the robot mid-clean by its brushes or mop module.',
  ],
  warranty: {
    coverage: 'Manufacturing defects in parts and workmanship under normal commercial use.',
    duration: '12 months from the rental or lease start date on your booking.',
    claims: 'Contact Rent-A-Robot support with your booking number — we coordinate the manufacturer claim and a loaner unit when available.',
  },
};

const guides: Record<string, RobotGuide> = {
  'atlas-concierge-x1': {
    ...generic,
    setup: [
      'Set the dock against a wall on hard flooring with at least 3 feet of clear space in front.',
      'Remove the mop-module transport lock and attach the dual spinning pads until both click.',
      'Fill the clean tank with warm water and the included floor solution; check the wavy filter is seated.',
      'Charge to 100% before the first run — a solid ring means ready (roughly 3 hours).',
      'Hold power for 3 seconds, pick a language on the display and connect to Wi-Fi when prompted.',
    ],
    mapping: [
      'Run the first empty mapping pass with the mop pads off so the robot can scan without cleaning.',
      'Keep interior doors fully open and let the robot complete the scan uninterrupted.',
      'In the app, label rooms (kitchen, lobby, restroom route) so you can target areas per client.',
      'Draw no-go zones over thick rugs, cable runs and wet bar areas.',
      'Save the map as “Site A” and duplicate it before making seasonal edits.',
    ],
    features: [
      'Dual spinning mop pads with pressure control for dried-on stains.',
      'Sonic lift: pads raise when crossing carpet or returning to the dock.',
      'Hot-water deep-mop cycle for greasy commercial floors.',
      'Job logs in the app you can show clients as proof of clean.',
    ],
  },
  'arcweld-pro-7': {
    ...generic,
    setup: [
      'Attach the detailing arm and lock the safety clip before powering on.',
      'Fill the steam reservoir with distilled water only — tap water voids the warranty.',
      'Let the unit heat up fully (status light turns amber to green) before releasing steam.',
      'Fit the microfiber bonnet for glass or the nylon brush for grout lines.',
      'Test steam flow away from surfaces for 5 seconds before each session.',
    ],
    mapping: [
      'Plan your route top-to-bottom and back-to-front so steam dries without footprints.',
      'Mark glass panels and mirrors in the app route list to keep passes consistent.',
      'Use edge mode along frames and corners where grime collects first.',
      'Re-scan a room after moving ladders or scaffolding so obstacle data stays current.',
    ],
    features: [
      'Pressurized steam that loosens grease without chemicals.',
      'Interchangeable heads for glass, grout, tracks and corners.',
      'Auto shut-off when the reservoir runs dry.',
      'Two-tank system that keeps hot steam away from your hands during refills.',
    ],
    warnings: [
      'Steam reaches scalding temperatures — never aim it at people, pets or plants.',
      'Do not use on cold glass that is in direct sun or freezing conditions; thermal shock can crack panes.',
      'Never open the steam cap while the system is pressurized.',
      'Keep the unit upright at all times; tipping can send hot water through the nozzle.',
    ],
  },
  'sortbot-warehouse-amr': {
    ...generic,
    setup: [
      'Position the charging dock in an open aisle with clear ceiling clearance for the sensor mast.',
      'Attach the roller brush module and vacuum bin until both latches lock.',
      'Power on with the deck switch, then connect the robot to site Wi-Fi through the app.',
      'Set the surface profile to the dominant floor type (tile, sealed concrete or low carpet).',
      'Run the 10-minute self-test from the app before the first full job.',
    ],
    mapping: [
      'Walk the space with the robot in follow mode once so it learns the main lanes.',
      'Let the robot run a full autonomous mapping pass during off hours.',
      'Mark staging zones, door thresholds and elevator pads on the map.',
      'Create route schedules per floor section for recurring client bookings.',
    ],
    features: [
      'Large-capacity dust bin rated for full shifts between empties.',
      'LiDAR lane mapping that keeps straight, efficient cleaning paths.',
      'Fleet-ready scheduling across multiple units and zones.',
      'HEPA-level filtration for finer dust on commercial floors.',
    ],
  },
  'sentinel-patrol-s2': {
    ...generic,
    setup: [
      'Spray the cleaning pad with the included glass solution and attach it to the drive unit.',
      'Tether the safety rope to a fixed anchor before the robot leaves your hand.',
      'Pair the robot with the app, then place it on the glass and confirm the frame detection beep.',
      'Choose dry or wet mode before starting — never switch mid-run on vertical glass.',
      'Keep the power cable clear of the cleaning path using the cable clip.',
    ],
    mapping: [
      'The robot auto-detects the pane edges; let it finish one full frame scan before spot mode.',
      'Use spot mode from the remote only after the frame pass is complete.',
      'For multi-pane walls, clean one pane at a time and note each in the app job list.',
      'Re-detect edges if the app reports low grip or an unusual frame warning.',
    ],
    features: [
      'Frame-edge detection that keeps the pad on glass, not on frames.',
      'Microfiber pad oscillation that leaves a streak-free finish.',
      'Auto reverse at obstacles like handles and stickers.',
      'Safety-rope and UPS battery backup that holds the pane through outages.',
    ],
    warnings: [
      'Always attach the safety tether — a dropped unit from height can cause serious injury.',
      'Do not use on cracked, uneven, or non-tempered glass.',
      'Never release the robot while it is on the glass; stop and retrieve it instead.',
      'Check pad wear before every pane — worn pads reduce grip.',
    ],
  },
  'flexiarm-2000': {
    ...generic,
    setup: [
      'Charge the base unit fully and lock the polishing head into the quick-release collar.',
      'Select the pad for the surface: soft for finished hardwood, scrub for stone or tile.',
      'Fill the polish tank if doing a wet polish and verify the drip rate on a test patch.',
      'Set the edge-guard mode so the head slows near baseboards and furniture.',
    ],
    mapping: [
      'Run the room scan with the head raised so the route covers the open floor first.',
      'Split large rooms into zones and let the robot finish each zone before moving on.',
      'Flag delicate rugs and thresholds as no-go areas in the app.',
      'Re-map after furniture changes or the robot will route into new obstacles.',
    ],
    features: [
      'Variable pad pressure for delicate finishes versus heavy scrubbing.',
      'Edge-guard slowdown that protects baseboards and toe kicks.',
      'LED debris spotlight that highlights missed spots after a pass.',
      'Quiet mode for occupied homes and offices.',
    ],
  },
  'scout-quadruped-q9': {
    ...generic,
    setup: [
      'Charge the leg battery pack fully and unfold all four legs until each joint clicks.',
      'Calibrate stance on a level surface using the app’s balance routine.',
      'Attach the vacuum or mop accessory to the back rail and lock both latches.',
      'Practice the start, stop and recall commands in an open room before client sites.',
    ],
    mapping: [
      'Walk the route once with the robot in follow mode so it learns stairs and landings.',
      'Mark stair edges in the app so the robot approaches them at the correct angle.',
      'Set restricted zones for pet areas, nurseries and food prep spaces.',
      'Update the map whenever ramps or gates change on site.',
    ],
    features: [
      'Four-legged balance that handles stairs, thresholds and uneven ground.',
      'Follow mode that trails you from room to room for spot work.',
      'Swappable accessories for vacuum, mop and detail tools.',
      'Obstacle recover: it steps around clutter instead of stalling.',
    ],
    warnings: [
      'Keep fingers and cords away from leg joints while the robot is standing.',
      'Never place the robot on stairs unattended during its first visits to a site.',
      'Do not load more than the rated accessory weight on the back rail.',
      'Recall the robot before opening exterior doors.',
    ],
  },
  'homemate-vacuum-v3': {
    ...generic,
    setup: [
      'Snap the side brushes in place and seat the dust bin with the filter fully inserted.',
      'Place the dock on hard flooring with clear space on both sides.',
      'Charge fully before the first run, then connect the app and enable voice control if desired.',
      'Tuck cords and lift blinds cords before starting jobs in occupied homes.',
    ],
    mapping: [
      'Run the first mapping pass with the brush off to learn the floor plan quickly.',
      'Name rooms in the app and set room-by-room suction schedules for clients.',
      'Add no-go lines at pet bowls, play areas and under-bed cable runs.',
      'Refresh the map after holiday furniture rearrangements.',
    ],
    features: [
      'Carpet-boost suction that ramps up automatically on rugs.',
      'Self-emptying dock that stores weeks of debris in a sealed bag.',
      'Quiet evening mode for in-home bookings.',
      'Room-specific cleaning from the app in a single tap.',
    ],
  },
  'companion-buddy-c5': {
    ...generic,
    setup: [
      'Charge the unit fully, then wake it with the top button and pair it in the app.',
      'Attach the compact vacuum module until the status light glows white.',
      'Set the speed dial to Low for occupied homes, Standard for empty rooms.',
      'Run the welcome routine, which calibrates obstacle stopping distance.',
    ],
    mapping: [
      'Guide the robot through each room once in learn mode at Low speed.',
      'Label rooms and mark pet zones and children’s play areas as slow zones.',
      'Review the route heat map after the first week and adjust schedules.',
      'Re-learn rooms after moving charging docks or gates.',
    ],
    features: [
      'Gentle bumper with give-way response around people and pets.',
      'Compact profile that cleans close to furniture legs and corners.',
      'Voice announcements so household members know when it is active.',
      'One-touch pause on top of the unit.',
    ],
  },
  'tidysweep-mini': {
    ...generic,
    setup: [
      'Peel the protective film from the bumpers and charge the mini unit fully.',
      'Attach the sweep cassette and confirm the small dust drawer is closed.',
      'Pair the robot in the app and set the boundary strip around delicate areas.',
      'Start in a small room for the first run to verify cleaning quality.',
    ],
    mapping: [
      'Let it scan one room at a time; small units map best in smaller passes.',
      'Lay boundary strips where you do not want it to cross.',
      'Store a named map per client home so future visits start instantly.',
      'Re-scan a room if the app reports repeated coverage gaps.',
    ],
    features: [
      'Palm-sized footprint for bathrooms, stairs landings and tight corners.',
      'Wet-dry sweep cassette for light mop passes.',
      'Magnetic boundary strips included in the kit.',
      'Two-minute swap between sweep and spot-vacuum modes.',
    ],
  },
};

export function getGuide(slug: string, name: string): RobotGuide {
  const known = guides[slug];
  if (known) return { ...known, videos: videosFor(name) };
  return { ...generic, videos: videosFor(name) };
}
