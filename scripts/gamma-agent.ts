import { prisma } from '../src/server/infrastructure/db/postgres/client';
import { messagingRepo } from '../src/server/infrastructure/db/postgres/repositories/messaging.repo';

async function getParticipants() {
  const gamma = await prisma.user.findFirst({ where: { username: 'user_gamma' } });
  const alpha = await prisma.user.findFirst({ where: { username: 'user_alpha' } });
  return { alpha, gamma };
}

async function findDirectConversation(alphaId: string, gammaId: string) {
  const directKey = [alphaId, gammaId].sort().join(':');
  return prisma.conversation.findUnique({
    where: { directKey },
    include: {
      channel: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: {
                select: { id: true, name: true, username: true },
              },
            },
          },
        },
      },
    },
  });
}

async function sendReply(channelId: string, gammaId: string, replyText: string) {
  try {
    const res = await messagingRepo.createMessageTransaction({
      channelId,
      authorId: gammaId,
      content: replyText,
    });
    return res.message;
  } catch (err) {
    // Graceful fallback to direct prisma creation if transaction repo has specific constraints
    return prisma.message.create({
      data: {
        channelId,
        authorId: gammaId,
        content: replyText,
      },
      include: {
        author: { select: { username: true } },
      },
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch') || args.includes('-w');
  const customReply = args.find((a) => !a.startsWith('-'))?.trim();

  const { alpha, gamma } = await getParticipants();

  if (!alpha || !gamma) {
    console.error('Could not locate user_alpha or user_gamma in database.');
    return;
  }

  console.log(`=======================================================`);
  console.log(`🤖 Gamma Agent Daemon (Identity: @${gamma.username})`);
  console.log(`Target User: @${alpha.username} [ID: ${alpha.id}]`);
  console.log(`Agent User:  @${gamma.username} [ID: ${gamma.id}]`);
  console.log(`Mode:        ${isWatch ? 'WATCH / AUTO-REPLY' : 'ONCE'}`);
  console.log(`=======================================================\n`);

  if (!isWatch) {
    const conv = await findDirectConversation(alpha.id, gamma.id);
    if (!conv || !conv.channel) {
      console.log('No direct conversation initiated yet between @user_alpha and @user_gamma.');
      console.log('Waiting for @user_alpha to find @user_gamma and send the first DM.');
      return;
    }

    console.log(`Conversation [ID: ${conv.id}, Channel: ${conv.channel.id}]:`);
    for (const m of conv.channel.messages) {
      console.log(`  [${m.createdAt.toLocaleTimeString()}] @${m.author?.username || m.authorId}: ${m.content}`);
    }

    if (customReply) {
      console.log(`\nSending manual reply as @${gamma.username}: "${customReply}"...`);
      const sent = await sendReply(conv.channel.id, gamma.id, customReply);
      console.log(`Reply sent successfully! (ID: ${sent.id})`);
    }
    return;
  }

  // WATCH MODE
  console.log(`Listening for incoming DMs from @${alpha.username}... (Press Ctrl+C to stop)`);
  const seenMessageIds = new Set<string>();

  // Seed seen messages
  const initialConv = await findDirectConversation(alpha.id, gamma.id);
  if (initialConv?.channel) {
    for (const m of initialConv.channel.messages) {
      seenMessageIds.add(m.id);
    }
  }

  while (true) {
    try {
      const conv = await findDirectConversation(alpha.id, gamma.id);
      if (conv?.channel) {
        for (const m of conv.channel.messages) {
          if (!seenMessageIds.has(m.id)) {
            seenMessageIds.add(m.id);
            console.log(`\n📬 [NEW MESSAGE] From @${m.author?.username || m.authorId} at ${m.createdAt.toLocaleTimeString()}:`);
            console.log(`   "${m.content}"`);

            // If message came from user_alpha, reply automatically as user_gamma
            if (m.authorId === alpha.id) {
              const replyText = `Hello @${alpha.username}! I am Gamma (@${gamma.username}), responding from the server daemon. I received your message: "${m.content}". Direct message connection is verified!`;
              console.log(`💬 Replying as @${gamma.username}: "${replyText}"...`);

              const sent = await sendReply(conv.channel.id, gamma.id, replyText);
              seenMessageIds.add(sent.id);
              console.log(`✅ Sent reply (Message ID: ${sent.id})`);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error during poll:', err?.message || err);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
