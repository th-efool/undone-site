'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { useNotes } from './hooks/useNotes';
import { NotesDesktop } from './NotesDesktop';
import { NotesMobile } from '@/src/client/mobile/screens/Notes/NotesMobile';

export function Notes() {
  const experience = useExperience();
  const notes = useNotes();

  if (experience === 'mobile') {
    return <NotesMobile model={notes} />;
  }

  return <NotesDesktop model={notes} />;
}
