import { SCORE_BAND_COLOR, SCORE_BAND_LABEL } from "@w-a/shared";
import type { ScoreBand } from "@w-a/shared";

const BANDS: ScoreBand[] = ["green", "yellow", "orange", "red"];

export function ScoreLegend() {
  return (
    <div className="flex flex-wrap gap-3">
      {BANDS.map((band) => (
        <div key={band} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SCORE_BAND_COLOR[band] }} />
          <span className="text-xs text-textSecondary">{SCORE_BAND_LABEL[band]}</span>
        </div>
      ))}
    </div>
  );
}
