import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const uploadTableDataProcedure = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
      area: z.string(),
      tableName: z.string(),
      csvContent: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Backend] === TABLE DATA UPLOAD ===');
    console.log('[Backend] Site:', input.siteId);
    console.log('[Backend] Area:', input.area);
    console.log('[Backend] Table:', input.tableName);
    console.log('[Backend] CSV size:', input.csvContent.length, 'bytes');
    
    const destinationFolder = `TABDATA\\${input.area}\\${input.tableName}`;
    const url = 'https://app.positron-portal.com/webviewdataupload';
    
    const payload = {
      SITEID: input.siteId,
      DESTINATIONWEBVIEWFOLDER: destinationFolder,
      FOLDERDATA: [] as string[],
      FILEDATA: {
        'TAB.CSV': input.csvContent,
      },
    };
    
    console.log('[Backend] Destination:', destinationFolder);
    console.log('[Backend] POST to:', url);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      console.log('[Backend] Response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[Backend] Error response:', text);
        return {
          success: false,
          error: `Server returned ${response.status}: ${text}`,
        };
      }
      
      const responseText = await response.text();
      console.log('[Backend] Success response:', responseText);
      
      return {
        success: true,
        error: undefined,
      };
    } catch (error: any) {
      console.error('[Backend] Upload error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

export default uploadTableDataProcedure;
