import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, field, label, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { openBankDetails } from "@/lib/crypto";
import { saveBankDetails } from "./actions";

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

export default function AccountPage() {
  return (
    <>
      <PageTitle title="Payout account" sub="Where your payout is sent when it's your month. Only the admins can see it." />
      <Card className="max-w-lg">
        <Suspense fallback={<Loading />}>
          <BankForm />
        </Suspense>
      </Card>
    </>
  );
}
