import { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";

const centroidCache = {};

function polygonCentroid(ring) {
  if (!ring || ring.length < 3) return { lng: 0, lat: 0, area: 0 };
  const n = ring.length;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-9) {
    const avg = ring.reduce(
      (acc, [x, y]) => [acc[0] + x, acc[1] + y],
      [0, 0]
    );
    return { lng: avg[0] / n, lat: avg[1] / n, area: 0 };
  }
  return { lng: cx / (6 * area), lat: cy / (6 * area), area };
}

function computeCentroid(feature) {
  const geom = feature.geometry;
  if (!geom) return [0, 0];

  const collect = (ring) => ring.map(([lng, lat]) => [lng, lat]);

  let coords = [];
  if (geom.type === "Polygon") {
    coords = collect(geom.coordinates[0]);
  } else if (geom.type === "MultiPolygon") {
    let best = { lng: 0, lat: 0, area: 0 };
    geom.coordinates.forEach((poly) => {
      const ring = collect(poly[0]);
      const c = polygonCentroid(ring);
      if (Math.abs(c.area) > Math.abs(best.area)) {
        best = c;
      }
    });
    return [best.lng, best.lat];
  }

  if (!coords.length) return [0, 0];
  const { lng, lat } = polygonCentroid(coords);
  return [lng, lat];
}

function getCentroid(name, features) {
  if (centroidCache[name]) return centroidCache[name];
  if (!features) return [0, 0];

  const feature = features.find((f) => {
    const n = (
      f.properties.ADMIN ||
      f.properties.NAME ||
      f.properties.NAME_LONG ||
      ""
    ).toLowerCase();
    return n === name.toLowerCase();
  });

  if (!feature) {
    const fuzzy = features.find((f) => {
      const n = (
        f.properties.ADMIN ||
        f.properties.NAME ||
        f.properties.NAME_LONG ||
        ""
      ).toLowerCase();
      return n.includes(name.toLowerCase()) || name.toLowerCase().includes(n);
    });
    if (!fuzzy) return [0, 0];
    const result = computeCentroid(fuzzy);
    centroidCache[name] = result;
    return result;
  }

  const result = computeCentroid(feature);
  centroidCache[name] = result;
  return result;
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const GR = 100;

function toXYZ(lat, lng, alt = 0) {
  const r = GR * (1 + alt);
  const p = lat * D2R,
    l = lng * D2R;
  return new THREE.Vector3(
    r * Math.cos(p) * Math.sin(l),
    r * Math.sin(p),
    r * Math.cos(p) * Math.cos(l)
  );
}

function slerp(a, b, t) {
  const [lo1, la1] = a,
    [lo2, la2] = b;
  const p1 = la1 * D2R,
    l1 = lo1 * D2R,
    p2 = la2 * D2R,
    l2 = lo2 * D2R;
  const ax = Math.cos(p1) * Math.cos(l1),
    ay = Math.cos(p1) * Math.sin(l1),
    az = Math.sin(p1);
  const bx = Math.cos(p2) * Math.cos(l2),
    by = Math.cos(p2) * Math.sin(l2),
    bz = Math.sin(p2);
  const dot = Math.min(1, ax * bx + ay * by + az * bz),
    O = Math.acos(dot);
  if (Math.abs(O) < 1e-7) return a;
  const s = Math.sin(O),
    fa = Math.sin((1 - t) * O) / s,
    fb = Math.sin(t * O) / s;
  return [
    Math.atan2(fa * ay + fb * by, fa * ax + fb * bx) * R2D,
    Math.asin(fa * az + fb * bz) * R2D
  ];
}

function arcAlt(t, peak = 0.32) {
  return Math.sin(t * Math.PI) * peak;
}

function eio(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function makeArrowGeo() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 1);
  sh.lineTo(-0.55, -0.6);
  sh.lineTo(0, -0.2);
  sh.lineTo(0.55, -0.6);
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
}

