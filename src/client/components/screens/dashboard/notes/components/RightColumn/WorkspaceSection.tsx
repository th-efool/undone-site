import { Folder, FileText, ChevronRight, ChevronDown, Plus, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import styles from './RightColumn.module.css';

interface Node {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: Node[];
}

const workspaceData: Node[] = [
  {
    id: '1',
    name: 'Projects',
    type: 'folder',
    children: [
      { id: '1-1', name: 'Anytype Redesign', type: 'file' },
      { id: '1-2', name: 'Marketing Plan', type: 'file' },
    ],
  },
  {
    id: '2',
    name: 'Research',
    type: 'folder',
    children: [
      { id: '2-1', name: 'Machine Learning', type: 'file' },
      { id: '2-2', name: 'Design Inspirations', type: 'file' },
    ],
  },
  {
    id: '3',
    name: 'Personal',
    type: 'folder',
    children: [],
  },
  {
    id: '4',
    name: 'Archive',
    type: 'folder',
    children: [],
  },
  {
    id: '5',
    name: 'Getting Started',
    type: 'file',
  }
];

export function WorkspaceSection() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    '1': true,
    '2': true
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (nodes: Node[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id} className={styles.treeItemWrapper}>
        <div 
          className={styles.treeItem}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => node.type === 'folder' && toggleExpand(node.id)}
        >
          {node.type === 'folder' && (
            <span className={styles.chevron}>
              {expanded[node.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {node.type === 'file' && <span className={styles.chevronSpacer} />}
          
          <span className={styles.treeIcon}>
            {node.type === 'folder' ? <Folder size={14} /> : <FileText size={14} />}
          </span>
          
          <span className={styles.treeName}>{node.name}</span>
          
          <div className={styles.treeActions}>
            <MoreHorizontal size={14} />
          </div>
        </div>
        
        {node.type === 'folder' && expanded[node.id] && node.children && (
          <div className={styles.treeChildren}>
            {renderTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className={styles.sectionContainer}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <Folder size={16} className={styles.sectionIcon} />
          <span>Workspace</span>
        </div>
        <div className={styles.sectionControls}>
          <button className={styles.textButton}>
            <Plus size={14} /> New
          </button>
          <button className={styles.iconButtonSmall}>
            <MoreHorizontal size={14} />
          </button>
        </div>
      </header>
      
      <div className={styles.workspaceTree}>
        {renderTree(workspaceData)}
      </div>
    </div>
  );
}
