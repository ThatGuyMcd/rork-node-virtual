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

    const API_BASE_URL = 'https://app.positron-portal.com';
    const uploadUrl = `${API_BASE_URL}/webviewdataupload`;

    const payload = {
      SITEID: siteId,
      DESTINATIONWEBVIEWFOLDER: '',
      FOLDERDATA: ['DATA/OPERATORDATA', 'DATA/OPERATORDATA/Stored Operator Tabs'],
      FILEDATA: {
        [`DATA/OPERATORDATA/Stored Operator Tabs/${fileName}`]: csvContent,
      },
    };

    console.log('[StoredTab Upload] Uploading to:', uploadUrl);
    console.log('[StoredTab Upload] Destination:', `${siteId}/DATA/OPERATORDATA/Stored Operator Tabs/${fileName}`);

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[StoredTab Upload] Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json().catch(() => ({ success: true }));
      console.log('[StoredTab Upload] Upload successful:', result);
      console.log('[StoredTab Upload] ========== UPLOAD COMPLETE ==========');

      return {
        success: true,
        message: 'Stored tab uploaded successfully',
        filePath,
        serverResponse: result,
      };
    } catch (error) {
      console.error('[StoredTab Upload] Error:', error);
      throw error;
    }
  });
