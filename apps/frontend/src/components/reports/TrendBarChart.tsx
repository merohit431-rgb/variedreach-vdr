import { TrendPoint } from '@/hooks/use-reports';

export function TrendBarChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-app-t3">No activity in this period.</p>;
  }

  const maxVal = Math.max(...data.map((d) => d.downloads + d.views), 1);
  const W = 560;
  const CHART_H = 80;
  const PAD_B = 20;
  const barGroupW = W / data.length;
  const barW = Math.max(3, barGroupW * 0.65);
  const barOffset = (barGroupW - barW) / 2;
  const labelEvery = Math.max(1, Math.floor(data.length / 7));

  const totalDownloads = data.reduce((s, d) => s + d.downloads, 0);
  const totalViews = data.reduce((s, d) => s + d.views, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-app-t3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-800" />
          Downloads ({totalDownloads})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-app-s3" />
          Views ({totalViews})
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${CHART_H + PAD_B}`}
        className="w-full"
        aria-label="Download and view activity over time"
        role="img"
      >
        {/* Zero baseline */}
        <line x1="0" y1={CHART_H} x2={W} y2={CHART_H} stroke="#e2e8f0" strokeWidth="1" />

        {data.map((point, i) => {
          const x = i * barGroupW;
          const dlH = Math.max(point.downloads > 0 ? 2 : 0, (point.downloads / maxVal) * CHART_H);
          const viewH = Math.max(point.views > 0 ? 2 : 0, (point.views / maxVal) * CHART_H);
          const totalH = dlH + viewH;

          return (
            <g key={point.date}>
              <title>
                {point.date}: {point.downloads} downloads, {point.views} views
              </title>
              {/* Views stacked on top (lighter) */}
              {viewH > 0 && (
                <rect
                  x={x + barOffset}
                  y={CHART_H - totalH}
                  width={barW}
                  height={viewH}
                  fill="#cbd5e1"
                  rx="1"
                />
              )}
              {/* Downloads (dark, bottom) */}
              {dlH > 0 && (
                <rect
                  x={x + barOffset}
                  y={CHART_H - dlH}
                  width={barW}
                  height={dlH}
                  fill="#1e293b"
                  rx="1"
                />
              )}
              {/* Date label */}
              {i % labelEvery === 0 && (
                <text
                  x={x + barGroupW / 2}
                  y={CHART_H + 14}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                >
                  {point.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
