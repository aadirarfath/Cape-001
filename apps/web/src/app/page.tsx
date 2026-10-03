import { LocationPicker } from "@/components/shops/location-picker";
import { getMessages } from "@/i18n";

export default function Home() {
  const m = getMessages();

  return (
    <div className="space-y-8">
      <div className="space-y-2 pt-4">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{m.home.title}</h1>
        <p className="text-muted-foreground text-pretty">{m.home.subtitle}</p>
      </div>
      <LocationPicker />
    </div>
  );
}
