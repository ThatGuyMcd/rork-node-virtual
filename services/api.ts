const API_BASE_URL = 'https://app.positron-portal.com/api/v1';

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface LinkResponse {
  ok: boolean;
  venueId: string;
  venueName?: string;
  error?: string;
}

export class PositronAPI {
  private siteId: string | null = null;

  async linkAccount(credentials: AuthCredentials): Promise<LinkResponse> {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/linkwebviewaccount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
      }

      const data = await response.json();
      
      if (!data.ok || !data.venueId) {
        throw new Error(data.error || 'No venue/site returned');
      }

      this.siteId = data.venueId;
      return data;
    } catch (error) {
      console.error('Link account error:', error);
      throw error;
    }
  }

  async getManifest(siteId: string): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/sites/${encodeURIComponent(siteId)}/data/manifest`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('json')) {
        const json = await response.json();
        const files = Array.isArray(json) ? json : (json.files || []);
        return files.map(this.normalizePath);
      } else {
        const text = await response.text();
        return text
          .split(/\r?\n/)
          .map(s => s.trim())
          .filter(Boolean)
          .map(this.normalizePath);
      }
    } catch (error) {
      console.error('Get manifest error:', error);
      throw error;
    }
  }

  async getFile(siteId: string, path: string): Promise<string> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/sites/${encodeURIComponent(siteId)}/data/file?path=${encodeURIComponent(path)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Get file error (${path}):`, error);
      throw error;
    }
  }

  private normalizePath(path: string): string {
    return String(path || '')
      .replace(/^[.\\/]+/, '')
      .replace(/\\/g, '/')
      .replace(/^DATA\//i, '');
  }
}

export const apiClient = new PositronAPI();
