export type ChatSuggestion = { id: string; label: string; prompt: string };

export function planningSuggestions(input: {
  goal?: string;
  firstLessonTitle?: string;
  asksAboutBackground: boolean;
}): ChatSuggestion[] {
  const goal = input.goal?.trim();
  return [
    input.firstLessonTitle
      ? {
          id: 'objectives',
          label: 'Refine objectives',
          prompt: `Refine the objectives for ${input.firstLessonTitle}`,
        }
      : {
          id: 'syllabus',
          label: goal ? 'Draft a syllabus' : 'Choose a goal',
          prompt: goal ? `Draft a deep-dive syllabus for ${goal}` : 'Help me choose a learning goal',
        },
    input.asksAboutBackground || !goal
      ? {
          id: 'background',
          label: 'Assess my background',
          prompt: `Help me assess my current background${goal ? ` for ${goal}` : ''}`,
        }
      : {
          id: 'projects',
          label: 'Add projects',
          prompt: `Add hands-on projects for ${goal}`,
        },
    {
      id: 'pace',
      label: 'Set my pace',
      prompt: 'Help me choose a realistic daily study pace. Ask about my available time first.',
    },
  ];
}

export function stageSuggestions(
  step: string | undefined,
  input: {
    goal?: string;
    firstLessonTitle?: string;
    asksAboutBackground: boolean;
  }
): ChatSuggestion[] {
  if (step === 'chat' || step === 'review') {
    return planningSuggestions(input).slice(0, 3);
  }
  if (step === 'recommendations') {
    return [
      { id: 'advanced', label: 'Advanced options', prompt: 'Show more advanced ones' },
      { id: 'practical', label: 'Practical options', prompt: 'I want something more practical' },
      { id: 'create_own', label: 'Create my own', prompt: 'I’ll create my own instead' },
    ].slice(0, 3);
  }
  if (step === 'discovery') {
    return [
      { id: 'search_again', label: 'Search again', prompt: 'Search again' },
      { id: 'own_sources', label: 'Provide my sources', prompt: 'I’ll provide my own sources instead' },
    ].slice(0, 3);
  }
  if (step === 'goal_setup') {
    return [
      { id: 'daily_time', label: 'Set daily time', prompt: '30 minutes per day' },
      { id: 'experience', label: 'Set experience', prompt: 'For intermediate developers' },
    ].slice(0, 3);
  }
  if (step === 'starting_point' || step === 'material_input') {
    return [
      { id: 'playlist', label: 'Add a playlist', prompt: 'I have a YouTube playlist' },
      { id: 'find_material', label: 'Find materials', prompt: 'Find material for me' },
      { id: 'start_goal', label: 'Start with a goal', prompt: 'I just have a goal' },
    ].slice(0, 3);
  }
  if (step === 'processing') {
    return [
      { id: 'view_progress', label: 'View progress', prompt: 'Show understanding progress' },
      { id: 'review_chunks', label: 'Review chunks', prompt: 'Show chunking details' },
      { id: 'cancel_processing', label: 'Cancel processing', prompt: 'Cancel processing' },
    ].slice(0, 3);
  }
  if (step === 'ready') {
    return [
      { id: 'open_experience', label: 'Open experience', prompt: 'Show my learning experience' },
      { id: 'review_cohort', label: 'Review cohort', prompt: 'Review my cohort' },
      { id: 'next_steps', label: 'Next steps', prompt: 'What happens next?' },
    ].slice(0, 3);
  }
  if (step === 'published') {
    return [
      { id: 'view_cohort', label: 'Open cohort', prompt: 'View cohort page' },
      { id: 'start_learning', label: 'Start learning in feed', prompt: 'Start learning in feed' },
    ].slice(0, 3);
  }
  return [
    { id: 'shorter_desc', label: 'Shorter description', prompt: 'Make the description shorter' },
    { id: 'clearer_title', label: 'Clearer title', prompt: 'Make the title clearer' },
    { id: 'clarify_obj', label: 'Clarify objectives', prompt: 'Clarify the learning objectives' },
  ].slice(0, 3);
}
