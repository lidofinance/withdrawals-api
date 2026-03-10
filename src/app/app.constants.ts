import * as fs from 'node:fs';
import * as path from 'node:path';

interface BuildInfo {
  version?: string;
  branch?: string;
  commit?: string;
}

function loadBuildInfo(): BuildInfo {
  try {
    const filePath = path.join(process.cwd(), 'build-info.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const buildInfo = loadBuildInfo();

export const APP_VERSION = buildInfo.version ?? 'unversioned';
export const APP_BRANCH = buildInfo.branch ?? 'unknown';
export const APP_COMMIT = buildInfo.commit ?? 'unknown';

export const APP_NAME = process.env.npm_package_name ?? 'unnamed';
export const APP_DESCRIPTION = process.env.npm_package_description;
