import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

const PX_PER_POINT = 18;
const HEIGHT = 300;
const MARGIN = { top: 12, right: 24, bottom: 4, left: 0 };
const X_AXIS_HEIGHT = 30;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom - X_AXIS_HEIGHT;
const Y_TICKS = [0, 25, 50, 75, 100];

const fmtTime = (ts) => new Date(ts).toLocaleTimeString("en-IN", { hour12: false });
const fmtFull = (ts) =>
  new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

const arrowBtn = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid #22324a",
  background: "#0a111b",
  color: "#e8eef8",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1
};

export default function GasChart({ data = [], threshold = 60 }) {
  const scrollRef = useRef(null);
  const [follow, setFollow] = useState(true);
  const [boxW, setBoxW] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(boxW, data.length * PX_PER_POINT + MARGIN.right);

  // keep the newest reading in view unless the user scrolled back
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (follow && el) el.scrollLeft = el.scrollWidth;
  }, [data.length, width, follow]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setFollow(el.scrollWidth - el.scrollLeft - el.clientWidth < 40);
  };

  const startDrag = (e) => {
    if (e.button !== 0) return;
    const el = scrollRef.current;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    el.style.cursor = "grabbing";
    const move = (ev) => {
      el.scrollLeft = startLeft - (ev.clientX - startX);
    };
    const up = () => {
      el.style.cursor = "grab";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const scrollByPage = (dir) => {
    const el = scrollRef.current;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const jumpToLive = () => {
    const el = scrollRef.current;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    setFollow(true);
  };

  return (
    <div className="panel chart-panel" style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Live Gas Monitoring</h3>
          <p style={{ margin: "6px 0 0", color: "#7c8aa0", fontSize: 14 }}>
            Updates every 1.5 seconds. Scroll or drag left to see earlier readings.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={arrowBtn} onClick={() => scrollByPage(-1)} aria-label="Scroll to earlier readings">
            ‹
          </button>
          <button style={arrowBtn} onClick={() => scrollByPage(1)} aria-label="Scroll to later readings">
            ›
          </button>
          {follow ? (
            <span style={{ color: "#25dbb0", fontWeight: 700, fontSize: 12 }}>LIVE</span>
          ) : (
            <button
              onClick={jumpToLive}
              style={{
                ...arrowBtn,
                width: "auto",
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 700,
                color: "#fbbf4a",
                borderColor: "#5a4413"
              }}
            >
              Back to live
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", marginTop: 16 }}>
        {/* fixed y-axis labels so they stay visible while the chart scrolls */}
        <div style={{ position: "relative", width: 36, height: HEIGHT, flexShrink: 0 }}>
          {Y_TICKS.map((v) => (
            <span
              key={v}
              style={{
                position: "absolute",
                right: 6,
                top: MARGIN.top + (1 - v / 100) * PLOT_H - 8,
                fontSize: 12,
                lineHeight: "16px",
                color: "#7c8aa0"
              }}
            >
              {v}
            </span>
          ))}
        </div>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          onMouseDown={startDrag}
          style={{ flex: 1, minWidth: 0, overflowX: "auto", cursor: "grab" }}
        >
          <LineChart width={width} height={HEIGHT} data={data} margin={MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#16303a" />
            <XAxis
              dataKey="ts"
              tickFormatter={fmtTime}
              interval={7}
              height={X_AXIS_HEIGHT}
              tick={{ fill: "#7c8aa0", fontSize: 12 }}
              axisLine={{ stroke: "#2a3a52" }}
              tickLine={false}
            />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              labelFormatter={fmtFull}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, "Gas"]}
              contentStyle={{ background: "#0e1520", border: "1px solid #22324a", borderRadius: 8 }}
              labelStyle={{ color: "#e8eef8" }}
              cursor={{ stroke: "#2a3f55" }}
            />
            <ReferenceLine y={threshold} stroke="#ff4d5e" strokeDasharray="5 4" />
            <Line
              type="monotone"
              dataKey="gas"
              stroke="#25dbb0"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </div>
      </div>

      {data.length > 0 && (
        <p style={{ margin: "10px 0 0", color: "#7c8aa0", fontSize: 12 }}>
          {data.length} readings stored, since {fmtFull(data[0].ts)}
        </p>
      )}
    </div>
  );
}