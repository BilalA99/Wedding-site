"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  addHouseholdAction,
  commitImportAction,
  deleteHouseholdAction,
  previewImportAction,
  type ImportPreview,
} from "./actions";
import { IMPORT_HEADERS } from "./import-headers";

interface HouseholdView {
  id: string;
  displayName: string;
  maxPartySize: number;
  allowPlusOne: boolean;
  email: string | null;
  phone: string | null;
  guests: string[];
}

export function InvitationsManager({
  households,
}: {
  households: HouseholdView[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maxSize, setMaxSize] = useState(4);
  const [plusOne, setPlusOne] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const templateCsv = `${IMPORT_HEADERS.join(",")}\r\nThe Ahmad Family,Omar,Ahmad,omar@example.com,+1 555 555 0100,yes,yes,no,4\r\n`;

  const addHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await addHouseholdAction({
      display_name: name,
      max_party_size: maxSize,
      allow_plus_one: plusOne,
    });
    setBusy(false);
    if (result.ok) {
      setName("");
      router.refresh();
    } else {
      setError(result.error ?? "Could not add household.");
    }
  };

  const runPreview = async () => {
    setBusy(true);
    setImportResult(null);
    setPreview(await previewImportAction(csvText));
    setBusy(false);
  };

  const runImport = async () => {
    setBusy(true);
    const result = await commitImportAction(csvText);
    setBusy(false);
    if (result.ok) {
      setImportResult(`Imported ${result.imported ?? 0} guests.`);
      setCsvText("");
      setPreview(null);
      router.refresh();
    } else {
      setImportResult(result.error ?? "Import failed.");
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section aria-labelledby="households-heading">
        <h2 id="households-heading" className="type-caps text-[0.65rem] text-sand">
          Households ({households.length})
        </h2>

        <form onSubmit={addHousehold} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label htmlFor="hh-name" className="type-caps mb-1 block text-[0.6rem] text-sand/70">
              Household name
            </label>
            <input
              id="hh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="hairline w-full rounded-lg border bg-charcoal-soft/60 px-4 py-2.5 text-sm text-ivory"
            />
          </div>
          <div>
            <label htmlFor="hh-max" className="type-caps mb-1 block text-[0.6rem] text-sand/70">
              Max party
            </label>
            <input
              id="hh-max"
              type="number"
              min={1}
              max={50}
              value={maxSize}
              onChange={(e) => setMaxSize(Number.parseInt(e.target.value, 10) || 1)}
              className="hairline w-20 rounded-lg border bg-charcoal-soft/60 px-3 py-2.5 text-center text-sm text-ivory"
            />
          </div>
          <label className="flex min-h-10 items-center gap-2 text-sm text-ivory/80">
            <input
              type="checkbox"
              checked={plusOne}
              onChange={(e) => setPlusOne(e.target.checked)}
              className="h-4 w-4 accent-[#b0955f]"
            />
            +1
          </label>
          <button
            type="submit"
            disabled={busy}
            className="type-caps min-h-10 rounded-full border border-gold/60 px-5 py-2 text-[0.62rem] text-gold-soft disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-thread-bright">
            {error}
          </p>
        )}

        <ul className="mt-5 flex flex-col gap-2">
          {households.map((h) => (
            <li
              key={h.id}
              className="hairline flex items-start justify-between gap-3 rounded-lg border bg-charcoal-soft/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ivory">{h.displayName}</p>
                <p className="mt-0.5 text-xs text-ivory/50">
                  max {h.maxPartySize}
                  {h.allowPlusOne ? " · +1 allowed" : ""}
                  {h.guests.length > 0 ? ` · ${h.guests.join(", ")}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await deleteHouseholdAction(h.id);
                  router.refresh();
                }}
                className="type-caps min-h-9 shrink-0 text-[0.58rem] text-thread-bright/70 hover:text-thread-bright"
                aria-label={`Remove ${h.displayName}`}
              >
                Remove
              </button>
            </li>
          ))}
          {households.length === 0 && (
            <li className="text-sm text-ivory/50">No households yet.</li>
          )}
        </ul>
      </section>

      <section aria-labelledby="import-heading">
        <h2 id="import-heading" className="type-caps text-[0.65rem] text-sand">
          CSV import
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-ivory/55">
          Columns: {IMPORT_HEADERS.join(", ")}
        </p>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`}
          download="invitations-template.csv"
          className="type-caps mt-2 inline-block text-[0.6rem] text-gold-soft hover:text-gold"
        >
          Download template ↓
        </a>

        <textarea
          rows={7}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Paste CSV here…"
          aria-label="CSV content"
          className="hairline mt-4 w-full rounded-lg border bg-charcoal-soft/60 px-4 py-3 font-mono text-xs text-ivory"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={runPreview}
            disabled={busy || !csvText.trim()}
            className="type-caps min-h-10 rounded-full border px-5 py-2 text-[0.62rem] text-ivory/80 disabled:opacity-40"
          >
            Validate
          </button>
          <button
            type="button"
            onClick={runImport}
            disabled={
              busy || !preview?.ok || (preview?.invalidCount ?? 1) > 0
            }
            className="type-caps min-h-10 rounded-full border border-gold/60 bg-gold/10 px-5 py-2 text-[0.62rem] text-gold-soft disabled:opacity-40"
          >
            Import
          </button>
          {importResult && (
            <span aria-live="polite" className="text-sm text-ivory/70">
              {importResult}
            </span>
          )}
        </div>

        {preview && (
          <div className="mt-4">
            {!preview.ok ? (
              <p role="alert" className="text-sm text-thread-bright">
                {preview.error}
              </p>
            ) : (
              <>
                <p className="text-sm text-ivory/70">
                  {preview.validCount} valid · {preview.invalidCount} with
                  problems
                </p>
                <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {preview.rows.map((r) => (
                    <li
                      key={r.line}
                      className={`rounded px-3 py-2 text-xs ${
                        r.problems.length > 0
                          ? "bg-thread/10 text-thread-bright"
                          : "bg-charcoal-soft/40 text-ivory/70"
                      }`}
                    >
                      Line {r.line}: {r.household} — {r.guest || "(no name)"}
                      {r.problems.length > 0 && ` · ${r.problems.join("; ")}`}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
