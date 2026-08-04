import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { NewsModule } from './modules/news/news.module';
import { AnalysisModule } from './modules/analysis/analysis.module';

@Module({
  imports: [
    // Loads environment variables from .env and makes them available
    // application-wide via the ConfigService. Further feature configuration
    // (database, auth, etc.) will be added in later sprints.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HealthModule,
    NewsModule,
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
