import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, Validate } from 'class-validator';
import { IsBigNumberValidator } from 'common/validators/is-big-number.validator';

export class RequestsTimeOptionsDto {
  @ApiProperty({ isArray: true, description: 'Array of id withdrawal requests', example: ['1', '2'] })
  @ArrayMaxSize(20)
  @ArrayMinSize(1)
  @IsArray()
  @Validate(IsBigNumberValidator, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    } else if (typeof value === 'string') {
      return decodeURIComponent(value).split(',');
    } else {
      return Array(value);
    }
  })
  ids: string[];
}
