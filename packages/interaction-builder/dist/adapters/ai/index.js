// src/adapters/ai/index.ts
import { generateText, stepCountIs } from "ai";
function createAiSdkModelAdapter(model) {
  return {
    async executeTurn(input) {
      const messages = input.messages.map((m) => ({
        role: m.role,
        content: m.content
      }));
      const result = await generateText({
        model,
        system: input.systemPrompt,
        messages,
        tools: input.tools,
        stopWhen: stepCountIs(input.maxSteps ?? 5)
      });
      return {
        text: result.text,
        stepsCount: result.steps?.length ?? 1
      };
    }
  };
}
export {
  createAiSdkModelAdapter
};
//# sourceMappingURL=index.js.map
