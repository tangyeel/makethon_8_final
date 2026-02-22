import { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";

// ── Centroid helpers ───────────────────────────────────────────────────────────
const centroidCache = {};

function computeCentroid(feature) {
  const geom = feature.geometry;
  if (!geom) return [0, 0];
  let coords = [];
  if (geom.type === "Polygon") {
    coords = geom.coordinates[0];
  } else if (geom.type === "MultiPolygon") {
    coords = geom.coordinates.reduce((a, b) =>
      a[0].length > b[0].length ? a : b
    )[0];
  }
  if (!coords.length) return [0, 0];
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat  = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lng, lat];
}

function getCentroid(name, features) {
  if (centroidCache[name]) return centroidCache[name];
  if (!features) return [0, 0];
  let f = features.find(f =>
    (f.properties.ADMIN || f.properties.NAME || "").toLowerCase() === name.toLowerCase()
  );
  if (!f) f = features.find(f => {
    const n = (f.properties.ADMIN || f.properties.NAME || "").toLowerCase();
    return n.includes(name.toLowerCase()) || name.toLowerCase().includes(n);
  });
  if (!f) return [0, 0];
  const r = computeCentroid(f);
  centroidCache[name] = r;
  return r;
}

// ── Math helpers ───────────────────────────────────────────────────────────────
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const GR  = 100;

function toXYZ(lat, lng, alt = 0) {
  const r = GR * (1 + alt), p = lat * D2R, l = lng * D2R;
  return new THREE.Vector3(
    r * Math.cos(p) * Math.sin(l),
    r * Math.sin(p),
    r * Math.cos(p) * Math.cos(l)
  );
}

function slerp(a, b, t) {
  const [lo1,la1]=a, [lo2,la2]=b;
  const p1=la1*D2R,l1=lo1*D2R,p2=la2*D2R,l2=lo2*D2R;
  const ax=Math.cos(p1)*Math.cos(l1),ay=Math.cos(p1)*Math.sin(l1),az=Math.sin(p1);
  const bx=Math.cos(p2)*Math.cos(l2),by=Math.cos(p2)*Math.sin(l2),bz=Math.sin(p2);
  const dot=Math.min(1,ax*bx+ay*by+az*bz), O=Math.acos(dot);
  if (Math.abs(O)<1e-7) return a;
  const s=Math.sin(O),fa=Math.sin((1-t)*O)/s,fb=Math.sin(t*O)/s;
  return [Math.atan2(fa*ay+fb*by,fa*ax+fb*bx)*R2D, Math.asin(fa*az+fb*bz)*R2D];
}

function arcAlt(t, peak=0.32) { return Math.sin(t*Math.PI)*peak; }
function eio(t) { return t<0.5?2*t*t:-1+(4-2*t)*t; }

function makeArrowGeo() {
  const sh = new THREE.Shape();
  sh.moveTo(0,1); sh.lineTo(-0.55,-0.6); sh.lineTo(0,-0.2); sh.lineTo(0.55,-0.6);
  sh.closePath();
  return new THREE.ShapeGeometry(sh);
}

function normalizeTradeRoute(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return [];
  const normalized = raw
    .filter(e => e && e.country)
    .map(e => ({ ...e, country: String(e.country).trim(), role: String(e.role||"").toLowerCase() }));
  if (normalized.length < 2) return [];
  const exporter = normalized.find(e => e.role==="exporter") || normalized[0];
  const importer = normalized.find(e => e.role==="importer") || normalized[normalized.length-1];
  if (!exporter?.country || !importer?.country) return [];
  return [
    { ...exporter, role:"exporter", material:exporter.material||"Export shipment", hs_code:exporter.hs_code||"0000.00" },
    { ...importer, role:"importer", material:importer.material||exporter.material||"Import shipment", hs_code:importer.hs_code||exporter.hs_code||"0000.00" },
  ];
}

