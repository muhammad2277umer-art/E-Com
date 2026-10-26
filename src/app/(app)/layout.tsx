import { logout } from "@/app/actions";
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="md:flex">
      <aside className="border-b border-slate-200 bg-white p-4 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between md:block">
          <div className="text-base font-semibold text-indigo-700">Brand Hunting CRM</div>
          {process.env.APP_PASSWORD && (
            <form action={logout} className="md:hidden">
              <button className="text-xs text-slate-500 hover:text-slate-800">Sign out</button>
            </form>
          )}
        </div>
        <Nav />
        {process.env.APP_PASSWORD && (
          <form action={logout} className="mt-6 hidden md:block">
            <button className="px-3 text-xs text-slate-500 hover:text-slate-800">Sign out</button>
          </form>
        )}
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
