import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * MY INTELLIGENCE R1 — the ONLY things a client may say about a story it
 * saves: its URL, and optionally the provider's article id as a lookup hint.
 * Title, source, dates, image and countries are resolved server-side; the
 * global ValidationPipe (forbidNonWhitelisted) rejects any other field.
 */
export class SaveStoryDto {
  @IsString()
  @MaxLength(2000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerArticleId?: string;
}
