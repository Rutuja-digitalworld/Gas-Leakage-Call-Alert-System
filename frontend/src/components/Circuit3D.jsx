import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html, ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  GasGuard — interactive 3D circuit (ESP32 + MQ sensor + LED)        */
/*  Drag = rotate · Scroll = zoom · Right-drag = pan · Click = inspect */
/* ------------------------------------------------------------------ */

const PARTS = {
  esp32: {
    name: "ESP32 DevKit",
    role: "Microcontroller (30-pin DevKit)",
    note: "Reads the gas level on GPIO34 (ADC), drives the alert LED on GPIO2 and sends the alert request over WiFi. Micro-USB end is on the right, antenna on the left.",
    pins: ["D34 ← MQ AO", "D2 → 220Ω → LED anode", "VIN (5V) → MQ VCC", "GND → common ground"],
  },
  mq: {
    name: "MQ gas sensor",
    role: "Gas sensor module",
    note: "Heated sensing element. Its analog output (AO) rises with gas concentration. On real hardware, bring AO down to 3.3V max with a voltage divider before the ESP32 ADC.",
    pins: ["VCC ← 5V", "GND ← ground", "DO – digital threshold (unused)", "AO → GPIO34"],
  },
  led: {
    name: "Alert LED",
    role: "Visual indicator",
    note: "Turns on and pulses when the gas level crosses the danger threshold.",
    pins: ["Anode ← GPIO2 via resistor", "Cathode → GND"],
  },
  resistor: {
    name: "220Ω resistor",
    role: "Current limiter",
    note: "Limits the current through the LED so it does not burn out. Bands: red, red, brown, gold.",
    pins: ["Leg 1 ← GPIO2", "Leg 2 → LED anode"],
  },
  breadboard: {
    name: "Breadboard",
    role: "Prototyping board",
    note: "Holds the components together without soldering.",
    pins: [],
  },
};

