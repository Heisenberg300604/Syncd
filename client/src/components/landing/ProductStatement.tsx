import { Section } from "./Section";
import { ScrollReveal } from "../ui/ScrollReveal";

export function ProductStatement() {
  return (
    <Section id="product-statement" raised>
      <ScrollReveal animation="fade-up" distance={24} duration={850}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
            One room. One song. Everyone in sync.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-ink-muted">
            No complicated setup. No video calls. Just create a room, share the
            code, and start listening.
          </p>
        </div>
      </ScrollReveal>
    </Section>
  );
}
