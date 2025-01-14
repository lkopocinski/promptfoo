import chalk from 'chalk';
import dedent from 'dedent';
import invariant from 'tiny-invariant';
import { VERSION } from '../../constants';
import logger from '../../logger';
import type {
  ApiProvider,
  CallApiContextParams,
  CallApiOptionsParams,
  ProviderOptions,
  ProviderResponse,
} from '../../types/providers';
import { getRemoteGenerationUrl } from '../constants';
import { neverGenerateRemote } from '../util';

export default class GoatProvider implements ApiProvider {
  private maxTurns: number;
  private readonly injectVar: string;

  id() {
    return 'promptfoo:redteam:goat';
  }

  constructor(options: ProviderOptions & { maxTurns?: number; injectVar?: string } = {}) {
    if (neverGenerateRemote()) {
      throw new Error(`GOAT strategy requires remote grading to be enabled`);
    }
    invariant(typeof options.injectVar === 'string', 'Expected injectVar to be set');
    this.injectVar = options.injectVar;
    this.maxTurns = options.maxTurns || 5;
  }

  async callApi(
    prompt: string,
    context?: CallApiContextParams,
    options?: CallApiOptionsParams,
  ): Promise<ProviderResponse> {
    let response: Response | undefined = undefined;

    const targetProvider: ApiProvider | undefined = context?.originalProvider;
    invariant(targetProvider, 'Expected originalProvider to be set');

    const messages: { content: string; role: 'user' | 'assistant' | 'system' }[] = [];

    for (let turn = 0; turn < this.maxTurns; turn++) {
      response = await fetch(getRemoteGenerationUrl(), {
        body: JSON.stringify({
          goal: context?.vars[this.injectVar],
          i: turn,
          messages,
          prompt: context?.prompt?.raw,
          task: 'goat',
          version: VERSION,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const data = await response.json();
      messages.push(data.message);
      logger.debug(
        dedent`
          ${chalk.bold.green(`GOAT turn ${turn} history:`)}
          ${chalk.cyan(JSON.stringify(messages, null, 2))}
        `,
      );
      const targetResponse = await targetProvider.callApi(
        JSON.stringify(messages),
        context,
        options,
      );
      if (targetResponse.error) {
        throw new Error(`Error from target provider: ${targetResponse.error}`);
      }
      invariant(targetResponse.output, 'Expected target response to be set');
      messages.push({
        content: targetResponse.output,
        role: 'assistant',
      });
    }
    return {
      output: messages[messages.length - 1].content,
      metadata: {
        messages: JSON.stringify(messages, null, 2),
      },
    };
  }
}
