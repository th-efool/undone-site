import { messagesRepository } from '@/src/client/repositories/messagesRepository';
import {
  CommunityChatModel,
  ConversationPreview,
  LiveSession,
  RecentMessage,
  UpcomingEvent,
} from '../models';

import { communityChatMock } from '../mock/communityChat.mock';

type Cohort = ReturnType<typeof messagesRepository.getEnrolledCohorts>[number];

const onlineCounts = [98, 64, 41, 22, 37, 18, 29, 33];
const avatars = [
  '/mock/avatars/a.webp',
  '/mock/avatars/b.webp',
  '/mock/avatars/c.webp',
  '/mock/avatars/d.webp',
  '/mock/avatars/e.webp',
];
const people = ['Maya Chen', 'Jordan Lee', 'Priya Shah', 'Noah Kim', 'Ava Patel'];
const eventTones: UpcomingEvent['tone'][] = ['purple', 'orange', 'blue'];

type CommunityConversationTemplate = {
  messages: string[];
  pinnedMessages: string[];
  reactions: string[];
  media: string[];
};

const communityConversationTemplates: Record<string, CommunityConversationTemplate> = {
  'deep-work-mastery': {
    messages: [
      'Starting my second 90-minute focus block now. Phone is in another room and Freedom is locked in.',
      'The shutdown ritual from Cal Newport is helping me stop context switching at night.',
      'How are you tracking deep work hours without turning the tracker into another distraction?',
      'Shared my weekly depth scorecard template for anyone who wants to copy it.',
      'Win: finished the architecture memo before Slack opened this morning.',
    ],
    pinnedMessages: [
      'Post your weekly depth score before Friday review.',
      'Focus block tracker and shutdown ritual template',
      'Bring one distraction audit note to the next Deep Work clinic.',
    ],
    reactions: ['🧠', '✅', '🌲'],
    media: ['/images/landing/before-sleep.webp', '/images/auth/phone.webp'],
  },
  'system-design-bootcamp': {
    messages: [
      'Design review starts soon. Bring your API gateway trade-offs and capacity estimates.',
      'The ByteByteGo cache invalidation diagram made the read path much clearer.',
      'For the chat app exercise, are we assuming fanout-on-write or fanout-on-read?',
      'Uploaded my back-of-the-envelope sizing notes for the URL shortener prompt.',
      'Progress check: nailed load balancer vs reverse proxy differences today.',
    ],
    pinnedMessages: [
      "Tonight's mock interview uses the notification service prompt.",
      'System design sizing cheatsheet and diagram kit',
      'Review CAP, queues, and cache patterns before the next session.',
    ],
    reactions: ['🧩', '👍', '📌'],
    media: ['/images/landing/screen.webp', '/images/auth/claude.webp'],
  },
  'history-psychology': {
    messages: [
      'CrashCourse recap starts in 10. Today is behaviorism, conditioning, and the Skinner box debate.',
      'The timeline from Wundt to cognitive psychology finally feels less jumbled now.',
      "Can someone explain how Freud's psychoanalysis differs from humanistic psychology for the quiz?",
      'Added flashcards for Pavlov, Watson, Skinner, and Maslow in the resources channel.',
      'Progress check: finished the memory and learning practice questions.',
    ],
    pinnedMessages: [
      'Behaviorism discussion prompts are due before recap.',
      'Psychology timeline flashcards and quiz notes',
      "Review major schools of thought before tomorrow's mini-test.",
    ],
    reactions: ['📝', '🤔', '✅'],
    media: ['/images/auth/maker.webp', '/images/landing/hand.webp'],
  },
  'german-language-a1': {
    messages: [
      'Sprechstunde begins soon. Warm up with greetings, numbers, and the accusative article drill.',
      'The der/die/das color coding from Learn German is finally sticking for me.',
      'Can someone check my sentence: Ich möchte einen Kaffee und eine Brezel?',
      'Shared the audio list for Kapitel 4 pronunciation practice.',
      'Win: ordered lunch in German practice without checking notes once.',
    ],
    pinnedMessages: [
      "Record a 30-second self-introduction before Sunday's speaking room.",
      'A1 article chart and Kapitel 4 audio list',
      'Practice accusative food-ordering phrases before next session.',
    ],
    reactions: ['🇩🇪', '👏', '🎧'],
    media: ['/mock/thumbnails/german.webp', '/images/landing/before-sleep.webp'],
  },
  'advanced-javascript': {
    messages: [
      "While this cohort is paused, I'm reviewing closures and event loop notes from Frontend Masters.",
      'The generator exercises make async iteration click better than the slides did.',
      'When we resume, can we revisit prototype chains before jumping into performance?',
      'Dropped a small debounce/throttle sandbox in resources for anyone catching up.',
      'Paused progress check: modules and scopes are ready for the restart.',
    ],
    pinnedMessages: [
      'Paused cohort: use this thread for catch-up questions until restart.',
      'Advanced JS closure, prototype, and event loop resources',
      'Complete the debounce/throttle sandbox before the resume date.',
    ],
    reactions: ['💻', '⚡', '🙌'],
    media: ['/images/auth/claude.webp', '/images/landing/screen.webp'],
  },
  'japanese-beginners': {
    messages: [
      "Paused week check-in: I'm keeping hiragana review alive with five-minute drills.",
      "Nihongo Lab's particles worksheet helped は vs が make more sense today.",
      'Can someone listen to my こんにちは / こんばんは pronunciation clip when you have time?',
      'Added a Genki-style vocab list for family words in the resources channel.',
      'Small win: read all the kana on the snack packaging practice sheet.',
    ],
    pinnedMessages: [
      'Paused cohort: keep daily kana streaks posted here.',
      'Hiragana, katakana, and particles catch-up pack',
      'Review family vocab and は/が examples before resuming.',
    ],
    reactions: ['🇯🇵', '🎧', '✨'],
    media: ['/mock/thumbnails/japanese.webp', '/images/auth/phone.webp'],
  },
  'ancient-civilizations': {
    messages: [
      "Museum map thread is open while the cohort is paused. Today I'm comparing Mesopotamia and Egypt timelines.",
      'The irrigation systems reading made the city-state trade routes easier to understand.',
      "Does anyone have a clean summary of Indus Valley seals and what we still don't know?",
      'Posted the Bronze Age collapse documentary notes in resources.',
      'Progress check: finished the Hammurabi code primary-source questions.',
    ],
    pinnedMessages: [
      'Paused cohort: add timeline notes for Mesopotamia, Egypt, Indus, and China.',
      'Ancient civilizations map pack and documentary notes',
      'Bring one primary-source observation to the resume session.',
    ],
    reactions: ['🏺', '📜', '🤯'],
    media: ['/mock/thumbnails/ancient.webp', '/images/landing/hand.webp'],
  },
  'data-storytelling': {
    messages: [
      "Paused cohort studio: I'm revising my chart headline so the takeaway appears first.",
      "Observable's annotation examples helped me remove three unnecessary colors from the dashboard.",
      'Can someone critique whether this slope chart beats a grouped bar chart for the retention story?',
      'Shared a before/after notebook for the messy sales dataset in resources.',
      'Win: turned the KPI dump into a three-slide narrative arc.',
    ],
    pinnedMessages: [
      'Paused cohort: post one chart makeover before the next critique.',
      'Data storytelling critique checklist and Observable notebooks',
      'Review headline, annotation, and chart choice prompts before resuming.',
    ],
    reactions: ['📊', '💡', '👏'],
    media: ['/images/landing/screen.webp', '/images/auth/maker.webp'],
  },
};

