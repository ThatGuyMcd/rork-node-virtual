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
      
      const csvContent = csvRows.join('\n');
      
      // Post to server
      const API_BASE_URL = 'https://app.positron-portal.com/api/v1';
      const url = `${API_BASE_URL}/sites/${encodeURIComponent(input.siteId)}/data/table`;
      
      console.log('[tRPC] Posting to:', url);
      console.log('[tRPC] CSV size:', csvContent.length, 'bytes');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          area: input.area,
          table: input.tableName,
          data: csvContent,
        }),
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[tRPC] Server error response:', response.status, text);
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      
      const result = await response.json().catch(() => ({ success: true }));
      console.log('[tRPC] Server response:', result);
      
      return {
        success: true,
        tableId: input.tableId,
        rowCount: input.tableData.length,
        serverResponse: result,
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
