import { Suspense } from "react";
import { PaymentForm } from "@/components/payment-form";
import { Card, Loading, NoCycle, PageTitle, RoundPicker } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { canAdminister } from "@/lib/auth/roles";
import { getActiveCycle, loadCycleData, parseRound, paymentOptions, summarise } from "@/lib/cycle-data";
import { formatLagos, MONTHS, roundDeadline, toLagosLocalInput } from "@/lib/time";
import { submitPayment } from "./actions";

type SearchParams = PageProps<"/pay">["searchParams"];

async function Pay({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin={canAdminister(user.role)} />;

  const now = new Date();
  const round = parseRound((await searchParams).round, cycle, now);
  const data = await loadCycleData(cycle.id);
  const options = paymentOptions(data, summarise(cycle, data, round, now), round);

  return (
    <>
      <PageTitle
        title="Send your teller"
        sub={`${MONTHS[round - 1]} ${cycle.year} round · due by ${formatLagos(roundDeadline(cycle.year, round))}`}
      />
      <RoundPicker href="/pay" monthsN={cycle.monthsN} round={round} />
      <Card className="max-w-lg">
        <p className="mb-4 text-sm text-foreground/70">
          Pay into the group account first, then send a photo of the teller here. You can also send one for
          someone whose phone is down. An admin checks it before it shows as paid.
        </p>
        <PaymentForm
          action={submitPayment}
          cycleId={cycle.id}
          round={round}
          options={options}
          defaultUserId={options.some((o) => o.userId === user.id) ? user.id : undefined}
          defaultTellerAt={toLagosLocalInput(now)}
          receiptRequired
          memberLabel="Paying for"
          submitLabel="Send for approval"
        />
      </Card>
    </>
  );
}

export default function PayPage(props: PageProps<"/pay">) {
  return (
    <Suspense fallback={<Loading />}>
      <Pay searchParams={props.searchParams} />
    </Suspense>
  );
}
