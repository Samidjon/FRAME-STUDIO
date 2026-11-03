import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteShell } from "@/components/navigation/site-header";
import { TemplatesCatalogue } from "@/components/templates/templates-catalogue";

export const metadata: Metadata = {
  title: "Templates",
  description: "Professional, fully editable starter compositions: Swiss, brutalist, editorial, album art, posters and wallpapers.",
};

function CatalogueFallback() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-14 md:px-8" aria-busy="true">
      <div className="label-mono">
        <span className="text-accent">01</span> Templates
      </div>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse border border-line bg-sunken" />
        ))}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <SiteShell>
      <Suspense fallback={<CatalogueFallback />}>
        <TemplatesCatalogue />
      </Suspense>
    </SiteShell>
  );
}
