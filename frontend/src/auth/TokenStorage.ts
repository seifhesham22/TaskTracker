export interface ITokenStorage {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
}

export class LocalStorageTokenStorage implements ITokenStorage {
  private readonly storageKey: string;

  constructor(storageKey = 'tasktracker_auth_token') {
    this.storageKey = storageKey;
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    try {
      localStorage.setItem(this.storageKey, token);
    } catch {
      // Ignore errors if local storage is restricted or disabled
    }
  }

  clearToken(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore errors
    }
  }
}

export const defaultTokenStorage = new LocalStorageTokenStorage();
