import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TokenizerError } from './tokenizer.error';

export function throwTokenizerError(err: unknown): never {
  if (err instanceof TokenizerError) {
    if (err.reason === 'api_key_missing') {
      throw new ServiceUnavailableException({
        status: 503,
        errors: { tokenizer: 'apiKeyMissing' },
      });
    }
    throw new BadGatewayException({
      status: 502,
      errors: {
        tokenizer:
          err.reason === 'upstream_rejected'
            ? 'upstreamRejected'
            : 'upstreamFailed',
      },
    });
  }
  throw err;
}
