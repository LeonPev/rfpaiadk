import type { AppState } from './types';
import { initialState } from './workflow';

const storageKey = 'ayit-adk-workflow-state-v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(storageKey);
}
