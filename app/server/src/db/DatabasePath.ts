import path from "node:path";

const normalizeEnvPath = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const resolveDatabaseRoot = (): string => {
  const envPath = normalizeEnvPath(process.env.DATABASE_PATH);
  if (!envPath) {
    throw new Error("DATABASE_PATH must be set to resolve database files.");
  }
  return path.resolve(envPath);
};

export const resolveDatabaseDir = (overrideDir?: string): string => {
  const root = resolveDatabaseRoot();
  const normalized = normalizeEnvPath(overrideDir);
  if (!normalized) {
    return root;
  }
  return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
};

export const resolveDatabaseFile = (
  fileName: string,
  options?: { overridePath?: string; overrideDir?: string }
): string => {
  const baseDir = resolveDatabaseDir(options?.overrideDir);
  const overridePath = normalizeEnvPath(options?.overridePath);
  if (overridePath) {
    return path.isAbsolute(overridePath) ? overridePath : path.resolve(baseDir, overridePath);
  }
  return path.resolve(baseDir, fileName);
};
