import { isSwaggerPath } from './swagger.utils';

describe('isSwaggerPath', () => {
  it.each([
    '/api',
    '/api/',
    '/api/index.html',
    '/api/swagger-ui.css',
    '/api/swagger-ui-init.js',
    '/api/api/swagger-ui-init.js',
    '/api-json',
    '/api-yaml',
    '/api?x=1',
    '/api-json?pretty=1',
  ])('returns true for swagger path %s', (url) => {
    expect(isSwaggerPath(url)).toBe(true);
  });

  it.each(['', '/', '/v1/request-time', '/health', '/metrics', '/apiary', '/api-jsonx', '/v1/api'])(
    'returns false for non-swagger path %s',
    (url) => {
      expect(isSwaggerPath(url)).toBe(false);
    },
  );
});
