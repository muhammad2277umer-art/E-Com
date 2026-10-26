import Link from "next/link";
import type { BrandStatus } from "@prisma/client";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";

export const btn =
  "inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
export const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const btnDanger = `${btn} border border-rose-200 bg-white text-rose-600 hover:bg-rose-50`;
export const btnSuccess = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
export const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function StatusBadge({ status }: { status: BrandStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Card({ title, actions, children, className = "" }: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function Flash({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  return (
    <div
      className={`mb-4 rounded-md border px-4 py-2 text-sm ${
        error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? msg}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="break-words text-sm text-slate-800">{value}</dd>
    </div>
  );
}

export function ExtLink({ href }: { href?: string | null }) {
  if (!href) return null;
  const url = /^https?:\/\//.test(href) ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
      {href}
    </a>
  );
}

export function Stat({ label, value, href, tone = "text-slate-900" }: {
  label: string;
  value: number;
  href?: string;
  tone?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function fmtDate(d?: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(d?: Date | null) {
  if (!d) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
