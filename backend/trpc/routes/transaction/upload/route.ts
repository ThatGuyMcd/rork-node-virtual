import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

const uploadTransactionDataRoute = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
      destinationFolder: z.string(),
      fileData: z.record(z.string(), z.string()),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Transaction Upload] Received transaction data');
    console.log(`[Transaction Upload] Site ID: ${input.siteId}`);
    console.log(`[Transaction Upload] Destination: ${input.destinationFolder}`);
    console.log(`[Transaction Upload] Files: ${Object.keys(input.fileData).length}`);

    const payload = {
      SITEID: input.siteId,
      DESTINATIONWEBVIEWFOLDER: input.destinationFolder,
      FOLDERDATA: [] as string[],
      FILEDATA: input.fileData,
    };

    try {
      const url = 'https://app.positron-portal.com/webviewdataupload';
      console.log('[Transaction Upload] Posting to:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Transaction Upload] Server error:', errorText);
        return {
          success: false,
          error: `Server returned ${response.status}: ${errorText}`,
        };
      }

      const result = await response.text();
      console.log('[Transaction Upload] Server response:', result);

      return {
        success: true,
        error: undefined,
      };
    } catch (error: any) {
      console.error('[Transaction Upload] Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

export default uploadTransactionDataRoute;
