import assert from 'node:assert/strict';
import test from 'node:test';
import { needsIOSInstallation, type InstallEnvironment } from '../src/ui/installEnvironment.ts';

const iphone: InstallEnvironment = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  platform: 'iPhone', maxTouchPoints: 5, standaloneDisplay: false,
};

test('iOS Safari, third-party browsers and embedded browsers all require installation', () => {
  for (const suffix of ['Safari/604.1', 'CriOS/142.0', 'FxiOS/144.0', 'EdgiOS/142.0', 'Telegram']) {
    assert.equal(needsIOSInstallation({ ...iphone, userAgent: iphone.userAgent.replace('Safari/604.1', suffix) }), true);
  }
});

test('installed iOS app opens using either standalone signal', () => {
  assert.equal(needsIOSInstallation({ ...iphone, standalone: true }), false);
  assert.equal(needsIOSInstallation({ ...iphone, standaloneDisplay: true }), false);
});

test('iPad including desktop Safari requires installation only in a browser', () => {
  const ipad = { ...iphone, platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15' };
  assert.equal(needsIOSInstallation(ipad), true);
  assert.equal(needsIOSInstallation({ ...ipad, standalone: true }), false);
  assert.equal(needsIOSInstallation({ ...iphone, platform: 'iPad', userAgent: 'Mozilla/5.0 (iPad; CPU OS 26_0)' }), true);
});

test('Android, macOS and desktop browsers open the website normally', () => {
  for (const environment of [
    { userAgent: 'Mozilla/5.0 (Linux; Android 16) Chrome/142', platform: 'Linux armv8l', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605', platform: 'MacIntel', maxTouchPoints: 0 },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/142', platform: 'Win32', maxTouchPoints: 10 },
  ]) assert.equal(needsIOSInstallation({ ...environment, standaloneDisplay: false }), false);
});
