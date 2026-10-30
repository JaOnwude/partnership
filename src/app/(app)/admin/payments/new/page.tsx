import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, NoCycle, PageTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { getActiveCycle, loadCycleData, parseRound, summarise } from "@/lib/cycle-data";
import { formatLagos, MONTHS, roundDeadline, toLagosLocalInput } from "@/lib/time";
import { RecordPaymentForm } from "./record-payment-form";

type SearchParams = PageProps<"/admin/payments/new">["searchParams"];

async function RecordPayment({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin />;

  const now = new Date();
  const params = await searchParams;
  const round = parseRound(params.round, cycle, now);
  const data = await loadCycleData(cycle.id);
  const summary = summarise(cycle, data, round, now);
  const options = summary.members
    .filter((m) => !m.payment && m.owed + m.own > 0)
    .map((m) => ({ userId: m.userId, name: data.names.get(m.userId) ?? "?", owed: m.owed, own: m.own }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const member = Number(params.member);

  return (
    <>
      <PageTitle
        title="Record a payment"
        sub={`${MONTHS[round - 1]} ${cycle.year} round · due by ${formatLagos(roundDeadline(cycle.year, round))}`}
      />
      <Card className="max-w-lg">
        <RecordPaymentForm
          cycleId={cycle.id}
          round={round}
          options={options}
          defaultUserId={options.some((o) => o.userId === member) ? member : undefined}
          defaultTellerAt={toLagosLocalInput(now)}
        />
        <Link href={`/board?round=${round}`} className="mt-4 inline-block text-sm text-brand underline">
          Back to the board
        </Link>
      </Card>
    </>
  );
}

export default function RecordPaymentPage(props: PageProps<"/admin/payments/new">) {
  return (
    <Suspense fallback={<Loading />}>
      <RecordPayment searchParams={props.searchParams} />
    </Suspense>
  );
}
