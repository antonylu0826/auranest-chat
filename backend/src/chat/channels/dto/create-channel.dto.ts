import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  /** URL-safe slug; auto-derived from name if omitted. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  topic?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
