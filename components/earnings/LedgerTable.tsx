"use client";

// Shared chronological earnings-ledger table.
//
// Renders the immutable ledger for one instructor — used by both the admin
// payout detail view and the instructor self-view. Presentational only:
// it takes already-shaped `LedgerEntryView`s and never fetches.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { LedgerEntryView } from "@/app/actions/instructor_payout_actions";

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  zaincash: "زين كاش",
  cash: "نقداً",
};

const SOURCE_LABEL: Record<string, string> = {
  wallet: "محفظة",
  zaincash: "زين كاش",
  backfill: "ترحيل سجل",
};

export function formatLedgerDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function LedgerTable({
  entries,
}: {
  entries: LedgerEntryView[];
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-sm">لا توجد حركات في السجل بعد.</p>
      </div>
    );
  }

  // Newest first for reading; the data arrives chronological (oldest first).
  const rows = [...entries].reverse();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">التاريخ</TableHead>
          <TableHead className="text-right">النوع</TableHead>
          <TableHead className="text-right">التفاصيل</TableHead>
          <TableHead className="text-right">المبلغ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((e) => {
          const isEarning = e.kind === "earning";
          return (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-sm text-gray-600">
                {formatLedgerDate(e.createdAt)}
              </TableCell>
              <TableCell>
                {isEarning ? (
                  <Badge className="bg-green-100 text-green-800">إيراد</Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-800">دفعة</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-gray-700">
                {isEarning ? (
                  <div className="space-y-0.5">
                    <div>
                      مبيعات{" "}
                      {typeof e.grossAmount === "number"
                        ? `${e.grossAmount.toLocaleString()} د.ع`
                        : ""}
                      {typeof e.revenueSharePercent === "number"
                        ? ` · حصتك ${e.revenueSharePercent}%`
                        : ""}
                    </div>
                    <div className="text-xs text-gray-400">
                      {e.sectionIds && e.sectionIds.length > 0
                        ? `${e.sectionIds.length} قسم`
                        : "دورة كاملة"}
                      {e.source ? ` · ${SOURCE_LABEL[e.source] ?? e.source}` : ""}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div>{e.method ? METHOD_LABEL[e.method] ?? e.method : "—"}</div>
                    {e.note && (
                      <div className="text-xs text-gray-400">{e.note}</div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell
                className={
                  isEarning
                    ? "font-semibold text-green-700 whitespace-nowrap"
                    : "font-semibold text-blue-700 whitespace-nowrap"
                }
              >
                {isEarning ? "+" : "−"}
                {e.amount.toLocaleString()} د.ع
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
