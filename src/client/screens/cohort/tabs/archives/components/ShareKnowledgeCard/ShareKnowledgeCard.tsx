import type { CohortArchives } from '../../../../models';

import styles from '../../Archives.module.css';

export function ShareKnowledgeCard({ archives }: { archives: CohortArchives }) {
  const cta = archives.shareKnowledge;
  return (
    <section className={styles.share}>
      <span>{cta.illustration}</span>
      <div>
        <h3>{cta.title}</h3>
        <p>{cta.description}</p>
        <button>{cta.buttonLabel}</button>
      </div>
    </section>
  );
}
