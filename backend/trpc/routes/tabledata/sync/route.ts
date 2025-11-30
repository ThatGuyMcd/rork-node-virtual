import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const syncTableDataProcedure = publicProcedure
  .input(
    z.object({
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
    console.log('[tRPC] Data rows:', input.tableData.length);
    
    return {
      success: true,
      tableId: input.tableId,
      rowCount: input.tableData.length,
    };
  });

export default syncTableDataProcedure;