/* ---------------- ESP32 pin layout (30-pin DevKit) ---------------- */
/* k = 0 is the antenna end, k = 14 is the USB end                    */
const PIN_FRONT = ["EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "D13", "GND", "VIN"];
const PIN_BACK = ["D23", "D22", "TX0", "RX0", "D21", "D19", "D18", "D5", "TX2", "RX2", "D4", "D2", "D15", "GND", "3V3"];

const ESP_X = -1.3;
const pinX = (k) => -0.63 + 0.09 * k;
const espPin = (side, k) => [ESP_X + pinX(k), 0.34, side * 0.3];

const MQ = {
  vcc: [0.9, 0.31, -0.2],
  gnd: [0.9, 0.31, -0.07],
  ao: [0.9, 0.31, 0.2],
};

const WIRES = [
  { id: "vcc", from: espPin(1, 14), to: MQ.vcc, color: "#e5372f", lift: 0.5 },
  { id: "gnd", from: espPin(1, 13), to: MQ.gnd, color: "#9a5b2e", lift: 0.32 },
  { id: "ao", from: espPin(1, 3), to: MQ.ao, color: "#f2c200", lift: 0.75 },
  { id: "gpio2", from: espPin(-1, 11), to: [-0.02, 0.3, 0.5], color: "#ff8a1f", lift: 0.5 },
  { id: "r-led", from: [0.32, 0.3, 0.5], to: [0.55, 0.3, 0.5], color: "#ff8a1f", lift: 0.2 },
  { id: "led-gnd", from: [0.65, 0.3, 0.5], to: espPin(1, 13), color: "#9a5b2e", lift: 0.5 },
];

/* --------------------------- textures ----------------------------- */

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.15, "rgba(255,255,255,0.65)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.2)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* white silkscreen printed on the black PCB (1500 x 680 px = 1.5 x 0.68 units) */
function makeSilkTexture() {
  const W = 1500;
  const H = 680;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.font = "600 22px Arial, sans-serif";
  g.textBaseline = "middle";
  const px = (k) => 120 + 90 * k;

  PIN_FRONT.forEach((label, k) => {
    g.save();
    g.translate(px(k), 610);
    g.rotate(-Math.PI / 2);
    g.textAlign = "left";
    g.fillText(label, 0, 0);
    g.restore();
  });
  PIN_BACK.forEach((label, k) => {
    g.save();
    g.translate(px(k), 70);
    g.rotate(-Math.PI / 2);
    g.textAlign = "right";
    g.fillText(label, 0, 0);
    g.restore();
  });

  g.textAlign = "center";
  g.font = "600 20px Arial, sans-serif";
  g.fillText("EN", 1250, 170);
  g.fillText("BOOT", 1250, 510);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* printed top of the metal WiFi shield (520 x 440 px = 0.52 x 0.44 units) */
function makeShieldTexture() {
  const W = 520;
  const H = 440;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#dfe3e8");
  grad.addColorStop(0.5, "#b9bfc7");
  grad.addColorStop(1, "#d2d7dd");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 1;
  for (let y = 0; y < H; y += 4) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.fillStyle = "#2b3038";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "700 46px Arial, sans-serif";
  g.fillText("ESP-WROOM-32", W / 2, 120);
  g.font = "600 22px Arial, sans-serif";
  g.fillText("FCC ID: 2AC7Z-ESPWROOM32", W / 2, 175);
  g.font = "600 20px Arial, sans-serif";
  g.fillText("CE   RoHS   WiFi   Bluetooth", W / 2, 215);
  // data-matrix style block
  for (let r = 0; r < 12; r++) {
    for (let col = 0; col < 12; col++) {
      if ((r * 7 + col * 13) % 3 === 0 || r === 0 || col === 0) {
        g.fillRect(60 + col * 9, 270 + r * 9, 7, 7);
      }
    }
  }
  g.font = "600 20px Arial, sans-serif";
  g.textAlign = "left";
  g.fillText("ESPRESSIF", 200, 300);
  g.fillText("ESP32-D0WDQ6", 200, 335);
  g.fillText("4MB FLASH", 200, 370);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* PCB meander antenna (180 x 440 px = 0.18 x 0.44 units) */
function makeAntennaTexture() {
  const c = document.createElement("canvas");
  c.width = 180;
  c.height = 440;
  const g = c.getContext("2d");
  g.fillStyle = "#101214";
  g.fillRect(0, 0, 180, 440);
  g.strokeStyle = "#d4b15a";
  g.lineWidth = 7;
  g.lineJoin = "round";
  g.beginPath();
  const pts = [
    [90, 10], [30, 50], [150, 50], [150, 110], [30, 110], [30, 170],
    [150, 170], [150, 230], [30, 230], [30, 290], [150, 290], [150, 350], [30, 350],
  ];
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------------------- helpers ----------------------------- */

function Wire({ from, to, color, lift }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += lift;
    const up = (v) => v.clone().add(new THREE.Vector3(0, lift * 0.5, 0));
    const curve = new THREE.CatmullRomCurve3([a, up(a), mid, up(b), b]);
    return new THREE.TubeGeometry(curve, 64, 0.014, 8, false);
  }, [from, to, lift]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  );
}

function Part({ id, position, selected, hovered, onSelect, onHover, box, labelY = 0.6, children }) {
  const isSelected = selected === id;
  const active = isSelected || hovered === id;
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      {children}
      {isSelected && box && (
        <mesh position={[0, box[1] / 2, 0]} raycast={() => null}>
          <boxGeometry args={box} />
          <meshBasicMaterial color="#4da3ff" wireframe />
        </mesh>
      )}
      {active && (
        <Html position={[0, labelY, 0]} center style={{ pointerEvents: "none" }}>
          <div style={styles.tag}>{PARTS[id].name}</div>
        </Html>
      )}
    </group>
  );
}

/* ---------------------------- parts ------------------------------- */

const HOLE_XS = Array.from({ length: 39 }, (_, i) => -1.9 + i * 0.1);
const HOLE_ZS = [-0.65, -0.55, -0.45, -0.35, -0.25, 0.25, 0.35, 0.45, 0.55, 0.65];

function Holes() {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    let i = 0;
    for (const z of HOLE_ZS) {
      for (const x of HOLE_XS) {
        m.setPosition(x, 0.201, z);
        ref.current.setMatrixAt(i++, m);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[null, null, HOLE_XS.length * HOLE_ZS.length]}>
      <boxGeometry args={[0.04, 0.01, 0.04]} />
      <meshStandardMaterial color="#5d6673" />
    </instancedMesh>
  );
}

function Breadboard(props) {
  return (
    <Part id="breadboard" position={[0, 0, 0]} box={[4.2, 0.2, 1.5]} labelY={0.5} {...props}>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.2, 1.5]} />
        <meshStandardMaterial color="#e9e5da" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[4.2, 0.006, 0.12]} />
        <meshStandardMaterial color="#bdb8aa" />
      </mesh>
      <mesh position={[0, 0.202, -0.72]}>
        <boxGeometry args={[4.0, 0.002, 0.02]} />
        <meshBasicMaterial color="#e5372f" />
      </mesh>
      <mesh position={[0, 0.202, 0.72]}>
        <boxGeometry args={[4.0, 0.002, 0.02]} />
        <meshBasicMaterial color="#2b7de9" />
      </mesh>
      <Holes />
    </Part>
  );
}

