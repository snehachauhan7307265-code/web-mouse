import { ComputerProfile } from '../types';

const STORAGE_KEY = 'webmouse_computer_profiles';

export function getComputerProfiles(): ComputerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read computer profiles:', e);
  }

  // Fallback: Check if there was an existing paired device or config
  try {
    const savedPaired = localStorage.getItem('webmouse_paired_device');
    const savedConfig = localStorage.getItem('webmouse_config');
    if (savedPaired || savedConfig) {
      const paired = savedPaired ? JSON.parse(savedPaired) : null;
      const config = savedConfig ? JSON.parse(savedConfig) : null;
      const host = paired?.ip || config?.host || '';
      if (host) {
        const defaultProfile: ComputerProfile = {
          id: 'profile_' + Date.now(),
          name: paired?.computerName || config?.lastComputerName || 'My Laptop',
          host,
          port: paired?.port || config?.port || 8765,
          token: config?.token,
          pairingCode: config?.code,
          lastConnected: Date.now(),
          status: 'saved',
        };
        saveComputerProfiles([defaultProfile]);
        return [defaultProfile];
      }
    }
  } catch (e) {
    // ignore
  }

  // Initial starter profile
  return [
    {
      id: 'default_laptop',
      name: 'My Laptop',
      host: '',
      port: 8765,
      lastConnected: Date.now(),
      status: 'offline',
    }
  ];
}

export function saveComputerProfiles(profiles: ComputerProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save computer profiles:', e);
  }
}

export function upsertComputerProfile(profileData: Partial<ComputerProfile> & { host: string }): ComputerProfile {
  const profiles = getComputerProfiles();
  const existingIndex = profiles.findIndex(
    (p) => (profileData.id && p.id === profileData.id) || (p.host && p.host.toLowerCase() === profileData.host.toLowerCase())
  );

  let updatedProfile: ComputerProfile;
  if (existingIndex >= 0) {
    updatedProfile = {
      ...profiles[existingIndex],
      ...profileData,
      lastConnected: Date.now(),
    };
    profiles[existingIndex] = updatedProfile;
  } else {
    updatedProfile = {
      id: profileData.id || 'pc_' + Math.random().toString(36).substring(2, 9),
      name: profileData.name || 'New Computer',
      host: profileData.host,
      port: profileData.port || 8765,
      token: profileData.token,
      pairingCode: profileData.pairingCode,
      lastConnected: Date.now(),
      status: profileData.status || 'saved',
    };
    profiles.push(updatedProfile);
  }

  saveComputerProfiles(profiles);
  return updatedProfile;
}

export function renameComputerProfile(id: string, newName: string): ComputerProfile[] {
  const profiles = getComputerProfiles().map((p) => {
    if (p.id === id) {
      return { ...p, name: newName.trim() || p.name };
    }
    return p;
  });
  saveComputerProfiles(profiles);
  return profiles;
}

export function deleteComputerProfile(id: string): ComputerProfile[] {
  const profiles = getComputerProfiles().filter((p) => p.id !== id);
  saveComputerProfiles(profiles);
  return profiles;
}

export function getDeviceTypeLabel(type?: string): string {
  switch (type) {
    case 'windows':
      return 'Windows PC';
    case 'android_tv':
      return 'Android TV';
    case 'smart_board':
      return 'Smart Board';
    case 'tablet':
      return 'Android Tablet';
    case 'android':
      return 'Android Phone';
    default:
      return 'Windows PC';
  }
}

export function getDeviceTypeColor(type?: string): {
  badgeBg: string;
  textColor: string;
} {
  switch (type) {
    case 'android_tv':
      return { badgeBg: 'bg-amber-500/20 border-amber-500/30', textColor: 'text-amber-400' };
    case 'smart_board':
      return { badgeBg: 'bg-purple-500/20 border-purple-500/30', textColor: 'text-purple-400' };
    case 'tablet':
      return { badgeBg: 'bg-blue-500/20 border-blue-500/30', textColor: 'text-blue-400' };
    case 'android':
      return { badgeBg: 'bg-emerald-500/20 border-emerald-500/30', textColor: 'text-emerald-400' };
    case 'windows':
    default:
      return { badgeBg: 'bg-indigo-500/20 border-indigo-500/30', textColor: 'text-indigo-400' };
  }
}

export function getLatencyQuality(latencyMs?: number): {
  label: string;
  color: string;
  badgeBg: string;
  dotColor: string;
} {
  if (latencyMs === undefined || latencyMs === null) {
    return {
      label: 'Good',
      color: 'text-zinc-400',
      badgeBg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      dotColor: 'bg-zinc-400',
    };
  }

  if (latencyMs < 25) {
    return {
      label: 'Excellent',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30',
      dotColor: 'bg-emerald-400',
    };
  }

  if (latencyMs < 60) {
    return {
      label: 'Good',
      color: 'text-indigo-400',
      badgeBg: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/30',
      dotColor: 'bg-indigo-400',
    };
  }

  if (latencyMs < 120) {
    return {
      label: 'Fair',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-500/30',
      dotColor: 'bg-amber-400',
    };
  }

  return {
    label: 'Slow',
    color: 'text-rose-400',
    badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-500/30',
    dotColor: 'bg-rose-400',
  };
}
