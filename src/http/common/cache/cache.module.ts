import { CacheModule as CacheModuleSource } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from 'common/config';

export const CacheModule = CacheModuleSource.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => ({
    // cache-manager@^5 uses ms
    ttl: configService.get('GLOBAL_CACHE_TTL') * 1000,
  }),
});
