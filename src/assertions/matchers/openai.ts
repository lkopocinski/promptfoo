import { BaseAssertion } from '.';
import { OpenAiChatCompletionProvider } from '../../providers/openai';
import { validateFunctionCall } from '../../providers/openaiUtil';
import { ApiProvider, AtomicTestCase, GradingResult } from '../../types';

export interface OpenAiAssertion extends BaseAssertion {
  test: AtomicTestCase;
  output: object | string;
  provider: ApiProvider | undefined;
}

export function isValidOpenAiToolsCallAssertion({
  assertion,
  test,
  output,
  provider,
}: OpenAiAssertion): GradingResult {
  const toolsOutput = output as {
    type: 'function';
    function: { arguments: string; name: string };
  }[];
  if (
    !Array.isArray(toolsOutput) ||
    toolsOutput.length === 0 ||
    typeof toolsOutput[0].function.name !== 'string' ||
    typeof toolsOutput[0].function.arguments !== 'string'
  ) {
    return {
      pass: false,
      score: 0,
      reason: `OpenAI did not return a valid-looking tools response: ${JSON.stringify(
        toolsOutput,
      )}`,
      assertion,
    };
  }

  try {
    toolsOutput.forEach((toolOutput) =>
      validateFunctionCall(
        toolOutput.function,
        (provider as OpenAiChatCompletionProvider).config.tools?.map((tool) => tool.function),
        test.vars,
      ),
    );
    return {
      pass: true,
      score: 1,
      reason: 'Assertion passed',
      assertion,
    };
  } catch (err) {
    return {
      pass: false,
      score: 0,
      reason: (err as Error).message,
      assertion,
    };
  }
}

export function isValidOpenAiFunctionCallAssertion({
  assertion,
  test,
  output,
  provider,
}: OpenAiAssertion): GradingResult {
  const functionOutput = output as { arguments: string; name: string };
  if (
    typeof functionOutput !== 'object' ||
    typeof functionOutput.name !== 'string' ||
    typeof functionOutput.arguments !== 'string'
  ) {
    return {
      pass: false,
      score: 0,
      reason: `OpenAI did not return a valid-looking function call: ${JSON.stringify(
        functionOutput,
      )}`,
      assertion,
    };
  }
  try {
    validateFunctionCall(
      functionOutput,
      (provider as OpenAiChatCompletionProvider).config.functions,
      test.vars,
    );
    return {
      pass: true,
      score: 1,
      reason: 'Assertion passed',
      assertion,
    };
  } catch (err) {
    return {
      pass: false,
      score: 0,
      reason: (err as Error).message,
      assertion,
    };
  }
}