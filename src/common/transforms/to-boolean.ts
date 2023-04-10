import { Transform, TransformFnParams } from 'class-transformer';

export function ToBoolean(): (target: any, key: string) => void {
  return Transform(({ value }: TransformFnParams) => {
    return value === 'true' || value === true || value === 1 || value === '1';
  });
}
