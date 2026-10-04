import type { DbErrorCode, KochiAreaId } from "@cape001/core";

// All user-facing text for the website. To add a language, create e.g. `ml.ts` exporting
// `const ml: Messages = { ... }` and register it in ./index.ts. Placeholders like {name} are
// filled with `format()` from ./index.ts.

export const en = {
  meta: {
    /** Locale for Intl date/number formatting. */
    intlLocale: "en-IN",
    htmlLang: "en-IN",
  },

  site: {
    name: "Cape 001",
    tagline: "Book barber and salon appointments in Kochi",
    description:
      "Find barbers and salons near you in Kochi and book a time in seconds. See prices, pick your barber, no waiting.",
    nav: {
      myBookings: "My bookings",
      home: "Cape 001 home",
    },
    footer: "Cape 001 · Kochi, Kerala",
  },

  areas: {
    edappally: "Edappally",
    kakkanad: "Kakkanad",
    "fort-kochi": "Fort Kochi",
    kaloor: "Kaloor",
    vyttila: "Vyttila",
    aluva: "Aluva",
  } satisfies Record<KochiAreaId, string>,

  home: {
    title: "Your next haircut, booked in a minute",
    subtitle: "Find barbers near you, see prices and free times, and book without calling.",
    useLocation: "Use my current location",
    locating: "Finding your location…",
    orPickArea: "Or choose an area",
    locationDenied: "Location access is off. Choose your area below instead.",
    locationUnavailable: "We couldn't get your location. Choose your area below instead.",
  },

  results: {
    title: "Barbers near you",
    titleNearArea: "Barbers near {area}",
    changeLocation: "Change",
    count: "{count} shops within {radius}",
    countOne: "1 shop within {radius}",
    fromPrice: "from {price}",
    away: "{distance} away",
    noResultsTitle: "No shops found nearby",
    noResultsBody: "There are no shops on Cape 001 within {radius} yet.",
    searchWider: "Search within {radius}",
    pickAnotherArea: "Choose another area",
    invalidLocation: "That location doesn't look right. Please choose your area again.",
  },

  shop: {
    book: "Book an appointment",
    services: "Services",
    barbers: "Barbers",
    address: "Address",
    openInMaps: "Open in Maps",
    call: "Call {phone}",
    minutes: "{count} min",
    noServices: "This shop hasn't listed any services yet.",
    photoAlt: "Photo of {name}",
    placeholderAlt: "{name} — no photos yet",
    metaTitle: "{name} — barber in {area}, {city}",
    metaDescription: "Book {name} in {area}, {city}. {services}. Prices from {price}. Choose your barber and time online.",
    notFound: "Shop not found",
  },

  booking: {
    title: "Book at {shop}",
    back: "Back",
    change: "Change",
    steps: {
      service: "Choose a service",
      barber: "Choose a barber",
      date: "Choose a date",
      slot: "Choose a time",
      confirm: "Confirm your booking",
    },
    anyBarber: "Any available barber",
    anyBarberHint: "We'll pick whoever is free at your time",
    today: "Today",
    tomorrow: "Tomorrow",
    loadingSlots: "Loading free times…",
    noSlots: "No free times on this day. Try another date.",
    slotsError: "We couldn't load free times. Please try again.",
    retry: "Try again",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    summary: {
      service: "Service",
      barber: "Barber",
      when: "When",
      price: "Price",
      shop: "Shop",
    },
    notesLabel: "Notes for the barber (optional)",
    notesPlaceholder: "e.g. short on the sides",
    nameLabel: "Your name",
    nameHint: "So the shop knows who to expect.",
    loginToConfirm: "Log in with your phone number to confirm",
    confirm: "Confirm booking",
    confirming: "Booking…",
    payAtShop: "Pay at the shop after your appointment.",
    slotTaken: "Sorry, someone just booked that time. Here are the latest free times — please pick another.",
  },

  auth: {
    phoneLabel: "Mobile number",
    phonePrefix: "+91",
    phonePlaceholder: "98470 12345",
    sendCode: "Send code",
    sending: "Sending…",
    codeSentTo: "Enter the 6-digit code sent to {phone}",
    codeLabel: "Verification code",
    verify: "Verify and continue",
    verifying: "Verifying…",
    changeNumber: "Change number",
    resend: "Resend code",
    invalidPhone: "Enter a valid 10-digit Indian mobile number.",
    invalidCode: "Enter the 6-digit code.",
    wrongCode: "That code is incorrect or has expired. Please try again.",
    sendFailed: "We couldn't send the code. Please try again in a moment.",
    tooManyRequests: "Too many attempts. Please wait a minute and try again.",
    loginTitle: "Log in",
    loginSubtitle: "Use your mobile number to see and manage your bookings.",
    logout: "Log out",
  },

  confirmation: {
    title: "You're booked!",
    subtitle: "See you at {shop}.",
    detailsTitle: "Booking details",
    status: "Status",
    bookingId: "Booking ID",
    notes: "Your notes",
    viewAll: "View all my bookings",
    bookAnother: "Book another",
    cancelHint: "You can cancel until {time}.",
    cancelClosed: "Online cancellation closed at {time}. Please call the shop.",
  },

  bookings: {
    title: "My bookings",
    upcoming: "Upcoming",
    past: "Past",
    noUpcoming: "You have no upcoming bookings.",
    noPast: "No past bookings yet.",
    findShop: "Find a barber",
    cancel: "Cancel booking",
    cancelConfirm: "Cancel this booking?",
    cancelYes: "Yes, cancel",
    cancelNo: "Keep it",
    cancelling: "Cancelling…",
    cancelled: "Booking cancelled.",
    details: "Details",
  },

  status: {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "Missed",
  },

  errors: {
    generic: "Something went wrong. Please try again.",
    network: "You seem to be offline. Check your connection and try again.",
    notFoundTitle: "Page not found",
    notFoundBody: "The page you're looking for doesn't exist or has moved.",
    goHome: "Go to home",
    tryAgain: "Try again",
    invalidName: "Enter your name (2 to 60 characters).",
    codes: {
      NOT_AUTHENTICATED: "Please log in to continue.",
      NOT_AUTHORIZED: "You don't have permission to do that.",
      INVALID_REQUEST: "Something was missing from your request. Please try again.",
      INVALID_LOCATION: "That location doesn't look right. Please choose your area again.",
      SLUG_TAKEN: "That shop address is already taken.",
      SHOP_NOT_FOUND: "We couldn't find that shop.",
      SHOP_UNAVAILABLE: "This shop isn't taking bookings right now.",
      INVALID_BARBER: "That barber isn't available for booking.",
      INVALID_SERVICE: "That service isn't available any more.",
      SERVICE_NOT_OFFERED: "That barber doesn't offer this service. Please choose another.",
      SLOT_IN_PAST: "That time has already passed. Please pick a later time.",
      TOO_FAR_AHEAD: "That date is too far ahead for this shop.",
      OUTSIDE_WORKING_HOURS: "That time is outside working hours. Please pick another time.",
      INVALID_TIME: "Please pick one of the listed times.",
      BARBER_UNAVAILABLE: "The barber is away at that time. Please pick another time.",
      BOOKING_LIMIT_REACHED: "You already have 3 upcoming bookings. Cancel one or wait until after your next visit.",
      SLOT_TAKEN: "Sorry, someone just booked that time. Please pick another.",
      BOOKING_NOT_FOUND: "We couldn't find that booking.",
      BOOKING_NOT_CANCELLABLE: "This booking can't be cancelled any more.",
      CANCELLATION_WINDOW_PASSED: "It's too late to cancel online. Please call the shop.",
      INVALID_STATUS_TRANSITION: "That change isn't allowed for this booking.",
      LAST_OWNER: "A shop must keep at least one owner.",
      INVALID_NAME: "Enter your name (2 to 60 characters).",
      // Partner app only; listed so every code has a message.
      INVALID_PHONE: "Enter a 10-digit Indian mobile number.",
      PHONE_ALREADY_INVITED: "That phone number is already used for another barber.",
      BARBER_ALREADY_LINKED: "This barber is already linked to an account.",
      INVALID_WORKING_HOURS: "Those working hours don't look right.",
    } satisfies Record<DbErrorCode, string>,
  },
};

type DeepStringRecord<T> = { [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]> };

/** The shape every language file must match: same keys, any strings. */
export type Messages = DeepStringRecord<typeof en>;
