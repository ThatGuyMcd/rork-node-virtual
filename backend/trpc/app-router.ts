import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import syncTableDataRoute from "./routes/tabledata/sync/route";
import uploadTableDataRoute from "./routes/tabledata/upload/route";
import uploadTransactionDataRoute from "./routes/transaction/upload/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  tabledata: createTRPCRouter({
    sync: syncTableDataRoute,
    upload: uploadTableDataRoute,
  }),
  transaction: createTRPCRouter({
    upload: uploadTransactionDataRoute,
  }),
});

export type AppRouter = typeof appRouter;