function getCommunityConversationTemplate(
  cohort: Cohort,
  paused: boolean,
): CommunityConversationTemplate {
  const template = communityConversationTemplates[cohort.id];
  if (template) return template;
  return {
    messages: [
      `${cohort.title} checkpoint starts soon. Drop questions and wins here.`,
      `This ${cohort.provider} explanation finally made the next module click.`,
      `Can someone share notes for ${cohort.schedule.label}?`,
      `Queued up the next ${cohort.title} resource for review.`,
      `Progress check: ${cohort.progressPercent}% complete and moving.`,
    ],
    pinnedMessages: [
      paused
        ? `${cohort.title} is paused. Catch-up thread stays open.`
        : `${cohort.title} checkpoint follows ${cohort.schedule.label}.`,
      `${cohort.provider} roadmap and resource list`,
      `Review ${cohort.title} practice prompts before the next session.`,
    ],
    reactions: ['🔥', '👏', '💡', '✅'],
    media: ['/images/landing/screen.webp', '/images/auth/maker.webp', '/images/auth/phone.webp'],
  };
}

export function getMessageCohorts(): Cohort[] {
  return messagesRepository.getEnrolledCohorts();
}

export function mapCohortToConversation(cohort: Cohort, index: number): ConversationPreview {
  const paused = 'pausedUntil' in cohort;
  const onlineCount = onlineCounts[index % onlineCounts.length];

  return {
    id: cohort.id,
    kind: 'community',
    name: cohort.title,
    avatar: cohort.thumbnail,
    sender: cohort.provider,
    preview: paused
      ? `Paused • ${cohort.resumeLabel}`
      : `${cohort.progressPercent}% complete • ${cohort.schedule.label}`,
    timestamp: paused ? 'Paused' : '2m',
    onlineCount,
    unreadCount: !paused && index < 3 ? [4, 3, 2][index] : undefined,
    hasMention: !paused && index === 0,
    pinned: index === 1 || paused,
    statusLabel: paused ? 'PAUSED' : 'GROUP',
  };
}

