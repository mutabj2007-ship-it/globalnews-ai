import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AnalyzeNewsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(300)
  query!: string;
}
