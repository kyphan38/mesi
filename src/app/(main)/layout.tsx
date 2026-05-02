import { FirebaseAuthGate } from "@/components/auth/FirebaseAuthGate";
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
          <div className="flex flex-1 flex-col">{children}</div>
        </MesiTasteProvider>
      </ProfileSetupGate>
    </FirebaseAuthGate>
  );
}
