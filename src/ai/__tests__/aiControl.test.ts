/**
 * WebMouse V2 — Phase 3: AI Control Engine Self-Contained Test Suite
 * Tests Natural Language Parsing, Intent Validation, Capability Checking,
 * Safety Bounds, Security Allowlisting, and Confirmation Handling.
 */

import { AIIntentParser } from '../AIIntentParser';
import { AIIntentValidator } from '../AIIntentValidator';
import { AIConfirmationManager } from '../AIConfirmationManager';
import { AIActionRouter } from '../AIActionRouter';
import { AIContext } from '../AIContext';
import { Device } from '../../types';

// Lightweight typed test harness
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock Devices for Testing
export const mockLaptop: Device = {
  id: 'dev-laptop',
  name: 'My Laptop',
  type: 'windows',
  platform: 'windows',
  connectionState: 'connected',
  capabilities: ['mouse', 'keyboard', 'media', 'presentation', 'file_transfer', 'screen_sender', 'quick_share'],
  paired: true,
  host: '192.168.1.100',
  port: 8765,
};

export const mockTv: Device = {
  id: 'dev-tv',
  name: 'Living Room TV',
  type: 'android_tv',
  platform: 'android',
  connectionState: 'connected',
  capabilities: ['tv_remote', 'media', 'screen_receiver'],
  paired: true,
  host: '192.168.1.105',
  port: 8765,
};

export const mockSmartBoard: Device = {
  id: 'dev-board',
  name: 'Smart Board',
  type: 'smart_board',
  platform: 'android',
  connectionState: 'connected',
  capabilities: ['touch', 'screen_receiver', 'presentation_receiver'],
  paired: true,
  host: '192.168.1.110',
  port: 8765,
};

export const mockContext: AIContext = {
  activeDeviceId: mockLaptop.id,
  activeDevice: mockLaptop,
  connectedDevices: [mockLaptop, mockTv, mockSmartBoard],
  lastTargetDevice: mockLaptop.name,
  appMode: 'controller',
  projectionActive: false,
  sessionHistory: [],
};

/**
 * Runs the complete suite of AI Control Engine validation tests
 */
