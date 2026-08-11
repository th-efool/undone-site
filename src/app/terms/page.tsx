import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for SideQuestHQ',
  alternates: {
    canonical: 'https://sidequesthq.com/terms',
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen py-24 px-6 md:px-12 bg-background text-text font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Terms of Service</h1>
        <p className="text-sm text-text/60">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Agreement to Terms</h2>
          <p className="leading-relaxed">
            By accessing or using SideQuestHQ, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">2. Description of Service</h2>
          <p className="leading-relaxed">
            SideQuestHQ is an application designed to help users stay consistent with their learning goals. We provide tools for microlearning, tracking progress, and AI-assisted study planning.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. User Accounts</h2>
          <p className="leading-relaxed">
            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Intellectual Property</h2>
          <p className="leading-relaxed">
            The Service and its original content, features, and functionality are and will remain the exclusive property of SideQuestHQ and its licensors.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Termination</h2>
          <p className="leading-relaxed">
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. Changes to Terms</h2>
          <p className="leading-relaxed">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
          </p>
        </section>
      </div>
    </main>
  );
}
