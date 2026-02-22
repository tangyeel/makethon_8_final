import { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";

/* ─── Centroid helpers ─── */
const centroidCache = {};

function polygonCentroid(ring) {
  if (!ring || ring.length < 3) return { lng: 0, lat: 0, area: 0 };
  const n = ring.length;
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-9) {
    const avg = ring.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
    return { lng: avg[0] / n, lat: avg[1] / n, area: 0 };
  }
  return { lng: cx / (6 * area), lat: cy / (6 * area), area };
}

function computeCentroid(feature) {
  const geom = feature.geometry;
  if (!geom) return [0, 0];
  const collect = (ring) => ring.map(([lng, lat]) => [lng, lat]);
  if (geom.type === "Polygon") {
    const { lng, lat } = polygonCentroid(collect(geom.coordinates[0]));
    return [lng, lat];
  }
  if (geom.type === "MultiPolygon") {
    let best = { lng: 0, lat: 0, area: 0 };
    geom.coordinates.forEach((poly) => {
      const c = polygonCentroid(collect(poly[0]));
      if (Math.abs(c.area) > Math.abs(best.area)) best = c;
    });
    return [best.lng, best.lat];
  }
  return [0, 0];
}

function getCentroid(name, features) {
  if (centroidCache[name]) return centroidCache[name];
  if (!features) return [0, 0];
  const lower = name.toLowerCase();
  let feat = features.find((f) =>
    (f.properties.ADMIN || f.properties.NAME || f.properties.NAME_LONG || "").toLowerCase() === lower
  );
  if (!feat) {
    feat = features.find((f) => {
      const n = (f.properties.ADMIN || f.properties.NAME || f.properties.NAME_LONG || "").toLowerCase();
      return n.includes(lower) || lower.includes(n);
    });
  }
  if (!feat) return [0, 0];
  const result = computeCentroid(feat);
  centroidCache[name] = result;
  return result;
}

/* ─── Math helpers ─── */
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function slerp(a, b, t) {
  const [lo1, la1] = a, [lo2, la2] = b;
  const p1 = la1*D2R, l1 = lo1*D2R, p2 = la2*D2R, l2 = lo2*D2R;
  const ax = Math.cos(p1)*Math.cos(l1), ay = Math.cos(p1)*Math.sin(l1), az = Math.sin(p1);
  const bx = Math.cos(p2)*Math.cos(l2), by = Math.cos(p2)*Math.sin(l2), bz = Math.sin(p2);
  const dot = Math.min(1, ax*bx + ay*by + az*bz), O = Math.acos(dot);
  if (Math.abs(O) < 1e-7) return a;
  const s = Math.sin(O), fa = Math.sin((1-t)*O)/s, fb = Math.sin(t*O)/s;
  return [Math.atan2(fa*ay + fb*by, fa*ax + fb*bx)*R2D, Math.asin(fa*az + fb*bz)*R2D];
}

function eio(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }

