import { HealthProfileForm } from "@/components/profile/HealthProfileForm";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 border-b px-4 py-4 backdrop-blur">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Cài đặt</h1>
        <p className="text-muted-foreground text-sm">Hồ sơ và dinh dưỡng</p>
      </header>
      <HealthProfileForm showIntro={false} />
    </div>
  );
}
