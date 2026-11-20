"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { useDemo } from "@/lib/demo-store";

type Result = { id: string; group: string; title: string; detail: string; href: string };

const groups = ["Pemasok", "Lahan", "Lot", "Tugas"];

export function GlobalSearch() {
  const { data } = useDemo();
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const term = query.trim().toLocaleLowerCase("id-ID");

  const results = useMemo<Result[]>(() => {
    if (term.length < 2) return [];
    const match = (...values: string[]) => values.join(" ").toLocaleLowerCase("id-ID").includes(term);
    const supplierName = (id: string) => data.suppliers.find((item) => item.id === id)?.name ?? id;
    return [
      ...data.suppliers.filter((item) => match(item.id, item.name, item.location)).map((item) => ({ id: item.id, group: "Pemasok", title: item.name, detail: `${item.id} · ${item.location}`, href: `/dashboard/due-diligence?pemasok=${item.id}` })),
      ...data.plots.filter((item) => match(item.id, item.owner, item.village, item.documentRef)).map((item) => ({ id: item.id, group: "Lahan", title: `${item.id} · ${item.owner}`, detail: `${item.village} · ${supplierName(item.supplierId)}`, href: `/dashboard/due-diligence?pemasok=${item.supplierId}&lahan=${item.id}` })),
      ...data.lots.filter((item) => match(item.id, item.receivingRef, item.transportRef, item.exportGroup)).map((item) => ({ id: item.id, group: "Lot", title: item.id, detail: `${supplierName(item.supplierId)} · ${item.weight} ton`, href: `/dashboard/traceability?lot=${item.id}` })),
      ...data.tasks.filter((item) => match(item.id, item.plotId, item.scope)).map((item) => ({ id: item.id, group: "Tugas", title: `${item.id} · ${item.plotId}`, detail: data.cooperatives.find((partner) => partner.id === item.cooperativeId)?.name ?? "", href: `/dashboard/cooperatives?tugas=${item.id}` })),
    ].slice(0, 12);
  }, [data, term]);

  function go(result: Result | undefined) {
    if (!result) return;
    router.push(result.href);
    setOpen(false);
    setQuery("");
    input.current?.blur();
  }

  const showList = open && term.length >= 2;
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  return (
    <div className="global-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <label className="search-field">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Cari pemasok, lahan, lot, atau tugas</span>
        <input
          ref={input} type="search" role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showList && results.length ? `${listId}-${activeIndex}` : undefined}
          placeholder="Cari pemasok, lahan, lot, atau tugas" value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((activeIndex + 1) % Math.max(1, results.length)); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActive((activeIndex - 1 + results.length) % Math.max(1, results.length)); }
            else if (event.key === "Enter") { event.preventDefault(); go(results[activeIndex]); }
            else if (event.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {showList && (
        <div className="search-results" id={listId} role="listbox" aria-label="Hasil pencarian">
          {results.length ? groups.map((group) => {
            const items = results.map((result, index) => ({ result, index })).filter(({ result }) => result.group === group);
            return items.length ? (
              <div key={group} role="group" aria-label={group}>
                <p className="search-group">{group}</p>
                {items.map(({ result, index }) => (
                  <button key={`${group}-${result.id}`} id={`${listId}-${index}`} type="button" role="option" aria-selected={index === activeIndex} tabIndex={-1}
                    onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => go(result)}>
                    <strong>{result.title}</strong><small>{result.detail}</small>
                  </button>
                ))}
              </div>
            ) : null;
          }) : <p className="search-empty">Tidak ada hasil untuk “{query.trim()}”. Coba kode lahan (LH-003), nomor lot, atau nama pemasok.</p>}
        </div>
      )}
    </div>
  );
}
