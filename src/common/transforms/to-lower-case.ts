import { Transform, TransformFnParams } from 'class-transformer';

export function ToLowerCase(): (target: any, key: string) => void {
  return Transform(({ value }: TransformFnParams) => {
    return String(value).toLocaleLowerCase();
  });
}
