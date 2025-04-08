import { CronExpression } from '@nestjs/schedule';
import { plainToClass, Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  validateSync,
  Min,
  IsArray,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { Environment, LogLevel, LogFormat } from './interfaces';

const toNumber =
  ({ defaultValue }) =>
  ({ value }) => {
    if (value === '' || value == null) return defaultValue;
    return Number(value);
  };

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.development;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 3000 }))
  PORT: number = 3000;

  @IsOptional()
  @IsString()
  CORS_WHITELIST_REGEXP = '';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 5 }))
  GLOBAL_THROTTLE_TTL: number = 5;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 100 }))
  GLOBAL_THROTTLE_LIMIT: number = 100;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toNumber({ defaultValue: 1 }))
  GLOBAL_CACHE_TTL: number = 1;

  @IsOptional()
  @IsString()
  SENTRY_DSN: string | null = null;

  @IsOptional()
  @IsEnum(LogLevel)
  @Transform(({ value }) => value || LogLevel.info)
  LOG_LEVEL: LogLevel = null;

  @IsOptional()
  @IsEnum(LogFormat)
  @Transform(({ value }) => value || LogFormat.json)
  LOG_FORMAT: LogFormat = null;

  @IsOptional()
  @IsString()
  JOB_INTERVAL_VALIDATORS = null;

  @IsOptional()
  @IsString()
  JOB_INTERVAL_QUEUE_INFO = CronExpression.EVERY_5_MINUTES;

  @IsOptional()
  @IsString()
  JOB_INTERVAL_CONTRACT_CONFIG = CronExpression.EVERY_10_HOURS;

  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) => value.split(','))
  CL_API_URLS: string[] = null;

  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) => value.split(','))
  EL_RPC_URLS: string[] = null;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  CHAIN_ID: number = null;

  @IsOptional()
  @IsString()
  KEYS_API_BASE_PATH = '';

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  IS_SERVICE_UNAVAILABLE = false;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  EL_RETRY_COUNT = 2;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  EL_BLOCK_STEP = 500;

  @IsOptional()
  @IsString()
  CUSTOM_NETWORK_FILE_NAME: string;
}
export const ENV_KEYS = Object.keys(new EnvironmentVariables());

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config);

  const validatorOptions = { skipMissingProperties: false };
  const errors = validateSync(validatedConfig, validatorOptions);

  if (errors.length > 0) {
    console.error(errors.toString());
    process.exit(1);
  }

  return validatedConfig;
}
