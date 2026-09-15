import * as fs from 'node:fs';
import * as path from 'node:path';

interface BuildInfo {
  version?: string;
  branch?: string;
  commit?: string;
}

interface PackageInfo {
  name?: string;
  version?: string;
  description?: string;
}

function loadJson<T>(fileName: string): T {
  try {
    const filePath = path.join(process.cwd(), fileName);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {} as T;
  }
}

const buildInfo = loadJson<BuildInfo>('build-info.json');
const packageInfo = loadJson<PackageInfo>('package.json');

/** The committed build-info.json ships placeholders that the image build fills in. */
const isPlaceholder = (value?: string): value is undefined => !value || value.startsWith('REPLACE_WITH_');

// The committed placeholders are truthy strings, so `??` alone would let
// "REPLACE_WITH_VERSION" through into the Sentry release, the Swagger document
// version and the build_info labels whenever the image build did not
// substitute the file (any local run, or a broken build step).
export const APP_VERSION = isPlaceholder(buildInfo.version) ? packageInfo.version ?? 'unversioned' : buildInfo.version;
export const APP_BRANCH = isPlaceholder(buildInfo.branch) ? 'unknown' : buildInfo.branch;
export const APP_COMMIT = isPlaceholder(buildInfo.commit) ? 'unknown' : buildInfo.commit;

export const APP_NAME = process.env.npm_package_name ?? packageInfo.name ?? 'unnamed';
export const APP_DESCRIPTION = process.env.npm_package_description ?? packageInfo.description;

/**
 * Sent as `User-Agent` on every outgoing request, so providers and our own ops
 * can attribute the traffic.
 */
export const APP_USER_AGENT = `${APP_NAME}/${APP_VERSION}`;
