import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import {
  ADMIN_OPERATIONS_REASON_MAX,
  ADMIN_OPERATIONS_REASON_MIN,
} from './admin-operations.contract';

/**
 * The whole request body. No actor field, no switch name, no capability claim —
 * the name comes from the route and the actor from the session, so neither can
 * be supplied by the caller. The service re-validates the reason rather than
 * trusting the pipe alone, because the audit row is the reason this field exists.
 */
export class AdminOperationsSwitchDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MinLength(ADMIN_OPERATIONS_REASON_MIN)
  @MaxLength(ADMIN_OPERATIONS_REASON_MAX)
  reason!: string;
}
