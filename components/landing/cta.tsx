import { Arrow, Container, LinkButton } from "./primitives";

export function CallToAction() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden py-24 md:py-36">
      {/* 12-column ghost grid — the page's underlying structure made visible once */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="mx-auto grid h-full max-w-[1440px] grid-cols-12 gap-4 px-4 md:gap-6 md:px-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-x border-line" />
          ))}
        </div>
      </div>
      <Container className="relative">
        <div className="label-mono flex items-center gap-2">
          <span className="text-accent">08</span> — Begin
        </div>
        <h2 id="cta-title" className="mt-8 font-display text-[clamp(3rem,10vw,10rem)] font-bold leading-[0.86] tracking-[-0.055em] text-fg">
          Begin with a grid.
          <br />
          <span className="text-muted">End with a</span> poster<span className="ml-[0.04em] inline-block h-[0.16em] w-[0.16em] bg-accent" aria-hidden />
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
          <p className="max-w-md text-[15px] leading-relaxed text-muted md:col-span-5 md:col-start-1">
            Free to start. Your projects stay on your device until you choose to publish — no account needed to design.
          </p>
          <div className="flex flex-wrap gap-3 md:col-span-6 md:col-start-7 md:justify-end">
            <LinkButton href="/create">
              Start Creating <Arrow />
            </LinkButton>
            <LinkButton href="/templates" variant="secondary">
              Browse Templates
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
