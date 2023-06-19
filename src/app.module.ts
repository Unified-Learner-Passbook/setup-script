import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConsoleModule } from 'nestjs-console';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    {
      ...HttpModule.register({}),
      global: true,
    },
    ConsoleModule, // import the ConsoleModule
  ],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
