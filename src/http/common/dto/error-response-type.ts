import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseType {
  @ApiProperty({
    example: 400,
    description: 'Http status code',
  })
  statusCode: number;

  @ApiProperty({
    description: 'Array of validation error messages',
  })
  message: string[];

  @ApiProperty({
    description: 'Error text',
    example: 'Bad Request',
  })
  error: string;
}
