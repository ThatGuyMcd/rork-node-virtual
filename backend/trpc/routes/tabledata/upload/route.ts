import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const uploadTableDataProcedure = publicProcedure
  .input(
    z.object({
      SITEID: z.string(),
      DESTINATIONWEBVIEWFOLDER: z.string(),
      FOLDERDATA: z.array(z.string()),
      FILEDATA: z.record(z.string(), z.string()),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[tRPC Upload] Starting bulk upload');
    console.log('[tRPC Upload] SITEID:', input.SITEID);
    console.log('[tRPC Upload] DESTINATION:', input.DESTINATIONWEBVIEWFOLDER);
    console.log('[tRPC Upload] Folders:', input.FOLDERDATA.length);
    console.log('[tRPC Upload] Files:', Object.keys(input.FILEDATA).length);
    
    try {
      const payloadSize = JSON.stringify(input).length;
      console.log('[tRPC Upload] Payload size:', payloadSize, 'bytes');
      console.log('[tRPC Upload] Posting to: https://app.positron-portal.com/webviewdataupload');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[tRPC Upload] Request timeout after 60 seconds');
        controller.abort();
      }, 60000);
      
      let response: Response;
      try {
        response = await fetch('https://app.positron-portal.com/webviewdataupload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error('[tRPC Upload] Fetch error:', fetchError);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Connection timeout - the server is taking too long to respond');
        }
        
        if (fetchError.message === 'Failed to fetch' || fetchError.message === 'Network request failed') {
          throw new Error('Network error - please check your internet connection and try again');
        }
        
        throw fetchError;
      }
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[tRPC Upload] Server error response:', response.status, text);
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      
      const result = await response.json().catch(() => ({ success: true }));
      console.log('[tRPC Upload] Upload successful:', result);
      
      return {
        success: true,
        serverResponse: result,
      };
    } catch (error: any) {
      console.error('[tRPC Upload] Error uploading to server:', error);
      throw error;
    }
  });

export default uploadTableDataProcedure;