/* small SMD components on the ESP32 PCB: [x, z, w, d, color] */
const SMD = [
  [0.0, 0.15, 0.04, 0.022, "#b08a4a"],
  [0.0, -0.15, 0.04, 0.022, "#b08a4a"],
  [0.2, -0.13, 0.03, 0.02, "#202327"],
  [0.2, 0.13, 0.03, 0.02, "#b08a4a"],
  [0.25, 0.0, 0.04, 0.022, "#b08a4a"],
  [0.42, 0.15, 0.03, 0.02, "#202327"],
  [0.42, -0.15, 0.03, 0.02, "#202327"],
  [0.08, -0.1, 0.03, 0.02, "#b08a4a"],
  [0.38, 0.06, 0.03, 0.02, "#202327"],
];

function TactButton({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.0175, 0]}>
        <boxGeometry args={[0.09, 0.035, 0.09]} />
        <meshStandardMaterial color="#17191c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.044, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.018, 20]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  );
}

function ESP32(props) {
  const silk = useMemo(() => makeSilkTexture(), []);
  const shield = useMemo(() => makeShieldTexture(), []);
  const antenna = useMemo(() => makeAntennaTexture(), []);
  const ks = useMemo(() => Array.from({ length: 15 }, (_, k) => k), []);

  return (
    <Part id="esp32" position={[ESP_X, 0.2, 0]} box={[1.5, 0.22, 0.7]} labelY={0.45} {...props}>
      {/* black plastic header housings */}
      {[-0.3, 0.3].map((z) => (
        <mesh key={z} position={[0, 0.065, z]}>
          <boxGeometry args={[1.32, 0.03, 0.05]} />
          <meshStandardMaterial color="#0a0a0b" roughness={0.7} />
        </mesh>
      ))}
      {/* pins below the board + solder points on top */}
      {ks.map((k) =>
        [-0.3, 0.3].map((z) => (
          <group key={`${k}-${z}`} position={[pinX(k), 0, z]}>
            <mesh position={[0, 0.025, 0]}>
              <boxGeometry args={[0.022, 0.05, 0.022]} />
              <meshStandardMaterial color="#d8b45a" metalness={0.9} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.134, 0]}>
              <sphereGeometry args={[0.02, 10, 8]} />
              <meshStandardMaterial color="#c9ced6" metalness={0.9} roughness={0.3} />
            </mesh>
          </group>
        ))
      )}

      {/* PCB */}
      <mesh position={[0, 0.105, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.05, 0.68]} />
        <meshStandardMaterial color="#0d0f12" roughness={0.45} metalness={0.1} />
      </mesh>
      {/* silkscreen */}
      <mesh position={[0, 0.1315, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[1.5, 0.68]} />
        <meshBasicMaterial map={silk} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* antenna area */}
      <mesh position={[-0.66, 0.14, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.44]} />
        <meshStandardMaterial color="#101214" roughness={0.5} />
      </mesh>
      <mesh position={[-0.66, 0.1505, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[0.18, 0.44]} />
        <meshStandardMaterial map={antenna} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* metal WiFi shield */}
      <mesh position={[-0.31, 0.165, 0]} castShadow>
        <boxGeometry args={[0.52, 0.07, 0.44]} />
        <meshStandardMaterial color="#b9bfc7" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[-0.31, 0.2005, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[0.52, 0.44]} />
        <meshStandardMaterial map={shield} metalness={0.8} roughness={0.38} />
      </mesh>

      {/* micro-USB port */}
      <mesh position={[0.7, 0.165, 0]} castShadow>
        <boxGeometry args={[0.2, 0.07, 0.15]} />
        <meshStandardMaterial color="#d3d8df" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[0.801, 0.165, 0]}>
        <boxGeometry args={[0.004, 0.035, 0.1]} />
        <meshStandardMaterial color="#050505" />
      </mesh>

      {/* CP2102 USB-UART chip */}
      <mesh position={[0.32, 0.141, 0]}>
        <boxGeometry args={[0.14, 0.022, 0.14]} />
        <meshStandardMaterial color="#15181c" roughness={0.5} />
      </mesh>
      <mesh position={[0.275, 0.153, -0.045]}>
        <cylinderGeometry args={[0.008, 0.008, 0.002, 10]} />
        <meshStandardMaterial color="#9aa0a8" />
      </mesh>

      {/* AMS1117 regulator */}
      <mesh position={[0.12, 0.145, 0]}>
        <boxGeometry args={[0.1, 0.03, 0.17]} />
        <meshStandardMaterial color="#15181c" roughness={0.5} />
      </mesh>
      <mesh position={[0.12, 0.162, 0]}>
        <boxGeometry args={[0.07, 0.006, 0.12]} />
        <meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* EN and BOOT buttons */}
      <TactButton position={[0.5, 0.13, -0.12]} />
      <TactButton position={[0.5, 0.13, 0.12]} />

      {/* SMD caps and resistors */}
      {SMD.map(([x, z, w, d, color], i) => (
        <mesh key={i} position={[x, 0.139, z]}>
          <boxGeometry args={[w, 0.018, d]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}

      {/* power LED (always on) */}
      <mesh position={[0.2, 0.139, -0.04]}>
        <boxGeometry args={[0.04, 0.014, 0.025]} />
        <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </Part>
  );
}

function MQSensor({ level, ...props }) {
  const capRef = useRef();
  useFrame(() => {
    if (capRef.current) capRef.current.emissiveIntensity = (level / 100) * 1.1;
  });
  return (
    <Part id="mq" position={[1.3, 0.2, 0]} box={[0.9, 0.32, 0.55]} labelY={0.5} {...props}>
      {[-0.2, -0.07, 0.07, 0.2].map((z) => (
        <mesh key={z} position={[-0.4, 0.055, z]}>
          <boxGeometry args={[0.03, 0.11, 0.03]} />
          <meshStandardMaterial color="#d8b45a" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.9, 0.04, 0.55]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.55} />
      </mesh>
      <mesh position={[0.1, 0.21, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.2, 32]} />
        <meshStandardMaterial
          ref={capRef}
          color="#c4c9d1"
          metalness={0.85}
          roughness={0.4}
          emissive="#ff6a00"
          emissiveIntensity={0}
        />
      </mesh>
      <mesh position={[0.1, 0.311, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.004, 32]} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} />
      </mesh>
      <mesh position={[-0.2, 0.135, 0.15]}>
        <boxGeometry args={[0.1, 0.05, 0.1]} />
        <meshStandardMaterial color="#2f6fed" />
      </mesh>
    </Part>
  );
}

function Resistor(props) {
  const bands = [
    ["#c0262d", -0.06],
    ["#c0262d", -0.02],
    ["#7a4a21", 0.02],
    ["#d4af37", 0.07],
  ];
  return (
    <Part id="resistor" position={[0.15, 0.2, 0.5]} box={[0.4, 0.2, 0.14]} labelY={0.35} {...props}>
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
          <meshStandardMaterial color="#b9c0c9" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.26, 16]} />
        <meshStandardMaterial color="#e3c9a0" roughness={0.7} />
      </mesh>
      {bands.map(([c, x]) => (
        <mesh key={x} position={[x, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.037, 0.037, 0.016, 16]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </Part>
  );
}

function LED({ alert, ...props }) {
  const glowTex = useMemo(() => makeGlowTexture(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#6e1a1e",
        emissive: "#ff2a1f",
        emissiveIntensity: 0.04,
        transparent: true,
        opacity: 0.96,
        roughness: 0.25,
        toneMapped: false,
      }),
    []
  );
  const lightRef = useRef();
  const haloRef = useRef();
  const coreRef = useRef();
  const poolRef = useRef();

  useFrame(({ clock }) => {
    const p = alert ? 0.8 + 0.2 * Math.sin(clock.elapsedTime * 8) : 0;
    mat.emissiveIntensity = alert ? 2.5 + 2.5 * p : 0.04;
    mat.color.set(alert ? "#ff5a4d" : "#6e1a1e");
    if (lightRef.current) lightRef.current.intensity = alert ? 6 + 10 * p : 0;
    if (haloRef.current) {
      haloRef.current.material.opacity = alert ? 0.5 + 0.4 * p : 0;
      haloRef.current.scale.setScalar(0.7 + 0.25 * p);
    }
    if (coreRef.current) {
      coreRef.current.material.opacity = alert ? 0.9 : 0;
      coreRef.current.scale.setScalar(0.26 + 0.08 * p);
    }
    if (poolRef.current) poolRef.current.material.opacity = alert ? 0.45 + 0.25 * p : 0;
  });

  return (
    <Part id="led" position={[0.6, 0.2, 0.5]} box={[0.2, 0.34, 0.16]} labelY={0.5} {...props}>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
          <meshStandardMaterial color="#b9c0c9" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 0]} castShadow material={mat}>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 24]} />
      </mesh>
      <mesh position={[0, 0.22, 0]} material={mat}>
        <sphereGeometry args={[0.07, 24, 16]} />
      </mesh>

      <pointLight ref={lightRef} position={[0, 0.3, 0]} color="#ff3b30" distance={5} decay={2} intensity={0} />

      {/* bloom-style glow */}
      <sprite ref={haloRef} position={[0, 0.22, 0]} renderOrder={10} raycast={() => null}>
        <spriteMaterial
          map={glowTex}
          color="#ff2a1f"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={coreRef} position={[0, 0.22, 0]} renderOrder={11} raycast={() => null}>
        <spriteMaterial
          map={glowTex}
          color="#ffb3a8"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {/* red light pool on the breadboard */}
      <mesh ref={poolRef} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[1.6, 1.6]} />
        <meshBasicMaterial
          map={glowTex}
          color="#ff2a1f"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Part>
  );
}

