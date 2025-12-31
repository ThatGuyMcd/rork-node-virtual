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
      const url = `${API_BASE_URL.replace('/api/v1', '')}/linkwebviewaccount`;
      console.log('[API] Attempting to link account to:', url);
      console.log('[API] Using credentials:', { username: credentials.username, password: '***' });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('[API] Response status:', response.status, response.statusText);
      console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Error response body:', text);
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
      }

      const text = await response.text();
      console.log('[API] Response body:', text);
      const data = JSON.parse(text);
      
      console.log('[API] Parsed response:', data);
      
      if (!data.ok || !data.venueId) {
        throw new Error(data.error || 'No venue/site returned');
      }

      this.siteId = data.venueId;
      console.log('[API] Successfully linked account. Venue ID:', data.venueId);
      return data;
    } catch (error: any) {
      console.error('[API] Link account error:', error);
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
      
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout. Please check your internet connection and try again.');
      }
      
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  async getManifest(siteId: string): Promise<{ path: string; lastModified?: string }[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/sites/${encodeURIComponent(siteId)}/data/manifest`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('json')) {
        const json = await response.json();
        const files = Array.isArray(json) ? json : (json.files || []);
        return files.map((item: any) => {
          if (typeof item === 'string') {
            return { path: this.normalizePath(item) };
          }
          return {
            path: this.normalizePath(item.path || item.name || item),
            lastModified: item.lastModified || item.modified || item.mtime,
          };
        });
      } else {
        const text = await response.text();
        return text
          .split(/\r?\n/)
          .map(s => s.trim())
          .filter(Boolean)
          .map(path => ({ path: this.normalizePath(path) }));
      }
    } catch (error: any) {
      console.error('Get manifest error:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout while fetching data manifest.');
      }
      
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  async getFile(siteId: string, path: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `${API_BASE_URL}/sites/${encodeURIComponent(siteId)}/data/file?path=${encodeURIComponent(path)}`,
        {
          method: 'GET',
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error: any) {
      console.error(`Get file error (${path}):`, error);
      
      if (error.name === 'AbortError') {
        throw new Error(`Timeout downloading file: ${path}`);
      }
      
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        throw new Error('Connection lost. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  async saveTableData(siteId: string, area: string, tableName: string, tableData: string): Promise<{ success: boolean }> {
    try {
      console.log(`[API] Saving table data for ${area}/${tableName}`);
      
      const folderPath = `TABDATA/${area}/${tableName}`;
      const filePath = `${folderPath}/TAB.CSV`;
      
      const payload = {
        SITEID: siteId,
        DESTINATIONWEBVIEWFOLDER: 'TABDATA',
        FOLDERDATA: [area, `${area}/${tableName}`],
        FILEDATA: {
          [filePath]: tableData,
        },
      };
      
      console.log('[API] Uploading table via webviewdataupload endpoint');
      console.log('[API] Folder path:', folderPath);
      console.log('[API] File path:', filePath);
      console.log('[API] Data size:', tableData.length, 'bytes');
      
      const url = `${API_BASE_URL.replace('/api/v1', '')}/webviewdataupload`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Save table data error response:', response.status, text);
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      console.log('[API] Successfully saved table data');
      return { success: true };
    } catch (error: any) {
      console.error('[API] Save table data error:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout while saving table data.');
      }
      
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      
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
