"use client";

import { CallToAction } from "./cta";
import { FeaturedTemplates } from "./featured-templates";
import { Formats } from "./formats";
import { GeneratorTeaser } from "./generator-teaser";
import { GridDemo } from "./grid-demo";
import { Hero } from "./hero";
import { Inspiration } from "./inspiration";
import { Tools } from "./tools";

/** FRAME STUDIO landing page — eight numbered sections on one 12-column system. */
export function Landing() {
  return (
    <>
      <Hero />
      <FeaturedTemplates />
      <Formats />
      <Tools />
      <GridDemo />
      <GeneratorTeaser />
      <Inspiration />
      <CallToAction />
    </>
  );
}
