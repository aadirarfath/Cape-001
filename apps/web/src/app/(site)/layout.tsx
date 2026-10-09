// Inner pages (search, shop, booking, my bookings, login) share a narrow reading column. The home
// page sits outside this group because its sections are full-bleed. Top padding clears the
// floating navbar.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-28">{children}</main>;
}
