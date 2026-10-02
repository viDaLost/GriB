import { useSyncExternalStore } from 'react';
import type { KeyAnswers } from '../data/questions';

/** Один снимок гриба и ответ модели по нему. */
export interface Shot {
  /** URI снимка для показа (file://...) */
  uri: string;
  probs: number[];
}

export interface ScanSession {
  shots: Shot[];
  /** Признаки, которые назвал пользователь, чтобы уточнить результат */
  answers: KeyAnswers;
}

export const MAX_SHOTS = 3;

/** Что снимать на каждом шаге: самые важные признаки часто не видны на одном фото. */
export const SHOT_HINTS = [
  'Гриб целиком, сбоку: шляпка и ножка',
  'Низ шляпки: пластинки, губка или складки',
  'Основание ножки — выкопайте гриб целиком',
];

let session: ScanSession = { shots: [], answers: {} };
const listeners = new Set<() => void>();

function update(next: ScanSession) {
  session = next;
  listeners.forEach((l) => l());
}

export function startSession(): void {
  update({ shots: [], answers: {} });
}

export function addShot(shot: Shot): void {
  update({ ...session, shots: [...session.shots, shot].slice(0, MAX_SHOTS) });
}

export function removeShot(index: number): void {
  update({ ...session, shots: session.shots.filter((_, i) => i !== index) });
}

export function setAnswers(answers: KeyAnswers): void {
  update({ ...session, answers });
}

export function getSession(): ScanSession {
  return session;
}

export function useScanSession(): ScanSession {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => session,
  );
}
