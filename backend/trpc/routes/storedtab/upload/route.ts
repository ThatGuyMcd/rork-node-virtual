import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

const uploadStoredTabRoute = publicProcedure
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log('[StoredTab Upload] Response status:', response.status);
      console.log('[StoredTab Upload] Response text:', responseText.substring(0, 200));

      if (!response.ok) {
        console.error('[StoredTab Upload] Upload failed:', response.status, responseText);
        return {
          success: false,
          message: `Upload failed: ${response.status} ${response.statusText}`,
          filePath,
          error: responseText,
        };
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.log('[StoredTab Upload] Response is not JSON, treating as success');
        result = { success: true };
      }

      console.log('[StoredTab Upload] Upload successful:', result);
      console.log('[StoredTab Upload] ========== UPLOAD COMPLETE ==========');

      return {
        success: true,
        message: 'Stored tab uploaded successfully',
        filePath,
        serverResponse: result,
      };
    } catch (error: any) {
      console.error('[StoredTab Upload] Error:', error);
      return {
        success: false,
        message: 'Upload failed with error',
        filePath,
        error: error.message || String(error),
      };
    }
  });

export default uploadStoredTabRoute;
