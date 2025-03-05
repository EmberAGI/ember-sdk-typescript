import fs from "node:fs";
import z from "zod";
import 'dotenv/config';

export const Settings = z.object({
  ETH_RPC_URL: z.string().default('https://eth.merkle.io'),
});

type SettingsKeys = keyof z.infer<typeof Settings>;
const SENSITIVE_KEYS: string[] = [
] as SettingsKeys[];
const FILE_SUFFIX = "_FILE";
function preProcessEnv() {
  const environment = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(process.env)) {
    if (
      !key.endsWith(FILE_SUFFIX) ||
      !SENSITIVE_KEYS.includes(
        key.substring(0, key.length - FILE_SUFFIX.length),
      ) ||
      !value
    ) {
      environment[key] = value;
      continue;
    }
    environment[key.substring(0, key.length - FILE_SUFFIX.length)] =
      fs.readFileSync(value, "utf8");
  }
  return environment;
}

export const ENVIRONMENT = Settings.parse(preProcessEnv());
