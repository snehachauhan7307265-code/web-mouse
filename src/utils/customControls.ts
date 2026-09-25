import { CustomControl } from '../types';

const STORAGE_KEY = 'webmouse_custom_controls';

export const DEFAULT_CUSTOM_CONTROLS: CustomControl[] = [
  {
    id: 'btn_copy',
    title: 'Ctrl + C',
    icon: 'Copy',
    color: 'indigo',
    type: 'shortcut',
    shortcutKeys: ['ctrl', 'c'],
  },
  {
    id: 'btn_paste',
    title: 'Ctrl + V',
    icon: 'Clipboard',
    color: 'blue',
    type: 'shortcut',
    shortcutKeys: ['ctrl', 'v'],
  },
  {
    id: 'btn_alttab',
    title: 'Alt + Tab',
    icon: 'Layers',
    color: 'purple',
    type: 'quick',
    quickAction: 'alttab',
  },
  {
    id: 'btn_desktop',
    title: 'Desktop',
    icon: 'Monitor',
    color: 'emerald',
    type: 'quick',
    quickAction: 'desktop',
  },
  {
    id: 'btn_mute',
    title: 'Mute',
    icon: 'VolumeX',
    color: 'amber',
    type: 'media',
    mediaAction: 'volumemute',
  },
  {
    id: 'btn_snip',
    title: 'Screenshot',
    icon: 'Camera',
    color: 'rose',
    type: 'quick',
    quickAction: 'screenshot',
  },
  {
    id: 'btn_taskmgr',
    title: 'Task Mgr',
    icon: 'Activity',
    color: 'zinc',
    type: 'quick',
    quickAction: 'taskmgr',
  },
  {
    id: 'btn_save',
    title: 'Ctrl + S',
    icon: 'Save',
    color: 'emerald',
    type: 'shortcut',
    shortcutKeys: ['ctrl', 's'],
  },
];

export function getCustomControls(): CustomControl[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load custom controls:', e);
  }
  return DEFAULT_CUSTOM_CONTROLS;
}

export function saveCustomControls(controls: CustomControl[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
  } catch (e) {
    console.error('Failed to save custom controls:', e);
  }
}

export function addCustomControl(controlData: Omit<CustomControl, 'id'>): CustomControl {
  const controls = getCustomControls();
  const newControl: CustomControl = {
    ...controlData,
    id: 'custom_' + Math.random().toString(36).substring(2, 9),
  };
  controls.push(newControl);
  saveCustomControls(controls);
  return newControl;
}

export function deleteCustomControl(id: string): CustomControl[] {
  const controls = getCustomControls().filter((c) => c.id !== id);
  saveCustomControls(controls);
  return controls;
}

export function moveCustomControl(id: string, direction: 'up' | 'down'): CustomControl[] {
  const controls = [...getCustomControls()];
  const index = controls.findIndex((c) => c.id === id);
  if (index < 0) return controls;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= controls.length) return controls;

  const temp = controls[index];
  controls[index] = controls[targetIndex];
  controls[targetIndex] = temp;

  saveCustomControls(controls);
  return controls;
}
