import { FirebaseAuthGate } from "@/components/auth/FirebaseAuthGate";
import { ProfileSetupGate } from "@/components/profile/ProfileSetupGate";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FirebaseAuthGate>
      <ProfileSetupGate>
        <div className="flex flex-1 flex-col">{children}</div>
      </ProfileSetupGate>
    </FirebaseAuthGate>
  );
}