export function mapCohortToLiveSession(cohort: Cohort, index: number): LiveSession {
  const onlineCount = onlineCounts[index % onlineCounts.length];

  return {
    id: cohort.id,
    title: cohort.title,
    thumbnail: cohort.thumbnail,
    avatars: avatars.slice(0, 4).map((avatar, avatarIndex) => ({
      id: `${cohort.id}-${avatarIndex}`,
      name: people[avatarIndex],
      avatar,
      online: true,
    })),
    status: `${onlineCount} learners online • ${cohort.progressPercent}% complete`,
    onlineCount,
    speakingCount: index === 0 ? 6 : undefined,
    live: index === 0,
    primary: index === 1,
  };
}

export function mapCohortToRecentMessage(cohort: Cohort, index: number): RecentMessage {
  const senderIndex = index % people.length;

  return {
    id: `recent-${cohort.id}`,
    sender: {
      id: `${cohort.id}-mentor`,
      name: index === 0 ? cohort.provider : people[senderIndex],
      avatar: avatars[senderIndex],
      online: index < 3,
    },
    community: cohort.title,
    message: `New checkpoint posted for ${cohort.title}. Next session follows ${cohort.schedule.label}.`,
    timestamp: index === 0 ? '2m' : `${(index + 1) * 8}m`,
    unreadCount: index < 3 ? 4 - index : undefined,
    live: index === 0,
  };
}

export function mapCohortToUpcomingEvent(cohort: Cohort, index: number): UpcomingEvent {
  return {
    id: `event-${cohort.id}`,
    title: `${cohort.title} Group Session`,
    subtitle: `${cohort.provider} • ${cohort.schedule.label}`,
    startsIn: ['Starts in 8m', 'Starts in 18m', 'Today, 8:00 PM', 'Tomorrow, 7:30 PM'][index % 4],
    tone: eventTones[index % eventTones.length],
  };
}