/* ---------------------------- scene ------------------------------- */

function Scene({ level, alert, showWires, selected, hovered, onSelect, onHover, controlsRef }) {
  const shared = { selected, hovered, onSelect, onHover };
  return (
    <>
      <ambientLight intensity={0.25} />
      <hemisphereLight args={["#8fb4ff", "#0b1220", 0.45]} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} color="#dfe8ff" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#6f8fff" />

      {/* soft studio reflections for the metal parts (no network needed) */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} color="#cfe0ff" />
        <Lightformer form="rect" intensity={1.2} position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1} position={[5, 1, -3]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} color="#8fb4ff" />
      </Environment>

      <Grid
        position={[0, -0.002, 0]}
        args={[10, 10]}
        cellSize={0.25}
        cellColor="#1b2a44"
        sectionSize={1}
        sectionColor="#2e4a78"
        fadeDistance={14}
        infiniteGrid
      />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.7} blur={2.5} scale={8} far={1.5} color="#000000" />

      <Breadboard {...shared} />
      <ESP32 {...shared} />
      <MQSensor level={level} {...shared} />
      <Resistor {...shared} />
      <LED alert={alert} {...shared} />
      {showWires && WIRES.map((w) => <Wire key={w.id} {...w} />)}

      {/* clicking empty space clears selection */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onClick={() => onSelect(null)}
        visible={false}
      >
        <planeGeometry args={[40, 40]} />
      </mesh>

      <OrbitControls
        ref={(c) => {
          controlsRef.current = c;
          if (c && c.saveState) c.saveState();
        }}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={9}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.2, 0]}
      />
    </>
  );
}

