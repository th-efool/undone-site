import { NextResponse } from 'next/server';

interface RewardSimulationRequest {
  actionType: string;
  userId?: string;
  platform?: string;
  metadata?: {
    streakDays?: number;
    questTitle?: string;
    scorePercent?: number;
    completionTimeSeconds?: number;
  };
}

interface PartnerOffer {
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
}

const PARTNER_OFFERS: Record<string, PartnerOffer> = {
  reader_cohort: {
    id: 'rew_reader_500',
    partnerName: 'Amazon Kindle & Audible',
    partnerCategory: 'Reading & Audiobooks',
    logo: '📚',
    rewardHeadline: '₹500 OFF Any Kindle Book or Free Audiobook',
    rewardValue: '₹500 OFF',
    numericValue: 500,
    currency: 'INR',
    code: 'SPONSOR-READER-500',
    terms: 'Valid on Amazon Kindle store and Audible subscriptions.',
    expiresInMinutes: 60,
  },
  dev_cohort: {
    id: 'rew_dev_1000',
    partnerName: 'AWS & Cloudflare',
    partnerCategory: 'Developer Infrastructure',
    logo: '⚡',
    rewardHeadline: '₹1,000 AWS & Cloud Sandbox Credits',
    rewardValue: '₹1,000 Credits',
    numericValue: 1000,
    currency: 'INR',
    code: 'SPONSOR-CLOUD-1000',
    terms: 'Granted directly to your developer account upon cohort completion.',
    expiresInMinutes: 120,
  },
  finance_cohort: {
    id: 'rew_finance_500',
    partnerName: 'Zerodha / Groww',
    partnerCategory: 'Investing & Wealth',
    logo: '📈',
    rewardHeadline: '₹500 Initial Investment Match',
    rewardValue: '₹500 Match',
    numericValue: 500,
    currency: 'INR',
    code: 'SPONSOR-INVEST-500',
    terms: 'Credited to your linked demat account wallet.',
    expiresInMinutes: 45,
  },
  fitness_cohort: {
    id: 'rew_fitness_1mo',
    partnerName: 'Cult.fit Elite',
    partnerCategory: 'Health & Fitness',
    logo: '🏋️',
    rewardHeadline: 'Free 1-Month Cult Elite Pass',
    rewardValue: '1-Month Pass',
    numericValue: 1500,
    currency: 'INR',
    code: 'SPONSOR-CULT-1MO',
    terms: 'Valid at any Cult.fit center for new and existing users.',
    expiresInMinutes: 48 * 60,
  },
};

export async function POST(request: Request) {
  try {
    const body: RewardSimulationRequest = await request.json();
    const actionKey = body.actionType || 'reader_cohort';
    const offer = PARTNER_OFFERS[actionKey] || PARTNER_OFFERS.reader_cohort;

    // Simulate verification delay (250ms) to mirror real rules engine evaluation
    await new Promise((resolve) => setTimeout(resolve, 250));

    const verificationTimestamp = new Date().toISOString();
    const expiryTimestamp = new Date(Date.now() + offer.expiresInMinutes * 60 * 1000).toISOString();

    const responsePayload = {
      success: true,
      status: 'VERIFIED',
      verificationId: `bb_vrf_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: verificationTimestamp,
      action: {
        type: actionKey,
        evaluatedCriteria: {
          platform: body.platform || 'SideQuestHQ',
          userActivityVerified: true,
          confidenceScore: 0.994,
          fraudCheckPassed: true,
        },
      },
      reward: {
        ...offer,
        expiresAt: expiryTimestamp,
        redemptionStatus: 'READY_TO_REDEEM',
        redemptionOptions: [
          { method: '1_CLICK_IN_APP', label: 'Redeem In-Platform Instantly' },
          { method: 'PARTNER_CHECKOUT', label: 'Apply Voucher at Partner Checkout' },
          { method: 'UPI_DIRECT', label: 'Send Directly to UPI Wallet' },
        ],
      },
      metrics: {
        latencyMs: 248,
        conversionLiftProjected: '+34%',
        redemptionRateEstimated: '92.4%',
      },
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error in hackathon reward simulation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process reward simulation rule.',
      },
      { status: 500 }
    );
  }
}
