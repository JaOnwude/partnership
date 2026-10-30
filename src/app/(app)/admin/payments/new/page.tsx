import Link from "next/link";
import { Suspense } from "react";
import { PaymentForm } from "@/components/payment-form";
import { Card, Loading, NoCycle, PageTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { getActiveCycle, loadCycleData, parseRound, paymentOptions, summarise } from "@/lib/cycle-data";
import { formatLagos, MONTHS, roundDeadline, toLagosLocalInput } from "@/lib/time";
import { recordPayment } from "../../actions";

type SearchParams = PageProps<"/admin/payments/new">["searchParams"];

async function RecordPayment({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin />;

  const now = new Date();
  const params = await searchParams;
  const round = parseRound(params.round, cycle, now);
  const data = await loadCycleData(cycle.id);
  const options = paymentOptions(data, summarise(cycle, data, round, now), round);
  const member = Number(params.member);

  return (
    <>
      <PageTitle
        title="Record a payment"
        sub={`${MONTHS[round - 1]} ${cycle.year} round · due by ${formatLagos(roundDeadline(cycle.year, round))}`}
      />
      <Card className="max-w-lg">
        <PaymentForm
          action={recordPayment}
          cycleId={cycle.id}
          round={round}
          options={options}
          defaultUserId={options.some((o) => o.userId === member) ? member : undefined}
          defaultTellerAt={toLagosLocalInput(now)}
          receiptRequired={false}
          memberLabel="Member"
          submitLabel="Record payment"
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
