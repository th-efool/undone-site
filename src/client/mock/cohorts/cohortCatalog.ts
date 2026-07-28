import { ArchiveType, EventStatus, LessonStatus, LessonType, SeasonStatus } from "@/src/client/components/screens/cohort/models";
import type { Cohort } from "@/src/client/components/screens/cohort/models";
import { cohortMock as deepWorkMastery } from "@/src/client/components/screens/cohort/mocks/cohortMock";

type Seed = {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    coverImage: string;
    difficulty: Cohort["difficulty"];
    categories: string[];
    creator: { id: string; name: string; avatarUrl: string; role: string; bio: string };
    stats: Cohort["stats"];
    progress: Cohort["progress"];
    focus: string;
    outcomes: string[];
    season: string;
    lessons: string[];
    events: string[];
    archiveTypes: ArchiveType[];
    legends: string[];
};

const avatars = ["/mock/avatars/a.webp", "/mock/avatars/b.webp", "/mock/avatars/c.webp", "/mock/avatars/d.webp", "/mock/avatars/e.webp"];

function cat(label: string) { return { id: label.toLowerCase().replaceAll(" ", "-"), label }; }
function obj(text: string, index: number) { return { id: `${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, text }; }
function stat(id: string, label: string, value: string) { return { id, icon: "target" as const, label, value }; }
function chunks(duration: string) { return Math.max(2, Math.round((Number(duration.match(/\d+/)?.[0]) || 12) / 3.5)); }

function build(seed: Seed): Cohort {
    const filters = deepWorkMastery.questline.filters;
    const progress = seed.progress;

    return {
        ...deepWorkMastery,
        id: seed.id,
        title: seed.title,
        subtitle: seed.subtitle,
        description: seed.description,
        coverImage: seed.coverImage,
        difficulty: seed.difficulty,
        categories: seed.categories.map(cat),
        creator: { ...seed.creator, ctaLabel: "View Quest Guide Profile" },
        stats: seed.stats,
        progress,
        overview: {
            description: `${seed.title} helps learners master ${seed.focus} through practical quests, focused projects, and community feedback.`,
            pillars: seed.outcomes.slice(0, 3).map((title, index) => ({ id: `pillar-${index}`, icon: ["target", "brain", "project"][index] as "target" | "brain" | "project", title, description: `Build durable skill in ${title.toLowerCase()}.` })),
            learningObjectives: seed.outcomes.concat(seed.lessons.slice(0, 3)).map(obj),
            journeySummary: [stat("duration", "Quest Length", `${12 + seed.lessons.length * 2} hours`), stat("quests", "Quests", `${seed.lessons.length * 8} quests`), stat("projects", "Projects", "3 projects")],
            expeditionStats: [stat("lessons", "Lessons", `${seed.lessons.length * 8}`), stat("seasons", "Seasons", "2"), stat("assignments", "Assignments", "8"), stat("projects", "Projects", "3"), stat("notes", "Public Notes", `${120 + seed.lessons.length * 7}`), stat("completion", "Estimated Completion", "3–5 weeks")],
            expeditionProgress: [stat("streak", "Current Streak", `${Math.max(3, Math.round(progress.journeyProgress / 4))} days`), stat("time", "Total Time Invested", `${Math.max(2, Math.round(progress.journeyProgress / 9))}h 20m`), stat("notes", "Field Notes Shared", `${Math.max(2, Math.round(progress.journeyProgress / 6))}`), stat("helpful", "Helpful Notes", `${Math.max(1, Math.round(progress.journeyProgress / 18))}`)],
            activeExplorers: avatars,
            activeExplorerOverflow: `+${Math.round(seed.stats.explorerCount / 45)}`,
        },
        questline: {
            ...deepWorkMastery.questline,
            title: `${seed.title} Questline`,
            description: `Complete hands-on quests for ${seed.focus}.`,
            filters,
            seasons: [{ id: "foundation", badge: "Season 1", title: seed.season, status: SeasonStatus.InProgress, progress: progress.journeyProgress, estimatedDuration: "~6 hrs", questCount: seed.lessons.length, summaryLabel: "View Season Summary", lessons: seed.lessons.map((title, index) => { const duration = index % 2 ? "12 min" : "18 min"; const totalChunks = chunks(duration); const status = index < 2 ? LessonStatus.Completed : index === 2 ? LessonStatus.InStream : LessonStatus.Ready; return { id: `${seed.id}-${index}`, title, type: index % 3 === 0 ? LessonType.Video : index % 3 === 1 ? LessonType.Reading : LessonType.Assignment, duration, status, totalChunks, completedChunks: status === LessonStatus.Completed ? totalChunks : status === LessonStatus.InStream ? Math.max(1, Math.floor(totalChunks / 2)) : 0, thumbnail: seed.coverImage }; }) }],
            feedTitle: `${seed.title} Assignments`,
            feedDescription: `Ship artifacts that prove your ${seed.focus} skills.`,
            assignmentFeed: seed.outcomes.slice(0, 3).map((title, index) => ({ id: `${seed.id}-assignment-${index}`, title, type: index === 2 ? LessonType.Project : LessonType.Assignment, description: `Create a practical ${title.toLowerCase()} artifact.`, duration: "~25 min", thumbnail: seed.coverImage, icon: index === 2 ? "project" : "assignment", participants: avatars.slice(0, 3).map((avatarUrl, i) => ({ id: `${seed.id}-p-${i}`, avatarUrl })), submittedCount: `+${90 + index * 47} submitted`, shareLabel: "Share Work", doneLabel: "Mark as Done" })),
        },
        events: {
            title: "Upcoming Events",
            description: `Live sessions and community practice for ${seed.title}.`,
            filters: deepWorkMastery.events.filters,
            upcomingEvents: seed.events.map((title, index) => ({ id: `${seed.id}-event-${index}`, date: { month: "May", day: String(18 + index * 4), weekday: ["Sun", "Thu", "Mon"][index % 3] }, title, description: `Join peers for ${title.toLowerCase()}.`, avatars: avatars.slice(0, 3).map((avatarUrl, i) => ({ id: `${seed.id}-a-${i}`, avatarUrl })), attendeeCount: `+${120 + index * 54} attending`, time: ["7:00 PM – 8:00 PM", "8:00 PM – 9:00 PM", "6:30 PM – 8:00 PM"][index % 3], timezone: "IST", platform: index % 2 ? "Zoom" : "Google Meet", status: index === 0 ? EventStatus.Upcoming : EventStatus.Live })),
            weeklySchedule: seed.events.slice(0, 3).map((title, index) => ({ id: `${seed.id}-week-${index}`, date: ["Sun, May 18", "Thu, May 22", "Mon, May 26"][index], time: ["7:00 PM", "8:00 PM", "6:30 PM"][index], title, icon: ["👥", "⚡", "🎯"][index] })),
            calendarSync: deepWorkMastery.events.calendarSync,
            suggestEvent: { title: "Suggest an Event", description: `Have a ${seed.focus} session idea?`, buttonLabel: "Suggest Event", illustration: "📝" },
        },
        archives: {
            title: "Archives",
            description: `Knowledge shared by ${seed.title} explorers.`,
            categories: deepWorkMastery.archives.categories,
            sortControls: deepWorkMastery.archives.sortControls,
            items: seed.outcomes.slice(0, 4).map((title, index) => ({ id: `${seed.id}-archive-${index}`, thumbnail: seed.coverImage, title: `${title} Playbook`, type: seed.archiveTypes[index % seed.archiveTypes.length], description: `A reusable resource for ${title.toLowerCase()}.`, author: { name: seed.legends[index % seed.legends.length], avatarUrl: avatars[index % avatars.length] }, publishedAt: index ? `${index + 2} days ago` : "Today", voteCount: 210 + index * 39, commentCount: 8 + index * 4 })),
            contributors: seed.legends.map((name, index) => ({ id: `${seed.id}-contrib-${index}`, name, avatarUrl: avatars[index % avatars.length], notes: 320 - index * 37 })),
            trending: seed.outcomes.slice(0, 5).map((title, index) => ({ id: `${seed.id}-trend-${index}`, title, score: `+${180 - index * 23}` })),
            shareKnowledge: { title: "Share your knowledge!", description: `Publish a resource for ${seed.title}.`, buttonLabel: "Create New Note", illustration: "🧾" },
        },
        hallOfFame: {
            title: "Hall of Fame",
            subtitle: `Celebrating ${seed.title} explorers who go above and beyond.`,
            filters: deepWorkMastery.hallOfFame.filters,
            timeRanges: deepWorkMastery.hallOfFame.timeRanges,
            categories: deepWorkMastery.hallOfFame.categories.map((item, index) => ({ ...item, winner: { name: seed.legends[index % seed.legends.length], avatarUrl: avatars[index % avatars.length] }, primaryMetric: ["12,450 XP", "8 Projects", "392 Notes", "183 Answers", "34 Days", "840 XP"][index] })),
            legends: seed.legends.slice(0, 3).map((name, index) => ({ id: `${seed.id}-legend-${index}`, rank: index + 1, avatarUrl: avatars[index], name, achievementTitle: ["All-time XP Leader", "Top Project Shipper", "Most Helpful Sage"][index], primaryMetric: ["48,920 XP", "21 Projects", "1,082 Notes"][index] })),
            userHighlights: deepWorkMastery.hallOfFame.userHighlights,
            recentAchievements: deepWorkMastery.hallOfFame.recentAchievements,
        },
    };
}

const seeds: Seed[] = [
    { id: "system-design-bootcamp", title: "System Design Bootcamp", subtitle: "Design scalable systems from first principles.", description: "Practice architecture interviews with realistic products, constraints, and trade-offs.", coverImage: "/mock/thumbnails/system-design.jpeg", difficulty: "Advanced", categories: ["Engineering", "Architecture", "Interviews"], creator: { id: "bytebytego", name: "ByteByteGo", avatarUrl: avatars[1], role: "System Design Educators", bio: "We teach distributed systems through visual architecture breakdowns." }, stats: { rating: 4.8, explorerCount: 9700, completionRate: 64 }, progress: { journeyProgress: 48, completedQuests: 28, totalQuests: 64, dailyGoal: "15 minutes of architecture practice", joinedDate: "June 2, 2026" }, focus: "scalable backend architecture", outcomes: ["Capacity Planning", "API Design", "Caching Strategy", "Reliable Queues", "Database Tradeoffs"], season: "Foundations of Scale", lessons: ["Back-of-the-envelope Math", "Load Balancers", "Cache Invalidation", "Queues and Streams", "Database Sharding"], events: ["Mock System Design Interview", "Diagram Critique", "Scaling Clinic"], archiveTypes: [ArchiveType.Diagram, ArchiveType.CheatSheet], legends: ["Meera R.", "Rohan Gupta", "Aarav Mehta", "Karan Malhotra"] },
    { id: "german-language-a1", title: "German Language A1", subtitle: "Speak your first confident German sentences.", description: "Build everyday German through listening drills, speaking rooms, and grammar quests.", coverImage: "/mock/thumbnails/german.webp", difficulty: "Beginner", categories: ["Languages", "German", "Speaking"], creator: { id: "learn-german", name: "Learn German", avatarUrl: avatars[2], role: "Language Studio", bio: "We help beginners move from grammar anxiety to daily conversation." }, stats: { rating: 4.7, explorerCount: 5200, completionRate: 71 }, progress: { journeyProgress: 24, completedQuests: 14, totalQuests: 58, dailyGoal: "12 minutes of German practice", joinedDate: "June 20, 2026" }, focus: "A1 German communication", outcomes: ["Greetings", "Articles", "Food Orders", "Pronunciation", "Short Dialogues"], season: "First Conversations", lessons: ["Guten Tag", "Der Die Das", "Numbers and Time", "Ordering Coffee", "Accusative Basics"], events: ["A1 Speaking Room", "Article Drill Sprint", "Pronunciation Clinic"], archiveTypes: [ArchiveType.Flashcard, ArchiveType.CheatSheet], legends: ["Ishita Verma", "Noah Kim", "Ava Patel", "Jonas Weber"] },
    { id: "history-psychology", title: "History of Psychology", subtitle: "Trace the ideas that shaped the mind sciences.", description: "Explore psychology from early labs to modern cognitive science with timelines and debates.", coverImage: "/mock/thumbnails/history-psych.jpg", difficulty: "Intermediate", categories: ["Psychology", "History", "Humanities"], creator: { id: "crashcourse", name: "CrashCourse", avatarUrl: avatars[3], role: "Educational Media", bio: "We make complex histories memorable through story-driven lessons." }, stats: { rating: 4.6, explorerCount: 6100, completionRate: 58 }, progress: { journeyProgress: 36, completedQuests: 19, totalQuests: 54, dailyGoal: "10 minutes of psychology review", joinedDate: "June 8, 2026" }, focus: "major psychology schools and thinkers", outcomes: ["Timeline Thinking", "Behaviorism", "Psychoanalysis", "Cognitive Revolution", "Research Methods"], season: "Schools of Thought", lessons: ["Wundt's Lab", "Freud and Jung", "Pavlov and Skinner", "Humanistic Psychology", "Cognitive Science"], events: ["Behaviorism Debate", "Timeline Review", "Quiz Prep Room"], archiveTypes: [ArchiveType.MindMap, ArchiveType.Flashcard], legends: ["Priya Shah", "Samiksha Sharma", "Vanshika Iyer", "Rohit Kumar"] },
    { id: "machine-learning", title: "Machine Learning", subtitle: "Build intuition for models, loss, and optimization.", description: "Learn ML by training small models, visualizing gradients, and explaining trade-offs.", coverImage: "/mock/thumbnails/machine-learning.avif", difficulty: "Advanced", categories: ["AI", "Math", "Python"], creator: { id: "andrew-lab", name: "Andrew Lab", avatarUrl: avatars[4], role: "ML Educators", bio: "We teach machine learning with code-first intuition." }, stats: { rating: 4.9, explorerCount: 18200, completionRate: 62 }, progress: { journeyProgress: 52, completedQuests: 31, totalQuests: 72, dailyGoal: "25 minutes of model practice", joinedDate: "May 28, 2026" }, focus: "applied machine learning fundamentals", outcomes: ["Gradient Descent", "Feature Design", "Model Evaluation", "Regularization", "Neural Networks"], season: "Learning from Data", lessons: ["Linear Regression", "Loss Functions", "Gradient Descent", "Classification", "Overfitting"], events: ["Gradient Descent Lab", "Model Debugging AMA", "Kaggle Sprint"], archiveTypes: [ArchiveType.CodeSnippet, ArchiveType.Diagram], legends: ["Vanshika Iyer", "Shaqun", "Neha Rao", "Arjun Dev"] },
    { id: "ai-builders", title: "AI Builders", subtitle: "Ship useful AI products with fast feedback.", description: "Prototype agents, RAG flows, and evaluation loops in a product-minded cohort.", coverImage: "/images/auth/claude.webp", difficulty: "Advanced", categories: ["AI", "Products", "Agents"], creator: { id: "sidequest-ai", name: "SideQuest AI Lab", avatarUrl: avatars[0], role: "Builder Community", bio: "We help builders turn AI demos into evaluated products." }, stats: { rating: 4.8, explorerCount: 7600, completionRate: 55 }, progress: { journeyProgress: 67, completedQuests: 42, totalQuests: 63, dailyGoal: "30 minutes shipping AI", joinedDate: "May 15, 2026" }, focus: "AI product building", outcomes: ["Prompt Systems", "RAG Pipelines", "Agent Tools", "Evaluation", "Launch Loops"], season: "Prototype to Product", lessons: ["Problem Framing", "RAG Basics", "Tool Calling", "Eval Sets", "Launch Review"], events: ["AI Builder Checkpoint", "Eval Clinic", "Demo Night"], archiveTypes: [ArchiveType.CodeSnippet, ArchiveType.FieldNote], legends: ["Shaqun", "Agrim Singh", "Samiksha Sharma", "Yash Patil"] },
];

const ids = ["python-data-science", "100-days-of-code", "become-a-reader-again", "body-doubling-room", "content-in-a-bottle", "advanced-javascript", "japanese-beginners", "ancient-civilizations", "data-storytelling", "intro-philosophy", "productivity-systems", "docker-kubernetes", "modern-react", "ui-design-fundamentals"];
const extra = ids.map((id, i) => build({ ...seeds[i % seeds.length], id, title: id.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join(" "), coverImage: ["/mock/thumbnails/data-science.avif", "/mock/thumbnails/100dcode.jpg", "/mock/thumbnails/reader.webp", "/mock/thumbnails/doubling.webp", "/mock/thumbnails/content-bottle.webp", "/mock/thumbnails/javascript.jpeg", "/mock/thumbnails/japanese.webp", "/mock/thumbnails/civilization.jpeg", "/mock/thumbnails/data-storytelling.jpg", "/mock/thumbnails/philosophy.jpg", "/images/landing/coffee-break.webp", "/mock/thumbnails/docker.avif", "/mock/thumbnails/react.webp", "/mock/thumbnails/ui-fundamentals.webp"][i] }));

export const cohortCatalog: Cohort[] = [deepWorkMastery, ...seeds.map(build), ...extra];
