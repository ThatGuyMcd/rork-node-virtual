import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const syncTableDataProcedure = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
      area: z.string(),
      tableName: z.string(),
      tableId: z.string(),
      tableData: z.array(
        z.object({
          quantity: z.number(),
          productName: z.string(),
          price: z.number(),
          pluFile: z.string(),
          group: z.string(),
          department: z.string(),
          vatCode: z.string(),
          vatPercentage: z.number(),
          vatAmount: z.number(),
          addedBy: z.string(),
          timeDate: z.string(),
          printer1: z.string(),
          printer2: z.string(),
          printer3: z.string(),
          itemPrinted: z.string(),
          tableId: z.string().optional(),
        })
      ),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[tRPC] Syncing table data for table:', input.tableId);
    console.log('[tRPC] Area:', input.area, 'Table:', input.tableName);
    console.log('[tRPC] Data rows:', input.tableData.length);
    
    try {
      // Convert table data to CSV format
      const csvRows: string[] = [];
      
      // Add header
      csvRows.push('X,Product,Price,PLUFile,Group,Department,VATCode,VATPercentage,VATAmount,Added By,Time/Date Added,PRINTER 1,PRINTER 2,PRINTER 3,Item Printed?,Table ID');
      
      // Add data rows
      for (const row of input.tableData) {
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
          row.tableId || '',
        ].join(',');
        csvRows.push(line);
      }
      
      const csvContent = csvRows.join('\r\n');
      
      // Post to server using the webviewdataupload endpoint
      const SERVER_BASE_URL = 'https://app.positron-portal.com';
      const url = `${SERVER_BASE_URL}/webviewdataupload`;
      
      const destinationFolder = `TABDATA\\${input.area}\\${input.tableName}`;
      
      const payload = {
        SITEID: input.siteId,
        DESTINATIONWEBVIEWFOLDER: destinationFolder,
        FOLDERDATA: [],
        FILEDATA: {
          'TAB.CSV': csvContent,
        },
      };
      
      console.log('[tRPC] Posting to:', url);
      console.log('[tRPC] Destination folder:', destinationFolder);
      console.log('[tRPC] CSV size:', csvContent.length, 'bytes');
      console.log('[tRPC] Payload structure:', {
        SITEID: payload.SITEID,
        DESTINATIONWEBVIEWFOLDER: payload.DESTINATIONWEBVIEWFOLDER,
        FOLDERDATA: payload.FOLDERDATA,
        FILEDATA_keys: Object.keys(payload.FILEDATA),
        FILEDATA_size: Object.values(payload.FILEDATA)[0].length,
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain, application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log('[tRPC] Response status:', response.status);
      console.log('[tRPC] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[tRPC] Server error response:', response.status, text);
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      
      const responseText = await response.text();
      console.log('[tRPC] Server response:', responseText);
      
      return {
        success: true,
        tableId: input.tableId,
        rowCount: input.tableData.length,
        serverResponse: responseText,
      };
    } catch (error: any) {
      console.error('[tRPC] Error syncing to server:', error);
      
      // Still return success to client but log the error
      // This prevents blocking the POS if the server is down
      return {
        success: false,
        tableId: input.tableId,
        rowCount: input.tableData.length,
        error: error.message,
      };
    }
  });

export default syncTableDataProcedure;
