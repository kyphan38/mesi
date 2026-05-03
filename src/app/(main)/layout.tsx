import { FirebaseAuthGate } from "@/components/auth/FirebaseAuthGate";
import { MobileMainNav } from "@/components/nav/mobile-main-nav";
import { MesiTasteProvider } from "@/components/providers/MesiTasteProvider";
import { ProfileSetupGate } from "@/components/profile/ProfileSetupGate";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FirebaseAuthGate>
      <ProfileSetupGate>
        <MesiTasteProvider>
          <div className="flex min-h-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
          <MobileMainNav />
        </MesiTasteProvider>
      </ProfileSetupGate>
    </FirebaseAuthGate>
  );
}
