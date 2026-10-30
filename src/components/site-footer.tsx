// A quiet footer on every page: what the app is (and isn't) and who to ask.
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-brand/10 px-4 py-6 text-center text-xs leading-relaxed text-foreground/60">
      <div className="mx-auto max-w-2xl space-y-1">
        <p>
          <strong className="font-semibold text-foreground/70">Partnership records contributions only.</strong> It never
          holds or moves money. Keep paying into the group account as usual.
        </p>
        <p>Tellers you upload can be seen by all members. Your bank details are seen only by the admins.</p>
        <p>Questions? Ask Mrs Nwokolo or Lolo Onyeze · Partnership since 2022</p>
      </div>
    </footer>
  );
}