export default function TradeRouteGlobe({ showHud = false, routeData = null }) {
  const mountRef = useRef(null);
  const globeRef = useRef(null);
  const geoRef = useRef(null);
  const seqRef = useRef({ stop: false, raf: null, tid: null });

  const [tradeData, setTradeData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [phase, setPhase] = useState("loading");
  const [status, setStatus] = useState("Loading…");
  const [geoReady, setGeoReady] = useState(false);
  const fixedView = { lat: 0, lng: -35, altitude: 3.2 };

  useEffect(() => {
    const normalize = (raw) =>
      [...raw].sort((a, b) =>
        a.role === "exporter" && b.role !== "exporter"
          ? -1
          : a.role !== "exporter" && b.role === "exporter"
          ? 1
          : 0
      );

    if (Array.isArray(routeData) && routeData.length >= 2) {
      setTradeData(normalize(routeData));
      setPhase("loading");
      setCurrentIndex(-1);
      setStatus("Loading…");
      return;
    }

    fetch("/test.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load /test.json (${r.status})`);
        return r.json();
      })
      .then((raw) => {
        setTradeData(normalize(raw));
        setPhase("loading");
        setCurrentIndex(-1);
      })
      .catch((err) => {
        console.error("Globe: failed to load test.json —", err.message);
        setStatus("Error: could not load test.json from public/");
      });
  }, [routeData]);

  useEffect(() => {
    if (!mountRef.current) return;

    const world = Globe()(mountRef.current)
      .globeImageUrl(
        "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      )
      .bumpImageUrl(
        "https://unpkg.com/three-globe/example/img/earth-topology.png"
      )
      .backgroundColor("rgba(0,0,0,0)")
      .atmosphereColor("#1060ee")
      .atmosphereAltitude(0.18)
      .polygonsData([])
      .polygonAltitude(0.006)
      .polygonCapColor((d) => d.__cap || "rgba(255,255,255,0.03)")
      .polygonSideColor(() => "rgba(60,130,255,0.04)")
      .polygonStrokeColor(() => "#1a3d88");

    world.renderer().setClearColor(0x000000, 0);
    world.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const sc = world.scene();
    sc.add(new THREE.AmbientLight(0x223355, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(5, 3, 5);
    sc.add(sun);

    const gc = document.createElement("canvas");
    gc.width = gc.height = 256;
    const gx = gc.getContext("2d");
    const gr = gx.createRadialGradient(128, 128, 48, 128, 128, 128);
    gr.addColorStop(0, "rgba(20,100,255,0.20)");
    gr.addColorStop(0.5, "rgba(10,55,200,0.07)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    gx.fillStyle = gr;
    gx.fillRect(0, 0, 256, 256);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(gc),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true
      })
    );
    halo.scale.set(380, 380, 1);
    sc.add(halo);

    const ctrl = world.controls();
    ctrl.autoRotate = false;
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.08;
    ctrl.enableZoom = true;
    ctrl.enabled = true;

    world.pointOfView(fixedView);
    globeRef.current = world;

    fetch(
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
    )
      .then((r) => r.json())
      .then((geo) => {
        geoRef.current = geo.features;
        world.polygonsData(geo.features);
        setGeoReady(true);
        setStatus("Ready");
      });

    return () => {
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    if (geoReady && tradeData.length >= 2 && phase === "loading") {
      setPhase("ready");
    }
  }, [geoReady, tradeData, phase]);

  useEffect(() => {
    if (phase !== "ready" || !globeRef.current || !geoRef.current) return;

    const world = globeRef.current;
    const features = geoRef.current;
    const seq = { stop: false, raf: null, tid: null };
    seqRef.current = seq;

    const ROLE = {
      exporter: { cap: "rgba(0,255,120,0.28)", label: "#00ff78" },
      importer: { cap: "rgba(0,160,255,0.28)", label: "#00b0ff" }
    };
    const BASE_CAP = "rgba(255,255,255,0.03)";
    const ARC_MS = 2600;
    const PAUSE_MS = 4000;
    const MAX_PTS = 200;
    const exporterCountry =
      tradeData.find((entry) => entry.role === "exporter")?.country || null;

    function lockCamera() {
      world.controls().enabled = false;
    }
    function freeCamera() {
      world.controls().enabled = true;
    }

    function setCam(lat, lng, alt) {
      world.pointOfView({ lat, lng, altitude: alt }, 0);
    }

    function lerpCam(fromLL, toLL, alt0, alt1, ms) {
      return new Promise((res) => {
        const t0 = performance.now();
        function tick(now) {
          if (seq.stop) return res();
          const raw = Math.min((now - t0) / ms, 1);
          const t = eio(raw);
          const [lng, lat] = slerp(fromLL, toLL, t);
          setCam(lat, lng, alt0 + (alt1 - alt0) * t);
          if (raw < 1) seq.raf = requestAnimationFrame(tick);
          else res();
        }
        seq.raf = requestAnimationFrame(tick);
      });
    }

    function highlight(name, role) {
      features.forEach((f) => {
        const n = f.properties.ADMIN || f.properties.NAME || "";
        const lower = n.toLowerCase();
        const currentMatch = lower === name.toLowerCase();
        const exporterMatch =
          exporterCountry && lower === exporterCountry.toLowerCase();

        if (currentMatch) {
          f.__cap = ROLE[role]?.cap || BASE_CAP;
        } else if (exporterMatch) {
          // Keep exporter highlighted during the whole sequence.
          f.__cap = ROLE.exporter.cap;
        } else {
          f.__cap = BASE_CAP;
        }
      });
      world.polygonsData([...features]);
    }

    const posBuf = new Float32Array(MAX_PTS * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(posBuf, 3));
    lineGeo.setDrawRange(0, 0);

    const liveLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xff2d2d })
    );
    liveLine.frustumCulled = false;
    liveLine.visible = false;
    world.scene().add(liveLine);

    const arrowMesh = new THREE.Mesh(
      makeArrowGeo(),
      new THREE.MeshBasicMaterial({ color: 0xffe600, side: THREE.DoubleSide })
    );
    arrowMesh.frustumCulled = false;
    arrowMesh.visible = false;
    world.scene().add(arrowMesh);

    function bake(fromLL, toLL) {
      const N = 80,
        pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N,
          [lng, lat] = slerp(fromLL, toLL, t);
        pts.push(toXYZ(lat, lng, arcAlt(t, 0.32)));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color: 0xffe600,
        opacity: 0.2,
        transparent: true
      });
      world.scene().add(new THREE.Line(g, m));
    }

    function animateArc(fromE, toE) {
      return new Promise((res) => {
        if (seq.stop) return res();

        const fromLL = getCentroid(fromE.country, features);
        const toLL = getCentroid(toE.country, features);
        const N = Math.min(MAX_PTS - 1, 120);

        const pts = Array.from({ length: N + 1 }, (_, i) => {
          const t = i / N,
            [lng, lat] = slerp(fromLL, toLL, t),
            alt = arcAlt(t, 0.32);
          return { lat, lng, alt, xyz: toXYZ(lat, lng, alt) };
        });

        lineGeo.setDrawRange(0, 0);
        liveLine.visible = true;
        arrowMesh.visible = true;

        let t0 = null;

        function frame(now) {
          if (seq.stop) return res();
          if (!t0) t0 = now;

          const raw = Math.min((now - t0) / ARC_MS, 1);
          const t = eio(raw);
          const idx = Math.min(Math.floor(t * N), N);
          const tip = pts[idx];
          const prev = pts[Math.max(idx - 1, 0)];

          for (let i = 0; i <= idx; i++) {
            const { xyz } = pts[i];
            posBuf[i * 3] = xyz.x;
            posBuf[i * 3 + 1] = xyz.y;
            posBuf[i * 3 + 2] = xyz.z;
          }
          lineGeo.attributes.position.needsUpdate = true;
          lineGeo.setDrawRange(0, idx + 1);

          const dir = new THREE.Vector3()
            .subVectors(tip.xyz, prev.xyz)
            .normalize();
          const up = tip.xyz.clone().normalize();
          const right = new THREE.Vector3().crossVectors(dir, up).normalize();
          const fwd = new THREE.Vector3().crossVectors(up, right);
          arrowMesh.position.copy(tip.xyz);
          arrowMesh.setRotationFromMatrix(
            new THREE.Matrix4().makeBasis(right, up, fwd)
          );
          arrowMesh.scale.setScalar(GR * 0.028);

          const camAlt = 1.5 + tip.alt * 2.6;
          setCam(tip.lat, tip.lng, camAlt);

          if (raw < 1) {
            seq.raf = requestAnimationFrame(frame);
          } else res();
        }

        seq.raf = requestAnimationFrame(frame);
      });
    }

    function wait(ms) {
      return new Promise((res) => {
        seq.tid = setTimeout(res, ms);
      });
    }

    async function run() {
      lockCamera();

      const first = tradeData[0];
      const firstLL = getCentroid(first.country, features);
      const [fLng, fLat] = firstLL;

      setCurrentIndex(0);
      setStatus(`Flying to ${first.country}…`);
      highlight(first.country, first.role);

      await lerpCam([fixedView.lng, fixedView.lat], firstLL, fixedView.altitude, 1.9, 2200);
      if (seq.stop) return;

      await wait(800);
      if (seq.stop) return;

      for (let i = 0; i < tradeData.length - 1; i++) {
        if (seq.stop) return;

        const fromE = tradeData[i];
        const toE = tradeData[i + 1];
        const toLL = getCentroid(toE.country, features);
        const [toLng, toLat] = toLL;

        setStatus(`${fromE.country}  ──▶  ${toE.country}`);
        setCurrentIndex(i);

        await animateArc(fromE, toE);
        if (seq.stop) return;

        bake(getCentroid(fromE.country, features), toLL);
        liveLine.visible = false;
        arrowMesh.visible = false;
        lineGeo.setDrawRange(0, 0);

        highlight(toE.country, toE.role);
        setCurrentIndex(i + 1);
        const arrivalAlt = 1.5 + arcAlt(1, 0.32) * 2.6;
        await lerpCam(toLL, toLL, arrivalAlt, 1.75, 500);
        if (seq.stop) return;

        setStatus(`${toE.country} — ${toE.material}`);
        await wait(PAUSE_MS);
        if (seq.stop) return;
      }

      setPhase("done");
      setStatus("All routes mapped — free roam enabled");
      freeCamera();
    }

    run();

    return () => {
      seq.stop = true;
      if (seq.raf) cancelAnimationFrame(seq.raf);
      if (seq.tid) clearTimeout(seq.tid);
    };
  }, [phase, tradeData]);

  const cur = tradeData[currentIndex] ?? null;
  const rs =
    cur?.role === "exporter"
      ? {
          text: "#00ff78",
          border: "rgba(0,255,120,0.4)",
          bg: "rgba(0,255,120,0.07)"
        }
      : {
          text: "#00b0ff",
          border: "rgba(0,160,255,0.4)",
          bg: "rgba(0,160,255,0.07)"
        };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div
        ref={mountRef}
        style={{
          width: "100%",
          height: "100%",
          transition: "transform 0.6s ease",
          transform: "translate(-50%, -40%) scale(1)"
        }}
      />

      {cur && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(0, 0, 0, 0.55)",
            color: "#e9f2ff",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            pointerEvents: "none"
          }}
        >
          {cur.country}
        </div>
      )}

      {showHud && (
        <>
          <div
            style={{
              position: "absolute",
              top: 18,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "'Courier New',monospace",
              color: "#4a9fff",
              fontSize: 12,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textShadow: "0 0 14px #4a9fff88",
              userSelect: "none",
              whiteSpace: "nowrap"
            }}
          >
            ⬡ &nbsp; Global Trade Flow Visualizer &nbsp; ⬡
          </div>

          {tradeData.length > 1 && (
            <div
              style={{
                position: "absolute",
                top: 44,
                left: "50%",
                transform: "translateX(-50%)",
                width: 220,
                height: 2,
                background: "rgba(255,255,255,0.07)",
                borderRadius: 2
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${((currentIndex + 1) / tradeData.length) * 100}%`,
                  background: "linear-gradient(90deg,#00ff78,#00b0ff)",
                  borderRadius: 2,
                  transition: "width 0.5s ease",
                  boxShadow: "0 0 10px #00b0ff88"
                }}
              />
            </div>
          )}

          <div
            style={{
              position: "absolute",
              top: 56,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "'Courier New',monospace",
              fontSize: 10,
              color: "rgba(120,180,255,0.5)",
              letterSpacing: "0.12em",
              whiteSpace: "nowrap"
            }}
          >
            {status}
          </div>

          {cur && (
            <div
              key={currentIndex}
              style={{
                position: "absolute",
                bottom: 24,
                left: 24,
                background: rs.bg,
                border: `1px solid ${rs.border}`,
                borderRadius: 12,
                padding: "12px 16px",
                fontFamily: "'Courier New',monospace",
                color: "#fff",
                backdropFilter: "blur(10px)",
                boxShadow: `0 0 24px ${rs.border}`,
                minWidth: 200,
                animation: "fadeUp 0.4s ease"
              }}
            >
              <div
                style={{
                  color: rs.text,
                  fontSize: 14,
                  fontWeight: "bold",
                  marginBottom: 3
                }}
              >
                {cur.country}
              </div>
              <div
                style={{
                  color: "#666",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  marginBottom: 6
                }}
              >
                {cur.role.toUpperCase()} &nbsp;·&nbsp; HS {cur.hs_code}
              </div>
              <div style={{ color: "#ddd", fontSize: 12 }}>
                {cur.material}
              </div>
            </div>
          )}

          <div
            style={{
              position: "absolute",
              bottom: 24,
              right: 24,
              fontFamily: "'Courier New',monospace",
              color: "rgba(100,170,255,0.45)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textAlign: "right"
            }}
          >
            {phase === "done"
              ? "✓  FREE ROAM"
              : tradeData.length > 0
              ? `STOP ${Math.min(currentIndex + 1, tradeData.length)} / ${
                  tradeData.length
                }`
              : ""}
          </div>

          <div
            style={{
              position: "absolute",
              top: 70,
              right: 18,
              fontFamily: "'Courier New',monospace",
              fontSize: 9,
              color: "#555",
              lineHeight: "18px"
            }}
          >
            <div>
              <span style={{ color: "#00ff78" }}>█</span> Exporter
            </div>
            <div>
              <span style={{ color: "#00b0ff" }}>█</span> Importer
            </div>
            <div>
              <span style={{ color: "#ffee00" }}>——▶</span> Route
            </div>
          </div>

          {phase === "done" && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                fontFamily: "'Courier New',monospace",
                color: "rgba(0,255,120,0.8)",
                fontSize: 12,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                textShadow: "0 0 20px #00ff78",
                pointerEvents: "none",
                animation: "fadeOut 1s ease 2s forwards"
              }}
            >
              Free Roam
            </div>
          )}

          <style>{`
            @keyframes fadeUp {
              from { opacity:0; transform:translateY(12px); }
              to   { opacity:1; transform:translateY(0); }
            }
            @keyframes fadeOut {
              from { opacity:1; } to { opacity:0; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
