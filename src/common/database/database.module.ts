import { TypeOrmModule } from '@nestjs/typeorm';
import { getTypeOrmConfig } from './database.config';

export const DatabaseModule = TypeOrmModule.forRoot(getTypeOrmConfig());
