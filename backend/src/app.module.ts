import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [RedisModule, SyncModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
