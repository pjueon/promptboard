import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface AppSettings {
  theme: 'light' | 'dark';
  locale: 'en' | 'ko' | 'ja';
  autoSave: boolean;
  autoSaveInterval: number; // seconds
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  locale: 'en',
  autoSave: true,
  autoSaveInterval: 30,
};

/**
 * Get settings file path
 * Stored next to the executable for portability
 */
function getSettingsPath(): string {
  // In development, use app.getPath('userData')
  // In production, use executable directory for portability
  if (app.isPackaged) {
    // Production: Store in executable directory
    const exePath = process.execPath;
    const exeDir = path.dirname(exePath);
    return path.join(exeDir, 'promptboard-settings.json');
  } else {
    // Development: Use userData directory
    return path.join(app.getPath('userData'), 'promptboard-settings.json');
  }
}

/**
 * Load settings from file
 */
export function loadSettings(): AppSettings {
  const settingsPath = getSettingsPath();
  
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(data);
      
      // Validate settings
      const validTheme = settings.theme === 'light' || settings.theme === 'dark';
      const validLocale = settings.locale === 'en' || settings.locale === 'ko' || settings.locale === 'ja';
      const validAutoSave = typeof settings.autoSave === 'boolean';
      const validInterval = typeof settings.autoSaveInterval === 'number' && settings.autoSaveInterval > 0;

      if (validTheme && validLocale && validAutoSave && validInterval) {
        return settings;
      }
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to file
 */
export function saveSettings(settings: AppSettings): boolean {
  const settingsPath = getSettingsPath();
  
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}