/* ----------------------------- UI --------------------------------- */

function CircuitViewer({ gasLevel = 0, threshold = 60, height = 520 }) {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showWires, setShowWires] = useState(true);
  const controlsRef = useRef(null);

  const level = Math.max(0, Math.min(100, gasLevel));
  const alert = level >= threshold;
  const info = selected ? PARTS[selected] : null;

  return (
    <div style={{ ...styles.wrap, height }}>
      <Canvas shadows camera={{ position: [3.2, 2.6, 3.6], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={["#070b14"]} />
        <Scene
          level={level}
          alert={alert}
          showWires={showWires}
          selected={selected}
          hovered={hovered}
          onSelect={setSelected}
          onHover={setHovered}
          controlsRef={controlsRef}
        />
        <AutoRotate controlsRef={controlsRef} enabled={autoRotate && !selected} />
      </Canvas>

      <div style={styles.vignette} />

      <div style={styles.toolbar}>
        <button style={btn(autoRotate)} onClick={() => setAutoRotate((v) => !v)}>
          {autoRotate ? "Pause rotation" : "Auto-rotate"}
        </button>
        <button style={btn(showWires)} onClick={() => setShowWires((v) => !v)}>
          {showWires ? "Hide wires" : "Show wires"}
        </button>
        <button style={btn(false)} onClick={() => controlsRef.current && controlsRef.current.reset()}>
          Reset view
        </button>
      </div>

      <div style={{ ...styles.badge, background: alert ? "#d92d20" : "#16a34a" }}>
        Gas {level.toFixed(0)}% · {alert ? "Danger" : "Safe"}
      </div>

      {info ? (
        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <div>
              <div style={styles.panelTitle}>{info.name}</div>
              <div style={styles.panelRole}>{info.role}</div>
            </div>
            <button style={styles.close} onClick={() => setSelected(null)} aria-label="Close details">
              ×
            </button>
          </div>
          <p style={styles.panelNote}>{info.note}</p>
          {info.pins.length > 0 && (
            <ul style={styles.pins}>
              {info.pins.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div style={styles.hint}>Drag to rotate, scroll to zoom, click a part to inspect it</div>
      )}
    </div>
  );
}

function AutoRotate({ controlsRef, enabled }) {
  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.autoRotate = enabled;
    c.autoRotateSpeed = 1.2;
  });
  return null;
}

/* ---------------------------- styles ------------------------------ */

const btn = (on) => ({
  font: "500 13px/1 system-ui, sans-serif",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid " + (on ? "#2b7de9" : "#2a3a58"),
  background: on ? "#2b7de9" : "rgba(15,23,41,0.9)",
  color: "#e6eefb",
  cursor: "pointer",
});

const styles = {
  wrap: {
    position: "relative",
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #1d2b47",
    background: "#070b14",
    fontFamily: "system-ui, sans-serif",
  },
  vignette: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
  },
  toolbar: { position: "absolute", top: 12, left: 12, display: "flex", gap: 8, flexWrap: "wrap" },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    color: "#fff",
    font: "600 13px/1 system-ui, sans-serif",
    padding: "8px 12px",
    borderRadius: 8,
  },
  hint: {
    position: "absolute",
    bottom: 12,
    left: 12,
    font: "13px/1.3 system-ui, sans-serif",
    color: "#9db0cc",
    background: "rgba(15,23,41,0.85)",
    border: "1px solid #1d2b47",
    padding: "6px 10px",
    borderRadius: 8,
  },
  panel: {
    position: "absolute",
    bottom: 12,
    left: 12,
    width: "min(340px, calc(100% - 24px))",
    background: "#0f1729",
    border: "1px solid #27385a",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  panelTitle: { font: "600 15px/1.2 system-ui, sans-serif", color: "#f1f5fd" },
  panelRole: { font: "13px/1.3 system-ui, sans-serif", color: "#8ea2c2", marginTop: 2 },
  panelNote: { font: "13px/1.5 system-ui, sans-serif", color: "#c5d2e8", margin: "10px 0 0" },
  pins: { font: "13px/1.6 system-ui, sans-serif", color: "#c5d2e8", margin: "8px 0 0", paddingLeft: 18 },
  close: {
    border: "none",
    background: "transparent",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    color: "#8ea2c2",
  },
  tag: {
    font: "600 12px/1 system-ui, sans-serif",
    color: "#0b1220",
    background: "#e6eefb",
    padding: "5px 8px",
    borderRadius: 6,
    whiteSpace: "nowrap",
  },
};

/* ------------------------------------------------------------------ */
/*  Exported component                                                 */
/* ------------------------------------------------------------------ */

export default function Circuit3D({ gasLevel = 0, threshold = 60 }) {
  return (
    <section id="circuit" className="section">
      <div className="circuit-card">
        <CircuitViewer gasLevel={gasLevel} threshold={threshold} />

        <div className="circuit-info">
          <div className="component-chip">ESP32</div>
          <div className="component-chip">MQ Gas Sensor</div>
          <div className="component-chip">LED / Alert</div>
          <div className="component-chip">Breadboard</div>
        </div>
      </div>
    </section>
  );
}