import { SWAGGER_URL } from './swagger.constants';

export const isSwaggerPath = (url: string): boolean => {
  const prefix = `/${SWAGGER_URL}`;

  // The hook is global and runs on every response, so bail out before splitting.
  if (!url.startsWith(prefix)) return false;

  const path = url.split('?')[0];

  return path === prefix || path.startsWith(`${prefix}/`) || path === `${prefix}-json` || path === `${prefix}-yaml`;
};
