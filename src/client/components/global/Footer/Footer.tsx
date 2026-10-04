import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Compass,
  MessageCircle,
  Layers3,
  FileText,
  ShieldCheck,
  Map,
  FolderOpen,
  Star,
  Search,
} from 'lucide-react';

import { Container } from '../layout/Container';
import { Stack } from '../layout/Stack';
import { Cluster } from '../layout/Cluster';
import { Divider } from '@/src/client/components/ui/Divider/Divider';
import { Logo } from '../Logo/Logo';

import styles from './Footer.module.css';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  description?: string;
}

const currentYear = new Date().getFullYear();

const productLinks = [
  {
    icon: <BookOpen size={16} />,
    label: 'AI Microlearning',
    href: '/features/microlearning',
  },
  {
    icon: <Layers3 size={16} />,
    label: 'Cohorts',
    href: '/cohort',
  },
  {
    icon: <Brain size={16} />,
    label: 'AI Study Planner',
    href: '/features/ai-study-planner',
  },
  {
    icon: <Compass size={16} />,
    label: 'Virtual Study Rooms',
    href: '/studyroom',
  },
];

const learnLinks = [
  {
    icon: <Map size={16} />,
    label: 'Roadmaps',
    href: '/explore',
  },
  {
    icon: <FolderOpen size={16} />,
    label: 'Curricula',
    href: '/explore',
  },
  {
    icon: <Star size={16} />,
    label: 'Trending Cohorts',
    href: '#community',
  },
  {
    icon: <Search size={16} />,
    label: 'Discover Topics',
    href: '#explore',
  },
];

const companyLinks = [
  {
    icon: <Compass size={16} />,
    label: 'How It Works',
    href: '#how-it-works',
  },
  {
    icon: <FileText size={16} />,
    label: 'Features',
    href: '#features',
  },
  {
    icon: <ShieldCheck size={16} />,
    label: 'Privacy Policy',
    href: '/policy',
  },
  {
    icon: <MessageCircle size={16} />,
    label: 'Terms of Service',
    href: '/terms',
  },
];

const resourceLinks = [
  {
    icon: <FileText size={16} />,
    label: 'Study Planner Guide',
    href: '/features/ai-study-planner',
  },
  {
    icon: <Compass size={16} />,
    label: 'Community',
    href: '#community',
  },
  {
    icon: <ShieldCheck size={16} />,
    label: 'FAQ',
    href: '#faq',
  },
  {
    icon: <Brain size={16} />,
    label: 'Begin Journey',
    href: '/auth',
  },
];

export function Footer({
  description = 'Every unfinished course, saved playlist, rabbit hole and late-night idea deserves another chance. Undone remembers where curiosity paused, so you can continue where inspiration left off.',
}: FooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.overlay} />

      <Container size="2xl">
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            {/* <div className={styles.badge}>
            
              <span>Built for Curious Minds</span>
            </div> */}

            <h2 className={styles.title}>
              Curiosity deserves more than
              <span className={styles.highlight}> bookmarks. </span>
              {/* <br />
               */}
            </h2>
            <div className={styles.heroDivider} />

            <p className={styles.description}>{description}</p>

            <Cluster
              gap="4"
              className={styles.actions}
            >
              {/* <Link
                href="#"
                className={styles.primaryButton}
              >
                Continue Your Journey
                <ArrowRight size={18} />
              </Link> */}

              {/* <Link
                href="#"
                className={styles.secondaryButton}
              >
                Explore SideQuestHQ
              </Link> */}
            </Cluster>
          </div>
        </section>

        <Divider className={styles.divider} />

        <section className={styles.linksGrid}>
          <Stack gap="4">
            <Logo />

            <p className={styles.brandText}>
              Curiosity with a finish line.
              <br />
              Learn consistently through AI-powered guidance, personalized learning journeys and
              meaningful progress.
            </p>
          </Stack>

          <Stack gap="5">
            <h4 className={styles.heading}>Product</h4>

            {productLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={styles.footerLink}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </Stack>

          <Stack gap="5">
            <h4 className={styles.heading}>Learn</h4>

            {learnLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={styles.footerLink}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </Stack>

          <Stack gap="5">
            <h4 className={styles.heading}>Company</h4>

            {companyLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={styles.footerLink}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </Stack>

          <Stack gap="5">
            <h4 className={styles.heading}>Resources</h4>

            {resourceLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={styles.footerLink}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </Stack>
        </section>

        <Divider className={styles.divider} />

        <div className={styles.bottomBar}>
          <small className={styles.copy}>
            © {currentYear} Undone. Curiosity with a finish line.
          </small>

          <Cluster gap="5">
            <Link
              href="https://github.com/th-efool/sidequesthq-site"
              className={styles.social}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>

            <Link
              href="https://x.com/undone"
              className={styles.social}
              target="_blank"
              rel="noopener noreferrer"
            >
              X
            </Link>

            <Link
              href="/policy"
              className={styles.social}
            >
              Privacy
            </Link>

            <Link
              href="/terms"
              className={styles.social}
            >
              Terms
            </Link>
          </Cluster>
        </div>
      </Container>
    </footer>
  );
}
