import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        const path = issue?.path.join('.') ?? '';
        const detail = path ? `${path}: ${issue.message}` : issue?.message;
        throw new BadRequestException({ reason: 'invalid_body', detail });
      }
      throw err;
    }
  }
}
