import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import syncTableDataRoute from "./routes/tabledata/sync/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  tabledata: createTRPCRouter({
    sync: syncTableDataRoute,
  }),
});

export type AppRouter = typeof appRouter;
