import styles from './ExploreTopics.module.css';
import { LineChart, BriefcaseBusiness, PenLine, FlaskConical, Leaf, Ellipsis } from 'lucide-react';

interface Topic {
  id: string;
  name: string;
}

interface ExploreTopicsProps {
  topics: Topic[];
}

export function ExploreTopics({ topics }: ExploreTopicsProps) {
  const mappedTopics = [
    { id: '1', name: 'Data & AI', icon: <LineChart size={32} color="#6366f1" /> },
    { id: '2', name: 'Business', icon: <BriefcaseBusiness size={32} color="#f97316" /> },
    { id: '3', name: 'Design', icon: <PenLine size={32} color="#ec4899" /> },
    { id: '4', name: 'Science', icon: <FlaskConical size={32} color="#3b82f6" /> },
    { id: '5', name: 'Personal\nGrowth', icon: <Leaf size={32} color="#22c55e" /> },
  ];

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Explore by topic</h2>
        <button className={styles.viewAll}>View all</button>
      </header>
      
      <div className={styles.carouselContainer}>
        <div className={styles.carousel}>
          {mappedTopics.map((topic) => (
            <div key={topic.id} className={styles.card}>
              <div className={styles.iconWrapper}>
                {topic.icon}
              </div>
              <span className={styles.topicName}>{topic.name}</span>
            </div>
          ))}
          <div className={styles.card}>
             <div className={styles.iconWrapper}>
                <Ellipsis size={32} color="#64748b" />
              </div>
              <span className={styles.topicName}>More</span>
          </div>
        </div>
      </div>
      
    </section>
  );
}