export function runAIControlTests(): TestResult[] {
  const results: TestResult[] = [];

  function runTest(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  }

  // 1. Natural Language Parsing Tests
  runTest('Parses "Open Chrome on my laptop" correctly', () => {
    const intent = AIIntentParser.parse('Open Chrome on my laptop', mockContext);
    assert(intent.intent === 'open_application', `Expected open_application, got ${intent.intent}`);
    assert(intent.parameters?.application === 'chrome', 'Expected chrome app parameter');
    assert(intent.targetDevice === 'My Laptop', 'Expected My Laptop target');
  });

  runTest('Parses "Play music" correctly', () => {
    const intent = AIIntentParser.parse('Play music', mockContext);
    assert(intent.intent === 'media_play', 'Expected media_play');
    assert(intent.requiresConfirmation === false, 'Expected no confirmation for play music');
  });

  runTest('Parses "Pause the video" correctly', () => {
    const intent = AIIntentParser.parse('Pause the video', mockContext);
    assert(intent.intent === 'media_pause', 'Expected media_pause');
  });

  runTest('Parses "Turn the TV volume down" correctly', () => {
    const intent = AIIntentParser.parse('Turn the TV volume down', mockContext);
    assert(intent.intent === 'volume_control', 'Expected volume_control');
    assert(intent.parameters?.action === 'decrease', 'Expected decrease action');
    assert(intent.targetDevice === 'Living Room TV', 'Expected Living Room TV target');
  });

  runTest('Parses "Move the mouse to the right" correctly', () => {
    const intent = AIIntentParser.parse('Move the mouse to the right', mockContext);
    assert(intent.intent === 'mouse_move', 'Expected mouse_move');
    assert(Number(intent.parameters?.dx) > 0, 'Expected positive dx for right');
  });

  runTest('Parses "Go to the next slide" correctly', () => {
    const intent = AIIntentParser.parse('Go to the next slide', mockContext);
    assert(intent.intent === 'presentation_next', 'Expected presentation_next');
  });

  runTest('Parses "Project my screen to the Smart Board" correctly', () => {
    const intent = AIIntentParser.parse('Project my screen to the Smart Board', mockContext);
    assert(intent.intent === 'start_projection', 'Expected start_projection');
    assert(intent.targetDevice === 'Smart Board', 'Expected Smart Board target');
    assert(intent.requiresConfirmation === true, 'Screen projection must require confirmation');
  });

  // 2. Safety & Security Allowlisting Tests
  runTest('Rejects arbitrary PowerShell command', () => {
    const intent = AIIntentParser.parse('Run this arbitrary PowerShell command Get-Process', mockContext);
    assert(intent.intent === 'unknown', 'Malicious command must return unknown intent');
    assert(Boolean(intent.explanation?.includes('unrestricted system commands')), 'Must explain safety restriction');
  });

  runTest('Rejects "Delete all my files"', () => {
    const intent = AIIntentParser.parse('Delete all my files', mockContext);
    assert(intent.intent === 'unknown', 'Destructive command must be rejected');
  });

  runTest('Rejects "Disable Windows security"', () => {
    const intent = AIIntentParser.parse('Disable Windows security', mockContext);
    assert(intent.intent === 'unknown', 'Security tampering must be rejected');
  });

  // 3. Intent Validation & Clamping Tests
  runTest('Validates allowlisted applications and parameter clamping', () => {
    const intent = AIIntentParser.parse('Move the mouse to the right', mockContext);
    const result = AIIntentValidator.validate(intent);
    assert(result.isValid === true, 'Valid intent must pass validation');
    assert(result.sanitizedIntent?.parameters?.dx === 300, 'Expected clamped dx');
  });

  // 4. Capability Checking Tests
  runTest('Smart Board rejects mouse movement because capability is missing', () => {
    const confirmationManager = new AIConfirmationManager();
    const router = new AIActionRouter(confirmationManager);
    const mouseIntent = AIIntentParser.parse('Move the mouse to the right', mockContext);
    const check = router.checkCapabilities(mouseIntent, mockSmartBoard);
    assert(check.supported === false, 'Smart Board must not accept mouse movement');
  });

  runTest('Living Room TV accepts media playback control', () => {
    const confirmationManager = new AIConfirmationManager();
    const router = new AIActionRouter(confirmationManager);
    const mediaIntent = AIIntentParser.parse('Play music', mockContext);
    const check = router.checkCapabilities(mediaIntent, mockTv);
    assert(check.supported === true, 'TV must accept media commands');
  });

  // 5. Confirmation Logic Tests
  runTest('Screen projection requires confirmation while volume control does not', () => {
    const projIntent = AIIntentParser.parse('Project my screen to the Smart Board', mockContext);
    assert(AIConfirmationManager.requiresConfirmation(projIntent) === true, 'Projection must require confirmation');

    const volIntent = AIIntentParser.parse('Turn the TV volume down', mockContext);
    assert(AIConfirmationManager.requiresConfirmation(volIntent) === false, 'Volume must not require confirmation');
  });

  // 6. Device Status & Clarification Tests
  runTest('Parses "Which devices are online?" correctly', () => {
    const intent = AIIntentParser.parse('Which devices are online?', mockContext);
    assert(intent.intent === 'device_status', 'Expected device_status intent');
  });

  runTest('Prompts clarification when projector target is ambiguous', () => {
    // Context with no active device and multiple receivers
    const ambiguousContext: AIContext = {
      ...mockContext,
      activeDevice: null,
      lastTargetDevice: undefined,
    };
    const intent = AIIntentParser.parse('Project my screen', ambiguousContext);
    assert(intent.intent === 'start_projection', 'Expected start_projection');
    assert(Boolean(intent.clarificationOptions?.length), 'Expected clarification options for ambiguous target');
  });

  runTest('Returns unknown with low confidence for nonsensical queries', () => {
    const intent = AIIntentParser.parse('abracadabra flim flam floo', mockContext);
    assert(intent.intent === 'unknown', 'Expected unknown for nonsense');
    assert(intent.confidence < 0.5, 'Expected low confidence');
  });

  return results;
}
