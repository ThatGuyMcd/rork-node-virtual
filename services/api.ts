import { Platform } from 'react-native';

const EXTERNAL_API_BASE_URL = 'https://app.positron-portal.com/api/v1';
const EXTERNAL_SERVER_URL = 'https://app.positron-portal.com';

const getProxyBaseUrl = (): string => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (apiBaseUrl) {
    return apiBaseUrl;
  }
  if (Platform.OS === 'web') {
    return '';
  }
  return 'http://localhost:3000';
};

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
      const url = 'https://app.positron-portal.com/linkwebviewaccount';
      console.log('[API] Attempting to link account to:', url);
      console.log('[API] Using credentials:', { username: credentials.username, password: '***' });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('[API] Response status:', response.status, response.statusText);
      console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      const contentType = response.headers.get('content-type') || '';
      console.log('[API] Content-Type:', contentType);

      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Error response body:', text);
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
      }

      const text = await response.text();
      console.log('[API] Response body:', text);
      
      if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        console.error('[API] Received non-JSON response. Content-Type:', contentType);
        console.error('[API] Response preview:', text.substring(0, 500));
        throw new Error('Backend server error: Received HTML instead of JSON. The backend may not be running or accessible.');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[API] Failed to parse response as JSON:', parseError);
        console.error('[API] Response text:', text.substring(0, 500));
        throw new Error('Backend returned invalid JSON. The backend may not be running or there\'s a server error.');
      }
      
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

      const url = `${EXTERNAL_API_BASE_URL}/sites/${encodeURIComponent(siteId)}/data/manifest`;

      const response = await fetch(url, {
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

      const url = `${EXTERNAL_API_BASE_URL}/sites/${encodeURIComponent(siteId)}/data/file?path=${encodeURIComponent(path)}`;

      const response = await fetch(
        url,
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
      console.log(`[API] ========== SAVING TABLE DATA ==========`);
      console.log(`[API] Site ID: ${siteId}`);
      console.log(`[API] Area: ${area}`);
      console.log(`[API] Table: ${tableName}`);
      console.log(`[API] Data size: ${tableData.length} bytes`);
      console.log(`[API] Platform: ${Platform.OS}`);
      
      const destinationFolder = `TABDATA\\${area}\\${tableName}`;
      
      const payload = {
        SITEID: siteId,
        DESTINATIONWEBVIEWFOLDER: destinationFolder,
        FOLDERDATA: [],
        FILEDATA: {
          'TAB.CSV': tableData,
        },
      };
      
      console.log('[API] Destination folder:', destinationFolder);
      
      const useProxy = Platform.OS === 'web';
      const url = useProxy 
        ? `${getProxyBaseUrl()}/api/proxy/webviewdataupload`
        : `${EXTERNAL_SERVER_URL}/webviewdataupload`;
      
      console.log(`[API] Using ${useProxy ? 'proxy' : 'direct'} endpoint: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const elapsed = Date.now() - startTime;
      console.log(`[API] Response received after ${elapsed}ms`);
      console.log('[API] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Error response body:', text);
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`);
      }
      
      const result = await response.json().catch(() => ({ success: true }));
      console.log('[API] Server result:', result);
      console.log('[API] ========== SAVE SUCCESSFUL ==========');
      return { success: true };
    } catch (error: any) {
      console.error('[API] ========== SAVE FAILED ==========');
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
      
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout while saving table data.');
      }
      
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection and server status.');
      }
      
      throw new Error(error.message || 'Failed to save table data');
    }
  }

  async uploadTransactionData(siteId: string, destinationFolder: string, fileData: Record<string, string>): Promise<{ success: boolean }> {
    try {
      console.log(`[API] ========== UPLOADING TRANSACTION DATA ==========`);
      console.log(`[API] Site ID: ${siteId}`);
      console.log(`[API] Destination: ${destinationFolder}`);
      console.log(`[API] File count: ${Object.keys(fileData).length}`);
      console.log(`[API] Platform: ${Platform.OS}`);
      
      const payload = {
        SITEID: siteId,
        DESTINATIONWEBVIEWFOLDER: destinationFolder,
        FOLDERDATA: [] as string[],
        FILEDATA: fileData,
      };
      
      const useProxy = Platform.OS === 'web';
      const url = useProxy 
        ? `${getProxyBaseUrl()}/api/proxy/webviewdataupload`
        : `${EXTERNAL_SERVER_URL}/webviewdataupload`;
      
      console.log(`[API] Using ${useProxy ? 'proxy' : 'direct'} endpoint: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const elapsed = Date.now() - startTime;
      console.log(`[API] Response received after ${elapsed}ms`);
      console.log('[API] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Error response body:', text);
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json().catch(() => ({ success: true }));
      console.log('[API] Server result:', result);
      console.log('[API] ========== TRANSACTION UPLOAD SUCCESSFUL ==========');
      return { success: true };
    } catch (error: any) {
      console.error('[API] ========== TRANSACTION UPLOAD FAILED ==========');
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout while uploading transaction data.');
      }
      
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection and server status.');
      }
      
      throw new Error(error.message || 'Failed to upload transaction data');
    }
  }

  async uploadSettingsProfiles(siteId: string, allProfiles: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[API] ========== UPLOADING SETTINGS PROFILES ==========');
      console.log(`[API] Site ID: ${siteId}`);
      console.log(`[API] Profile count: ${Object.keys(allProfiles).length}`);
      console.log(`[API] Platform: ${Platform.OS}`);
      
      const payload = {
        siteId,
        allProfiles,
      };
      
      const useProxy = Platform.OS === 'web';
      const url = useProxy 
        ? `${getProxyBaseUrl()}/api/proxy/uploadsettingsprofile`
        : `${EXTERNAL_SERVER_URL}/uploadsettingsprofile`;
      
      console.log(`[API] Using ${useProxy ? 'proxy' : 'direct'} endpoint: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const elapsed = Date.now() - startTime;
      console.log(`[API] Response received after ${elapsed}ms`);
      console.log('[API] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Error response body:', text);
        return { success: false, error: `Server returned ${response.status}: ${text}` };
      }
      
      const result = await response.json().catch(() => ({ success: true }));
      console.log('[API] Server result:', result);
      
      if (result.success === false) {
        console.error('[API] ========== SETTINGS PROFILES UPLOAD FAILED ==========');
        return { success: false, error: result.error || 'Unknown error' };
      }
      
      console.log('[API] ========== SETTINGS PROFILES UPLOAD SUCCESSFUL ==========');
      return { success: true };
    } catch (error: any) {
      console.error('[API] ========== SETTINGS PROFILES UPLOAD FAILED ==========');
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      
      if (error.name === 'AbortError') {
        return { success: false, error: 'Connection timeout while uploading settings profiles.' };
      }
      
      if (error.message === 'Failed to fetch' || error.message === 'Network request failed') {
        return { success: false, error: 'Network error: Unable to connect to server.' };
      }
      
      return { success: false, error: error.message || 'Failed to upload settings profiles' };
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
