const getApiUrl = () => {
  const url = 'https://app.positron-portal.com';
  console.log('[API] Using direct Positron server:', url);
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
      
      if (text.trim().startsWith('<')) {
        throw new Error('Received HTML instead of JSON. Check server CORS configuration.');
      }
      
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

  async saveSingleTableData(
    siteId: string,
    area: string,
    tableName: string,
    csvContent: string,
    additionalFiles: Record<string, string> = {}
  ): Promise<{ success: boolean }> {
    console.log('[API] ====== saveSingleTableData CALLED ======');
    console.log('[API] siteId:', siteId);
    console.log('[API] area:', area);
    console.log('[API] tableName:', tableName);
    console.log('[API] csvContent length:', csvContent?.length || 0);
    console.log('[API] Additional files:', Object.keys(additionalFiles));
    
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/webviewdataupload`;
    
    // Build file data with full paths (matching settings-profiles pattern)
    const fileData: Record<string, string> = {};
    const folderPath = `DATA/TABDATA/${area}/${tableName}`;
    
    // Add tabledata.csv
    fileData[`${folderPath}/tabledata.csv`] = csvContent;
    
    // Add additional files
    for (const [filename, content] of Object.entries(additionalFiles)) {
      fileData[`${folderPath}/${filename}`] = content;
    }
    
    const payload = {
      SITEID: siteId,
      DESTINATIONWEBVIEWFOLDER: '',
      FOLDERDATA: [folderPath],
      FILEDATA: fileData,
    };
    
    console.log('[API] POST', url);
    console.log('[API] Uploading table data:', area, '/', tableName);
    console.log('[API] Files to upload:', Object.keys(fileData));
    console.log('[API] Payload size:', JSON.stringify(payload).length, 'bytes');
    
    try {
      console.log('[API] About to call fetch...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[API] Request timeout after 30s');
        controller.abort();
      }, 30000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('[API] Fetch completed, response received');
      
      console.log('[API] Table data response status:', response.status);
      console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] Table data error response:', text);
        throw new Error(`Server error ${response.status}: ${text}`);
      }
      
      const responseText = await response.text();
      console.log('[API] Table data response:', responseText);
      console.log('[API] Single table data uploaded successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[API] ====== SINGLE TABLE UPLOAD ERROR ======');
      console.error('[API] Error name:', error.name);
      console.error('[API] Error type:', error.constructor?.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Full error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout after 30 seconds');
      }
      throw error;
    }
  }

  async saveAllTableData(siteId: string, allTableData: Map<string, any[]>): Promise<{ success: boolean }> {
    console.log('[API] ====== saveAllTableData CALLED ======');
    console.log('[API] siteId:', siteId);
    console.log('[API] Number of tables:', allTableData.size);
    
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/webviewdataupload`;
    
    const folderData: string[] = [];
    const fileData: Record<string, string> = {};
    const areaSet = new Set<string>();
    
    for (const [tableKey, rows] of allTableData.entries()) {
      const parts = tableKey.split('/');
      const area = parts[0];
      const tableName = parts[1];
      
      areaSet.add(area);
      
      const areaTableFolder = `${area}/${tableName}`;
      if (!folderData.includes(area)) {
        folderData.push(area);
      }
      if (!folderData.includes(areaTableFolder)) {
        folderData.push(areaTableFolder);
      }
      
      const csvRows: string[] = [];
      csvRows.push('X,Product,Price,PLUFile,Group,Department,VATCode,VATPercentage,VATAmount,Added By,Time/Date Added,PRINTER 1,PRINTER 2,PRINTER 3,Item Printed?');
      
      for (const row of rows) {
        const line = [
          row.quantity.toFixed(3),
          ` ${row.productName}`,
          row.price.toFixed(2),
          row.pluFile,
          row.group,
          row.department,
          row.vatCode,
          row.vatPercentage.toString(),
          row.vatAmount.toFixed(2),
          row.addedBy,
          row.timeDate,
          row.printer1,
          row.printer2,
          row.printer3,
          row.itemPrinted,
        ].join(',');
        csvRows.push(line);
      }
      
      const csvContent = csvRows.join('\n');
      fileData[`${areaTableFolder}/tabledata.csv`] = csvContent;
    }
    
    const payload = {
      SITEID: siteId,
      DESTINATIONWEBVIEWFOLDER: 'TABDATA',
      FOLDERDATA: folderData,
      FILEDATA: fileData,
    };
    
    console.log('[API] POST', url);
    console.log('[API] Uploading all table data');
    console.log('[API] Areas:', Array.from(areaSet));
    console.log('[API] Total tables:', allTableData.size);
    console.log('[API] Payload size:', JSON.stringify(payload).length, 'bytes');
    
    try {
      console.log('[API] About to call fetch...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[API] Request timeout after 30s');
        controller.abort();
      }, 30000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('[API] Fetch completed, response received');
      
      console.log('[API] All table data response status:', response.status);
      console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[API] All table data error response:', text);
        throw new Error(`Server error ${response.status}: ${text}`);
      }
      
      const responseText = await response.text();
      console.log('[API] All table data response:', responseText);
      console.log('[API] All table data uploaded successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[API] ====== ALL TABLE UPLOAD ERROR ======');
      console.error('[API] Error name:', error.name);
      console.error('[API] Error type:', error.constructor?.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Full error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout after 30 seconds');
      }
      throw error;
    }
  }

  async uploadTransactionData(siteId: string, destinationFolder: string, fileData: Record<string, string>): Promise<{ success: boolean }> {
    console.log('[API] ====== uploadTransactionData CALLED ======');
    console.log('[API] siteId:', siteId);
    console.log('[API] destinationFolder:', destinationFolder);
    console.log('[API] fileData keys:', Object.keys(fileData));
    
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
    console.log('[API] Payload size:', JSON.stringify(payload).length, 'bytes');
    
    try {
      console.log('[API] About to call fetch...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[API] Transaction upload timeout after 30s');
        controller.abort();
      }, 30000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('[API] Fetch completed, response received');
      
      console.log('[API] Transaction upload response status:', response.status);
      console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
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
      console.error('[API] ====== TRANSACTION UPLOAD ERROR ======');
      console.error('[API] Error name:', error.name);
      console.error('[API] Error type:', error.constructor?.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Full error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout after 30 seconds');
      }
      throw error;
    }
  }

  async uploadSettingsProfiles(siteId: string, allProfiles: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    console.log('[API] ====== uploadSettingsProfiles CALLED ======');
    console.log('[API] siteId:', siteId);
    console.log('[API] allProfiles keys:', Object.keys(allProfiles));
    
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/webviewdataupload`;
    
    const fileData: Record<string, string> = {};
    for (const [profileName, profileInfo] of Object.entries(allProfiles)) {
      const fileName = `${profileName}.json`;
      fileData[fileName] = JSON.stringify(profileInfo);
    }
    
    const payload = {
      SITEID: siteId,
      DESTINATIONWEBVIEWFOLDER: 'settings-profiles',
      FOLDERDATA: [] as string[],
      FILEDATA: fileData,
    };
    
    console.log('[API] POST', url);
    console.log('[API] Uploading', Object.keys(allProfiles).length, 'settings profiles');
    console.log('[API] Destination: settings-profiles');
    console.log('[API] Payload size:', JSON.stringify(payload).length, 'bytes');
    
    try {
      console.log('[API] About to call fetch...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[API] Settings upload timeout after 30s');
        controller.abort();
      }, 30000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('[API] Fetch completed, response received');
      
      console.log('[API] Settings upload response status:', response.status);
      console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
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
      console.error('[API] ====== SETTINGS UPLOAD ERROR ======');
      console.error('[API] Error name:', error.name);
      console.error('[API] Error type:', error.constructor?.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Full error:', error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Upload timeout after 30 seconds' };
      }
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