/* ─── Component ─── */
export default function TradeRouteGlobe({ showHud = false, routeData = null }) {
  const wrapperRef = useRef(null);   // sized wrapper div
  const mountRef   = useRef(null);   // globe.gl mounts here
  const globeRef   = useRef(null);
  const geoRef     = useRef(null);
  const seqRef     = useRef({ stop: false, raf: null, tid: null });

  const [tradeData,    setTradeData]    = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [phase,        setPhase]        = useState("loading");
  const [status,       setStatus]       = useState("Loading…");
  const [geoReady,     setGeoReady]     = useState(false);

  const fixedView = { lat: 20, lng: 0, altitude: 2.5 };

  /* ─── Load route data ─── */
  useEffect(() => {
    const normalize = (raw) =>
      [...raw].sort((a, b) =>
        a.role === "exporter" && b.role !== "exporter" ? -1
        : a.role !== "exporter" && b.role === "exporter" ? 1 : 0
      );

    if (Array.isArray(routeData) && routeData.length >= 2) {
      setTradeData(normalize(routeData));
      setPhase("loading");
      setCurrentIndex(-1);
      setStatus("Loading…");
      return;
    }
    // fallback: try test.json
    fetch("/test.json")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((raw) => { setTradeData(normalize(raw)); setPhase("loading"); setCurrentIndex(-1); })
      .catch(() => setStatus("Awaiting route data…"));
  }, [routeData]);

  /* ─── Init globe.gl ─── */
  useEffect(() => {
    if (!mountRef.current) return;

    // Give the wrapper a moment to paint so getBoundingClientRect is non-zero
    const init = () => {
      const w = wrapperRef.current?.clientWidth  || 800;
      const h = wrapperRef.current?.clientHeight || 500;

      const world = Globe()
        .width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .atmosphereColor("#38BDF8")
        .atmosphereAltitude(0.2)
        .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
        .polygonsData([])
        .polygonAltitude(0.006)
        .polygonCapColor((d) => d.__cap || "rgba(255,255,255,0.03)")
        .polygonSideColor(() => "rgba(56,189,248,0.04)")
        .polygonStrokeColor(() => "#1a4d88")
        (mountRef.current);

      world.renderer().setClearColor(0x000000, 0);
      world.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Lighting
      const sc = world.scene();
      sc.add(new THREE.AmbientLight(0x223355, 3));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(5, 3, 5);
      sc.add(sun);

      world.controls().enableDamping = true;
      world.controls().dampingFactor = 0.08;
      world.controls().enableZoom = true;
      world.pointOfView(fixedView);
      globeRef.current = world;

      // Resize observer — keep globe sized to its wrapper
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          world.width(width).height(height);
        }
      });
      if (wrapperRef.current) ro.observe(wrapperRef.current);

      // Load GeoJSON
      fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
        .then((r) => r.json())
        .then((geo) => {
          geoRef.current = geo.features;
          world.polygonsData(geo.features);
          setGeoReady(true);
          setStatus("Ready");
        })
        .catch(() => setStatus("Could not load map data"));

      return () => {
        ro.disconnect();
        if (mountRef.current) mountRef.current.innerHTML = "";
      };
    };

    // Small delay so CSS has laid out the wrapper
    const t = setTimeout(init, 80);
    return () => clearTimeout(t);
  }, []);

  /* ─── Start animation when geo + data ready ─── */
  useEffect(() => {
    if (geoReady && tradeData.length >= 2 && phase === "loading") {
      setPhase("ready");
    }
  }, [geoReady, tradeData, phase]);

  /* ─── Animation sequence ─── */
  useEffect(() => {
    if (phase !== "ready" || !globeRef.current || !geoRef.current) return;

    const world    = globeRef.current;
    const features = geoRef.current;
    const seq = { stop: false, raf: null, tid: null };
    seqRef.current = seq;

    const ROLE = {
      exporter: { cap: "rgba(0,255,120,0.28)" },
      importer: { cap: "rgba(0,160,255,0.28)" },
    };
    const BASE_CAP = "rgba(255,255,255,0.03)";
    const ARC_MS   = 2600;
    const PAUSE_MS = 3500;
    const exporterCountry = tradeData.find((e) => e.role === "exporter")?.country || null;

    function highlight(name, role) {
      features.forEach((f) => {
        const n = (f.properties.ADMIN || f.properties.NAME || "").toLowerCase();
        const isThis     = n === name.toLowerCase();
        const isExporter = exporterCountry && n === exporterCountry.toLowerCase();
        f.__cap = isThis ? (ROLE[role]?.cap || BASE_CAP) : isExporter ? ROLE.exporter.cap : BASE_CAP;
      });
      world.polygonsData([...features]);
    }

    function clearHighlights() {
      features.forEach((f) => (f.__cap = BASE_CAP));
      world.polygonsData([...features]);
    }

    function lerpCam(fromLL, toLL, alt0, alt1, ms) {
      return new Promise((res) => {
        const t0 = performance.now();
        function tick(now) {
          if (seq.stop) return res();
          const raw = Math.min((now - t0) / ms, 1);
          const t   = eio(raw);
          const [lng, lat] = slerp(fromLL, toLL, t);
          world.pointOfView({ lat, lng, altitude: alt0 + (alt1 - alt0) * t }, 0);
          if (raw < 1) seq.raf = requestAnimationFrame(tick);
          else res();
        }
        seq.raf = requestAnimationFrame(tick);
      });
    }

    function drawArc(fromLL, toLL) {
      return new Promise((res) => {
        const t0 = performance.now();
        function tick(now) {
          if (seq.stop) { world.arcsData([]); return res(); }
          const raw = Math.min((now - t0) / ARC_MS, 1);
          world.arcsData([{
            startLat: fromLL[1], startLng: fromLL[0],
            endLat:   toLL[1],   endLng:   toLL[0],
            color: ["#ffee00", "#00b0ff"],
            arcAltitudeAutoScale: 0.5,
            stroke: 0.5,
          }]);
          if (raw < 1) seq.raf = requestAnimationFrame(tick);
          else res();
        }
        seq.raf = requestAnimationFrame(tick);
      });
    }

    async function runSequence() {
      setPhase("animating");
      world.controls().enabled = false;

      for (let i = 0; i < tradeData.length; i++) {
        if (seq.stop) break;
        const entry = tradeData[i];
        const ll    = getCentroid(entry.country, features);
        if (!ll || (ll[0] === 0 && ll[1] === 0)) continue;

        setCurrentIndex(i);
        setStatus(`${entry.country.toUpperCase()} · ${entry.role.toUpperCase()}`);
        highlight(entry.country, entry.role);

        const prevEntry = i > 0 ? tradeData[i - 1] : null;
        const prevLL    = prevEntry ? getCentroid(prevEntry.country, features) : null;
        const startLL   = prevLL && prevLL[0] !== 0 ? prevLL : [fixedView.lng, fixedView.lat];

        await lerpCam(startLL, ll, 2.8, 2.0, 1600);
        if (seq.stop) break;

        if (prevLL && prevLL[0] !== 0) {
          await drawArc(prevLL, ll);
        }
        if (seq.stop) break;

        await new Promise((res) => { seq.tid = setTimeout(res, PAUSE_MS); });
      }

      if (!seq.stop) {
        clearHighlights();
        world.arcsData([]);
        world.controls().enabled = true;
        world.pointOfView({ lat: 20, lng: 0, altitude: 2.6 }, 1400);
        setPhase("done");
        setCurrentIndex(-1);
        setStatus("Free Roam — drag to explore");
      }
    }

    runSequence();

    return () => {
      seq.stop = true;
      if (seq.raf) cancelAnimationFrame(seq.raf);
      if (seq.tid) clearTimeout(seq.tid);
      if (globeRef.current) {
        try {
          globeRef.current.arcsData([]);
          features.forEach((f) => (f.__cap = BASE_CAP));
          globeRef.current.polygonsData([...features]);
          globeRef.current.controls().enabled = true;
        } catch (_) {}
      }
    };
  }, [phase]);

  const cur = currentIndex >= 0 && currentIndex < tradeData.length ? tradeData[currentIndex] : null;
  const rs  = cur?.role === "exporter"
    ? { text: "#00ff78", border: "rgba(0,255,120,0.4)", bg: "rgba(0,255,120,0.06)" }
    : { text: "#00b0ff", border: "rgba(0,160,255,0.4)", bg: "rgba(0,160,255,0.06)" };

  return (
    /* Outer wrapper: fills .dashboard-map, gives globe.gl explicit pixel dimensions */
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 480,
        overflow: "hidden",
        borderRadius: 16,
        background: "transparent",
      }}
    >
      {/* globe.gl mounts into this div — no transforms, no offset */}
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Current country overlay */}
      {cur && (
        <div style={{
          position: "absolute", top: 14, left: 14,
          padding: "6px 12px", borderRadius: 8,
          background: "rgba(5,7,9,0.75)",
          border: `1px solid ${rs.border}`,
          color: "#e9f2ff", fontSize: 12, fontWeight: 600,
          letterSpacing: "0.04em", pointerEvents: "none",
          backdropFilter: "blur(8px)",
        }}>
          {cur.country}
        </div>
      )}

      {/* Status bar */}
      <div style={{
        position: "absolute", bottom: 14, left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "'DM Mono', monospace",
        fontSize: 10, letterSpacing: "0.14em",
        color: "rgba(56,189,248,0.5)",
        pointerEvents: "none", whiteSpace: "nowrap",
      }}>
        {status}
      </div>

      {/* Route card (showHud mode) */}
      {showHud && cur && (
        <div key={currentIndex} style={{
          position: "absolute", bottom: 40, left: 24,
          background: rs.bg, border: `1px solid ${rs.border}`,
          borderRadius: 12, padding: "12px 16px",
          color: "#fff", backdropFilter: "blur(10px)",
          boxShadow: `0 0 24px ${rs.border}`, minWidth: 200,
          animation: "fadeUp 0.4s ease",
        }}>
          <div style={{ color: rs.text, fontSize: 14, fontWeight: "bold", marginBottom: 3 }}>{cur.country}</div>
          <div style={{ color: "#666", fontSize: 9, letterSpacing: "0.18em", marginBottom: 6 }}>
            {cur.role.toUpperCase()} · HS {cur.hs_code}
          </div>
          <div style={{ color: "#ddd", fontSize: 12 }}>{cur.material}</div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
