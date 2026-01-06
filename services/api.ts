const getApiUrl = () => {
  const url = 'https://app.positron-portal.com';
  console.log('[API] Using Positron server URL:', url);
  return url;
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
      const baseUrl = getApiUrl();
      const url = `${baseUrl}/linkwebviewaccount`;
      console.log('[API] POST', url);
      console.log('[API] Request body:', JSON.stringify(credentials));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('[API] Response status:', response.status);
      console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Error response body:', text);
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const text = await response.text();
      console.log('[API] Response body:', text);
      
      const data = JSON.parse(text);
      
      if (!data.ok || !data.venueId) {
        throw new Error(data.error || 'No venue returned');
      }

      this.siteId = data.venueId;
      console.log('[API] Successfully linked to venue:', data.venueId);
      return data;
    } catch (error: any) {
      console.error('[API] Link error:', error);
      console.error('[API] Error type:', error.constructor.name);
      console.error('[API] Error message:', error.message);
      if (error.name === 'AbortError') {
        throw new Error('Connection timeout');
      }
      throw error;
    }
  }

  async getManifest(siteId: string): Promise<{ path: string; lastModified?: string }[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const baseUrl = getApiUrl();
      const url = `${baseUrl}/api/v1/sites/${encodeURIComponent(siteId)}/data/manifest`;
      console.log('[API] GET', url);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('[API] Manifest response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Manifest error response:', text);
        throw new Error(`HTTP ${response.status}: ${text}`);
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
      console.error('[API] Manifest error:', error);
      console.error('[API] Error type:', error.constructor.name);
      console.error('[API] Error message:', error.message);
      if (error.name === 'AbortError') {
        throw new Error('Timeout fetching manifest');
      }
      throw error;
    }
  }

  async getFile(siteId: string, path: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const baseUrl = getApiUrl();
      const url = `${baseUrl}/api/v1/sites/${encodeURIComponent(siteId)}/data/file?path=${encodeURIComponent(path)}`;
      console.log('[API] GET file:', path);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        console.error('[API] File error response:', text);
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      return await response.text();
    } catch (error: any) {
      console.error('[API] File error:', error);
      console.error('[API] Error type:', error.constructor.name);
      console.error('[API] Error message:', error.message);
      if (error.name === 'AbortError') {
        throw new Error(`Timeout downloading: ${path}`);
      }
      throw error;
    }
  }

  async saveTableData(siteId: string, area: string, tableName: string, csvContent: string): Promise<{ success: boolean }> {
    const destinationFolder = `TABDATA\\${area}\\${tableName}`;
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/webviewdataupload`;
    
    const payload = {
      SITEID: siteId,
      DESTINATIONWEBVIEWFOLDER: destinationFolder,
      FOLDERDATA: [] as string[],
      FILEDATA: {
        'TAB.CSV': csvContent,
      },
    };
    
    console.log('[API] POST', url);
    console.log('[API] Uploading table data:', area, '/', tableName);
    console.log('[API] Payload keys:', Object.keys(payload));
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      console.log('[API] Table data response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Table data error response:', text);
        throw new Error(`Server error ${response.status}: ${text}`);
      }
      
      const responseText = await response.text();
      console.log('[API] Table data response:', responseText);
      console.log('[API] Table data uploaded successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[API] Upload failed:', error);
      console.error('[API] Error type:', error.constructor.name);
      console.error('[API] Error message:', error.message);
      throw error;
    }
  }

  async uploadTransactionData(siteId: string, destinationFolder: string, fileData: Record<string, string>): Promise<{ success: boolean }> {
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/webviewdataupload`;
    
    const payload = {
      SITEID: siteId,
      DESTINATIONWEBVIEWFOLDER: destinationFolder,
      FOLDERDATA: [] as string[],
      FILEDATA: fileData,
    };

    console.log('[API] POST', url);
    console.log('[API] Uploading', Object.keys(fileData).length, 'transaction files');
    console.log('[API] Destination folder:', destinationFolder);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      console.log('[API] Transaction upload response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Transaction upload error response:', text);
        throw new Error(`Server error ${response.status}: ${text}`);
      }
      
      const responseText = await response.text();
      console.log('[API] Transaction upload response:', responseText);
      console.log('[API] Transactions uploaded successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[API] Transaction upload failed:', error);
      console.error('[API] Error type:', error.constructor.name);
      console.error('[API] Error message:', error.message);
      throw error;
    }
  }

  async uploadSettingsProfiles(siteId: string, allProfiles: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/uploadsettingsprofile`;
    
    console.log('[API] POST', url);
    console.log('[API] Uploading', Object.keys(allProfiles).length, 'settings profiles');
    console.log('[API] Site ID:', siteId);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, allProfiles }),
      });
      
      console.log('[API] Settings upload response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Settings upload error response:', text);
        return { success: false, error: `Server error ${response.status}: ${text}` };
      }
      
      const responseText = await response.text();
      console.log('[API] Settings upload response:', responseText);
      console.log('[API] Settings profiles uploaded successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[API] Settings upload failed:', error);
      console.error('[API] Error type:', error.constructor.name);
      console.error('[API] Error message:', error.message);
      return { success: false, error: error.message || 'Upload failed' };
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
