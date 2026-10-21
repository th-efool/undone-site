import { useEffect, useState } from 'react';
import { messagesRepository, EnrolledCommunityDTO } from '@/src/client/repositories/messagesRepository';

export function useCommunity(): EnrolledCommunityDTO[] {
  const [communities, setCommunities] = useState<EnrolledCommunityDTO[]>([]);

  useEffect(() => {
    let active = true;
    messagesRepository.fetchEnrolledCommunities().then((data) => {
      if (active) setCommunities(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return communities;
}
