import { messagesRepository } from "@/src/client/repositories/messagesRepository";

export function useCommunity() {
    return messagesRepository.getEnrolledCohorts();
}
