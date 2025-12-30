import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

export const uploadStoredTabRoute = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
      operatorName: z.string(),
      csvContent: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const { siteId, operatorName, csvContent } = input;

    console.log('[StoredTab Upload] ========== UPLOAD REQUEST ==========');
    console.log('[StoredTab Upload] Site ID:', siteId);
    console.log('[StoredTab Upload] Operator:', operatorName);
    console.log('[StoredTab Upload] CSV size:', csvContent.length, 'bytes');

    const fileName = `${operatorName}_StoredTab.csv`;
    const filePath = `OPERATORDATA/Stored Operator Tabs/${fileName}`;

    const RORK_DB_ENDPOINT = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
    const RORK_DB_NAMESPACE = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
    const RORK_DB_TOKEN = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

    if (!RORK_DB_ENDPOINT || !RORK_DB_NAMESPACE || !RORK_DB_TOKEN) {
      console.error('[StoredTab Upload] Missing database configuration');
      throw new Error('Database configuration is missing');
    }

    const uploadUrl = `${RORK_DB_ENDPOINT}/upload`;

    const payload = {
      SITEID: siteId,
      DESTINATIONWEBVIEWFOLDER: 'OPERATORDATA',
      FOLDERDATA: ['Stored Operator Tabs'],
      FILEDATA: {
        [`Stored Operator Tabs/${fileName}`]: csvContent,
      },
    };

    console.log('[StoredTab Upload] Uploading to:', uploadUrl);
    console.log('[StoredTab Upload] Destination:', `${siteId}/DATA/OPERATORDATA/Stored Operator Tabs/${fileName}`);

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RORK_DB_TOKEN}`,
          'surreal-ns': RORK_DB_NAMESPACE,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[StoredTab Upload] Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      await response.json();
      console.log('[StoredTab Upload] Upload successful');
      console.log('[StoredTab Upload] ========== UPLOAD COMPLETE ==========');

      return {
        success: true,
        message: 'Stored tab uploaded successfully',
        filePath,
      };
    } catch (error) {
      console.error('[StoredTab Upload] Error:', error);
      throw error;
    }
  });
