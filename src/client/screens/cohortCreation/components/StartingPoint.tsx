import type { StartingPoint as StartingPointValue } from '@/src/shared/cohort-creation/contracts';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Search, Target, Upload } from 'lucide-react';
import { StartingPointArt } from './StartingPointArt';
import { InkUnderline } from './InkUnderline';
import styles from './StartingPoint.module.css';

const choices = [
  { value: 'have_material', label: 'I already have material', description: 'A playlist, PDF, articles, videos, GitHub repo, Notion pages…', icon: Upload },
  { value: 'find_material', label: 'Find material for me', description: 'I know what I want to learn. Help me find the best resources.', icon: Search },
  { value: 'have_goal', label: 'I just have a goal', description: 'Help me figure out the rest — the material, structure, pacing, and everything in between.', icon: Target },
] satisfies { value: StartingPointValue; label: string; description: string; icon: typeof Upload }[];
export function StartingPoint({ selected, onSelect, onBack, disabled = false, compact = false }: { selected: StartingPointValue | null; onSelect: (choice: StartingPointValue) => void; onBack: () => void; disabled?: boolean; compact?: boolean }) {
  if (compact) return <nav aria-label="Starting point" className={styles.compact}>
    <button type="button" disabled={disabled} onClick={onBack} aria-label="Back to recommendations"><ArrowLeft size={16} /></button>
    {choices.map(choice => <button key={choice.value} type="button" disabled={disabled} aria-pressed={selected === choice.value}
      onClick={() => onSelect(choice.value)}>{choice.label}</button>)}
  </nav>;
  return <section aria-label="Starting point" className={styles.starting} data-selected={!!selected}>
    <div className={styles.decorations} aria-hidden="true">
      <span className={styles.edgePhoto}><Image src="/images/hero-collage/real-mountains.jpg" alt="" fill sizes="200px" /></span>
      <span className={styles.edgeNote}>Your interests.<br />Your pace.<br />Your people.</span>
      <span className={styles.bottomPhoto}><Image src="/images/hero-collage/real-cathedral.jpg" alt="" fill sizes="260px" /></span>
      <span className={styles.bottomNote}>A more<br />curious<br />tomorrow.</span>
      <span className={styles.bottomLine} />
    </div>
    <header className={styles.heading}><p className={styles.eyebrow}>Let’s make yours</p>
      <h1>What are you<br /><span>starting with?<InkUnderline className={styles.underline} /></span></h1>
      <p className={styles.subtitle}>Pick the option that feels closest, or just tell me in your own words.</p>
      <span className={styles.annotation} aria-hidden="true">Different<br />starting points.<br />Same destination<br />— a deeper you.</span>
    </header>
    <div className={styles.cards}>
      {choices.map(choice => <button className={styles.choice} key={choice.value} type="button" disabled={disabled}
        aria-label={choice.label} aria-pressed={selected === choice.value} onClick={() => onSelect(choice.value)}>
        <StartingPointArt kind={choice.value} />
        <span className={styles.choiceBody}><span className={styles.choiceIcon}><choice.icon size={29} strokeWidth={1.5} /></span>
          <span className={styles.choiceTitle}>{choice.value === 'find_material' ? <>Find material<br />for me</> : choice.label}</span><span className={styles.description}>{choice.description}</span>
          <span className={styles.arrow}><ArrowRight size={23} /></span>
        </span>
      </button>)}
    </div>
    <div className={styles.navigation}>{selected && <p role="status">Starting point saved to your account.</p>}
      <button type="button" disabled={disabled} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to recommendations</button>
    </div>
  </section>;
}
