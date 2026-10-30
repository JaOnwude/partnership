import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { NotificationsToggle } from "@/components/notifications-toggle";
import { Card, field, label, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { openBankDetails } from "@/lib/crypto";
import { changePin, saveBankDetails } from "./actions";

async function BankForm() {
  const user = await requireUser();
  const [row] = await getDb().select({ bankDetails: users.bankDetails }).from(users).where(eq(users.id, user.id));
  const details = openBankDetails(row?.bankDetails ?? null);

  return (
    <ActionForm action={saveBankDetails} submitLabel="Save account details">
      <div>
        <label htmlFor="bank" className={label}>Bank</label>
        <input id="bank" name="bank" required defaultValue={details?.bank} placeholder="e.g. First Bank, Moniepoint" className={field} />
      </div>
      <div>
        <label htmlFor="number" className={label}>Account number</label>
        <input
          id="number" name="number" required inputMode="numeric" pattern="\d{10}" maxLength={10}
          defaultValue={details?.number} className={field}
        />
      </div>
      <div>
        <label htmlFor="name" className={label}>Account name</label>
        <input id="name" name="name" required defaultValue={details?.name} className={field} />
      </div>
    </ActionForm>
  );
}

const pin = { inputMode: "numeric", pattern: "\\d{6}", maxLength: 6, required: true, className: field } as const;

export default function AccountPage() {
  return (
    <>
      <PageTitle title="Your account" />
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <h2 className="mb-2 font-semibold text-brand">Notifications</h2>
          <NotificationsToggle />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold text-brand">Payout account</h2>
          <p className="mb-3 text-sm text-foreground/70">Where your payout is sent in your month. Only the admins can see it.</p>
          <Suspense fallback={<Loading />}>
            <BankForm />
          </Suspense>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-brand">Change PIN</h2>
          <ActionForm action={changePin} submitLabel="Change PIN">
            <div>
              <label htmlFor="current" className={label}>Current PIN</label>
              <input id="current" name="current" type="password" autoComplete="current-password" {...pin} />
            </div>
            <div>
              <label htmlFor="next" className={label}>New PIN (6 digits)</label>
              <input id="next" name="next" type="password" autoComplete="new-password" {...pin} />
            </div>
            <div>
              <label htmlFor="confirm" className={label}>New PIN again</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" {...pin} />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
