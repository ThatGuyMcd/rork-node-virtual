import { z } from 'zod';
import { publicProcedure } from '../../../create-context';

const uploadTransactionDataRoute = publicProcedure
  .input(
    z.object({
      SITEID: z.string(),
      DESTINATIONWEBVIEWFOLDER: z.string(),
      FOLDERDATA: z.array(z.string()),
      FILEDATA: z.record(z.string(), z.string()),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Transaction Upload] Received transaction data');
    console.log(`[Transaction Upload] Site ID: ${input.SITEID}`);
    console.log(`[Transaction Upload] Destination: ${input.DESTINATIONWEBVIEWFOLDER}`);
    console.log(`[Transaction Upload] Folders: ${input.FOLDERDATA.length}`);
    console.log(`[Transaction Upload] Files: ${Object.keys(input.FILEDATA).length}`);

    try {
      const API_BASE_URL = 'https://app.positron-portal.com';
      const url = `${API_BASE_URL}/uploadwebviewdata`;

      console.log('[Transaction Upload] Posting to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Transaction Upload] Server error:', errorText);
        throw new Error(`Failed to upload transaction data: ${response.status} ${response.statusText}`);
      }

      const result = await response.text();
      console.log('[Transaction Upload] Server response:', result);

      return {
        success: true,
        message: 'Transaction data uploaded successfully',
      };
    } catch (error) {
      console.error('[Transaction Upload] Error:', error);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to upload transaction data'
      );
    }
  });

export default uploadTransactionDataRoute;
