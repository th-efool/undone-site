export interface SimulationResponse {
  success: boolean;
  status: string;
  verificationId: string;
  timestamp: string;
  action: {
    type: string;
    evaluatedCriteria: {
      platform: string;
      userActivityVerified: boolean;
      confidenceScore: number;
      fraudCheckPassed: boolean;
    };
  };
  reward: {
    id: string;
    partnerName: string;
    partnerCategory: string;
    logo: string;
    rewardHeadline: string;
    rewardValue: string;
    numericValue: number;
    currency: string;
    code: string;
    terms: string;
    expiresInMinutes: number;
    expiresAt: string;
    redemptionStatus: string;
  };
  metrics: {
    latencyMs: number;
    conversionLiftProjected: string;
    redemptionRateEstimated: string;
  };
}

export interface SubmissionData {
  projectName: string;
  tagline: string;
  track: string;
  demoUrl: string;
  githubUrl: string;
  loomVideoUrl: string;
  pitchDeckUrl: string;
  teamMembers: string;
  contactEmail: string;
  problemSummary: string;
  solutionSummary: string;
  keyInnovations: string;
}

export const DEFAULT_SUBMISSION: SubmissionData = {
  projectName: 'BuildBank: Sponsored Learning Cohorts',
  tagline: 'Companies sponsor learning cohorts. Users learn for free and unlock sponsor rewards.',
  track: 'EdTech / Embedded Finance',
  demoUrl: 'https://sidequesthq.com/hackathon',
  githubUrl: 'https://github.com/th-efool/buildbank-sidequesthq',
  loomVideoUrl: '',
  pitchDeckUrl: '',
  teamMembers: 'SideQuestHQ & BuildBank Builders',
  contactEmail: 'team@sidequesthq.com',
  problemSummary: 'Digital learning platforms have great engagement but struggle to monetize effectively. On the other hand, brands want high-intent users but ads are spammy and ignored. Users want to learn but lack motivation and resources.',
  solutionSummary: 'Sponsored Cohorts! Brands sponsor specific learning journeys (e.g., Amazon sponsors a "Become a Reader Again" cohort). Users learn, get verified by the BuildBank engine, and unlock a highly relevant financial reward from the sponsor upon completion.',
  keyInnovations: 'Real-time cohort verification engine, in-context 1-click reward redemption, multi-tenant sponsor network integration, and high-conversion micro-incentives.'
};

export const ACTIONS = [
  {
    key: 'reader_cohort',
    title: 'Become a Reader Again',
    category: 'Sponsored Cohort',
    desc: 'User completed the 14-day reading habit builder cohort.',
    expectedReward: '₹500 OFF Kindle / Audible',
    thumbnail: '/mock/thumbnails/reader.webp',
  },
  {
    key: 'dev_cohort',
    title: 'Full-Stack Web Dev',
    category: 'Sponsored Cohort',
    desc: 'Finished the Next.js Architecture and Deployment track.',
    expectedReward: '₹1,000 Cloud & GPU Credits',
    thumbnail: '/mock/thumbnails/react.webp',
  },
  {
    key: 'finance_cohort',
    title: 'Personal Finance 101',
    category: 'Sponsored Cohort',
    desc: 'Completed the basics of investing and mutual funds cohort.',
    expectedReward: '₹500 Initial Investment Match',
    thumbnail: '/mock/thumbnails/data-science.avif',
  },
  {
    key: 'fitness_cohort',
    title: 'Fitness Habit Builder',
    category: 'Sponsored Cohort',
    desc: 'Maintained a 7-day workout streak in the fitness cohort.',
    expectedReward: 'Free 1-Month Gym Pass',
    thumbnail: '/mock/thumbnails/deep-work.webp',
  },
];

export const PROGRESS_STEPS = [
  { step: 1, title: '1. User Takes Action', desc: 'Milestone / Streak achieved' },
  { step: 2, title: '2. Action Verified', desc: 'Predefined criteria validated' },
  { step: 3, title: '3. Financial Reward', desc: 'Instant voucher / cashback' },
  { step: 4, title: '4. Instant Redemption', desc: 'Zero off-platform drop-off' },
];
