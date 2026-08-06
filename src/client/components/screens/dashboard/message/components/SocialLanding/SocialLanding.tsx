import { useState } from 'react';
import type { ReplyContext } from '../../models';
import { Center } from '../Center/Center';
import { CommunityChat } from '../CommunityChat/CommunityChat';
import { DMConversation } from '../DMConversation/DMConversation';
import { LeftSidebar } from '../LeftSidebar/LeftSidebar';
import { RightSidebar } from '../RightSidebar/RightSidebar';
import { TypingIndicator } from '../shared/TypingIndicator/TypingIndicator';
import { useMessage } from '../../hooks';
import { useIsMobile } from '@/src/client/hooks/useIsMobile';
import styles from './SocialLanding.module.css';

interface Props {
  message: ReturnType<typeof useMessage>;
}

export function SocialLanding({ message }: Props) {
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Batch C: Local reply context per view (avoids cross-contamination)
  const [communityReply, setCommunityReply] = useState<ReplyContext | null>(null);
  const [dmReply, setDmReply] = useState<ReplyContext | null>(null);

  return (
    <div className={`${styles.landing} ${isMobile && mobileView !== 'list' ? styles.panelHidden : ''} ${isMobile && mobileView !== 'chat' ? styles.chatHidden : ''}`}>
      <LeftSidebar
        tabs={message.sidebarTabs}
        filters={message.conversationFilters}
        selectedTab={message.selectedSidebarTab}
        selectedFilter={message.conversationFilter}
        conversations={message.conversations}
        dmConversations={message.conversations.filter((c) => c.kind === 'dm')}
        searchQuery={message.searchQuery}
        onTabChange={message.actions.setSelectedSidebarTab}
        onFilterChange={message.actions.setConversationFilter}
        onSelectConversation={(conv) => {
          message.actions.selectConversation(conv);
          if (isMobile) setMobileView('chat');
        }}
        onSearchClear={() => message.actions.setSearchQuery('')}
        onMarkAllRead={message.actions.markAllRead}
        onGoHome={message.actions.backToLanding}
        isHome={message.view === 'landing'}
      />

      {message.view === 'community' && (
        <CommunityChat
          community={message.communityChat}
          draft={message.communityDraft}
          scrollTop={message.communityScrollTop}
          onBack={() => {
            message.actions.backToLanding();
            if (isMobile) setMobileView('list');
          }}
          onDraftChange={(value) => message.actions.setDraft(message.communityChat.id, value)}
          onScrollChange={(scrollTop) =>
            message.actions.setConversationScroll(message.communityChat.id, scrollTop)
          }
          onSend={() => {
            message.actions.sendCommunityMessage(message.communityChat.id, communityReply);
            setCommunityReply(null);
          }}
          onReaction={(messageId, emoji) =>
            message.actions.toggleCommunityReaction(message.communityChat.id, messageId, emoji)
          }
          onUpload={(file, kind) =>
            message.actions.uploadCommunityAttachment(message.communityChat.id, file, kind)
          }
          replyBanner={communityReply}
          onReplyDismiss={() => setCommunityReply(null)}
          onReply={(messageId, senderName, previewText, senderAvatar) =>
            setCommunityReply({ messageId, senderName, senderAvatar: senderAvatar || '/images/logos/floating-logo.webp', previewText })
          }
          isTyping={message.isTyping}
          typingUsernames={['Aarav', 'Vanshika']} /* mock */
        />
      )}

      {message.view === 'dm' && (
        <DMConversation
          conversation={message.dmConversation}
          draft={message.dmDraft}
          scrollTop={message.dmScrollTop}
          onBack={() => {
            message.actions.backToLanding();
            if (isMobile) setMobileView('list');
          }}
          onDraftChange={(value) => message.actions.setDraft(message.dmConversation.id, value)}
          onScrollChange={(scrollTop) =>
            message.actions.setConversationScroll(message.dmConversation.id, scrollTop)
          }
          onSend={() => {
            message.actions.sendDMMessage(message.dmConversation.id, dmReply);
            setDmReply(null);
          }}
          onUpload={(file, kind) =>
            message.actions.uploadDMAttachment(message.dmConversation.id, file, kind)
          }
          replyBanner={dmReply}
          onReplyDismiss={() => setDmReply(null)}
          onReply={(messageId, senderName, previewText, senderAvatar) =>
            setDmReply({ messageId, senderName, senderAvatar: senderAvatar || '/images/logos/floating-logo.webp', previewText })
          }
          onDeleteMessage={(messageId) => message.actions.deleteDMMessage(message.dmConversation.id, messageId)}
          isTyping={message.isTyping}
          typingUsernames={[message.dmConversation.user.name]} /* mock */
        />
      )}

      {message.view === 'landing' && (
        <>
          <Center
            query={message.searchQuery}
            liveSessions={message.liveSessions}
            recentMessages={message.recentMessages}
            onSearchChange={message.actions.setSearchQuery}
          />
          <RightSidebar
            upcomingEvents={message.upcomingEvents}
            friendsOnline={message.friendsOnline}
          />
        </>
      )}
    </div>
  );
}
