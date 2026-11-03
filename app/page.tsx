import { SiteShell } from "@/components/navigation/site-header";
import { Landing } from "@/components/landing/landing";

export default function HomePage() {
  return (
    <SiteShell>
      <Landing />
    </SiteShell>
  );
}
