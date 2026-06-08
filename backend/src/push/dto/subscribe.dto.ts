import { IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class SubscribeDto {
  @IsString()
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