export function mapCohortToCommunity(cohortId: string | null): CommunityChatModel {
  const cohorts = getMessageCohorts();
  const cohort = cohorts.find((item) => item.id === cohortId) ?? cohorts[0];
  const index = cohorts.findIndex((item) => item.id === cohort.id);
  const paused = 'pausedUntil' in cohort;

  const template = getCommunityConversationTemplate(cohort, paused);

  return {
    ...communityChatMock,
    id: cohort.id,
    name: cohort.title,
    avatar: cohort.thumbnail,
    description: `${cohort.provider} course group • ${cohort.progressPercent}% complete`,
    onlineCount: onlineCounts[Math.max(index, 0) % onlineCounts.length],
    pinnedAnnouncement: {
      author: cohort.provider,
      title: paused
        ? `${cohort.title} is paused. Group stays open for resources and questions.`
        : `${cohort.title} checkpoint follows ${cohort.schedule.label}.`,
      actionLabel: paused ? 'View Resources' : 'Join Session',
    },
    createdBy: cohort.provider,
    createdAt: ['Jan 12, 2026', 'Feb 3, 2026', 'Mar 18, 2026', 'Apr 6, 2026'][
      Math.max(index, 0) % 4
    ],
    members: avatars.map((avatar, memberIndex) => ({
      id: `${cohort.id}-member-${memberIndex}`,
      name: people[(memberIndex + Math.max(index, 0)) % people.length],
      avatar,
      online: memberIndex < 3 + (Math.max(index, 0) % 2),
    })),
    channels: [{ id: 'general', label: '# general' }],
    messages: communityChatMock.messages.map((message, messageIndex) => {
      const image = template.media[messageIndex % template.media.length];
      const hasAttachment = (messageIndex + Math.max(index, 0)) % 3 === 1;
      return {
        ...message,
        author: {
          id: `${cohort.id}-${messageIndex}`,
          name: people[(messageIndex + Math.max(index, 0)) % people.length],
          avatar: avatars[(messageIndex + Math.max(index, 0)) % avatars.length],
          online: messageIndex < 4,
        },
        id: `${cohort.id}-${message.id}`,
        timestamp: [
          `Today at ${4 + messageIndex}:1${messageIndex} PM`,
          `Yesterday at ${8 + messageIndex}:0${messageIndex} PM`,
          `Mon at ${10 + messageIndex}:2${messageIndex} AM`,
        ][Math.max(index + messageIndex, 0) % 3],
        body: message.body
          ? (template.messages[messageIndex] ?? message.body)
          : (template.messages[messageIndex] ?? message.body),
        reactions: [
          {
            emoji: template.reactions[messageIndex % template.reactions.length],
            count: 3 + messageIndex + Math.max(index, 0),
          },
          ...(messageIndex % 2 ? [{ emoji: '👏', count: 2 + messageIndex }] : []),
        ],
        replies:
          messageIndex === Math.max(index, 0) % 4
            ? {
                avatars: avatars.slice(0, 3).map((avatar, replyIndex) => ({
                  id: `${cohort.id}-reply-${replyIndex}`,
                  name: people[(replyIndex + 1) % people.length],
                  avatar,
                })),
                count: 2 + (Math.max(index, 0) % 4),
                lastReplyBy: people[(messageIndex + 2) % people.length],
                timestamp: `${5 + messageIndex}:4${messageIndex} PM`,
              }
            : undefined,
        attachment: hasAttachment
          ? {
              id: `${cohort.id}-asset-${messageIndex}`,
              kind: messageIndex % 2 ? 'image' : 'pdf',
              title:
                messageIndex % 2
                  ? `${cohort.title} snapshot`
                  : `${cohort.title.replaceAll(' ', '_')}_notes.pdf`,
              url: messageIndex % 2 ? image : undefined,
              caption: `${cohort.title} working notes`,
              meta: messageIndex % 2 ? 'Mock image' : '1.2 MB · PDF',
            }
          : undefined,
      };
    }),
    pinnedMessages: communityChatMock.pinnedMessages.map((message, messageIndex) => ({
      ...message,
      id: `${cohort.id}-${message.id}`,
      preview: template.pinnedMessages[messageIndex] ?? message.preview,
    })),
    media: template.media.map((url, mediaIndex) => ({
      id: `${cohort.id}-media-${mediaIndex}`,
      kind: 'image',
      title: `${cohort.title} media ${mediaIndex + 1}`,
      url,
    })),
    events: [
      mapCohortToUpcomingEvent(cohort, Math.max(index, 0)),
      ...communityChatMock.events.slice(Math.max(index, 0) % 2),
    ],
  };
}
