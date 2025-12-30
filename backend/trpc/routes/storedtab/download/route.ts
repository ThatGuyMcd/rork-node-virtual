import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

export const downloadStoredTabRoute = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
    })
  )
  .query(async ({ input }) => {
    const { siteId } = input;

    console.log('[StoredTab Download] ========== DOWNLOAD REQUEST ==========');
    console.log('[StoredTab Download] Site ID:', siteId);

    const RORK_DB_ENDPOINT = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
    const RORK_DB_NAMESPACE = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
    const RORK_DB_TOKEN = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

    if (!RORK_DB_ENDPOINT || !RORK_DB_NAMESPACE || !RORK_DB_TOKEN) {
      console.error('[StoredTab Download] Missing database configuration');
      return {
        success: false,
        storedTabs: [],
        error: 'Database configuration is missing',
      };
    }

    const manifestUrl = `${RORK_DB_ENDPOINT}/manifest`;

    try {
      console.log('[StoredTab Download] Fetching manifest...');
      const manifestResponse = await fetch(manifestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RORK_DB_TOKEN}`,
          'surreal-ns': RORK_DB_NAMESPACE,
        },
        body: JSON.stringify({ SITEID: siteId }),
      });

      if (!manifestResponse.ok) {
        console.error('[StoredTab Download] Manifest fetch failed:', manifestResponse.status);
        return {
          success: false,
          storedTabs: [],
          error: 'Failed to fetch manifest',
        };
      }

      const manifest = await manifestResponse.json();
      console.log('[StoredTab Download] Manifest received, total files:', manifest.length);

      const storedTabFiles = manifest.filter((file: any) => {
        const pathUpper = file.path.toUpperCase();
        return (
          pathUpper.startsWith('OPERATORDATA/STORED OPERATOR TABS/') &&
          pathUpper.endsWith('_STOREDTAB.CSV')
        );
      });

      console.log('[StoredTab Download] Found', storedTabFiles.length, 'stored tab files');

      if (storedTabFiles.length === 0) {
        console.log('[StoredTab Download] No stored tabs found');
        return {
          success: true,
          storedTabs: [],
        };
      }

      const storedTabs = [];
      const downloadUrl = `${RORK_DB_ENDPOINT}/download`;

      for (const file of storedTabFiles) {
        try {
          console.log('[StoredTab Download] Downloading:', file.path);

          const downloadResponse = await fetch(downloadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RORK_DB_TOKEN}`,
              'surreal-ns': RORK_DB_NAMESPACE,
            },
            body: JSON.stringify({
              SITEID: siteId,
              FILEPATH: file.path,
            }),
          });

          if (!downloadResponse.ok) {
            console.error('[StoredTab Download] Failed to download:', file.path);
            continue;
          }

          const csvContent = await downloadResponse.text();
          console.log('[StoredTab Download] Downloaded:', file.path, 'Size:', csvContent.length);

          const fileName = file.path.split('/').pop() || '';
          const operatorName = fileName.replace('_StoredTab.csv', '');

          storedTabs.push({
            operatorName,
            csvContent,
            lastModified: file.lastModified || new Date().toISOString(),
          });
        } catch (error) {
          console.error('[StoredTab Download] Error downloading file:', file.path, error);
        }
      }

      console.log('[StoredTab Download] Successfully downloaded', storedTabs.length, 'stored tabs');
      console.log('[StoredTab Download] ========== DOWNLOAD COMPLETE ==========');

      return {
        success: true,
        storedTabs,
      };
    } catch (error) {
      console.error('[StoredTab Download] Error:', error);
      return {
        success: false,
        storedTabs: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
