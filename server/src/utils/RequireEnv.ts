const RequireEnv = (Key: string): string => {
  const Value = process.env[Key];
  if (!Value) {
    throw new Error(`Missing required env var: ${Key}`);
  }
  return Value;
};

export default RequireEnv;
