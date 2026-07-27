import { MessageMock } from "../models";

const avatars = ["/mock/avatars/a.webp", "/mock/avatars/b.webp", "/mock/avatars/c.webp", "/mock/avatars/d.webp", "/mock/avatars/e.webp"];
const covers = ["/images/landing/before-sleep.webp", "/images/landing/screen.webp", "/images/landing/hand.webp", "/images/auth/phone.webp", "/images/auth/maker.webp"];

export const messageMock: MessageMock = {
    conversations: [
        { id: "ai-builders", kind: "community", name: "AI Builders", avatar: covers[1], sender: "Shaqun", preview: "Checkpoint starting in 5 mins. Let's go! 🚀", timestamp: "2m", onlineCount: 43, unreadCount: 32, selected: true, hasMention: true },
        { id: "machine-learning", kind: "community", name: "Machine Learning", avatar: covers[2], sender: "Vanshika", preview: "Adam finally clicked for me!", timestamp: "5m", onlineCount: 127, unreadCount: 7 },
        { id: "system-design", kind: "community", name: "System Design", avatar: covers[4], sender: "Rohan", preview: "Shared a new resource", timestamp: "22m", onlineCount: 64, unreadCount: 12, pinned: true },
        { id: "deep-work", kind: "community", name: "Deep Work", avatar: covers[0], sender: "Aryan", preview: "Focus mode ON. See you at the end.", timestamp: "10m", onlineCount: 98, statusLabel: "LIVE", pinned: true },
        { id: "ai-filmmaking", kind: "community", name: "AI Filmmaking", avatar: "/images/auth/faceless.webp", sender: "Samiksha", preview: "Look at this transition! 🔥", timestamp: "1h", onlineCount: 28, unreadCount: 3 },
        { id: "indie-hackers", kind: "community", name: "Indie Hackers", avatar: "/images/auth/claude.webp", sender: "Agrim", preview: "Just shipped the waitlist flow 😄", timestamp: "3h", onlineCount: 19, unreadCount: 1 },
        { id: "product-designers", kind: "community", name: "Product Designers", avatar: "/images/auth/maker.webp", sender: "Neha", preview: "Critique on the new landing page?", timestamp: "4h", onlineCount: 15 },
        { id: "shaqun", kind: "dm", name: "Shaqun", avatar: avatars[0], sender: "Shaqun", preview: "Ready for the checkpoint?", timestamp: "3m", unreadCount: 2, selected: true },
        { id: "vanshika", kind: "dm", name: "Vanshika Iyer", avatar: avatars[1], sender: "Vanshika", preview: "That optimizer note helped.", timestamp: "18m" },
        { id: "rohan", kind: "dm", name: "Rohan Gupta", avatar: avatars[2], sender: "Rohan", preview: "Sent the PDF link.", timestamp: "1h", pinned: true },
    ],
    liveSessions: [
        { id: "deep", title: "Deep Work", thumbnail: covers[0], avatars: [0, 2, 3, 4].map((i) => ({ id: String(i), name: "Friend", avatar: avatars[i], online: true })), status: "98 studying", onlineCount: 98, live: true },
        { id: "ai", title: "AI Builders", thumbnail: covers[1], avatars: [0, 1, 2].map((i) => ({ id: String(i), name: "Builder", avatar: avatars[i], online: true })), status: "43 online • 12 speaking", onlineCount: 43, speakingCount: 12, primary: true },
        { id: "ml", title: "ML Cohort", thumbnail: covers[2], avatars: [0, 2, 3].map((i) => ({ id: String(i), name: "Peer", avatar: avatars[i], online: true })), status: "127 online", onlineCount: 127 },
        { id: "game", title: "Game Dev", thumbnail: covers[3], avatars: [0, 1, 2, 4].map((i) => ({ id: String(i), name: "Dev", avatar: avatars[i], online: true })), status: "36 online", onlineCount: 36 },
    ],
    recentMessages: [
        { id: "r1", sender: { id: "s", name: "Shaqun", avatar: avatars[0], online: true }, community: "AI Builders", message: "Checkpoint starting in 5 mins. Let's go! 🚀", timestamp: "2m", unreadCount: 32 },
        { id: "r2", sender: { id: "v", name: "Vanshika Iyer", avatar: avatars[1] }, community: "Machine Learning", message: "Adam optimizer intuition finally makes sense now.", timestamp: "5m", unreadCount: 7 },
        { id: "r3", sender: { id: "r", name: "Rohan Gupta", avatar: avatars[2] }, community: "System Design", message: "", attachment: "scalability-patterns.pdf", timestamp: "22m", unreadCount: 12 },
        { id: "r4", sender: { id: "a", name: "Aryan Mehta", avatar: avatars[3], online: true }, community: "Deep Work", message: "Focus mode ON. See you at the end.", timestamp: "", live: true },
        { id: "r5", sender: { id: "sa", name: "Samiksha Sharma", avatar: avatars[4] }, community: "AI Filmmaking", message: "Look at this transition! 🔥", timestamp: "1h", unreadCount: 3 },
        { id: "r6", sender: { id: "ag", name: "Agrim Singh", avatar: avatars[2] }, community: "Indie Hackers", message: "Just shipped the waitlist flow 😄", timestamp: "2h", unreadCount: 1 },
    ],
    upcomingEvents: [
        { id: "u1", title: "Deep Work Session", subtitle: "Focus together", startsIn: "Starts in 8m", tone: "purple" },
        { id: "u2", title: "AI Builders Checkpoint", subtitle: "Gradient Descent", startsIn: "Starts in 18m", tone: "orange" },
        { id: "u3", title: "ML Cohort Call", subtitle: "Q&A + Doubt Clearing", startsIn: "Starts in 1h 15m", tone: "blue" },
    ],
    challenge: { tag: "AI Builders", title: "Gradient Descent Visualizer", description: "Build a visual intuition of how GD converges.", participants: [0, 1, 3].map((i) => ({ id: String(i), name: "Participant", avatar: avatars[i] })), participantCount: 124 },
    friendsOnline: [0, 1, 2, 3, 4].map((i) => ({ id: String(i), name: ["Shaqun", "Vanshika", "Rohan", "Samiksha", "Agrim"][i], avatar: avatars[i], online: true })),
};
