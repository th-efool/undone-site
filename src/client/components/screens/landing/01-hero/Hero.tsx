import { Section } from "@/src/client/components/global/layout/Section";
import { HeroNavbar } from "./heroNavbar";
import { HeroScene } from "./heroScene";
import { HeroContent } from "./heroContent";
import { HeroTicker } from "./heroTicker";
import {HeroRibbon} from "@/src/client/components/screens/landing/01-hero/heroRibbon";
import { HeroFloatingContentIcons } from "./heroFloatingContentIcons";
import styles from "./Hero.module.css";

export function Hero() {
  return (
      <Section
          hero
          background="transparent"
          className={styles.hero}
      >
          <HeroFloatingContentIcons />
          <HeroRibbon />
          <HeroScene />
          <HeroNavbar />
          <HeroContent />
          <HeroTicker />
      </Section>
  );
}