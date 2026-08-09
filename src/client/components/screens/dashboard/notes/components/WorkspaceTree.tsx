import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  Plus, 
  MoreHorizontal, 
  ChevronRight, 
  ChevronDown 
} from 'lucide-react';
import styles from '../Notes.module.css';

type FileNode = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FileNode[];
};

const mockData: FileNode[] = [
  {
    id: 'projects',
    name: 'Projects',
    type: 'folder',
    children: [
      { id: 'anytype', name: 'Anytype Redesign', type: 'file' },
      { id: 'marketing', name: 'Marketing Plan', type: 'file' },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    type: 'folder',
    children: [
      { id: 'ml', name: 'Machine Learning', type: 'file' },
      { id: 'design', name: 'Design Inspirations', type: 'file' },
    ],
  },
  { id: 'personal', name: 'Personal', type: 'folder', children: [] },
  {
    id: 'archive',
    name: 'Archive',
    type: 'folder',
    children: [{ id: 'getting-started', name: 'Getting Started', type: 'file' }],
  },
];

export const WorkspaceTree = ({ notes }: { notes: any }) => {
  const activeNotebookId = notes?.data?.selectedNotebook?.id;
  const activeNotes = notes?.state?.notes?.filter((n: any) => n.notebookId === activeNotebookId && !n.archived) || [];
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    projects: true,
    research: true,
  });

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const renderTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isFolder = node.type === 'folder';
      const isExpanded = isFolder && expandedFolders[node.id];
      const paddingLeft = `${level * 16 + 12}px`;

      return (
        <div key={node.id}>
          <div 
            className={styles.treeNode} 
            style={{ paddingLeft }}
            onClick={() => isFolder && toggleFolder(node.id)}
          >
            <div className={styles.treeNodeIcon}>
              {isFolder ? (
                <>
                  <span className={styles.treeChevron}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  {isExpanded ? <FolderOpen size={14} className={styles.folderIcon} /> : <Folder size={14} className={styles.folderIcon} />}
                </>
              ) : (
                <span className={styles.fileSpacer}>
                  <FileText size={14} className={styles.fileIcon} />
                </span>
              )}
            </div>
            <span className={styles.treeNodeLabel}>{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className={styles.treeChildren}>
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className={styles.workspaceTreeContainer}>
      <div className={styles.workspaceTreeHeader}>
        <div className={styles.workspaceTreeTitle}>
          <Folder size={16} />
          <span>Workspace</span>
        </div>
        <div className={styles.workspaceTreeActions}>
          <button className={styles.treeActionBtn} title="New" onClick={() => notes.actions.createNote()}>
            <Plus size={14} />
          </button>
          <button className={styles.treeActionBtn} title="More">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
      <div className={styles.workspaceTreeBody}>
        {activeNotes.map((note: any) => (
          <div 
            key={note.id} 
            className={styles.treeNode} 
            style={{ paddingLeft: '12px' }}
            onClick={() => notes.actions.selectNote(note.id)}
          >
            <div className={styles.treeNodeIcon}>
              <span className={styles.fileSpacer}>
                <FileText size={14} className={styles.fileIcon} />
              </span>
            </div>
            <span className={styles.treeNodeLabel}>{note.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
