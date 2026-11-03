import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteShell } from "@/components/navigation/site-header";
import { CreateStudio } from "@/components/create/create-studio";

export const metadata: Metadata = {
  title: "Create",
  description: "Start a new design: a blank canvas in any format, a professional template, or the algorithmic composition generator.",
};

function CreateFallback() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-14 md:px-8" aria-busy="true">
      <div className="label-mono">
        <span className="text-accent">02</span> Create
      </div>
      <div className="mt-6 h-16 w-2/3 animate-pulse bg-sunken" />
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse border border-line bg-sunken" />
        ))}
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <SiteShell>
      <Suspense fallback={<CreateFallback />}>
        <CreateStudio />
      </Suspense>
    </SiteShell>
  );
}
