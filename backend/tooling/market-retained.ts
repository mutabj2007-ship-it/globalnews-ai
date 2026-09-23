import 'dotenv/config';
import { PrismaService } from '../src/database/prisma.service';
import { inspectMarketCapture } from '../src/modules/market-ingest/market-retained-capture';
import { MarketRetainedProducer } from '../src/modules/market-ingest/market-retained.producer';

/** Offline operator tool. Defaults to inventory only; never contacts a provider. */
async function main() {
  const args = process.argv.slice(2);
  const argument = (flag: string) => {
    const i = args.indexOf(flag);
    return i < 0 ? undefined : args[i + 1];
  };
  const id = argument('--retrieval');
  const author = argument('--author');
  if (args.includes('--apply') && (!id || !author))
    throw new Error('--apply requires --retrieval and --author');
  const db = new PrismaService();
  try {
    if (args.includes('--apply')) {
      console.log(
        JSON.stringify({
          retrievalId: id,
          written: await new MarketRetainedProducer(db, [id!]).admit(id!, author!),
        }),
      );
      return;
    }
    let cursor: string | undefined;
    for (;;) {
      const captures = await db.snapshotRetrieval.findMany({
        where: id ? { retrievalId: id } : { providerId: 'EUROSTAT' },
        take: 100,
        ...(cursor ? { cursor: { retrievalId: cursor }, skip: 1 } : {}),
        orderBy: { retrievalId: 'asc' },
        include: { payload: true },
      });
      for (const capture of captures) {
        try {
          const inspected = inspectMarketCapture(capture);
          console.log(
            JSON.stringify({
              retrievalId: capture.retrievalId,
              admissible: true,
              context: inspected.geography,
              observations: inspected.observations.length,
            }),
          );
        } catch (error) {
          console.log(
            JSON.stringify({
              retrievalId: capture.retrievalId,
              admissible: false,
              reason: error instanceof Error ? error.message : 'Inspection failed',
            }),
          );
        }
      }
      if (captures.length < 100) break;
      cursor = captures[captures.length - 1].retrievalId;
    }
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Retained Market operation failed; verify the database, schema and capture approval.',
  );
  process.exitCode = 1;
});
