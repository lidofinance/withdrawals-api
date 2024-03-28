import { HTTP_PATHS } from '../../http/http.constants';

export const getPathDetails = (originalUrl: string) => {
  try {
    const path = originalUrl.split('?')[0];
    const parts = path.split('/');
    const version = parseInt(parts[1].substring(1));
    const [, , ...rest] = parts;
    const routeWithoutVersion = rest.join('/');

    if (isNaN(version) || !HTTP_PATHS[version] || !HTTP_PATHS[version][routeWithoutVersion]) {
      return { version: HTTP_PATHS[version] ? version : 'unknown', route: 'unknown' };
    }

    return { version, route: routeWithoutVersion };
  } catch (error) {
    return { version: 'unknown', route: 'unknown' };
  }
};
