/**
 * Syntax Education — Curriculum Tree Picker (masterdoc §4.2).
 *
 * Renders an admin-approved title's `layout` JSON as a nested checkbox tree
 * (Unit ➔ Chapter ➔ Section). The selection is collapsed to an `AssignmentResourceSlice`
 * which the teacher dashboard POSTs to `/api/msgf/education/teacher/assignment-resources`.
 *
 * Pure presentational component — no API calls. Parent dashboards control submission.
 */
import { useEffect, useMemo, useState } from "react";

export type CatalogSection = {
  sectionId: string;
  sectionTitle: string;
  pageStart?: number;
  pageEnd?: number;
};

export type CatalogChapter = {
  chapterId: string;
  chapterTitle: string;
  pageStart?: number;
  pageEnd?: number;
  sections: CatalogSection[];
};

export type CatalogUnit = {
  unitId: string;
  unitTitle: string;
  chapters: CatalogChapter[];
};

export type CurriculumLayout = CatalogUnit[];

export type AssignmentResourceSlice = {
  unitIds: string[];
  chapterIds: string[];
  sectionIds: string[];
  pageStart?: number;
  pageEnd?: number;
};

export type CurriculumTreePickerProps = {
  layout: CurriculumLayout;
  titleLabel?: string;
  initialSlice?: AssignmentResourceSlice;
  /** Fired on every change so parent can preview the slice or enable a Save button. */
  onChange: (slice: AssignmentResourceSlice) => void;
  className?: string;
};

type CheckedMap = {
  units: Set<string>;
  chapters: Set<string>;
  sections: Set<string>;
};

function emptyChecked(): CheckedMap {
  return { units: new Set(), chapters: new Set(), sections: new Set() };
}

function checkedFromSlice(slice: AssignmentResourceSlice | undefined): CheckedMap {
  if (!slice) return emptyChecked();
  return {
    units: new Set(slice.unitIds),
    chapters: new Set(slice.chapterIds),
    sections: new Set(slice.sectionIds),
  };
}

function toSlice(checked: CheckedMap): AssignmentResourceSlice {
  return {
    unitIds: Array.from(checked.units).sort(),
    chapterIds: Array.from(checked.chapters).sort(),
    sectionIds: Array.from(checked.sections).sort(),
  };
}

export function CurriculumTreePicker(props: CurriculumTreePickerProps) {
  const [checked, setChecked] = useState<CheckedMap>(() =>
    checkedFromSlice(props.initialSlice)
  );

  useEffect(() => {
    props.onChange(toSlice(checked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  const summary = useMemo(() => {
    return `${checked.units.size} units · ${checked.chapters.size} chapters · ${checked.sections.size} sections`;
  }, [checked]);

  function toggleUnit(unit: CatalogUnit) {
    setChecked((prev) => {
      const next = cloneChecked(prev);
      const isOn = next.units.has(unit.unitId);
      if (isOn) {
        next.units.delete(unit.unitId);
        unit.chapters.forEach((c) => {
          next.chapters.delete(c.chapterId);
          c.sections.forEach((s) => next.sections.delete(s.sectionId));
        });
      } else {
        next.units.add(unit.unitId);
        unit.chapters.forEach((c) => {
          next.chapters.add(c.chapterId);
          c.sections.forEach((s) => next.sections.add(s.sectionId));
        });
      }
      return next;
    });
  }

  function toggleChapter(unit: CatalogUnit, chapter: CatalogChapter) {
    setChecked((prev) => {
      const next = cloneChecked(prev);
      const isOn = next.chapters.has(chapter.chapterId);
      if (isOn) {
        next.chapters.delete(chapter.chapterId);
        chapter.sections.forEach((s) => next.sections.delete(s.sectionId));
        next.units.delete(unit.unitId);
      } else {
        next.chapters.add(chapter.chapterId);
        chapter.sections.forEach((s) => next.sections.add(s.sectionId));
      }
      return next;
    });
  }

  function toggleSection(
    unit: CatalogUnit,
    chapter: CatalogChapter,
    section: CatalogSection
  ) {
    setChecked((prev) => {
      const next = cloneChecked(prev);
      const isOn = next.sections.has(section.sectionId);
      if (isOn) {
        next.sections.delete(section.sectionId);
        next.chapters.delete(chapter.chapterId);
        next.units.delete(unit.unitId);
      } else {
        next.sections.add(section.sectionId);
      }
      return next;
    });
  }

  return (
    <div className={props.className ?? ""}>
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">
          {props.titleLabel ?? "Select chapters & sections"}
        </h3>
        <span className="text-xs text-zinc-500">{summary}</span>
      </header>

      <ul className="space-y-3">
        {props.layout.map((unit) => {
          const unitChecked = checked.units.has(unit.unitId);
          return (
            <li key={unit.unitId} className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-100">
                <input
                  type="checkbox"
                  checked={unitChecked}
                  onChange={() => toggleUnit(unit)}
                />
                <span className="font-semibold">{unit.unitTitle}</span>
              </label>

              <ul className="mt-2 space-y-2 pl-6">
                {unit.chapters.map((chapter) => {
                  const chapterChecked = checked.chapters.has(chapter.chapterId);
                  return (
                    <li key={chapter.chapterId}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                        <input
                          type="checkbox"
                          checked={chapterChecked}
                          onChange={() => toggleChapter(unit, chapter)}
                        />
                        <span>{chapter.chapterTitle}</span>
                        {chapter.pageStart != null && chapter.pageEnd != null && (
                          <span className="text-xs text-zinc-500">
                            (pp. {chapter.pageStart}–{chapter.pageEnd})
                          </span>
                        )}
                      </label>

                      {chapter.sections.length > 0 && (
                        <ul className="mt-1 space-y-1 pl-6">
                          {chapter.sections.map((section) => {
                            const sectionChecked = checked.sections.has(section.sectionId);
                            return (
                              <li key={section.sectionId}>
                                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={sectionChecked}
                                    onChange={() => toggleSection(unit, chapter, section)}
                                  />
                                  <span>{section.sectionTitle}</span>
                                  {section.pageStart != null && section.pageEnd != null && (
                                    <span className="text-zinc-500">
                                      (pp. {section.pageStart}–{section.pageEnd})
                                    </span>
                                  )}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function cloneChecked(c: CheckedMap): CheckedMap {
  return {
    units: new Set(c.units),
    chapters: new Set(c.chapters),
    sections: new Set(c.sections),
  };
}
