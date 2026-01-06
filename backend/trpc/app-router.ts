import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import syncTableDataRoute from "./routes/tabledata/sync/route";
import uploadTableDataRoute from "./routes/tabledata/upload/route";
import uploadTransactionDataRoute from "./routes/transaction/upload/route";
import uploadSettingsProfileRoute from "./routes/settingsprofile/upload/route";
import downloadSettingsProfileRoute from "./routes/settingsprofile/download/route";

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
  settingsprofile: createTRPCRouter({
    upload: uploadSettingsProfileRoute,
    download: downloadSettingsProfileRoute,
  }),
});

export type AppRouter = typeof appRouter;
