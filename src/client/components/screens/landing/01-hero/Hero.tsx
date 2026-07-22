import { Section } from "@/src/client/components/global/layout/Section";
import { HeroNavbar } from "./heroNavbar";
import { HeroScene } from "./heroScene";
import { HeroContent } from "./heroContent";
import { HeroTicker } from "./heroTicker";

import styles from "./Hero.module.css";

export function Hero() {
  return (
      <Section
          hero
          background="transparent"
          className={styles.hero}
      >
          <HeroScene />
          <HeroNavbar />
          <HeroContent />
          <HeroTicker />

      </Section>
  );
}