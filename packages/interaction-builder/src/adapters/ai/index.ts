import { generateText, stepCountIs, type LanguageModel, type ModelMessage } from 'ai';
import type {
  InteractionModelAdapter,
  InteractionModelTurnInput,
  InteractionModelTurnOutput,
} from '../../runtime/runner';

export function createAiSdkModelAdapter(model: LanguageModel): InteractionModelAdapter {
  return {
    async executeTurn(input: InteractionModelTurnInput): Promise<InteractionModelTurnOutput> {
      const messages: ModelMessage[] = input.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const result = await generateText({
        model,
        system: input.systemPrompt,
        messages,
        tools: input.tools,
        stopWhen: stepCountIs(input.maxSteps ?? 5),
      });

      return {
        text: result.text,
        stepsCount: result.steps?.length ?? 1,
      };
    },
  };
}

export type { LanguageModel };
