import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  /** Mutually exclusive with dmId. */
  @IsOptional()
  @IsString()
  channelId?: string;

  /** Mutually exclusive with channelId. */
  @IsOptional()
  @IsString()
  dmId?: string;

  /** Reply to a top-level message. The referenced message must not itself be a reply. */
  @IsOptional()
  @IsString()
  parentId?: string;

  /** Client-generated idempotency key to prevent duplicate sends on reconnect. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientNonce?: string;
}