// ── Detail Panel ───────────────────────────────────────────────────────────────
function DetailPanel({ entry, onClose }) {
  if (!entry) return null;
  const isExp = entry.role === "exporter";
  const accent = isExp ? "#00ff78" : "#00aaff";
  const accentBorder = isExp ? "rgba(0,255,120,0.35)" : "rgba(0,160,255,0.35)";
  const accentGlow   = isExp ? "rgba(0,255,120,0.15)" : "rgba(0,160,255,0.15)";
  const reserved = ["country","role","hs_code","material"];
  const extra = Object.entries(entry).filter(([k]) => !reserved.includes(k));

  return (
    <div style={{
      position:"absolute", top:"50%", right:32, transform:"translateY(-50%)",
      width:300, background:"rgba(0,2,14,0.92)", border:`1px solid ${accentBorder}`,
      borderRadius:16, padding:"24px 26px", fontFamily:"'Courier New',monospace",
      backdropFilter:"blur(20px)", zIndex:1000,
      boxShadow:`0 0 40px ${accentGlow},0 0 80px rgba(0,0,0,0.6)`,
      animation:"slideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <button onClick={onClose} style={{
        position:"absolute",top:14,right:16,background:"none",border:"none",cursor:"pointer",
        color:"rgba(255,255,255,0.3)",fontSize:18,lineHeight:1,padding:"2px 6px",
      }}
        onMouseEnter={e=>e.target.style.color="#fff"}
        onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.3)"}
      >✕</button>

      <div style={{ display:"inline-block", background: isExp?"rgba(0,255,120,0.07)":"rgba(0,160,255,0.07)",
        border:`1px solid ${accentBorder}`, borderRadius:4, padding:"2px 8px",
        fontSize:9, letterSpacing:"0.2em", color:accent, marginBottom:10, textTransform:"uppercase",
      }}>{entry.role}</div>

      <div style={{ color:"#fff", fontSize:22, fontWeight:"bold", letterSpacing:"0.04em", marginBottom:4, lineHeight:1.2 }}>
        {entry.country}
      </div>
      <div style={{ color:accent, fontSize:13, marginBottom:20, opacity:0.85 }}>{entry.material}</div>

      <div style={{ height:1, background:`linear-gradient(90deg,${accentBorder},transparent)`, marginBottom:18 }}/>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ color:"rgba(255,255,255,0.35)",fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase" }}>HS Code</span>
        <span style={{ color:"#fff",fontSize:13,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,padding:"2px 8px",letterSpacing:"0.08em" }}>
          {entry.hs_code}
        </span>
      </div>

      {extra.map(([k,v]) => (
        <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:12 }}>
          <span style={{ color:"rgba(255,255,255,0.35)",fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",paddingTop:2,flexShrink:0 }}>
            {k.replace(/_/g," ")}
          </span>
          <span style={{ color:"rgba(220,235,255,0.85)",fontSize:12,textAlign:"right",lineHeight:1.4 }}>{v}</span>
        </div>
      ))}

      <div style={{ marginTop:18,height:2,borderRadius:1,background:`linear-gradient(90deg,${accent},transparent)`,opacity:0.4 }}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function GlobeComponent({ routeData = null }) {
  // wrapperRef  → the outer positioned div (sized by parent CSS)
  // mountRef    → the div globe.gl renders its canvas INTO
  // Both are rendered in the same place; mountRef fills wrapperRef via absolute inset:0
  const wrapperRef  = useRef(null);
  const mountRef    = useRef(null);
  const globeRef    = useRef(null);
  const geoRef      = useRef(null);
  const seqRef      = useRef({ stop:false, raf:null, tid:null });
  const spheresRef  = useRef([]);

  const [tradeData,     setTradeData]     = useState([]);
  const [currentIndex,  setCurrentIndex]  = useState(-1);
  const [phase,         setPhase]         = useState("loading");
  const [status,        setStatus]        = useState("Loading…");
  const [geoReady,      setGeoReady]      = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [resetKey,      setResetKey]      = useState(0);
  const [isRefreshing,  setIsRefreshing]  = useState(false);

  // ── Load route data ──────────────────────────────────────────────────────────
  useEffect(() => {
    setTradeData([]);
    setCurrentIndex(-1);
    setPhase("loading");
    setStatus("Loading…");
    setSelectedEntry(null);

    const from = normalizeTradeRoute(routeData);
    if (from.length >= 2) {
      setTradeData(from);
      setIsRefreshing(false);
      return;
    }
    fetch(`/test.json?_=${Date.now()}`)
      .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(raw => { setTradeData(normalizeTradeRoute(raw)); setIsRefreshing(false); })
      .catch(e  => { setStatus(`Error: ${e.message}`); setIsRefreshing(false); });
  }, [resetKey, routeData]);

  // ── Init Globe ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    let roCleanup = () => {};

    const init = () => {
      // ── CRITICAL: read size from wrapperRef (has real CSS dimensions),
      //    not mountRef (which is position:absolute and may still read 0)
      const w = wrapperRef.current?.offsetWidth  || 800;
      const h = wrapperRef.current?.offsetHeight || 520;

      // ── Build the globe. NOTE: labelsData([]) not labelsData() ──────────────
      const world = Globe()
        .width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .atmosphereColor("#1060ee")
        .atmosphereAltitude(0.18)
        .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
        .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
        .polygonsData([])
        .polygonAltitude(0.006)
        .polygonCapColor(d => d.__cap || "rgba(255,255,255,0.03)")
        .polygonSideColor(() => "rgba(60,130,255,0.04)")
        .polygonStrokeColor(() => "#1a3d88")
        .labelsData([])          // ← pass [] not bare call (bare call = getter, breaks chain)
        (mountRef.current);      // ← mount into mountRef

      // Make the renderer's canvas fill its container with no extra sizing
      const canvas = world.renderer().domElement;
      canvas.style.display = "block";
      canvas.style.width   = "100%";
      canvas.style.height  = "100%";

      world.renderer().setClearColor(0x000005, 1);
      world.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Lighting
      const sc = world.scene();
      sc.add(new THREE.AmbientLight(0xffffff, 2.5));
      const sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(200, 100, 200); sc.add(sun);
      const fill = new THREE.DirectionalLight(0x4488ff, 0.5);
      fill.position.set(-200, -50, -200); sc.add(fill);

      // Halo glow
      const gc = document.createElement("canvas");
      gc.width = gc.height = 256;
      const gx = gc.getContext("2d");
      const gr = gx.createRadialGradient(128,128,48,128,128,128);
      gr.addColorStop(0,"rgba(20,100,255,0.20)");
      gr.addColorStop(0.5,"rgba(10,55,200,0.07)");
      gr.addColorStop(1,"rgba(0,0,0,0)");
      gx.fillStyle = gr; gx.fillRect(0,0,256,256);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(gc),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      }));
      halo.scale.set(380,380,1); sc.add(halo);

      const ctrl = world.controls();
      ctrl.autoRotate = false; ctrl.enableDamping = true;
      ctrl.dampingFactor = 0.08; ctrl.enableZoom = true; ctrl.enabled = true;

      world.pointOfView({ lat:20, lng:10, altitude:3.1 });
      globeRef.current = world;

      // ── ResizeObserver on wrapperRef so we always get real pixel dims ──────
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) world.width(width).height(height);
      });
      ro.observe(wrapperRef.current);
      roCleanup = () => ro.disconnect();

      // ── Load GeoJSON ─────────────────────────────────────────────────────────
      fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
        .then(r => r.json())
        .then(geo => {
          geoRef.current = geo.features;
          world.polygonsData(geo.features);
          setGeoReady(true);
          setStatus("Ready");
        })
        .catch(() => setStatus("Could not load map data"));
    };

    // Delay slightly so parent CSS has painted and offsetWidth is real
    const t = setTimeout(init, 120);

    return () => {
      clearTimeout(t);
      roCleanup();
      if (mountRef.current) mountRef.current.innerHTML = "";
      globeRef.current = null;
    };
  }, []);  // run once on mount

  // ── Gate: start animation when both globe and data are ready ────────────────
  useEffect(() => {
    if (!geoReady || tradeData.length < 2 || phase !== "loading") return;
    if (globeRef.current && geoRef.current) {
      globeRef.current.labelsData([]);
      geoRef.current.forEach(f => { f.__cap = "rgba(255,255,255,0.03)"; });
      globeRef.current.polygonsData([...geoRef.current]);
    }
    setPhase("ready");
  }, [geoReady, tradeData, phase, resetKey]);

  // ── Free-roam sphere nodes + flower arcs ────────────────────────────────────
  useEffect(() => {
    if (phase !== "done" || !geoRef.current || !globeRef.current) return;

    const world    = globeRef.current;
    const features = geoRef.current;
    const scene    = world.scene();
    const camera   = world.camera();
    const canvas   = world.renderer().domElement;

    const SPHERE_R    = 2.5;
    const CENTRE_DIST = GR - SPHERE_R * 0.5;
    const FLOWER_SEGS = 80;
    const FLOWER_PEAK = 0.28;

    const meshes = tradeData.map(entry => {
      const [lng, lat] = getCentroid(entry.country, features);
      const col = entry.role === "exporter" ? 0x00ff78 : 0x00aaff;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(SPHERE_R, 20, 20),
        new THREE.MeshPhongMaterial({ color:col, emissive:col, emissiveIntensity:0.45, shininess:80 })
      );
      mesh.frustumCulled = false;
      const p = lat*D2R, l = lng*D2R;
      mesh.position.set(
        CENTRE_DIST*Math.cos(p)*Math.sin(l),
        CENTRE_DIST*Math.sin(p),
        CENTRE_DIST*Math.cos(p)*Math.cos(l)
      );
      scene.add(mesh);
      return { mesh, entry, lng, lat };
    });
    spheresRef.current = meshes;

    let flowerLines   = [];
    let flowerRaf     = null;
    let activeExporter = null;

    function clearFlower() {
      cancelAnimationFrame(flowerRaf);
      flowerLines.forEach(({ line }) => { scene.remove(line); line.geometry.dispose(); line.material.dispose(); });
      flowerLines = [];
      activeExporter = null;
      meshes.forEach(m => {
        m.mesh.scale.setScalar(1);
        m.mesh.material.emissiveIntensity = 0.45;
        m.mesh.material.opacity = 1;
        m.mesh.material.transparent = false;
      });
    }

    function spawnFlower(exporterItem) {
      clearFlower();
      activeExporter = exporterItem.entry;
      const exporterHs  = String(exporterItem.entry.hs_code).trim();
      const allImporters = meshes.filter(m => m.entry.role === "importer");
      const matched      = allImporters.filter(m => String(m.entry.hs_code).trim() === exporterHs);
      const targets      = matched.length ? matched : allImporters;
      if (!targets.length) return;
      const fromLL = [exporterItem.lng, exporterItem.lat];
      if (fromLL[0] === 0 && fromLL[1] === 0) return;

      const relevant = new Set([exporterItem, ...targets]);
      meshes.forEach(m => {
        if (!relevant.has(m)) {
          m.mesh.material.transparent = true; m.mesh.material.opacity = 0.12; m.mesh.material.emissiveIntensity = 0.05;
        } else {
          m.mesh.material.transparent = false; m.mesh.material.opacity = 1;
          m.mesh.material.emissiveIntensity = m === exporterItem ? 1.4 : 0.9;
          m.mesh.scale.setScalar(m === exporterItem ? 2.0 : 1.5);
        }
      });

      const total = targets.length || 1;
      targets.forEach((imp, idx) => {
        const toLL = [imp.lng, imp.lat];
        const pts  = [];
        for (let i = 0; i <= FLOWER_SEGS; i++) {
          const t = i / FLOWER_SEGS;
          const [lng2, lat2] = slerp(fromLL, toLL, t);
          pts.push(toXYZ(lat2, lng2, arcAlt(t, FLOWER_PEAK)));
        }

        function makePosAttr() {
          const arr = new Float32Array(pts.length * 3);
          pts.forEach((v, i) => { arr[i*3]=v.x; arr[i*3+1]=v.y; arr[i*3+2]=v.z; });
          return new THREE.BufferAttribute(arr, 3);
        }

        [[0x00ff88,1.0,false],[0x00ff44,0.7,true],[0x00ffcc,0.4,true]].forEach(([col, opa, additive], li) => {
          const geo = new THREE.BufferGeometry(); geo.setAttribute("position", makePosAttr());
          const mat = new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:opa, depthTest:false, depthWrite:false,
            ...(additive ? { blending: THREE.AdditiveBlending } : {}) });
          const line = new THREE.Line(geo, mat);
          line.frustumCulled = false; line.renderOrder = 999 - li; scene.add(line);
          flowerLines.push({ line, phaseSeed: idx/total, layer: ["core","glow","halo"][li] });
        });
      });

      const startTime = performance.now();
      function animateFlower(now) {
        const elapsed = (now - startTime) / 1000;
        flowerLines.forEach(({ line, phaseSeed, layer }) => {
          const wave = (Math.sin(elapsed * 2.5 + phaseSeed * Math.PI * 2) + 1) / 2;
          if (layer === "core") {
            line.material.opacity = 0.5 + 0.5 * wave;
            line.material.color.setRGB(0, 0.8+0.2*wave, 0.3+0.7*wave);
          } else if (layer === "glow") {
            line.material.opacity = 0.3 + 0.5 * wave;
          } else {
            const slow = (Math.sin(elapsed * 1.4 + phaseSeed * Math.PI * 2) + 1) / 2;
            line.material.opacity = 0.15 + 0.35 * slow;
          }
          line.material.needsUpdate = true;
        });
        const p = 1.6 + 0.5 * Math.abs(Math.sin(elapsed * 3.0));
        exporterItem.mesh.scale.setScalar(p);
        exporterItem.mesh.material.emissiveIntensity = 0.9 + 0.9 * Math.abs(Math.sin(elapsed * 3.0));
        flowerRaf = requestAnimationFrame(animateFlower);
      }
      flowerRaf = requestAnimationFrame(animateFlower);
    }

    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let hoveredMesh = null;
    function getHit(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX-rect.left)/rect.width)  * 2 - 1;
      mouse.y = -((e.clientY-rect.top) /rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(meshes.map(m=>m.mesh), false);
      return hits.length ? meshes.find(m=>m.mesh===hits[0].object) : null;
    }
    function onMove(e) {
      const found = getHit(e);
      if (found) {
        canvas.style.cursor = "pointer";
        if (hoveredMesh !== found) {
          hoveredMesh = found;
          if (!activeExporter) meshes.forEach(m => {
            m.mesh.scale.setScalar(m===found?1.5:1.0); m.mesh.material.emissiveIntensity = m===found?1.0:0.45;
          });
        }
      } else {
        canvas.style.cursor = "default";
        if (hoveredMesh) { hoveredMesh = null; if (!activeExporter) meshes.forEach(m => { m.mesh.scale.setScalar(1); m.mesh.material.emissiveIntensity=0.45; }); }
      }
    }
    function onClick(e) {
      const found = getHit(e);
      if (found) {
        if (found.entry.role === "exporter") {
          if (activeExporter?.country === found.entry.country) { clearFlower(); setSelectedEntry(null); }
          else { spawnFlower(found); setSelectedEntry(found.entry); }
        } else {
          clearFlower(); setSelectedEntry(prev => prev?.country===found.entry.country ? null : found.entry);
        }
      } else { clearFlower(); setSelectedEntry(null); }
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      canvas.style.cursor = "default";
      cancelAnimationFrame(flowerRaf);
      flowerLines.forEach(({ line }) => { scene.remove(line); line.geometry.dispose(); line.material.dispose(); });
      meshes.forEach(({mesh}) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
      spheresRef.current = [];
    };
  }, [phase, tradeData]);

  // ── Animation sequence ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "ready" || !globeRef.current || !geoRef.current) return;

    const world    = globeRef.current;
    const features = geoRef.current;
    const seq      = { stop:false, raf:null, tid:null };
    seqRef.current = seq;

    const ROLE = {
      exporter: { cap:"rgba(0,255,120,0.28)", label:"#00c45a" },
      importer: { cap:"rgba(0,160,255,0.28)", label:"#0088cc" },
    };
    const ARC_MS=2600, PAUSE_MS=4000, MAX_PTS=200;

    const setCam = (lat,lng,alt) => world.pointOfView({lat,lng,altitude:alt},0);

    function lerpCam(fromLL, toLL, a0, a1, ms) {
      return new Promise(res => {
        const t0 = performance.now();
        function tick(now) {
          if (seq.stop) return res();
          const raw = Math.min((now-t0)/ms, 1), t = eio(raw);
          const [lng,lat] = slerp(fromLL, toLL, t);
          setCam(lat, lng, a0+(a1-a0)*t);
          if (raw < 1) seq.raf = requestAnimationFrame(tick); else res();
        }
        seq.raf = requestAnimationFrame(tick);
      });
    }

    function highlight(name, role) {
      features.forEach(f => {
        const n = f.properties.ADMIN || f.properties.NAME || "";
        f.__cap = n.toLowerCase()===name.toLowerCase() ? ROLE[role]?.cap : "rgba(255,255,255,0.03)";
      });
      world.polygonsData([...features]);
    }

    // Custom sprite labels
    const labelSprites = [];
    function addLabel(lat, lng, text, color) {
      const cvs = document.createElement("canvas"); const ctx = cvs.getContext("2d");
      const font = "bold 28px 'Courier New',monospace"; ctx.font = font;
      const tw = ctx.measureText(text).width; cvs.width = Math.ceil(tw)+32; cvs.height = 52;
      ctx.font = font; ctx.textBaseline = "middle";
      ctx.strokeStyle="rgba(0,0,0,0.95)"; ctx.lineWidth=6; ctx.lineJoin="round"; ctx.strokeText(text,16,26);
      ctx.shadowColor=color; ctx.shadowBlur=10; ctx.fillStyle=color; ctx.fillText(text,16,26); ctx.shadowBlur=0;
      const tex = new THREE.CanvasTexture(cvs); tex.needsUpdate=true;
      const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false, depthWrite:false });
      const sprite = new THREE.Sprite(mat); sprite.frustumCulled=false; sprite.renderOrder=900;
      const aspect = cvs.width/cvs.height, h = GR*0.055;
      sprite.scale.set(h*aspect, h, 1);
      const ALT=GR*1.035, p=(lat+3)*D2R, l=lng*D2R;
      sprite.position.set(ALT*Math.cos(p)*Math.sin(l), ALT*Math.sin(p), ALT*Math.cos(p)*Math.cos(l));
      world.scene().add(sprite); labelSprites.push(sprite);
    }

    // Live arc line
    const posBuf = new Float32Array(MAX_PTS*3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(posBuf, 3));
    lineGeo.setDrawRange(0,0);
    const liveLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color:0xffee00}));
    liveLine.frustumCulled=false; liveLine.visible=false; world.scene().add(liveLine);

    const arrowMesh = new THREE.Mesh(makeArrowGeo(), new THREE.MeshBasicMaterial({color:0xffcc00,side:THREE.DoubleSide}));
    arrowMesh.frustumCulled=false; arrowMesh.visible=false; world.scene().add(arrowMesh);

    function bake(fromLL, toLL) {
      const N=80, pts=[];
      for (let i=0;i<=N;i++) { const t=i/N,[lng,lat]=slerp(fromLL,toLL,t); pts.push(toXYZ(lat,lng,arcAlt(t,0.32))); }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      world.scene().add(new THREE.Line(g, new THREE.LineBasicMaterial({color:0xff8800,opacity:0.18,transparent:true})));
    }

    function animateArc(fromE, toE) {
      return new Promise(res => {
        if (seq.stop) return res();
        const fromLL = getCentroid(fromE.country, features);
        const toLL   = getCentroid(toE.country, features);
        const N = Math.min(MAX_PTS-1, 120);
        const pts = Array.from({length:N+1}, (_,i) => {
          const t=i/N, [lng,lat]=slerp(fromLL,toLL,t), alt=arcAlt(t,0.32);
          return { lat, lng, alt, xyz:toXYZ(lat,lng,alt) };
        });
        lineGeo.setDrawRange(0,0); liveLine.visible=true; arrowMesh.visible=true;
        let t0=null;
        function frame(now) {
          if (seq.stop) return res();
          if (!t0) t0=now;
          const raw=Math.min((now-t0)/ARC_MS,1), t=eio(raw);
          const idx=Math.min(Math.floor(t*N),N);
          const tip=pts[idx], prev=pts[Math.max(idx-1,0)];
          for (let i=0;i<=idx;i++) { const {xyz}=pts[i]; posBuf[i*3]=xyz.x; posBuf[i*3+1]=xyz.y; posBuf[i*3+2]=xyz.z; }
          lineGeo.attributes.position.needsUpdate=true; lineGeo.setDrawRange(0,idx+1);
          const dir=new THREE.Vector3().subVectors(tip.xyz,prev.xyz).normalize();
          const up=tip.xyz.clone().normalize();
          const right=new THREE.Vector3().crossVectors(dir,up).normalize();
          const fwd=new THREE.Vector3().crossVectors(up,right);
          arrowMesh.position.copy(tip.xyz);
          arrowMesh.setRotationFromMatrix(new THREE.Matrix4().makeBasis(right,up,fwd));
          arrowMesh.scale.setScalar(GR*0.028);
          setCam(tip.lat,tip.lng,1.5+tip.alt*2.6);
          if (raw<1) seq.raf=requestAnimationFrame(frame); else res();
        }
        seq.raf=requestAnimationFrame(frame);
      });
    }

    const wait = ms => new Promise(res => { seq.tid=setTimeout(res,ms); });

    async function run() {
      world.controls().enabled = false;
      const first   = tradeData[0];
      const firstLL = getCentroid(first.country, features);
      const [fLng,fLat] = firstLL;

      setCurrentIndex(0); setStatus(`Flying to ${first.country}…`);
      highlight(first.country, first.role);
      await lerpCam([10,20], firstLL, 2.5, 1.75, 2200);
      if (seq.stop) return;

      addLabel(fLat, fLng, `[${first.role==="exporter"?"EXP":"IMP"}] ${first.country}`, ROLE[first.role]?.label||"#fff");
      await wait(800);
      if (seq.stop) return;

      for (let i=0; i<tradeData.length-1; i++) {
        if (seq.stop) return;
        const fromE=tradeData[i], toE=tradeData[i+1];
        const toLL=getCentroid(toE.country,features);
        const [toLng,toLat]=toLL;
        setStatus(`${fromE.country}  ──▶  ${toE.country}`); setCurrentIndex(i);
        await animateArc(fromE, toE);
        if (seq.stop) return;

        bake(getCentroid(fromE.country,features), toLL);
        liveLine.visible=false; arrowMesh.visible=false; lineGeo.setDrawRange(0,0);
        highlight(toE.country, toE.role); setCurrentIndex(i+1);
        addLabel(toLat,toLng,`[${toE.role==="exporter"?"EXP":"IMP"}] ${toE.country}`,ROLE[toE.role]?.label||"#fff");

        const arrAlt=1.5+arcAlt(1,0.32)*2.6;
        await lerpCam(toLL,toLL,arrAlt,1.75,500);
        if (seq.stop) return;

        setStatus(`${toE.country} — ${toE.material}`);
        await wait(PAUSE_MS);
        if (seq.stop) return;
      }

      setPhase("done");
      setStatus("All routes mapped — click any node to explore · reset to reload");
      world.controls().enabled = true;
    }

    run();

    return () => {
      seq.stop=true;
      if (seq.raf) cancelAnimationFrame(seq.raf);
      if (seq.tid) clearTimeout(seq.tid);
      labelSprites.forEach(s => { world.scene().remove(s); s.material.map?.dispose(); s.material.dispose(); });
      // restore controls
      if (globeRef.current) { try { globeRef.current.controls().enabled=true; } catch(_){} }
    };
  }, [phase, tradeData]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const cur = tradeData[currentIndex] ?? null;
  const rs  = cur?.role==="exporter"
    ? { text:"#00ff78", border:"rgba(0,255,120,0.4)", bg:"rgba(0,255,120,0.07)" }
    : { text:"#00b0ff", border:"rgba(0,160,255,0.4)", bg:"rgba(0,160,255,0.07)" };

  return (
    // ── wrapperRef: fills whatever the parent gives (e.g. .dashboard-map at 520px)
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 520,
        background: "#000005",
        overflow: "hidden",
      }}
    >
      {/*
        mountRef: the div globe.gl mounts its canvas into.
        position:absolute + inset:0 makes it fill wrapperRef exactly.
        NO transform. NO translate. No offset whatsoever.
      */}
      <div
        ref={mountRef}
        style={{ position:"absolute", inset:0 }}
      />

      {/* ── Header ── */}
      <div style={{
        position:"absolute",top:22,left:"50%",transform:"translateX(-50%)",
        fontFamily:"'Courier New',monospace",color:"#4a9fff",fontSize:13,
        letterSpacing:"0.22em",textTransform:"uppercase",
        textShadow:"0 0 14px #4a9fff88",userSelect:"none",whiteSpace:"nowrap",
        zIndex:10,pointerEvents:"none",
      }}>⬡ &nbsp; Global Trade Flow Visualizer &nbsp; ⬡</div>

      {/* ── Progress bar ── */}
      {tradeData.length > 1 && (
        <div style={{ position:"absolute",top:52,left:"50%",transform:"translateX(-50%)",
          width:280,height:2,background:"rgba(255,255,255,0.07)",borderRadius:2,zIndex:10,pointerEvents:"none" }}>
          <div style={{
            height:"100%",width:`${((currentIndex+1)/tradeData.length)*100}%`,
            background:"linear-gradient(90deg,#00ff78,#00b0ff)",
            borderRadius:2,transition:"width 0.5s ease",boxShadow:"0 0 10px #00b0ff88",
          }}/>
        </div>
      )}

      {/* ── Status ── */}
      <div style={{
        position:"absolute",top:63,left:"50%",transform:"translateX(-50%)",
        fontFamily:"'Courier New',monospace",fontSize:11,
        color:"rgba(120,180,255,0.5)",letterSpacing:"0.12em",whiteSpace:"nowrap",
        zIndex:10,pointerEvents:"none",
      }}>{status}</div>

      {/* ── Current stop card ── */}
      {cur && phase!=="done" && (
        <div key={currentIndex} style={{
          position:"absolute",bottom:38,left:38,zIndex:10,
          background:rs.bg,border:`1px solid ${rs.border}`,borderRadius:12,padding:"16px 22px",
          fontFamily:"'Courier New',monospace",color:"#fff",backdropFilter:"blur(10px)",
          boxShadow:`0 0 24px ${rs.border}`,minWidth:230,animation:"fadeUp 0.4s ease",
        }}>
          <div style={{color:rs.text,fontSize:17,fontWeight:"bold",marginBottom:3}}>{cur.country}</div>
          <div style={{color:"#666",fontSize:10,letterSpacing:"0.18em",marginBottom:8}}>
            {cur.role.toUpperCase()} &nbsp;·&nbsp; HS {cur.hs_code}
          </div>
          <div style={{color:"#ddd",fontSize:13}}>{cur.material}</div>
        </div>
      )}

      {/* ── Detail panel ── */}
      {selectedEntry && <DetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}

      {/* ── Free roam hint + Reset ── */}
      {phase==="done" && !selectedEntry && (
        <div style={{ position:"absolute",bottom:38,left:38,zIndex:10,display:"flex",flexDirection:"column",gap:10,alignItems:"flex-start" }}>
          <div style={{ fontFamily:"'Courier New',monospace",color:"rgba(100,170,255,0.3)",fontSize:11,letterSpacing:"0.1em" }}>
            CLICK EXPORTER → SEE TRADE LINKS
          </div>
          <button
            onClick={() => { setIsRefreshing(true); setResetKey(k=>k+1); }}
            disabled={isRefreshing}
            style={{
              fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:"0.18em",textTransform:"uppercase",
              color:isRefreshing?"rgba(100,170,255,0.3)":"#4a9fff",
              background:"rgba(0,10,40,0.7)",border:"1px solid rgba(74,159,255,0.35)",
              borderRadius:6,padding:"7px 14px",cursor:isRefreshing?"default":"pointer",
              backdropFilter:"blur(10px)",boxShadow:isRefreshing?"none":"0 0 14px rgba(74,159,255,0.2)",
              transition:"all 0.2s",display:"flex",alignItems:"center",gap:7,
            }}
            onMouseEnter={e=>{ if(!isRefreshing){ e.currentTarget.style.borderColor="rgba(74,159,255,0.7)"; e.currentTarget.style.boxShadow="0 0 20px rgba(74,159,255,0.35)"; }}}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(74,159,255,0.35)"; e.currentTarget.style.boxShadow="0 0 14px rgba(74,159,255,0.2)"; }}
          >
            <span style={{ display:"inline-block",animation:isRefreshing?"spin 0.8s linear infinite":"none" }}>⟳</span>
            {isRefreshing?"FETCHING…":"RESET & RELOAD"}
          </button>
        </div>
      )}

      {/* ── Stop counter ── */}
      <div style={{
        position:"absolute",bottom:38,right:38,zIndex:10,pointerEvents:"none",
        fontFamily:"'Courier New',monospace",color:"rgba(100,170,255,0.45)",fontSize:12,letterSpacing:"0.1em",textAlign:"right",
      }}>
        {phase==="done"?"✓  FREE ROAM":tradeData.length>0?`STOP ${Math.min(currentIndex+1,tradeData.length)} / ${tradeData.length}`:""}
      </div>

      {/* ── Legend ── */}
      <div style={{
        position:"absolute",top:86,right:28,zIndex:10,pointerEvents:"none",
        fontFamily:"'Courier New',monospace",fontSize:11,color:"#555",lineHeight:"22px",
      }}>
        <div><span style={{color:"#00ff78"}}>█</span> Exporter</div>
        <div><span style={{color:"#00aaff"}}>█</span> Importer</div>
        <div><span style={{color:"#ffee00"}}>——▶</span> Route</div>
        <div><span style={{color:"#00ff78"}}>∿∿</span> Trade links</div>
      </div>

      {/* ── "Free Roam" flash ── */}
      {phase==="done" && (
        <div style={{
          position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:10,
          fontFamily:"'Courier New',monospace",color:"rgba(0,255,120,0.8)",fontSize:14,
          letterSpacing:"0.3em",textTransform:"uppercase",textShadow:"0 0 20px #00ff78",
          pointerEvents:"none",animation:"fadeOut 1s ease 2s forwards",
        }}>Free Roam</div>
      )}

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeOut { from{opacity:1} to{opacity:0} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-50%) translateX(20px)} to{opacity:1;transform:translateY(-50%) translateX(0)} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
