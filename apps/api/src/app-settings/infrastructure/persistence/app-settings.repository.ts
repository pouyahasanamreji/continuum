import { WhitelistedSettingKey } from '../../app-settings.keys';

export abstract class AppSettingsRepository {
  abstract getValue(key: WhitelistedSettingKey): string | null;
  abstract setValue(
    key: WhitelistedSettingKey,
    value: string,
    now: number,
  ): void;
  abstract deleteValue(key: WhitelistedSettingKey): void;
  abstract applyPatch(
    patch: Partial<Record<WhitelistedSettingKey, string>>,
    now: number,
  ): void;
}
