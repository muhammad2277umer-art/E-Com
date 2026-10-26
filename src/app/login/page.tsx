import { login } from "@/app/actions";
import { btnPrimary, input, one, type SearchParams } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto mt-24 max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      <form action={login} className="space-y-3">
        <input type="hidden" name="next" value={one(sp.next) ?? "/"} />
        <input name="password" type="password" placeholder="Team password" className={input} autoFocus />
        {one(sp.error) && <p className="text-sm text-rose-600">{one(sp.error)}</p>}
        <button className={`${btnPrimary} w-full`}>Sign in</button>
      </form>
    </div>
  );
}
