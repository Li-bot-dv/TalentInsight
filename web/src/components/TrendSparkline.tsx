export function TrendSparkline({
  data,
  positive,
  width = 88,
  height = 24,
}: {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-[#7c8490]">—</span>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const padX = 3;
  const padY = 3;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const pathD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const isUp = positive !== undefined ? positive : data[data.length - 1] >= data[0];
  const stroke = isUp ? "#047857" : "#be123c";
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={stroke} />
    </svg>
  );
}
