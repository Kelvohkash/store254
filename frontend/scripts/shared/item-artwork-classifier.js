(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.Store254ItemArtwork = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  // Architectural studio color palettes: satin backdrop, soft spotlight, deep directional material gradient, hairline rim
  const PALETTES = {
    cobalt: { bg1: "#f6f8fc", bg2: "#e8eef8", orb: "#bfdbfe", p1: "#1e40af", p2: "#3b82f6", accent: "#f59e0b", rim: "#1e3a8a", ink: "#1e293b" },
    emerald: { bg1: "#f4fbf8", bg2: "#e3f3ec", orb: "#a7f3d0", p1: "#065f46", p2: "#10b981", accent: "#d97706", rim: "#064e3b", ink: "#0f172a" },
    amber: { bg1: "#faf8f4", bg2: "#f3ecdf", orb: "#fde68a", p1: "#b45309", p2: "#f59e0b", accent: "#334155", rim: "#78350f", ink: "#1e293b" },
    rose: { bg1: "#fbf6f7", bg2: "#f3e5e9", orb: "#fecdd3", p1: "#9f1239", p2: "#e11d48", accent: "#d97706", rim: "#881337", ink: "#1e293b" },
    violet: { bg1: "#f7f6fc", bg2: "#ebe7f7", orb: "#ddd6fe", p1: "#5b21b6", p2: "#7c3aed", accent: "#0284c7", rim: "#4c1d95", ink: "#1e293b" },
    cyan: { bg1: "#f3fafb", bg2: "#e2f2f5", orb: "#a5f3fc", p1: "#155e75", p2: "#0891b2", accent: "#d97706", rim: "#164e63", ink: "#0f172a" },
    terracotta: { bg1: "#faf6f3", bg2: "#f1e7df", orb: "#fed7aa", p1: "#9a3412", p2: "#ea580c", accent: "#0f766e", rim: "#7c2d12", ink: "#1e293b" },
    forest: { bg1: "#f4f9f5", bg2: "#e3efe6", orb: "#bbf7d0", p1: "#166534", p2: "#22c55e", accent: "#ca8a04", rim: "#14532d", ink: "#0f172a" },
    indigo: { bg1: "#f5f6fb", bg2: "#e6e9f5", orb: "#c7d2fe", p1: "#312e81", p2: "#4f46e5", accent: "#d97706", rim: "#1e1b4b", ink: "#1e293b" },
    plum: { bg1: "#faf5fb", bg2: "#f0e4f4", orb: "#e9d5ff", p1: "#701a75", p2: "#a21caf", accent: "#d97706", rim: "#581c87", ink: "#1e293b" },
    teal: { bg1: "#f3faf9", bg2: "#e1f2ef", orb: "#99f6e4", p1: "#115e59", p2: "#0d9488", accent: "#d97706", rim: "#134e4a", ink: "#0f172a" },
    slate: { bg1: "#f8fafc", bg2: "#e6ebf2", orb: "#cbd5e1", p1: "#1e293b", p2: "#475569", accent: "#2563eb", rim: "#0f172a", ink: "#0f172a" },
    gold: { bg1: "#faf8f2", bg2: "#f2ebd8", orb: "#fef08a", p1: "#854d0e", p2: "#ca8a04", accent: "#334155", rim: "#713f12", ink: "#1e293b" },
    crimson: { bg1: "#fbf5f5", bg2: "#f3e4e4", orb: "#fecaca", p1: "#991b1b", p2: "#dc2626", accent: "#d97706", rim: "#7f1d1d", ink: "#1e293b" },
    sky: { bg1: "#f4f9fc", bg2: "#e3eef7", orb: "#bae6fd", p1: "#075985", p2: "#0284c7", accent: "#059669", rim: "#0c4a6e", ink: "#0f172a" },
    mint: { bg1: "#f3faf8", bg2: "#e1f1ec", orb: "#a7f3d0", p1: "#0f766e", p2: "#14b8a6", accent: "#c2410c", rim: "#115e59", ink: "#0f172a" },
  };

  // Architectural precision SVG silhouettes (58 distinct core forms, hydrated with gradients & hairlines)
  const SHAPES = {
    sneaker: `<path d="M18 76c2-14 14-24 22-30l12 8c9 6 19 8 33 10 9 1 15 6 15 14v5H18v-7z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M18 81h82a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4v-7z" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/><path d="M48 53l8-5M55 58l8-5M62 62l7-4" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><path d="M25 74c10-2 18-8 24-14l14 12c-12 4-25 5-38 2z" fill="{{p2}}" opacity="0.85"/>`,
    dress_shoe: `<path d="M17 72c3-11 11-22 18-24 6 6 14 7 20 1 10 10 24 17 44 18 5 0 8 4 8 9v6H17V72z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M17 81h90v7H73l-3-3H40v3H17v-7z" fill="{{ink}}"/><path d="M26 71c16 0 28-4 36-11" stroke="{{p2}}" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M51 54l4 5M56 57l4 5" stroke="{{accent}}" stroke-width="1.8" stroke-linecap="round"/>`,
    shirt: `<path d="M36 28l12-5c4 6 20 6 24 0l12 5 16 14-10 15-9-6v43H39V51l-9 6-10-15 16-14z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M48 23c4 8 20 8 24 0" fill="none" stroke="{{ink}}" stroke-width="2"/><path d="M50 38h20v16H50z" fill="{{p2}}" opacity="0.35"/><path d="M43 85h34" stroke="{{accent}}" stroke-width="2.5" stroke-linecap="round"/>`,
    dress: `<path d="M47 22l5 12h16l5-12 9 4-5 20 17 44c-20 6-48 6-68 0l17-44-5-20 9-4z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M44 48h32" stroke="{{accent}}" stroke-width="3" stroke-linecap="round"/><path d="M52 52l-10 38M60 52v40M68 52l10 38" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity="0.45"/>`,
    bag: `<path d="M42 42V33c0-10 36-10 36 0v9" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/><rect x="24" y="42" width="72" height="50" rx="12" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M24 56c18 9 54 9 72 0" fill="{{p2}}" opacity="0.5"/><rect x="53" y="55" width="14" height="11" rx="3" fill="{{accent}}"/>`,
    watch: `<rect x="47" y="14" width="26" height="22" rx="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/><rect x="47" y="84" width="26" height="22" rx="4" fill="{{p2}}" stroke="{{ink}}" stroke-width="2"/><circle cx="60" cy="60" r="27" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><circle cx="60" cy="60" r="21" fill="#ffffff"/><path d="M60 44v16l10 7" fill="none" stroke="{{ink}}" stroke-width="2.5" stroke-linecap="round"/><circle cx="60" cy="60" r="3" fill="{{accent}}"/>`,
    ring_gem: `<path d="M42 26h36l14 20-32 48-32-48 14-20z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M28 46h64M42 26l18 20 18-20M60 46v48" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.7"/>`,
    eyewear: `<path d="M18 52c2-7 10-9 18-9h12c5 0 8 4 8 9l-2 14c-2 9-9 13-18 13s-15-5-17-14l-1-13z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M102 52c-2-7-10-9-18-9H72c-5 0-8 4-8 9l2 14c2 9 9 13 18 13s15-5 17-14l1-13z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M54 50c4-4 8-4 12 0" fill="none" stroke="{{ink}}" stroke-width="2.5"/><path d="M26 51l12 18M76 51l12 18" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`,
    phone: `<rect x="35" y="14" width="50" height="92" rx="10" fill="{{ink}}"/><rect x="40" y="21" width="40" height="76" rx="6" fill="{{p2}}"/><path d="M40 32l40-11v34L40 72z" fill="{{p1}}" opacity="0.7"/><rect x="51" y="23" width="18" height="3.5" rx="2" fill="{{ink}}"/><rect x="47" y="68" width="26" height="14" rx="4" fill="#ffffff" opacity="0.88"/>`,
    laptop: `<rect x="24" y="24" width="72" height="48" rx="6" fill="{{ink}}"/><rect x="29" y="29" width="62" height="38" rx="3" fill="{{p1}}"/><path d="M35 55l12-13 10 9 14-15 14 13v12H35z" fill="{{p2}}" opacity="0.85"/><path d="M14 74h92l-6 14H20l-6-14z" fill="#e2e8f0" stroke="{{ink}}" stroke-width="2"/>`,
    tv: `<rect x="16" y="24" width="88" height="54" rx="6" fill="{{ink}}"/><rect x="21" y="29" width="78" height="44" rx="3" fill="{{p1}}"/><path d="M21 63c18-16 32-24 46-12s20-4 32-12v34H21z" fill="{{p2}}"/><path d="M60 78v10M40 90h40" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/>`,
    headphones: `<path d="M28 60v-6c0-18 14-32 32-32s32 14 32 32v6" fill="none" stroke="{{ink}}" stroke-width="5" stroke-linecap="round"/><rect x="18" y="54" width="16" height="32" rx="8" fill="{{p1}}"/><rect x="86" y="54" width="16" height="32" rx="8" fill="{{p1}}"/><rect x="24" y="60" width="5" height="20" rx="2.5" fill="{{accent}}"/><rect x="91" y="60" width="5" height="20" rx="2.5" fill="{{accent}}"/>`,
    turntable: `<rect x="16" y="24" width="88" height="72" rx="10" fill="{{ink}}"/><circle cx="48" cy="60" r="23" fill="{{p1}}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/><circle cx="48" cy="60" r="14" fill="none" stroke="{{p2}}" stroke-width="1.4" stroke-dasharray="5 4"/><circle cx="48" cy="60" r="6" fill="{{accent}}"/><rect x="80" y="34" width="12" height="52" rx="3" fill="rgba(255,255,255,0.16)"/><rect x="78" y="56" width="16" height="7" rx="2" fill="{{accent}}"/>`,
    mic: `<rect x="46" y="18" width="28" height="44" rx="14" fill="{{p1}}"/><path d="M48 32h24M48 40h24M48 48h24" stroke="#ffffff" stroke-width="1.5" opacity="0.45"/><path d="M36 48v10c0 13 11 24 24 24s24-11 24-24V48" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/><path d="M60 82v16M44 98h32" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>`,
    guitar: `<path d="M84 20l14 14-12 12-6-6-22 22c7 9 6 22-3 31-10 10-27 10-37 0s-10-27 0-37c9-9 22-10 31-3l22-22-6-6 19-5z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><circle cx="38" cy="79" r="8" fill="{{ink}}"/><circle cx="38" cy="79" r="4" fill="{{accent}}"/>`,
    camera: `<path d="M20 40h18l6-10h32l6 10h18a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><circle cx="60" cy="64" r="19" fill="{{ink}}" stroke="#ffffff" stroke-width="2"/><circle cx="60" cy="64" r="11" fill="{{p2}}"/><circle cx="55" cy="59" r="3.5" fill="#ffffff" opacity="0.7"/>`,
    gamepad: `<path d="M32 42h56c12 0 20 14 20 32 0 12-7 18-14 14l-14-12H40L26 88c-7 4-14-2-14-14 0-18 8-32 20-32z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M34 55v16M26 63h16" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><circle cx="80" cy="56" r="3.5" fill="{{accent}}"/><circle cx="90" cy="64" r="3.5" fill="#ffffff" opacity="0.85"/><circle cx="80" cy="72" r="3.5" fill="{{p2}}"/>`,
    drone: `<path d="M32 36l56 48M88 36L32 84" stroke="{{ink}}" stroke-width="3.2" stroke-linecap="round"/><rect x="47" y="47" width="26" height="26" rx="8" fill="{{p1}}"/><ellipse cx="30" cy="34" rx="14" ry="3.5" fill="{{p2}}"/><ellipse cx="90" cy="34" rx="14" ry="3.5" fill="{{p2}}"/><ellipse cx="30" cy="86" rx="14" ry="3.5" fill="{{p2}}"/><ellipse cx="90" cy="86" rx="14" ry="3.5" fill="{{p2}}"/><circle cx="60" cy="60" r="5" fill="{{accent}}"/>`,
    rocket: `<path d="M60 14c16 14 22 36 18 58l-18 8-18-8c-4-22 2-44 18-58z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M42 58l-14 14 12 6M78 58l14 14-12 6" fill="{{p2}}"/><circle cx="60" cy="43" r="8" fill="#ffffff"/><circle cx="60" cy="43" r="4" fill="{{accent}}"/><path d="M54 80l6 20 6-20z" fill="{{accent}}"/>`,
    telescope: `<path d="M22 46l62-22 8 20-62 18z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><ellipse cx="88" cy="34" rx="5" ry="11" transform="rotate(-20 88 34)" fill="{{accent}}"/><path d="M55 58l-18 44M55 58l18 44M55 58v44" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/>`,
    globe: `<circle cx="60" cy="60" r="36" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><ellipse cx="60" cy="60" rx="18" ry="36" fill="none" stroke="#ffffff" stroke-width="1.6" opacity="0.65"/><path d="M24 60h72M29 43h62M29 77h62" stroke="#ffffff" stroke-width="1.4" opacity="0.55"/>`,
    coffee: `<path d="M28 46h52v32c0 12-10 20-26 20s-26-8-26-20V46z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M80 52h10c7 0 11 5 11 11s-4 11-11 11H80" fill="none" stroke="{{ink}}" stroke-width="3"/><path d="M24 98h62" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/><path d="M43 34c-4-6 4-10 0-16M55 34c-4-6 4-10 0-16M67 34c-4-6 4-10 0-16" fill="none" stroke="{{p2}}" stroke-width="2.4" stroke-linecap="round"/>`,
    cloche: `<ellipse cx="60" cy="76" rx="42" ry="11" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/><path d="M22 72c2-22 18-36 38-36s36 14 38 36H22z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><circle cx="60" cy="30" r="5" fill="{{accent}}"/><path d="M36 62c6-9 14-14 24-15" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.45" stroke-linecap="round"/>`,
    cake: `<rect x="24" y="64" width="72" height="30" rx="8" fill="{{p1}}"/><rect x="36" y="42" width="48" height="24" rx="6" fill="{{p2}}"/><path d="M24 72c6 5 12 5 18 0s12 5 18 0 12 5 18 0 12 5 18 0" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/><rect x="57" y="25" width="6" height="17" rx="2" fill="#ffffff"/><path d="M60 14c4 5 5 9 0 12-5-3-4-7 0-12z" fill="{{accent}}"/>`,
    basket: `<path d="M24 58h72l-8 34H32l-8-34z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><path d="M36 58c0-18 48-18 48 0" fill="none" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/><circle cx="46" cy="50" r="10" fill="{{accent}}"/><circle cx="72" cy="48" r="11" fill="{{p2}}"/>`,
    bottle: `<path d="M49 16h22v14l11 16v48a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V46l11-16V16z" fill="{{p1}}" stroke="{{ink}}" stroke-width="2"/><rect x="46" y="12" width="28" height="7" rx="3" fill="{{ink}}"/><rect x="42" y="54" width="36" height="26" rx="4" fill="#ffffff"/><circle cx="60" cy="67" r="6" fill="{{accent}}"/>`,
    blender: `<path d="M38 30h44l-5 44H43l-5-44z" fill="{{p2}}" opacity="0.55" stroke="{{ink}}" stroke-width="2"/><rect x="36" y="22" width="48" height="8" rx="4" fill="{{ink}}"/><path d="M35 74h50l6 24H29l6-24z" fill="{{p1}}"/><circle cx="60" cy="86" r="5.5" fill="{{accent}}"/>`,
    sofa: `<path d="M24 44a10 10 0 0 1 10-10h52a10 10 0 0 1 10 10v22H24V44z" fill="{{p1}}"/><rect x="14" y="54" width="16" height="30" rx="6" fill="{{p2}}"/><rect x="90" y="54" width="16" height="30" rx="6" fill="{{p2}}"/><rect x="24" y="64" width="72" height="20" rx="4" fill="{{p1}}"/><path d="M26 84v12M94 84v12" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>`,
    bed: `<path d="M18 46a6 6 0 0 1 6-6h72a6 6 0 0 1 6 6v36H18V46z" fill="{{p1}}"/><rect x="26" y="48" width="28" height="14" rx="4" fill="#ffffff"/><rect x="66" y="48" width="28" height="14" rx="4" fill="#ffffff"/><rect x="14" y="66" width="92" height="18" rx="4" fill="{{p2}}"/><path d="M20 84v12M100 84v12" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>`,
    lamp: `<path d="M36 22h48l14 34H22L36 22z" fill="{{p1}}"/><path d="M60 56v36M40 94h40" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/><circle cx="60" cy="64" r="6" fill="{{accent}}"/>`,
    textile: `<rect x="22" y="28" width="76" height="64" rx="10" fill="{{p1}}"/><rect x="32" y="38" width="56" height="44" rx="5" fill="{{p2}}" stroke="#ffffff" stroke-width="1.5"/><path d="M42 50l18-10 18 10-18 22z" fill="{{accent}}"/>`,
    serum: `<rect x="48" y="16" width="24" height="14" rx="4" fill="{{ink}}"/><path d="M42 30h36l6 12v48a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10V42l6-12z" fill="{{p1}}"/><rect x="44" y="48" width="32" height="34" rx="5" fill="#ffffff"/><path d="M60 56c5 6 7 10 7 14a7 7 0 1 1-14 0c0-4 2-8 7-14z" fill="{{p2}}"/>`,
    cosmetic: `<rect x="38" y="54" width="44" height="44" rx="7" fill="{{ink}}"/><rect x="43" y="40" width="34" height="16" rx="3" fill="{{accent}}"/><path d="M47 40V22c4-6 22-8 26 2v16H47z" fill="{{p1}}"/>`,
    scissors: `<circle cx="34" cy="82" r="11" fill="none" stroke="{{ink}}" stroke-width="3.8"/><circle cx="86" cy="82" r="11" fill="none" stroke="{{ink}}" stroke-width="3.8"/><path d="M41 72l44-50M79 72L35 22" stroke="{{p1}}" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="50" r="4.5" fill="{{accent}}"/>`,
    spa: `<ellipse cx="60" cy="86" rx="32" ry="9" fill="{{p1}}"/><ellipse cx="60" cy="70" rx="25" ry="9" fill="{{p2}}"/><ellipse cx="60" cy="55" rx="18" ry="8" fill="#ffffff" stroke="{{ink}}" stroke-width="1.5"/><path d="M60 22c7 9 8 15 0 21-8-6-7-12 0-21z" fill="{{accent}}"/>`,
    medkit: `<rect x="20" y="34" width="80" height="62" rx="12" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/><path d="M46 34v-8a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v8" fill="none" stroke="{{ink}}" stroke-width="3"/><path d="M54 48h12v11h11v12H66v11H54V71H43V59h11V48z" fill="{{p1}}"/>`,
    stethoscope: `<path d="M36 24v26a24 24 0 0 0 48 0V24" fill="none" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/><path d="M60 74v12a10 10 0 0 0 20 0V68" fill="none" stroke="{{p1}}" stroke-width="3.5" stroke-linecap="round"/><circle cx="80" cy="64" r="9" fill="{{p1}}" stroke="#ffffff" stroke-width="2"/><circle cx="80" cy="64" r="4" fill="{{accent}}"/>`,
    dumbbell: `<rect x="30" y="54" width="60" height="12" rx="4" fill="{{ink}}"/><rect x="14" y="36" width="12" height="48" rx="4" fill="{{p1}}"/><rect x="26" y="42" width="10" height="36" rx="3" fill="{{p2}}"/><rect x="84" y="42" width="10" height="36" rx="3" fill="{{p2}}"/><rect x="94" y="36" width="12" height="48" rx="4" fill="{{p1}}"/>`,
    bicycle: `<circle cx="32" cy="76" r="17" fill="none" stroke="{{ink}}" stroke-width="3.8"/><circle cx="88" cy="76" r="17" fill="none" stroke="{{ink}}" stroke-width="3.8"/><path d="M32 76l20-32h26l10 32M52 44l8 32h28M44 36h16M74 36h12" fill="none" stroke="{{p1}}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    car: `<path d="M22 60l10-20h56l10 20v20H22V60z" fill="{{p1}}"/><path d="M35 44h50l6 14H29l6-14z" fill="{{p2}}"/><circle cx="36" cy="80" r="10" fill="{{ink}}" stroke="#ffffff" stroke-width="2"/><circle cx="84" cy="80" r="10" fill="{{ink}}" stroke="#ffffff" stroke-width="2"/><rect x="26" y="64" width="11" height="5" rx="2" fill="{{accent}}"/><rect x="83" y="64" width="11" height="5" rx="2" fill="{{accent}}"/>`,
    helmet: `<path d="M30 62c0-22 15-36 34-36 18 0 32 14 32 34v12c0 10-8 16-20 16H44l-14-26z" fill="{{p1}}"/><path d="M62 38h28c4 8 4 18 0 24H60c-6-6-6-18 2-24z" fill="{{ink}}"/><circle cx="46" cy="68" r="5" fill="{{accent}}"/>`,
    pipe: `<path d="M22 46h24v-14h16v14h32v18H62v10H46V64H22V46z" fill="{{p1}}"/><path d="M40 22h28M54 22v10" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/><path d="M84 74c6 7 8 11 8 15a8 8 0 1 1-16 0c0-4 2-8 8-15z" fill="{{p2}}"/>`,
    bolt: `<circle cx="60" cy="60" r="36" fill="{{p1}}"/><path d="M64 28L40 64h18l-6 28 28-38H62l2-26z" fill="{{accent}}"/>`,
    solar: `<circle cx="88" cy="28" r="11" fill="{{accent}}"/><path d="M22 46l56-10 18 44-56 10-18-44z" fill="{{p1}}"/><path d="M36 44l18 43M52 41l18 43M68 38l18 43M29 62l56-10M35 76l56-10" stroke="#ffffff" stroke-width="1.4" opacity="0.55"/><path d="M58 88v14M40 102h36" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/>`,
    tools: `<path d="M32 30h38l12 10-12 10H54v48H42V50H32V30z" fill="{{p1}}"/><rect x="40" y="56" width="16" height="42" rx="4" fill="{{p2}}"/><path d="M70 58l24 24-8 8-24-24z" fill="{{accent}}"/>`,
    paint: `<path d="M26 30h58v22H26V30z" fill="{{p1}}" rx="6"/><path d="M84 41h10v18L60 66v12" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="52" y="76" width="16" height="28" rx="5" fill="{{accent}}"/>`,
    flame: `<path d="M60 16c12 16 26 26 26 48a26 26 0 1 1-52 0c0-13 6-24 14-32 2 8 6 12 10 12 4-9 2-18 2-28z" fill="{{p1}}"/><path d="M60 48c7 8 13 14 13 24a13 13 0 1 1-26 0c0-9 6-16 13-24z" fill="{{accent}}"/><path d="M24 98h72" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>`,
    clean: `<path d="M44 36h26l8 16v42a8 8 0 0 1-8 8H44a8 8 0 0 1-8-8V52l8-16z" fill="{{p1}}"/><path d="M44 36V22h32l8 8H62v6" fill="{{ink}}"/><rect x="44" y="58" width="26" height="24" rx="4" fill="#ffffff"/>`,
    cctv: `<path d="M22 44l56-16 14 28-56 16-14-28z" fill="{{p1}}"/><ellipse cx="86" cy="42" rx="6" ry="12" transform="rotate(-24 86 42)" fill="{{ink}}"/><circle cx="85" cy="42" r="3.5" fill="{{accent}}"/><path d="M42 66v24H22" fill="none" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/>`,
    lock_shield: `<path d="M60 16l34 12v28c0 24-14 40-34 48-20-8-34-24-34-48V28l34-12z" fill="{{p1}}"/><rect x="48" y="54" width="24" height="19" rx="4" fill="#ffffff"/><path d="M53 54v-6a7 7 0 0 1 14 0v6" fill="none" stroke="#ffffff" stroke-width="2.5"/>`,
    house: `<path d="M16 56L60 20l44 36v42H16V56z" fill="{{p1}}"/><path d="M12 58L60 18l48 40" fill="none" stroke="{{ink}}" stroke-width="4" stroke-linecap="round"/><rect x="48" y="64" width="24" height="34" rx="3" fill="{{accent}}"/><rect x="26" y="62" width="13" height="13" rx="2" fill="#ffffff"/><rect x="81" y="62" width="13" height="13" rx="2" fill="#ffffff"/>`,
    tent: `<path d="M60 22l42 72H18L60 22z" fill="{{p1}}"/><path d="M60 50l16 44H44l16-44z" fill="{{ink}}"/><circle cx="90" cy="30" r="8" fill="{{accent}}"/>`,
    plant: `<path d="M34 68h52l-7 30H41l-7-30z" fill="{{p1}}"/><rect x="29" y="60" width="62" height="10" rx="4" fill="{{accent}}"/><path d="M60 60V34" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/><path d="M60 44c-18 0-26-10-24-22 14 0 24 8 24 22z" fill="{{p2}}"/><path d="M60 36c16-4 24-14 22-24-14 2-22 10-22 24z" fill="{{p2}}"/>`,
    barn: `<path d="M20 96V54l40-30 40 30v42H20z" fill="{{p1}}"/><rect x="42" y="60" width="36" height="36" fill="{{accent}}"/><path d="M42 60l36 36M78 60L42 96" stroke="#ffffff" stroke-width="1.6" opacity="0.6"/><rect x="52" y="38" width="16" height="13" rx="2" fill="#ffffff"/>`,
    honey: `<path d="M36 40h48l6 14v32a12 12 0 0 1-12 12H42a12 12 0 0 1-12-12V54l6-14z" fill="{{p1}}"/><rect x="38" y="24" width="44" height="12" rx="5" fill="{{ink}}"/><path d="M60 54l12 7v14l-12 7-12-7V61l12-7z" fill="{{accent}}"/>`,
    fish: `<path d="M28 60c14-20 42-22 60-6l16-12v36L88 66c-18 16-46 14-60-6z" fill="{{p1}}"/><circle cx="44" cy="56" r="3.5" fill="#ffffff"/><path d="M58 46c-4 10-4 18 0 28" fill="none" stroke="{{accent}}" stroke-width="2.5" stroke-linecap="round"/>`,
    paw: `<ellipse cx="60" cy="74" rx="22" ry="18" fill="{{p1}}"/><circle cx="32" cy="46" r="8.5" fill="{{p2}}"/><circle cx="50" cy="34" r="8.5" fill="{{p2}}"/><circle cx="70" cy="34" r="8.5" fill="{{p2}}"/><circle cx="88" cy="46" r="8.5" fill="{{p2}}"/><circle cx="60" cy="75" r="7" fill="{{accent}}"/>`,
    teddy: `<circle cx="60" cy="54" r="22" fill="{{p1}}"/><circle cx="38" cy="34" r="10" fill="{{p2}}"/><circle cx="82" cy="34" r="10" fill="{{p2}}"/><ellipse cx="60" cy="60" rx="11" ry="8" fill="#ffffff"/><path d="M40 80c12 10 28 10 40 0l6 14H34l6-14z" fill="{{accent}}"/>`,
    book: `<path d="M18 32c14-6 30-4 42 6 12-10 28-12 42-6v56c-14-6-30-4-42 6-12-10-28-12-42-6V32z" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/><path d="M60 38v56" stroke="{{ink}}" stroke-width="2"/><path d="M28 45h22M28 55h22M28 65h18" stroke="{{p1}}" stroke-width="2.5" stroke-linecap="round"/><path d="M70 45h22M70 55h22M70 65h18" stroke="{{p2}}" stroke-width="2.5" stroke-linecap="round"/><path d="M84 20v22l-5-4-5 4V20z" fill="{{accent}}"/>`,
    printer: `<rect x="30" y="18" width="60" height="24" rx="4" fill="#ffffff" stroke="{{ink}}" stroke-width="1.8"/><rect x="16" y="38" width="88" height="36" rx="8" fill="{{p1}}"/><rect x="30" y="62" width="60" height="38" rx="4" fill="#ffffff" stroke="{{ink}}" stroke-width="1.8"/><path d="M40 74h40M40 84h26" stroke="{{p2}}" stroke-width="3" stroke-linecap="round"/>`,
    code_terminal: `<rect x="16" y="22" width="88" height="72" rx="10" fill="{{ink}}"/><rect x="21" y="36" width="78" height="53" rx="6" fill="{{p1}}"/><path d="M46 53l-11 9 11 9M74 53l11 9-11 9M63 50l-6 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    robot: `<path d="M60 14v12" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="14" r="4" fill="{{accent}}"/><rect x="26" y="26" width="68" height="54" rx="14" fill="{{p1}}"/><circle cx="45" cy="49" r="6" fill="#ffffff"/><circle cx="75" cy="49" r="6" fill="#ffffff"/><rect x="42" y="65" width="36" height="7" rx="3.5" fill="{{ink}}"/><path d="M42 80l-6 18h48l-6-18" fill="{{p2}}"/>`,
    flask: `<path d="M46 20h28v8h-5v18l21 38a8 8 0 0 1-7 12H37a8 8 0 0 1-7-12l21-38V28h-5v-8z" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/><path d="M35 68h50l7 16a6 6 0 0 1-5 9H33a6 6 0 0 1-5-9l7-16z" fill="{{p1}}"/><circle cx="52" cy="77" r="4" fill="{{accent}}"/>`,
    orb_mystic: `<circle cx="60" cy="52" r="30" fill="{{p1}}"/><circle cx="60" cy="52" r="21" fill="{{p2}}" opacity="0.5"/><path d="M34 86h52l-6 12H40l-6-12z" fill="{{ink}}"/><path d="M60 36l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="{{accent}}"/>`,
    party: `<path d="M26 94L42 40l36 36-52 18z" fill="{{p1}}"/><path d="M36 62l24 24M43 44l30 30" stroke="{{accent}}" stroke-width="3" stroke-linecap="round"/><circle cx="72" cy="30" r="6" fill="{{accent}}"/><circle cx="92" cy="46" r="4.5" fill="{{p2}}"/>`,
    gift: `<rect x="24" y="48" width="72" height="50" rx="8" fill="{{p1}}"/><rect x="20" y="36" width="80" height="16" rx="5" fill="{{p2}}"/><rect x="53" y="36" width="14" height="62" fill="{{accent}}"/><path d="M60 36c-14-2-22-14-14-19 7-4 14 7 14 19zm0 0c14-2 22-14 14-19-7-4-14 7-14 19z" fill="{{accent}}"/>`,
    truck: `<path d="M16 38h52v42H16V38z" fill="{{p1}}"/><path d="M68 48h20l14 16v16H68V48z" fill="{{p2}}"/><circle cx="35" cy="84" r="8.5" fill="{{ink}}" stroke="#ffffff" stroke-width="2"/><circle cx="84" cy="84" r="8.5" fill="{{ink}}" stroke="#ffffff" stroke-width="2"/><rect x="74" y="54" width="14" height="10" rx="2" fill="#ffffff"/>`,
    briefcase: `<path d="M46 33v-7a5 5 0 0 1 5-5h18a5 5 0 0 1 5 5v7" fill="none" stroke="{{ink}}" stroke-width="2.4" stroke-linecap="round"/><rect x="18" y="33" width="84" height="60" rx="10" fill="{{p1}}" stroke="rgba(255,255,255,0.28)" stroke-width="1.2"/><path d="M18 43a10 10 0 0 1 10-10h64a10 10 0 0 1 10 10v14c-26 9-58 9-84 0V43z" fill="{{p2}}" opacity="0.52"/><path d="M20 57c25 8 55 8 80 0" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/><rect x="51" y="52" width="18" height="12" rx="3" fill="{{accent}}" stroke="rgba(255,255,255,0.65)" stroke-width="1"/><rect x="57" y="56" width="6" height="4" rx="1" fill="#ffffff" opacity="0.85"/>`,
    scales: `<path d="M60 20v72M36 92h48M28 36h64" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/><path d="M28 36l-10 26h20L28 36zM92 36l-10 26h20L92 36z" fill="none" stroke="{{p1}}" stroke-width="2"/><path d="M16 62a12 12 0 0 0 24 0H16zM80 62a12 12 0 0 0 24 0H80z" fill="{{p1}}"/>`,
    vase: `<path d="M44 26h32l-4 14c12 10 14 26 6 42l-4 14H46l-4-14c-8-16-6-32 6-42l-4-14z" fill="{{p1}}"/><path d="M38 56h44M36 68h48" stroke="{{accent}}" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="60" cy="26" rx="16" ry="5" fill="{{p2}}"/>`,
    trophy: `<path d="M36 24h48v22c0 14-10 26-24 26s-24-12-24-26V24z" fill="{{p1}}"/><path d="M36 30H22c0 14 6 20 14 20M84 30h14c0 14-6 20-14 20" fill="none" stroke="{{ink}}" stroke-width="2.5" stroke-linecap="round"/><path d="M60 72v14M42 86h36l4 10H38l4-10z" fill="{{accent}}"/>`,
    umbrella: `<path d="M18 58c4-24 22-36 42-36s38 12 42 36c-10-6-18-6-28 0-10-6-18-6-28 0-10-6-18-6-28 0z" fill="{{p1}}"/><path d="M60 22v62c0 8-12 8-12 0" fill="none" stroke="{{ink}}" stroke-width="3" stroke-linecap="round"/>`,
    mushroom: `<path d="M22 58c4-22 20-34 38-34s34 12 38 34c-24 6-52 6-76 0z" fill="{{p1}}"/><path d="M48 62v26c0 6 24 6 24 0V62" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/><circle cx="64" cy="36" r="5" fill="{{accent}}"/>`,
    calendar_ok: `<rect x="20" y="28" width="80" height="68" rx="12" fill="#ffffff" stroke="{{ink}}" stroke-width="2"/><path d="M20 40a12 12 0 0 1 12-12h56a12 12 0 0 1 12 12v10H20V40z" fill="{{p1}}"/><path d="M40 20v14M80 20v14" stroke="{{ink}}" stroke-width="3.5" stroke-linecap="round"/><path d="M46 70l10 10 20-20" fill="none" stroke="{{p1}}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    cube_prism: `<path d="M60 18l36 20v44L60 102 24 82V38l36-20z" fill="{{p1}}"/><path d="M60 18l36 20-36 20-36-20 36-20z" fill="{{p2}}"/><path d="M60 58v44" stroke="#ffffff" stroke-width="1.5" opacity="0.45"/>`,
  };

  // Optional corner micro-badge stamps to visually distinguish sub-specialties cleanly
  const BADGES = {
    none: "",
    bolt: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M97 86l-7 9h5l-1 7 7-9h-5l1-7z" fill="{{accent}}"/>`,
    drop: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M96 86c3 4 5 7 5 9.5a5 5 0 1 1-10 0c0-2.5 2-5.5 5-9.5z" fill="{{p2}}"/>`,
    leaf: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M91 99c0-7 5-12 11-12 0 6-5 12-11 12z" fill="{{p2}}"/>`,
    shield: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M96 86l7 2.5v5.5c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5v-5.5L96 86z" fill="{{p1}}"/>`,
    clock: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><circle cx="96" cy="94" r="7" fill="none" stroke="{{p1}}" stroke-width="1.6"/><path d="M96 90v4l3 2" fill="none" stroke="{{accent}}" stroke-width="1.6" stroke-linecap="round"/>`,
    star: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M96 86l2.2 4.8 5.2.6-3.8 3.6 1 5.2-4.6-2.5-4.6 2.5 1-5.2-3.8-3.6 5.2-.6z" fill="{{accent}}"/>`,
    check: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M90 94l4 4 8-8" fill="none" stroke="{{p1}}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    flame: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M96 86c3 3 5 6 5 9a5 5 0 1 1-10 0c0-3 2-6 5-9z" fill="{{accent}}"/>`,
    wave: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M89 94c2-3 4-3 7 0s5 3 7 0" fill="none" stroke="{{p2}}" stroke-width="2" stroke-linecap="round"/>`,
    plus: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><path d="M96 88v12M90 94h12" stroke="{{p1}}" stroke-width="2.4" stroke-linecap="round"/>`,
    tag: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><rect x="91" y="89" width="10" height="10" rx="2" fill="{{accent}}"/>`,
    gear: `<circle cx="96" cy="94" r="13" fill="#ffffff" stroke="{{ink}}" stroke-opacity="0.16" stroke-width="1"/><circle cx="96" cy="94" r="5" fill="none" stroke="{{p1}}" stroke-width="2.5" stroke-dasharray="2.5 2"/>`,
  };

  // Core primary archetypes (legacy & headline IDs preserved 100%)
  // Tuple: [id, label, palette, shapeKey, badgeKey, phrases, keywords]
  const CORE_ROWS = [
    ["sneaker", "Sneakers & Athletic Footwear", "cobalt", "sneaker", "none", ["running shoe", "sports shoe", "trail runner", "air force", "air max", "basketball shoe"], ["sneaker", "sneakers", "trainer", "trainers", "kicks", "shoe", "shoes", "footwear", "viatu", "kiatu", "jordan", "adidas", "nike", "puma", "reebok", "vans", "converse", "new balance", "running", "jogging", "canvas", "boot", "boots", "timberland", "cleats"]],
    ["dress_shoe", "Formal Leather & Clarks Shoes", "terracotta", "dress_shoe", "none", ["official shoe", "leather shoe", "dress shoe", "oxford shoe", "formal wear"], ["clarks", "clark", "santoni", "loafers", "loafer", "oxford", "oxfords", "brogue", "derby", "moccasin", "heels", "stiletto", "pumps", "sandals", "sandal", "slippers", "crocs", "official"]],
    ["shirt_apparel", "Clothing, Apparel & Shirts", "indigo", "shirt", "none", ["t shirt", "polo shirt", "mens wear", "ladies wear", "street wear", "thrift clothes"], ["shirt", "tshirt", "tee", "hoodie", "jacket", "coat", "sweater", "trouser", "jeans", "denim", "shorts", "suit", "blazer", "nguo", "mtumba", "apparel", "fashion", "wear", "uniform", "jersey", "vest", "tracksuit"]],
    ["dress_fashion", "Dresses, Gowns & Tailoring", "rose", "dress", "none", ["evening gown", "wedding dress", "kitenge dress", "fashion design", "custom tailoring"], ["dress", "gown", "skirt", "blouse", "abaya", "kitenge", "ankara", "bridal", "lingerie", "silk", "tailor", "bespoke", "boutique", "saree", "jumpsuit", "kimono", "cape", "costume"]],
    ["handbag", "Bags, Backpacks & Luggage", "plum", "bag", "none", ["travel bag", "laptop bag", "school bag", "leather bag", "crossbody bag"], ["bag", "handbag", "tote", "purse", "wallet", "clutch", "backpack", "rucksack", "suitcase", "luggage", "briefcase", "duffel", "pouch", "satchel", "mkoba"]],
    ["watch_luxury", "Watches, Jewelry & Luxury", "gold", "watch", "none", ["smart watch", "wrist watch", "gold ring", "wedding ring", "diamond jewelry"], ["watch", "watches", "rolex", "casio", "timepiece", "jewelry", "jewellery", "ring", "necklace", "earring", "bracelet", "bangle", "gold", "silver", "diamond", "emerald", "crown", "tiara", "pearl", "pendant", "gem"]],
    ["sunglasses", "Eyewear, Glasses & Optics", "cyan", "eyewear", "none", ["sun glasses", "reading glasses", "blue light", "contact lens"], ["glasses", "sunglasses", "shades", "eyewear", "spectacles", "frames", "optician", "goggles", "visor", "monocle", "kaleidoscope"]],
    ["smartphone", "Phones, Tablets & Accessories", "sky", "phone", "none", ["mobile phone", "screen protector", "phone case", "power bank", "fast charger", "phone repair"], ["phone", "smartphone", "iphone", "samsung", "tecno", "infinix", "xiaomi", "oppo", "pixel", "ipad", "tablet", "simu", "charger", "powerbank", "cable", "case", "screen", "mobile"]],
    ["laptop_pc", "Laptops, Computers & IT", "slate", "laptop", "none", ["laptop repair", "gaming pc", "macbook pro", "it support", "office computer"], ["laptop", "macbook", "computer", "pc", "desktop", "keyboard", "mouse", "ssd", "ram", "motherboard", "cpu", "gpu", "router", "wifi", "server", "printer", "it", "hardware", "workstation"]],
    ["tv_display", "TVs, Projectors & Displays", "indigo", "tv", "none", ["smart tv", "oled tv", "tv mount", "home theater", "led monitor"], ["tv", "television", "oled", "qled", "hisense", "tcl", "sony", "lg", "screen", "monitor", "projector", "display", "antenna", "decoder"]],
    ["headphones_audio", "Headphones, Woofers & Audio", "violet", "headphones", "none", ["sound system", "bluetooth speaker", "ear buds", "sub woofer", "wireless headphones"], ["headphone", "headphones", "headset", "earbud", "earbuds", "airpod", "airpods", "speaker", "woofer", "subwoofer", "soundbar", "amplifier", "jbl", "sony", "bose", "audio", "bass", "boombox"]],
    ["music_studio", "Music Production, Beats & DJ", "cobalt", "turntable", "none", ["music production", "beat making", "audio mixing", "mastering", "recording studio", "dj service"], ["beat", "beats", "music", "mziki", "producer", "mixing", "mastering", "studio", "dj", "turntable", "vinyl", "synthesizer", "midi", "track", "song", "instrumental", "soundtrack", "jingle"]],
    ["microphone_podcast", "Microphones, Voice & Podcasting", "crimson", "mic", "none", ["voice over", "podcast recording", "live sound", "karaoke mic"], ["mic", "microphone", "podcast", "voiceover", "singing", "vocal", "radio", "broadcast", "pa", "mc", "megaphone", "intercom"]],
    ["guitar_instrument", "Musical Instruments & Gear", "terracotta", "guitar", "none", ["acoustic guitar", "electric guitar", "piano lessons", "drum set"], ["guitar", "piano", "keyboard", "drums", "violin", "saxophone", "trumpet", "ukulele", "flute", "harp", "accordion", "kazoo", "instrument", "music lesson"]],
    ["camera_photo", "Cameras, Photography & Video", "slate", "camera", "none", ["photo shoot", "wedding photography", "video coverage", "mirrorless camera", "ring light"], ["camera", "canon", "nikon", "fujifilm", "gopro", "lens", "tripod", "photography", "photographer", "videography", "videographer", "portrait", "shoot", "webcam", "gimbal", "picha"]],
    ["gaming_console", "Gaming, Consoles & VR", "indigo", "gamepad", "none", ["playstation 5", "game console", "vr headset", "gaming chair", "retro arcade"], ["game", "gaming", "ps5", "ps4", "playstation", "xbox", "nintendo", "switch", "controller", "joystick", "vr", "arcade", "esports", "chess", "dice", "boardgame", "michezo"]],
    ["drone_flight", "Drones, Aviation & RC", "cyan", "drone", "none", ["drone footage", "aerial photography", "rc plane", "hot air balloon"], ["drone", "quadcopter", "dji", "aerial", "helicopter", "plane", "flight", "paragliding", "parachute", "balloon", "kite", "aviation"]],
    ["rocket_space", "Space, Sci-Fi & Novelty", "violet", "rocket", "none", ["space suit", "sci fi", "alien prop", "star projector"], ["rocket", "space", "astronaut", "ufo", "alien", "galaxy", "planet", "moon", "meteor", "star", "lightsaber", "laser", "quantum", "cyber", "futuristic", "sci-fi"]],
    ["telescope_astro", "Telescopes & Stargazing", "indigo", "telescope", "none", ["optical telescope", "telescope lens", "star gazing", "night sky", "optical scope"], ["telescope", "astronomy", "binoculars", "stargazing", "observatory", "optics", "compass", "monocular"]],
    ["coffee_cafe", "Coffee, Tea & Cafes", "terracotta", "coffee", "none", ["coffee shop", "coffee beans", "iced coffee", "tea pot", "tumbler mug"], ["coffee", "espresso", "latte", "cappuccino", "tea", "chai", "matcha", "cafe", "mug", "cup", "thermos", "flask", "tumbler", "kahawa", "kettle"]],
    ["restaurant_food", "Meals, Dining & Catering", "crimson", "cloche", "none", ["fast food", "nyama choma", "outside catering", "food delivery", "home cooked"], ["food", "meal", "lunch", "dinner", "breakfast", "restaurant", "catering", "burger", "pizza", "chicken", "beef", "nyama", "choma", "biryani", "pilau", "shawarma", "chips", "samosa", "chakula", "snack", "chef", "spice"]],
    ["bakery_cake", "Bakery, Cakes & Confectionery", "rose", "cake", "none", ["birthday cake", "wedding cake", "fresh bread", "pastry box"], ["cake", "keki", "cupcake", "bakery", "bread", "pastry", "croissant", "cookie", "biscuit", "donut", "doughnut", "muffin", "chocolate", "candy", "sweet", "dessert", "ice cream"]],
    ["fresh_produce", "Groceries, Fruits & Produce", "forest", "basket", "none", ["fresh fruit", "organic vegetable", "mama mboga", "farm fresh"], ["fruit", "vegetable", "grocery", "groceries", "produce", "mango", "avocado", "banana", "apple", "orange", "pineapple", "tomato", "onion", "potato", "maize", "beans", "rice", "flour", "unga", "sugar", "cooking oil"]],
    ["beverage_drinks", "Beverages, Juices & Bottles", "teal", "bottle", "none", ["water dispenser", "fresh juice", "wine bottle", "craft drink"], ["drink", "juice", "smoothie", "soda", "water", "wine", "beer", "whisky", "gin", "bottle", "cocktail", "milk", "yoghurt", "kombucha", "liquor"]],
    ["kitchen_cookware", "Kitchen, Cookware & Appliances", "cyan", "blender", "none", ["air fryer", "kitchen blender", "gas cooker", "microwave oven", "pressure cooker"], ["kitchen", "blender", "mixer", "toaster", "microwave", "oven", "fridge", "freezer", "cooker", "stove", "sufuria", "pot", "pan", "kettle", "cutlery", "knife", "plate", "flask", "dispenser", "appliance"]],
    ["sofa_furniture", "Furniture & Home Living", "terracotta", "sofa", "none", ["living room", "sofa set", "office chair", "dining table", "king bed"], ["sofa", "couch", "chair", "table", "desk", "bed", "mattress", "wardrobe", "cabinet", "shelf", "furniture", "bench", "stool", "recliner", "beanbag", "decor", "interior"]],
    ["lamp_lighting", "Lighting, Lamps & Neon", "gold", "lamp", "none", ["table lamp", "chandelier light", "neon sign", "lava lamp", "led strip"], ["lamp", "light", "lighting", "bulb", "led", "chandelier", "lantern", "torch", "spotlight", "floodlight", "neon", "lava lamp"]],
    ["carpet_textile", "Bedding, Curtains & Carpets", "plum", "textile", "none", ["bed sheets", "duvet cover", "floor carpet", "window curtain"], ["carpet", "rug", "duvet", "bedsheet", "pillow", "blanket", "curtain", "curtains", "towel", "mat", "doormat", "linen", "fabric", "cloth", "textile", "cushion"]],
    ["skincare_beauty", "Skincare, Serums & Fragrance", "mint", "serum", "none", ["skin care", "vitamin c serum", "body lotion", "face cream", "perfume bottle"], ["skincare", "serum", "cream", "lotion", "moisturizer", "cleanser", "toner", "sunscreen", "soap", "perfume", "cologne", "fragrance", "deodorant", "uremb", "cosmetics", "oil", "shea", "aloe"]],
    ["makeup_glam", "Makeup, Nails & Glam", "rose", "cosmetic", "none", ["lip gloss", "nail polish", "makeup kit", "gel polish"], ["makeup", "lipstick", "mascara", "foundation", "powder", "eyeshadow", "nail", "manicure", "pedicure", "lash", "lashes", "blush", "glam"]],
    ["hair_salon", "Barber, Hair & Salon", "plum", "scissors", "none", ["hair cut", "human hair", "braid styling", "beard trim", "hair salon"], ["hair", "wig", "wigs", "braid", "braiding", "dreadlocks", "salon", "barber", "kinyozi", "nywele", "clipper", "shaver", "comb", "scissors", "dryer", "curler", "shampoo"]],
    ["spa_wellness", "Spa, Massage & Aromatherapy", "teal", "spa", "none", ["deep tissue", "massage therapy", "scented candle", "essential oil"], ["spa", "massage", "sauna", "facial", "wellness", "therapy", "candle", "incense", "aromatherapy", "meditation", "relaxation", "reflexology"]],
    ["pharmacy_med", "Pharmacy, Clinic & Health", "emerald", "medkit", "none", ["first aid", "blood pressure", "medical checkup", "vitamin supplement"], ["medicine", "pharmacy", "chemist", "dawa", "pill", "pills", "vitamin", "supplement", "protein", "clinic", "doctor", "nurse", "health", "stethoscope", "thermometer", "bandage", "first-aid", "dental", "dentist", "physio"]],
    ["fitness_gym", "Fitness, Sports & Gym", "cobalt", "dumbbell", "none", ["gym membership", "personal trainer", "yoga mat", "football boot"], ["gym", "fitness", "dumbbell", "barbell", "weight", "weights", "kettlebell", "yoga", "treadmill", "sports", "football", "soccer", "basketball", "tennis", "boxing", "gloves", "trainer", "workout", "trampoline"]],
    ["bicycle_ride", "Bicycles, Scooters & Skate", "emerald", "bicycle", "none", ["mountain bike", "electric scooter", "skate board"], ["bicycle", "bike", "ebike", "scooter", "skateboard", "rollerblade", "unicycle", "cycling", "baiskeli"]],
    ["car_auto", "Automotive, Spares & Car Care", "slate", "car", "none", ["car wash", "auto spares", "oil change", "wheel alignment", "car detailing"], ["car", "gari", "auto", "vehicle", "tyre", "tire", "wheel", "rim", "engine", "battery", "brake", "oil", "radiator", "headlight", "mechanic", "garage", "carwash", "detailing", "suv", "truck"]],
    ["motorcycle_boda", "Motorcycles, Boda & Helmets", "crimson", "helmet", "none", ["motor bike", "boda boda", "crash helmet"], ["motorcycle", "motorbike", "boda", "scooter", "helmet", "boxer", "tvs", "bajaj", "yamaha", "riding"]],
    ["plumbing_water", "Plumbing, Pipes & Water Systems", "sky", "pipe", "none", ["pipe fitting", "water pump", "borehole", "sink tap", "drain cleaning"], ["plumb", "plumber", "plumbing", "pipe", "faucet", "tap", "water", "maji", "tank", "pump", "drain", "sink", "toilet", "shower", "geyser", "valve", "filter"]],
    ["electrical_power", "Electrical, Wiring & Generators", "amber", "bolt", "none", ["circuit breaker", "house wiring", "backup power", "voltage stabilizer"], ["electric", "electrical", "electrician", "umeme", "wire", "wiring", "cable", "socket", "switch", "breaker", "ups", "generator", "voltage", "extension", "plug"]],
    ["solar_energy", "Solar Panels & Clean Energy", "cobalt", "solar", "none", ["solar panel", "solar inverter", "solar system", "solar water heater", "solar battery"], ["solar", "photovoltaic", "inverter", "panel", "renewable", "wind turbine", "green energy", "sunpower"]],
    ["construction_tools", "Hardware, Tools & Building", "terracotta", "tools", "none", ["building material", "power tool", "iron sheet", "carpentry service"], ["hardware", "tool", "tools", "hammer", "drill", "saw", "cement", "mabati", "timber", "wood", "mbao", "nail", "screw", "bolt", "tile", "brick", "carpenter", "fundi", "masonry", "roofing", "wrench", "spanner"]],
    ["painting_art", "Paint, Art & Mural Finishes", "plum", "paint", "none", ["wall paint", "interior painting", "canvas art", "art supplies"], ["paint", "painter", "rangi", "brush", "roller", "primer", "varnish", "art", "canvas", "easel", "acrylic", "drawing", "sketch", "sculpture", "mural", "portrait", "calligraphy", "gypsum"]],
    ["welding_flame", "Welding, Metalwork & Forging", "crimson", "flame", "none", ["steel gate", "metal fabrication", "window grille", "custom sword"], ["weld", "welder", "welding", "steel", "iron", "metal", "grille", "gate", "blacksmith", "forge", "anvil", "knife", "blade", "katana", "sword", "flame", "torch"]],
    ["cleaning_service", "Cleaning, Laundry & Fumigation", "cyan", "clean", "none", ["dry clean", "sofa cleaning", "carpet cleaning", "pest control", "house cleaning"], ["clean", "cleaning", "usafi", "laundry", "fumigation", "pest", "detergent", "soap", "bleach", "vacuum", "mop", "broom", "sanitizer", "wash", "housekeeping", "maid"]],
    ["security_cctv", "Security, CCTV & Smart Locks", "slate", "cctv", "none", ["cctv camera", "electric fence", "smart lock", "access control"], ["cctv", "security", "alarm", "lock", "padlock", "key", "safe", "fence", "guard", "biometric", "surveillance", "bell", "shield"]],
    ["real_estate", "Property, Rentals & Moving", "emerald", "house", "none", ["real estate", "bedsitter", "home moving", "house hunting", "air bnb"], ["house", "home", "nyumba", "apartment", "flat", "villa", "land", "plot", "rent", "lease", "airbnb", "estate", "moving", "relocation", "property"]],
    ["camping_outdoor", "Camping, Safari & Travel", "forest", "tent", "none", ["camping tent", "sleeping bag", "safari tour", "hiking gear"], ["tent", "camping", "safari", "hiking", "mountain", "backpack", "kayak", "boat", "canoe", "surfboard", "tour", "travel", "expedition", "adventure", "lantern"]],
    ["garden_plants", "Plants, Bonsai & Landscaping", "mint", "plant", "none", ["potted plant", "indoor plant", "lawn care", "bonsai tree"], ["plant", "flower", "bonsai", "cactus", "succulent", "monstera", "terrarium", "seed", "seeds", "pot", "planter", "soil", "manure", "garden", "lawn", "tree", "nursery", "landscaping", "grass", "herb"]],
    ["farm_livestock", "Agrovets, Livestock & Farming", "forest", "barn", "none", ["animal feed", "dairy meal", "egg incubator", "poultry farming"], ["farm", "agrovet", "kilimo", "chicken", "kuku", "eggs", "goat", "mbuzi", "cow", "ngombe", "sheep", "pig", "feed", "fertilizer", "tractor", "greenhouse", "drip", "incubator", "hatchery", "livestock"]],
    ["beekeeping_honey", "Honey, Apiary & Beekeeping", "gold", "honey", "none", ["raw honey", "bee hive", "bees wax"], ["honey", "asali", "bee", "beekeeping", "hive", "apiary", "honeycomb", "beeswax", "pollen", "propolis"]],
    ["aquarium_fish", "Fish, Seafood & Aquariums", "sky", "fish", "none", ["fish tank", "fresh tilapia", "aquarium filter", "scuba gear"], ["fish", "samaki", "tilapia", "salmon", "tuna", "prawns", "seafood", "aquarium", "coral", "octopus", "jellyfish", "scuba", "diving", "submarine", "shell"]],
    ["pets_veterinary", "Pets, Veterinary & Animal Care", "terracotta", "paw", "none", ["dog food", "cat litter", "vet clinic", "pet grooming", "exotic pet"], ["pet", "dog", "puppy", "cat", "kitten", "vet", "veterinary", "collar", "leash", "kibble", "reptile", "snake", "lizard", "iguana", "parrot", "rabbit", "hamster", "taxidermy"]],
    ["baby_kids", "Baby Care, Strollers & Toys", "mint", "teddy", "none", ["baby stroller", "baby carrier", "sleep consultation", "soft toy"], ["baby", "newborn", "toddler", "kids", "stroller", "crib", "diaper", "diapers", "pampers", "pacifier", "toy", "toys", "teddy", "plush", "plushie", "lego", "doll", "rubber duck", "nursery"]],
    ["books_education", "Books, Stationery & Courses", "cobalt", "book", "none", ["online course", "tuition class", "text book", "revision book"], ["book", "books", "vitabu", "novel", "bible", "journal", "diary", "notebook", "textbook", "library", "course", "class", "tuition", "tutor", "coaching", "lesson", "training", "workshop", "graduation", "ebook"]],
    ["office_stationery", "Printing, Branding & Office", "indigo", "printer", "none", ["business cards", "t-shirt printing", "banner design", "office supplies"], ["print", "printing", "printer", "flyer", "banner", "sticker", "brand", "branding", "stamp", "pen", "stationery", "envelope", "folder", "photocopy", "laminate", "paper", "card"]],
    ["digital_software", "Software, Websites & Digital", "violet", "code_terminal", "none", ["web design", "mobile app", "graphic design", "seo service", "digital download"], ["website", "software", "app", "saas", "code", "coding", "developer", "design", "logo", "template", "plugin", "domain", "hosting", "crypto", "nft", "digital", "automation", "ai"]],
    ["robot_3dprint", "Robotics, 3D Printing & Makers", "cyan", "robot", "none", ["3d print", "3d printing", "arduino kit", "laser cut"], ["robot", "robotics", "3d", "printer", "arduino", "raspberry", "sensor", "microcontroller", "cnc", "laser", "diorama", "prototype", "gadget", "hologram", "holographic"]],
    ["lab_science", "Science, Chemistry, Fossils & Minerals", "teal", "flask", "none", ["science kit", "chemistry set", "lab test", "mineral sample"], ["science", "lab", "chemistry", "microscope", "flask", "beaker", "dna", "fossil", "dinosaur", "crystal", "quartz", "mineral", "meteorite", "bone", "specimen", "research"]],
    ["magic_mystic", "Magic, Tarot, Games & Curiosities", "plum", "orb_mystic", "none", ["crystal ball", "magic trick", "board game", "tarot deck", "alchemy potion"], ["magic", "wizard", "witch", "tarot", "potion", "alchemy", "wand", "crystal", "mystic", "ghost", "illusion", "juggling", "novelty", "prank", "weird", "curiosity", "relic", "unicorn", "dragon"]],
    ["party_events", "Events, Weddings & Celebrations", "amber", "party", "none", ["event planner", "party tent", "wedding decor", "birthday party"], ["event", "events", "wedding", "harusi", "party", "balloon", "balloons", "confetti", "tents", "pa system", "birthday", "anniversary", "decor", "stage", "trophy", "award"]],
    ["gifts_hampers", "Gifts, Bouquets & Hampers", "rose", "gift", "none", ["gift box", "flower bouquet", "gift hamper", "valentine gift"], ["gift", "zawadi", "hamper", "bouquet", "flower", "roses", "surprise", "basket", "ribbon", "wrapped", "voucher"]],
    ["shipping_logistics", "Courier, Parcels & Logistics", "cobalt", "truck", "none", ["parcel delivery", "moving truck", "express courier", "freight cargo"], ["delivery", "courier", "parcel", "package", "cargo", "freight", "shipping", "dispatch", "errand", "logistics", "warehouse", "wholesale", "bulk", "box"]],
    ["legal_finance", "Consulting, Legal, Tax & Business", "indigo", "briefcase", "none", ["tax filing", "business registration", "legal advice", "kra pin"], ["consulting", "consultant", "legal", "lawyer", "advocate", "accounting", "tax", "kra", "audit", "finance", "insurance", "contract", "notary", "hr", "marketing", "strategy"]],
    ["sewing_craft", "Crafts, Yarn, Pottery & Leatherwork", "terracotta", "vase", "none", ["crochet yarn", "pottery wheel", "leather craft", "handmade craft"], ["crochet", "knit", "yarn", "wool", "sewing", "needle", "thread", "pottery", "clay", "ceramic", "vase", "leathercraft", "origami", "bead", "beads", "maasai", "craft", "macrame"]],
    ["antique_collectible", "Collectibles, Clocks & Antiques", "gold", "trophy", "none", ["vintage vinyl", "wall clock", "antique piece", "collector edition"], ["antique", "vintage", "collectible", "statue", "figurine", "clock", "coin", "stamp", "trophy", "medal", "retro", "classic", "artifact", "relic"]],
    ["umbrella_weather", "Umbrellas, Rain Gear & Shade", "sky", "umbrella", "none", ["rain coat", "garden umbrella", "shade net", "tarpaulin cover"], ["umbrella", "raincoat", "poncho", "tarpaulin", "canopy", "awning", "shade", "parasol"]],
    ["food_exotic_mushroom", "Artisanal Spices, Mushrooms & Herbs", "plum", "mushroom", "none", ["oyster mushroom", "truffle oil", "herbal tea", "exotic spice"], ["mushroom", "fungi", "truffle", "herb", "herbal", "spice", "kimchi", "fermented", "organic", "tea"]],
    ["umbrella_service_general", "Professional & Bookable Service", "indigo", "calendar_ok", "none", ["book service", "appointment booking", "custom service"], ["service", "appointment", "booking", "session", "consultation", "repair", "install", "maintenance", "support", "errand", "hire"]],
    ["product_artifact_general", "Custom & Specialty Product", "emerald", "cube_prism", "none", ["featured item", "custom product", "special edition"], ["product", "item", "merch", "artifact", "widget", "gadget", "supply", "goods", "edition"]],
  ];

  // Compact specialized catalog (+455 extra distinct domain icons across 22 verticals => 524 total)
  // Format per row: [id, label, palette, shapeKey, badgeKey, kw1, kw2, ...]
  const EXTRA_SPECIALTY_ROWS = [
    // Fashion & Footwear (24)
    ["trail_running_shoe", "Trail Running Shoes", "forest", "sneaker", "leaf", "trail running", "hiking shoe", "salomon"],
    ["football_boots", "Football Cleats & Studs", "emerald", "sneaker", "star", "football boot", "soccer cleats", "studs"],
    ["basketball_kicks", "Basketball High-Tops", "crimson", "sneaker", "flame", "basketball sneaker", "high top", "hoops"],
    ["kids_sneakers", "Kids Sneakers & Light-Ups", "sky", "sneaker", "tag", "kids shoes", "toddler sneakers", "boys shoes"],
    ["leather_chelsea_boot", "Leather Chelsea Boots", "terracotta", "dress_shoe", "star", "chelsea boot", "ankle boot", "suede boot"],
    ["stiletto_heels", "High Heels & Evening Pumps", "rose", "dress_shoe", "flame", "stiletto", "high heels", "block heels"],
    ["safari_boots", "Safari & Work Boots", "amber", "dress_shoe", "shield", "safety boot", "steel toe", "work boot"],
    ["loafers_suede", "Suede & Driving Loafers", "slate", "dress_shoe", "check", "driving loafer", "penny loafer", "moccasins"],
    ["custom_suits", "Bespoke Suits & Tuxedos", "slate", "shirt", "star", "tailored suit", "tuxedo", "groom suit"],
    ["polo_shirts", "Golf & Polo Shirts", "emerald", "shirt", "check", "polo shirt", "collared tee", "lacoste"],
    ["hoodies_streetwear", "Oversized Hoodies & Fleece", "violet", "shirt", "bolt", "oversized hoodie", "fleece pullover", "streetwear"],
    ["maasai_shuka", "Shukas, Kikoy & Cultural Wear", "crimson", "textile", "flame", "shuka", "kikoy", "kanga", "leso"],
    ["denim_jackets", "Denim Jeans & Jackets", "cobalt", "shirt", "tag", "selvedge denim", "skinny jeans", "ripped jeans"],
    ["workwear_overalls", "Industrial Overalls & PPE", "amber", "shirt", "shield", "reflector vest", "overall", "dust coat"],
    ["bridal_gowns", "Bridal Gowns & Bridesmaids", "rose", "dress", "star", "bridal gown", "wedding dress", "veil"],
    ["abaya_kaftan", "Abayas, Kaftans & Modest Wear", "plum", "dress", "moon", "abaya", "kaftan", "hijab", "jilbab"],
    ["kitenge_tailoring", "Custom Kitenge & Ankara", "terracotta", "dress", "tag", "ankara dress", "kitenge skirt", "vitenge"],
    ["gym_activewear", "Gym Leggings & Sports Bras", "mint", "shirt", "bolt", "activewear", "yoga pants", "compression"],
    ["laptop_backpacks", "Anti-Theft Laptop Backpacks", "slate", "bag", "shield", "laptop backpack", "usb backpack", "commuter bag"],
    ["travel_luggage", "Hardshell Suitcases & Trolleys", "cobalt", "bag", "clock", "suitcase", "carry on", "luggage set"],
    ["leather_wallets", "Leather Wallets & Cardholders", "terracotta", "bag", "lock", "bifold wallet", "card holder", "money clip"],
    ["diaper_bags", "Mom & Baby Diaper Backpacks", "mint", "bag", "plus", "diaper bag", "nappy bag", "changing bag"],
    ["wedding_rings", "Wedding & Engagement Rings", "gold", "ring_gem", "star", "engagement ring", "diamond ring", "solitaire"],
    ["gold_chains", "Gold Chains & Cuban Links", "gold", "ring_gem", "flame", "cuban link", "gold chain", "karat"],
    // Watches, Luxury & Optics (16)
    ["luxury_chronograph", "Mechanical Chronograph Watches", "slate", "watch", "gear", "chronograph", "automatic watch", "rolex"],
    ["fitness_tracker", "Smartwatches & Fitness Bands", "cobalt", "watch", "bolt", "apple watch", "garmin", "smart band"],
    ["dive_watches", "Waterproof Dive Watches", "sky", "watch", "drop", "dive watch", "seiko diver", "g-shock"],
    ["wall_clocks", "Minimalist Wall & Desk Clocks", "amber", "watch", "clock", "wall clock", "pendulum clock", "alarm clock"],
    ["polarized_shades", "Polarized Driving Sunglasses", "slate", "eyewear", "star", "polarized sunglasses", "aviators", "wayfarer"],
    ["blue_light_glasses", "Blue-Light Computer Glasses", "cobalt", "eyewear", "bolt", "blue light glasses", "gaming glasses", "screen glasses"],
    ["prescription_frames", "Prescription Eyeglass Frames", "teal", "eyewear", "check", "optical frames", "reading glasses", "optometry"],
    ["vr_optics", "Optical Loupes & Magnifiers", "indigo", "eyewear", "gear", "jeweler loupe", "magnifying glass", "inspectors"],
    ["pearl_jewelry", "Freshwater Pearls & Brooches", "rose", "ring_gem", "drop", "pearl necklace", "pearl earring", "brooch"],
    ["crystal_healing", "Raw Crystals & Chakra Stones", "plum", "ring_gem", "star", "amethyst", "rose quartz", "tourmaline"],
    ["custom_belt_buckles", "Leather Belts & Buckles", "terracotta", "watch", "tag", "leather belt", "buckle", "suspenders"],
    ["tie_cufflinks", "Silk Ties & Silver Cufflinks", "indigo", "shirt", "star", "necktie", "bowtie", "cufflinks"],
    ["hats_caps", "Snapbacks, Fedoras & Beanies", "slate", "helmet", "tag", "fedora", "baseball cap", "bucket hat", "beanie"],
    ["scarves_shawls", "Cashmere Scarves & Shawls", "rose", "textile", "leaf", "pashmina", "wool scarf", "shawl"],
    ["socks_hosiery", "Bamboo Socks & Hosiery", "emerald", "sneaker", "leaf", "dress socks", "compression socks", "stockings"],
    ["umbrella_compact", "Windproof Travel Umbrellas", "sky", "umbrella", "drop", "golf umbrella", "foldable umbrella", "parasol"],
    // Tech, Mobile, Computing & Repair (34)
    ["iphone_flagship", "Flagship Smartphones", "slate", "phone", "star", "iphone 16", "iphone 15", "pro max", "galaxy ultra"],
    ["budget_android", "4G/5G Android Phones", "cobalt", "phone", "bolt", "redmi", "tecno camon", "infinix hot", "oppo a"],
    ["screen_replacement", "Phone Screen & Battery Repair", "amber", "phone", "gear", "screen replacement", "cracked screen", "phone clinic"],
    ["magsafe_chargers", "Wireless Chargers & Powerbanks", "emerald", "phone", "bolt", "magsafe", "fast charger", "gan charger", "100w"],
    ["tablet_stylus", "Tablets, iPads & Stylus Pens", "indigo", "phone", "tag", "ipad air", "apple pencil", "drawing tablet"],
    ["phone_rig_case", "Rugged Phone Cases & Protectors", "slate", "phone", "shield", "tempered glass", "otterbox", "magsafe case"],
    ["ultrabook_mac", "Ultrabooks & MacBooks", "slate", "laptop", "star", "macbook air", "xps", "thinkpad", "zenbook"],
    ["gaming_laptop", "RTX Gaming Laptops & Rigs", "crimson", "laptop", "flame", "rtx 4060", "rog strix", "alienware", "legion"],
    ["nvme_storage", "SSDs, NVMe & External Drives", "cobalt", "laptop", "bolt", "nvme ssd", "hard disk", "flash drive", "nas"],
    ["wifi_mesh_router", "Starlink, 5G & Mesh Routers", "sky", "laptop", "wave", "starlink", "mikrotik", "tp-link", "mesh wifi", "5g router"],
    ["mechanical_keyboards", "Mechanical Keyboards & Mice", "violet", "laptop", "gear", "mechanical keyboard", "rgb mouse", "keycaps"],
    ["server_hosting", "Servers, Switches & Rack Gear", "slate", "code_terminal", "shield", "rack server", "ethernet switch", "ups rack"],
    ["curved_monitors", "4K & Ultrawide Monitors", "indigo", "tv", "star", "ultrawide monitor", "144hz", "4k display", "ips"],
    ["office_projectors", "4K & Classroom Projectors", "teal", "tv", "clock", "epson projector", "mini projector", "projector screen"],
    ["pos_terminals", "POS Machines, Scanners & Tills", "emerald", "printer", "tag", "etr machine", "barcode scanner", "pos terminal", "receipt printer"],
    ["laser_printers", "Laser & EcoTank Printers", "cobalt", "printer", "check", "epson ecotank", "hp laserjet", "toner cartridge"],
    ["studio_monitors", "Studio Reference Monitors", "slate", "turntable", "wave", "krk rokit", "yamaha hs", "studio monitor"],
    ["dj_controllers", "DJ Controllers & Pioneer Decks", "violet", "turntable", "bolt", "pioneer ddj", "serato", "rekordbox", "cdj"],
    ["vinyl_records", "Vinyl Records & Record Players", "amber", "turntable", "star", "lp vinyl", "audiophile", "crosley", "gramophone"],
    ["vocal_microphones", "Condenser Mics & Interfaces", "crimson", "mic", "wave", "focusrite", "scarlett", "shure sm7b", "rode"],
    ["wireless_lapels", "Wireless Lavalier & Rode Mics", "sky", "mic", "bolt", "lapel mic", "rode wireless", "dji mic"],
    ["anc_earbuds", "Noise-Cancelling Earbuds", "indigo", "headphones", "wave", "airpods pro", "galaxy buds", "sony xm5"],
    ["bluetooth_party_box", "Party Speakers & PA Sound", "crimson", "headphones", "flame", "jbl partybox", "harman kardon", "pa speaker"],
    ["mirrorless_cameras", "Mirrorless & Cinema Cameras", "slate", "camera", "star", "sony alpha", "canon eos", "fx3", "red cinema"],
    ["camera_lenses", "Prime & Telephoto Camera Lenses", "amber", "camera", "gear", "50mm lens", "70-200mm", "sigma art", "tamron"],
    ["action_cams", "GoPro, Insta360 & Action Cams", "cyan", "camera", "wave", "insta360", "gopro hero", "underwater cam"],
    ["gimbal_stabilizers", "Phone & Camera Gimbals", "teal", "camera", "check", "dji ronin", "osmo mobile", "zhiyun", "stabilizer"],
    ["led_studio_lights", "Ring Lights, Softboxes & RGB", "amber", "lamp", "star", "godox", "aputure", "softbox", "ring light"],
    ["ps5_xbox_gear", "PlayStation, Xbox & Racing Rigs", "cobalt", "gamepad", "star", "dualsense", "xbox series", "logitech g29"],
    ["vr_headsets", "VR Headsets & Mixed Reality", "violet", "gamepad", "wave", "meta quest", "oculus", "psvr2", "vr experience"],
    ["handheld_retro", "Retro Handhelds & Emulators", "emerald", "gamepad", "tag", "steam deck", "rog ally", "gameboy", "anbernic"],
    ["cinema_drones", "FPV & 4K Mapping Drones", "sky", "drone", "star", "mavic 3", "fpv drone", "agri drone", "lidar drone"],
    ["smart_home_hubs", "Smart Switches & Voice Hubs", "teal", "bolt", "wave", "alexa", "google nest", "tuya smart", "zigbee"],
    ["it_cybersecurity", "Cybersecurity & Data Recovery", "crimson", "code_terminal", "shield", "pentest", "firewall", "data recovery", "backup"],
    // Food, Drinks, Bakery & Hospitality (30)
    ["specialty_coffee", "Single-Origin Roasted Coffee", "terracotta", "coffee", "leaf", "arabica", "aa coffee", "espresso roast", "drip coffee"],
    ["espresso_machines", "Espresso & Pod Coffee Makers", "slate", "coffee", "gear", "espresso machine", "nespresso", "french press", "grinder"],
    ["herbal_teas", "Matcha, Green & Herbal Teas", "mint", "coffee", "leaf", "green tea", "chamomile", "hibiscus", "kericho gold"],
    ["boba_bubble_tea", "Boba Milk Tea & Matcha Lattes", "rose", "bottle", "star", "boba", "bubble tea", "tapioca", "iced matcha"],
    ["nyama_choma_grill", "BBQ, Nyama Choma & Grills", "crimson", "cloche", "flame", "mbuzi choma", "steakhouse", "ribs", "grill"],
    ["swahili_cuisine", "Pilau, Biryani & Swahili Meals", "amber", "cloche", "star", "coast biryani", "coconut curry", "samaki wa kupaka", "mahamri"],
    ["artisanal_pizza", "Wood-Fired Pizza & Pasta", "crimson", "cloche", "flame", "margherita", "pepperoni pizza", "lasagna", "spaghetti"],
    ["gourmet_burgers", "Smash Burgers, Wings & Fries", "terracotta", "cloche", "tag", "smash burger", "chicken wings", "loaded fries"],
    ["sushi_asian", "Sushi, Ramen & Asian Bowls", "slate", "cloche", "wave", "sushi roll", "ramen", "dim sum", "teriyaki"],
    ["vegan_plant_meals", "Vegan, Keto & Salad Bowls", "forest", "cloche", "leaf", "salad bowl", "keto meal", "vegan platter", "quinoa"],
    ["meal_prep_sub", "Weekly Office Meal Prep Plans", "emerald", "cloche", "clock", "meal plan", "office lunch", "tiffin"],
    ["custom_wedding_cakes", "Tiered Wedding & Bento Cakes", "rose", "cake", "star", "bento cake", "fondant cake", "red velvet"],
    ["sourdough_bakery", "Sourdough, Bagels & Croissants", "amber", "cake", "leaf", "sourdough", "brioche", "focaccia", "ciabatta"],
    ["cupcakes_macarons", "Cupcakes, Macarons & Cookies", "plum", "cake", "tag", "macaron", "brownies", "cinnamon roll", "chocolate chip"],
    ["ice_cream_gelato", "Artisanal Gelato & Frozen Yogurt", "sky", "cake", "drop", "gelato", "sorbet", "sundae", "frozen yogurt"],
    ["cold_pressed_juice", "Cold-Pressed Juices & Smoothies", "emerald", "bottle", "leaf", "detox juice", "mango smoothie", "cane juice"],
    ["craft_cocktails", "Wine, Spirits & Mixology", "crimson", "bottle", "star", "cabernet", "single malt", "prosecco", "mocktail"],
    ["kombucha_probiotic", "Kombucha, Kefir & Probiotics", "teal", "bottle", "wave", "kefir", "fermented drink", "ginger beer"],
    ["mineral_water", "Refill Water & Dispensers", "sky", "bottle", "drop", "20l water", "alkaline water", "water refill"],
    ["organic_fruits", "Fresh Mangoes, Berries & Avocados", "forest", "basket", "leaf", "hass avocado", "strawberries", "passion fruit"],
    ["spices_masala", "Swahili Spices, Pilau Masala & Salt", "amber", "mushroom", "flame", "cardamom", "turmeric", "cinnamon", "chili oil"],
    ["dry_cereals", "Grains, Lentils, Rice & Legumes", "gold", "basket", "check", "basmati", "kamande", "ndengu", "chia seeds", "oats"],
    ["butchery_meat", "Halal Butchery & Prime Cuts", "crimson", "cloche", "check", "beef fillet", "goat meat", "mutton", "sausages"],
    ["poultry_eggs", "Farm Fresh Eggs & Kienyeji Chicken", "amber", "barn", "star", "kienyeji eggs", "broiler", "tray of eggs"],
    ["dairy_cheese", "Artisanal Cheese, Ghee & Milk", "gold", "bottle", "star", "mozzarella", "cheddar", "ghee", "paneer", "butter"],
    ["nuts_dried_fruit", "Macadamia, Cashews & Trail Mix", "terracotta", "basket", "star", "macadamia", "almonds", "cashew", "dates"],
    ["corporate_catering", "Buffet, Events & Outside Catering", "indigo", "cloche", "check", "outside catering", "chafing dish", "corporate lunch"],
    ["air_fryers", "Air Fryers & Multicookers", "slate", "blender", "bolt", "air fryer", "instant pot", "slow cooker"],
    ["commercial_kitchen", "Commercial Ovens & Dough Mixers", "slate", "blender", "gear", "dough mixer", "deck oven", "deep fryer"],
    ["cookware_sets", "Granite Pots, Pans & Cast Iron", "terracotta", "blender", "flame", "cast iron", "nonstick pan", "dutch oven"],
    // Home, Furniture, Decor & Appliances (26)
    ["l_shaped_sofas", "Sectional Sofas & Velvet Couches", "indigo", "sofa", "star", "sectional sofa", "recliner sofa", "chesterfield"],
    ["ergonomic_chairs", "Ergonomic Office & Gaming Chairs", "slate", "sofa", "gear", "ergonomic chair", "mesh chair", "executive desk"],
    ["dining_sets", "Solid Mahogany Dining Sets", "terracotta", "sofa", "check", "mahogany dining", "6 seater", "coffee table"],
    ["orthopedic_mattress", "Orthopedic Mattresses & Beds", "cobalt", "bed", "shield", "orthopedic mattress", "pocket spring", "memory foam"],
    ["chest_wardrobes", "Wardrobes, TV Stands & Shelving", "amber", "sofa", "tag", "tv stand", "shoe rack", "bookshelf", "chest of drawers"],
    ["smart_refrigerators", "Double-Door Fridges & Freezers", "cyan", "blender", "drop", "no frost fridge", "chest freezer", "wine cooler"],
    ["front_load_washers", "Washing Machines & Dryers", "sky", "clean", "gear", "washing machine", "tumble dryer", "washer dryer"],
    ["air_conditioners", "Inverter AC & Air Purifiers", "sky", "clean", "wave", "split ac", "air purifier", "humidifier", "dehumidifier"],
    ["chandeliers", "Crystal Chandeliers & Pendants", "gold", "lamp", "star", "crystal chandelier", "pendant light", "sconce"],
    ["outdoor_solar_lights", "Garden Floodlights & Streetlights", "amber", "lamp", "bolt", "security light", "motion sensor light", "pathway light"],
    ["custom_neon_signs", "Custom LED Neon Wall Signs", "violet", "lamp", "flame", "neon sign", "led logo", "backlit sign"],
    ["blackout_curtains", "Blackout Curtains & Sheer Drapes", "plum", "textile", "moon", "blackout curtain", "velvet drape", "curtain rod"],
    ["hotel_bedding", "Egyptian Cotton Sheets & Duvets", "slate", "bed", "star", "cotton duvet", "fitted sheet", "microfiber pillow"],
    ["persian_rugs", "Tufted Carpets & Jute Rugs", "terracotta", "textile", "tag", "shaggy carpet", "turkish rug", "jute rug"],
    ["wall_mirrors", "LED Vanity & Full-Length Mirrors", "gold", "textile", "star", "vanity mirror", "arch mirror", "gold frame mirror"],
    ["smart_door_locks", "Biometric Fingerprint Door Locks", "slate", "lock_shield", "bolt", "fingerprint lock", "hotel card lock", "keypad lock"],
    ["fireproof_safes", "Digital Home & Office Safes", "slate", "lock_shield", "shield", "digital safe", "deposit box", "gun safe"],
    ["wallpaper_3d", "3D Wall Panels & Peel Wallpaper", "indigo", "paint", "tag", "wall panel", "fluted wall", "marble sticker"],
    ["interior_styling", "Interior Design & Space Planning", "teal", "sofa", "star", "interior designer", "3d render", "home staging"],
    ["carpet_deep_clean", "Steam Sofa & Mattress Cleaning", "cyan", "clean", "drop", "sofa cleaning", "mattress cleaning", "steam clean"],
    ["dry_cleaning", "Executive Dry Cleaning & Ironing", "cobalt", "shirt", "drop", "dry cleaner", "steam press", "suit press"],
    ["fumigation_pro", "Termite & Bedbug Fumigation", "emerald", "clean", "shield", "bedbug", "cockroach gel", "termite control"],
    ["trash_recycling", "Waste Bins & Garbage Collection", "forest", "clean", "leaf", "recycle bin", "skip hire", "garbage pickup"],
    ["moving_packers", "Home & Office Moving Packers", "cobalt", "truck", "check", "home movers", "office relocation", "bubble wrap"],
    ["storage_units", "Self-Storage & Warehousing", "slate", "truck", "shield", "self storage", "pallet rack", "cold room"],
    ["water_filtration", "Reverse Osmosis Water Purifiers", "sky", "pipe", "check", "ro purifier", "uv filter", "under sink"],
    // Beauty, Grooming, Salon & Healthcare (28)
    ["retinol_niacinamide", "Retinol, Niacinamide & Sunscreens", "teal", "serum", "drop", "niacinamide", "hyaluronic", "spf 50", "retinol"],
    ["luxury_perfumes", "Designer & Oud Fragrances", "gold", "serum", "star", "oud", "eau de parfum", "arabian perfume", "mist"],
    ["beard_grooming", "Beard Oils, Balms & Shavers", "slate", "scissors", "star", "beard oil", "wahl clipper", "straight razor"],
    ["human_hair_wigs", "Lace Front Wigs & Bundles", "plum", "scissors", "star", "brazilian hair", "hd lace", "closure", "ponytail"],
    ["knotless_braids", "Knotless Braids, Locs & Twists", "terracotta", "scissors", "clock", "knotless braids", "sisterlocks", "butterfly locs"],
    ["gel_nail_studio", "Acrylics, BIAB & Gel Manicure", "rose", "cosmetic", "star", "biab", "acrylic nails", "nail art", "shellac"],
    ["lash_extensions", "Eyelash Extensions & Microblading", "plum", "cosmetic", "check", "volume lashes", "brow lamination", "microblading"],
    ["deep_tissue_spa", "Swedish & Deep Tissue Massage", "teal", "spa", "drop", "swedish massage", "hot stone", "thai massage"],
    ["waxing_laser", "Laser Hair Removal & Waxing", "rose", "spa", "bolt", "brazilian wax", "laser removal", "sugaring"],
    ["scented_soy_candles", "Soy Wax Candles & Diffusers", "amber", "spa", "flame", "soy candle", "reed diffuser", "essential oil"],
    ["dental_clinic", "Dental Cleaning, Braces & Veneers", "sky", "medkit", "star", "teeth whitening", "root canal", "braces", "scaling"],
    ["optical_clinic", "Eye Exams & Contact Lenses", "cyan", "eyewear", "plus", "optometrist", "eye checkup", "acuvue"],
    ["physio_chiro", "Physiotherapy & Chiropractor", "emerald", "stethoscope", "check", "chiropractor", "back pain", "sports physio"],
    ["telemedicine", "Online Doctor & Lab Consultation", "cobalt", "stethoscope", "wave", "telehealth", "virtual doctor", "lab test"],
    ["vitamins_supps", "Multivitamins, Collagen & Whey", "forest", "medkit", "leaf", "whey protein", "creatine", "collagen", "omega 3"],
    ["maternity_care", "Maternity Pillows & Postpartum", "mint", "teddy", "plus", "breast pump", "maternity belt", "nursing wear"],
    ["orthopedic_braces", "Knee Braces & Mobility Aids", "slate", "stethoscope", "shield", "wheelchair", "knee support", "crutches"],
    ["blood_monitors", "BP Monitors, Glucometers & Oximeters", "crimson", "stethoscope", "bolt", "omron", "bp machine", "glucometer"],
    ["natural_soap_bars", "Cold-Process Turmeric & Goat Milk Soap", "amber", "serum", "leaf", "turmeric soap", "black soap", "bath bomb"],
    ["tattoo_piercing", "Tattoo Studio & Body Piercing", "slate", "paint", "flame", "tattoo artist", "nose piercing", "helix"],
    ["menstrual_care", "Organic Pads, Cups & Period Care", "rose", "medkit", "leaf", "menstrual cup", "sanitary pad", "period"],
    ["sleep_therapy", "Weighted Blankets & White Noise", "indigo", "bed", "moon", "weighted blanket", "sleep mask", "earplugs"],
    ["veterinary_clinic", "Vet Vaccinations & Pet Surgery", "emerald", "paw", "plus", "pet vaccine", "deworming", "spay"],
    ["dog_grooming", "Mobile Dog Wash & Pet Spa", "terracotta", "paw", "drop", "dog grooming", "nail trim", "flea bath"],
    ["aquarium_scaping", "Aquascaping & Exotic Corals", "sky", "fish", "leaf", "planted tank", "co2 kit", "reef coral"],
    ["herbal_apothecary", "Tinctures, Moringa & Ashwagandha", "forest", "mushroom", "leaf", "moringa", "ashwagandha", "shilajit"],
    ["first_aid_kits", "Workplace & Car First-Aid Kits", "crimson", "medkit", "shield", "trauma kit", "burn gel", "tourniquet"],
    ["dermatology_acne", "Dermatology & Chemical Peels", "cobalt", "serum", "plus", "chemical peel", "microneedling", "acne"],
    // Auto, Transport, Hardware, Solar & Industrial (34)
    ["suv_car_sales", "Car Dealership & Imports", "slate", "car", "star", "toyota prado", "subaru", "mazda cx5", "car import"],
    ["tyres_rims", "All-Terrain Tyres & Alloy Rims", "slate", "car", "gear", "michelin", "bfgoodrich", "alloy rim", "wheel balancing"],
    ["car_audio_tint", "Car Audio, Dashcams & Window Tint", "cobalt", "car", "bolt", "android screen", "dashcam", "window tint", "car tracker"],
    ["car_detailing", "Ceramic Coating & Steam Car Wash", "cyan", "car", "drop", "ceramic coating", "paint correction", "car polish"],
    ["ev_chargers", "EV Chargers & Hybrid Batteries", "emerald", "car", "bolt", "hybrid battery", "prius battery", "ev charger"],
    ["mechanic_diagnostics", "OBD Diagnostics & Engine Service", "crimson", "car", "check", "obd scan", "timing belt", "brake pads"],
    ["towing_recovery", "24/7 Flatbed Towing & Roadside", "amber", "truck", "bolt", "towing", "breakdown", "jumpstart", "flatbed"],
    ["adventure_motorbikes", "Dual-Sport & Touring Bikes", "crimson", "helmet", "flame", "ktm duke", "kawasaki", "royal enfield", "bmw gs"],
    ["riding_jackets", "Armored Riding Jackets & Gloves", "slate", "helmet", "shield", "riding jacket", "knee guard", "intercom"],
    ["electric_bicycles", "Foldable E-Bikes & Escooters", "emerald", "bicycle", "bolt", "electric bike", "xiaomi scooter", "fat tire"],
    ["skate_longboard", "Skateboards, Cruisers & Trucks", "violet", "bicycle", "star", "penny board", "longboard", "grip tape"],
    ["solar_water_pumps", "Solar Borehole & Submersible Pumps", "sky", "solar", "drop", "lorentz pump", "submersible pump", "borehole solar"],
    ["lithium_batteries", "LiFePO4 & Deep-Cycle Batteries", "emerald", "solar", "bolt", "lifepo4", "lithium battery", "gel battery", "100ah"],
    ["wind_turbines", "Micro Wind & Hybrid Power Kits", "cyan", "solar", "wave", "wind generator", "hybrid inverter", "mppt"],
    ["water_heaters_solar", "Pressurized Solar Water Heaters", "terracotta", "solar", "flame", "solar geyser", "evacuated tube", "instant shower"],
    ["backup_generators", "Silent Diesel & Petrol Generators", "amber", "bolt", "gear", "diesel generator", "5kva", "portable power"],
    ["power_drills", "Cordless Drills, Grinders & Saws", "cobalt", "tools", "bolt", "makita", "bosch", "dewalt", "angle grinder"],
    ["welding_inverters", "MIG/TIG Welders & Plasma Cutters", "crimson", "flame", "bolt", "mig welder", "welding rods", "welding mask"],
    ["aluminum_glass", "Aluminum Windows, Partitioning & Glass", "sky", "house", "check", "curtain wall", "sliding window", "shower cubicle"],
    ["cabro_paving", "Cabro Paving & Concrete Works", "slate", "tools", "check", "cabro", "interlocking block", "terrazzo"],
    ["borehole_drilling", "Hydrogeological Survey & Drilling", "sky", "pipe", "gear", "hydrogeological", "casing pipe", "water tank"],
    ["irrigation_drip", "Drip Irrigation Kits & Sprinklers", "forest", "pipe", "leaf", "drip kit", "greenhouse irrigation", "sprinkler"],
    ["cctv_hikvision", "IP Cameras, NVR & Biometrics", "slate", "cctv", "shield", "hikvision", "dahua", "nvr", "ptz camera"],
    ["electric_fencing", "Razor Wire & High-Voltage Fence", "crimson", "cctv", "bolt", "energizer", "razor wire", "perimeter fence"],
    ["fire_safety", "Fire Extinguishers & Smoke Alarms", "crimson", "lock_shield", "flame", "co2 extinguisher", "smoke detector", "fire blanket"],
    ["gate_automation", "Sliding Gate Motors & Barriers", "indigo", "cctv", "gear", "centurion motor", "remote gate", "boom barrier"],
    ["roofing_mabati", "Stone-Coated Roof Tiles & Gutters", "terracotta", "house", "shield", "decra", "versatile mabati", "rain gutter"],
    ["timber_joinery", "Kiln-Dried Timber & Custom Doors", "amber", "tools", "leaf", "mvule door", "cypress", "kitchen cabinet"],
    ["epoxy_flooring", "Metallic Epoxy & Gypsum Ceilings", "violet", "paint", "star", "3d epoxy", "gypsum design", "cornice"],
    ["plumbing_emergency", "24/7 Burst Pipe & Septic Service", "sky", "pipe", "bolt", "unclog drain", "exhauster", "septic bio"],
    ["forklifts_heavy", "Scaffolding, Forklifts & Mixers", "amber", "truck", "gear", "scaffolding", "concrete mixer", "compactor"],
    ["agritech_greenhouse", "Greenhouses, Shade Nets & Mulch", "forest", "plant", "shield", "shade net", "uv polythene", "seedling tray"],
    ["dairy_silage", "Silage, Hay Bales & Dairy Equipment", "emerald", "barn", "leaf", "chaff cutter", "milking machine", "lucerne"],
    ["poultry_incubators", "Automated Egg Incubators & Feeders", "gold", "barn", "bolt", "egg incubator", "drinker", "brooder"],
    // Sports, Outdoors, Hobbies, Music, Art & Education (34)
    ["camping_rooftop", "Rooftop Tents, Overlanding & Fridges", "forest", "tent", "car", "rooftop tent", "overland", "awning", "camping chair"],
    ["kayak_rafting", "Inflatable Kayaks, SUPs & Lifejackets", "sky", "tent", "wave", "inflatable kayak", "paddle board", "life vest"],
    ["fishing_tackle", "Fishing Rods, Reels & Tackle Boxes", "cyan", "fish", "gear", "spinning reel", "fishing lure", "tackle box"],
    ["golf_equipment", "Golf Clubs, Bags & Range Sessions", "emerald", "trophy", "leaf", "driver club", "golf balls", "putting green"],
    ["boxing_martial_arts", "Boxing Gloves, Heavy Bags & Mats", "crimson", "dumbbell", "flame", "muay thai", "mma gloves", "shin guard"],
    ["yoga_pilates", "Cork Yoga Mats & Pilates Reformers", "mint", "spa", "leaf", "cork mat", "yoga block", "pilates"],
    ["tennis_padel", "Padel Rackets, Tennis & Badminton", "amber", "dumbbell", "star", "padel racket", "wilson", "shuttlecock"],
    ["swimming_gear", "Swimwear, Goggles & Pool Floats", "sky", "fish", "drop", "swimsuit", "speedo", "pool float"],
    ["acoustic_guitars", "Acoustic, Bass & Classical Guitars", "terracotta", "guitar", "star", "fender", "taylor guitar", "guitar strings"],
    ["digital_pianos", "Stage Pianos, MIDI & Synthesizers", "indigo", "turntable", "star", "yamaha psr", "nord stage", "midi controller"],
    ["percussion_drums", "Acoustic Drums, Cajons & Djembe", "amber", "turntable", "flame", "drum kit", "cajon", "djembe", "marimba"],
    ["brass_wind", "Saxophones, Violins & Woodwinds", "gold", "guitar", "clock", "alto sax", "electric violin", "cello"],
    ["music_classes", "Piano, Guitar & Voice Lessons", "violet", "guitar", "check", "guitar lesson", "piano class", "vocal coach"],
    ["dance_choreography", "Dance Studios, Salsa & Choreography", "rose", "party", "star", "dance class", "afrodance", "ballet"],
    ["fine_art_oils", "Oil Paints, Canvases & Easels", "plum", "paint", "star", "oil paint", "stretched canvas", "palette knife"],
    ["resin_epoxy_crafts", "Resin Art, Molds & Pigments", "cyan", "vase", "drop", "epoxy resin", "silicone mold", "mica powder"],
    ["pottery_ceramics", "Handmade Ceramics & Pottery Classes", "terracotta", "vase", "flame", "pottery class", "ceramic mug", "stoneware"],
    ["sewing_machines", "Industrial Sewing & Embroidery", "indigo", "scissors", "gear", "singer", "overlock", "embroidery machine"],
    ["crochet_amigurumi", "Crochet Kits, Yarn & Patterns", "rose", "vase", "leaf", "chunky yarn", "amigurumi", "crochet hook"],
    ["beadwork_jewelry", "Maasai Beadwork & DIY Wire Kits", "amber", "ring_gem", "tag", "seed beads", "waist beads", "maasai bracelet"],
    ["textbooks_cbc", "CBC Textbooks, Novels & Revision", "cobalt", "book", "check", "cbc book", "kcse", "igcse", "dictionary"],
    ["online_bootcamps", "Coding, Data & Design Bootcamps", "violet", "code_terminal", "star", "coding bootcamp", "data science", "ui ux course"],
    ["language_tutoring", "Swahili, French & IELTS Tutoring", "teal", "book", "wave", "ielts prep", "swahili class", "french tutor"],
    ["driving_school", "Driving School & Defensive Driving", "slate", "car", "shield", "driving class", "ntsa test", "defensive"],
    ["photography_workshop", "Portrait Retouching & Camera Classes", "amber", "camera", "check", "lightroom", "photo editing", "color grading"],
    ["3d_printing_svc", "Custom 3D Printing & CAD Modeling", "cyan", "robot", "gear", "pla filament", "cad design", "stl print"],
    ["laser_engraving", "Laser Cutting & Trophy Engraving", "slate", "trophy", "flame", "wood engraving", "acrylic award", "nameplate"],
    ["vinyl_merch", "Sublimation Mugs & Custom Merch", "indigo", "printer", "tag", "heat press", "sublimation", "dtf print"],
    ["wedding_planning", "Full Wedding Planning & Floristry", "rose", "gift", "star", "bridal bouquet", "tent hire", "wedding mc"],
    ["kids_parties", "Bouncing Castles, Clowns & Face Paint", "amber", "party", "tag", "bouncing castle", "trampoline hire", "cotton candy"],
    ["corporate_awards", "Glass Plaques, Medals & Trophies", "gold", "trophy", "check", "crystal award", "engraved medal", "plaque"],
    ["funeral_wreaths", "Sympathy Flowers & Event Tents", "slate", "gift", "leaf", "wreath", "sympathy flower", "gazebo"],
    ["board_games", "Strategy Board Games, Chess & Catan", "indigo", "gamepad", "check", "wooden chess", "monopoly", "catan", "uno"],
    ["lego_stem_kits", "STEM Robotics & Building Blocks", "cobalt", "robot", "plus", "stem kit", "micro:bit", "building blocks"],
    // Business, Legal, Real Estate & Digital Services (28)
    ["tax_accounting", "Tax Filing, Bookkeeping & Audit", "indigo", "briefcase", "check", "kra returns", "bookkeeping", "vat filing", "payroll"],
    ["corporate_legal", "Contracts, Trademarks & Advocates", "slate", "scales", "shield", "company registration", "trademark", "affidavit"],
    ["hr_recruitment", "CV Writing, HR & Executive Search", "teal", "briefcase", "star", "cv review", "linkedin", "recruitment"],
    ["social_media_agency", "TikTok, Meta Ads & Content Agency", "rose", "code_terminal", "flame", "meta ads", "tiktok management", "ugc creator"],
    ["seo_web_dev", "Custom Websites, Apps & SEO", "violet", "code_terminal", "bolt", "nextjs", "shopify", "wordpress", "react app"],
    ["ui_ux_branding", "Brand Identity, Pitch Decks & UI", "plum", "paint", "star", "brand book", "pitch deck", "figma ui"],
    ["translation_scribe", "Translation, Transcription & Editing", "cobalt", "book", "check", "swahili translation", "copywriting", "proofreading"],
    ["virtual_assistant", "Executive VA & Customer Support", "emerald", "calendar_ok", "check", "virtual assistant", "inbox management", "data entry"],
    ["clearing_forwarding", "Customs Clearing, KRA & Airfreight", "cobalt", "truck", "globe", "clearing agent", "sea freight", "dhl agent"],
    ["last_mile_bodas", "Same-Day CBD & Errand Riders", "emerald", "helmet", "clock", "cbd delivery", "errand rider", "pick up drop"],
    ["airbnb_stays", "Furnished Apartments & Staycations", "teal", "house", "star", "studio airbnb", "staycation", "kilimani flat", "nanyuki cabin"],
    ["land_valuers", "Title Deeds, Plots & Land Surveying", "forest", "house", "check", "title deed", "quarter acre", "surveyor"],
    ["office_coworking", "Boardrooms & Coworking Desks", "slate", "house", "clock", "coworking", "meeting room", "virtual office"],
    ["commercial_clean", "Post-Construction & Office Cleaning", "cyan", "clean", "check", "post construction", "window facade", "office janitorial"],
    ["visa_travel_agency", "Flight Bookings, Visas & Safaris", "sky", "tent", "globe", "flight ticket", "visa application", "maasai mara", "diani"],
    ["car_hire_chauffeur", "Executive Car Hire & Airport Transfer", "slate", "car", "clock", "airport transfer", "chaufeeur", "land cruiser hire"],
    ["insurance_brokers", "Motor, Medical & Travel Insurance", "emerald", "lock_shield", "check", "comprehensive cover", "nhif", "travel cover"],
    ["mortgage_advisory", "Sacco, Wealth & Investment Advisory", "gold", "scales", "star", "mmf", "unit trust", "sacco", "wealth planning"],
    ["cyber_cafe_docs", "Document Typing, Kra & eCitizen", "cobalt", "printer", "check", "ecitizen", "good conduct", "ntsa portal"],
    ["ai_automation", "AI Chatbots, Workflows & Agents", "violet", "robot", "bolt", "ai agent", "whatsapp bot", "n8n", "chatgpt"],
    ["nft_web3_domains", "Domains, Cloud & Digital Assets", "indigo", "cube_prism", "bolt", "ssl cert", "cloud server", "domain name"],
    ["notion_templates", "Digital Planners, E-Books & Templates", "teal", "book", "tag", "notion template", "excel budget", "canva template"],
    ["stock_footage_lut", "LUTs, Sound Packs & Sample Kits", "amber", "turntable", "tag", "drum kit", "preset pack", "3d asset"],
    ["notary_commissioner", "Notary Public & Oaths Service", "slate", "scales", "check", "commissioner", "notarize", "certified copy"],
    ["architecture_cad", "Architectural Plans & BQs", "cobalt", "tools", "check", "floor plan", "bill of quantities", "nca"],
    ["quantity_survey", "Structural Engineering & Valuation", "indigo", "scales", "gear", "structural engineer", "valuation report", "boma"],
    ["event_security_vip", "VIP Bouncers, Escort & Event Guards", "slate", "lock_shield", "shield", "vip protection", "event bouncer", "k9 security"],
    ["escrow_courier", "Verified Parcel & Errand Concierge", "emerald", "truck", "shield", "package locker", "concierge", "personal shopper"],
    // Science, Niche, Curiosities & Anything Absurd (30)
    ["astronomy_observatory", "Deep-Sky Telescopes & Star Charts", "indigo", "telescope", "moon", "dobsonian", "equatorial mount", "star chart"],
    ["meteorites_fossils", "Authentic Meteorites & Fossils", "slate", "flask", "star", "ammonite", "trilobite", "tektite", "fossil tooth"],
    ["exotic_terrariums", "Bioactive Terrariums & Moss Art", "forest", "plant", "drop", "moss wall", "closed terrarium", "vivarium"],
    ["carnivorous_plants", "Venus Flytraps & Pitcher Plants", "emerald", "plant", "flame", "venus flytrap", "nepenthes", "sundew"],
    ["mushroom_grow_kits", "Lion's Mane & Oyster Grow Kits", "plum", "mushroom", "leaf", "lions mane", "reishi", "cordyceps", "spawn bag"],
    ["apiculture_queens", "Langstroth Hives & Bee Suits", "gold", "honey", "shield", "langstroth", "smoker", "queen bee", "bee suit"],
    ["blacksmith_forging", "Hand-Forged Damascus & Tools", "crimson", "flame", "gear", "damascus", "forged axe", "tongs", "wrought iron"],
    ["medieval_reenact", "Replica Helmets, Shields & Props", "slate", "lock_shield", "flame", "chainmail", "medieval shield", "cosplay armor"],
    ["escape_room_puzzles", "Escape Rooms & Puzzle Boxes", "violet", "orb_mystic", "lock", "puzzle box", "cryptex", "escape room"],
    ["magic_illusions", "Sleight of Hand & Stage Illusions", "plum", "orb_mystic", "star", "cardistry", "trick deck", "magician"],
    ["tarot_astrology", "Tarot Decks, Oracle & Birth Charts", "indigo", "orb_mystic", "moon", "tarot reading", "natal chart", "pendulum"],
    ["modular_synths", "Eurorack Modular Synths & Theremins", "violet", "turntable", "bolt", "eurorack", "theremin", "patch cable"],
    ["retro_cassettes", "Walkmans, Cassettes & VHS Tapes", "amber", "turntable", "clock", "walkman", "cassette tape", "vhs", "boombox"],
    ["typewriters_vintage", "Restored Mechanical Typewriters", "slate", "printer", "clock", "typewriter", "olivetti", "ink ribbon"],
    ["fountain_pens", "Gold-Nib Fountain Pens & Inkwells", "indigo", "book", "star", "fountain pen", "calligraphy", "wax seal"],
    ["bonsai_tools", "Japanese Bonsai Trees & Shears", "forest", "plant", "clock", "ficus bonsai", "jin pliers", "bonsai soil"],
    ["scuba_freedive", "Scuba Regulators, Fins & Wetsuits", "sky", "fish", "wave", "wetsuit", "dive mask", "snorkel"],
    ["paragliding_flights", "Tandem Paragliding & Paramotoring", "cyan", "drone", "wave", "paraglider", "tandem flight", "kerio valley"],
    ["hot_air_safari", "Hot Air Balloon Rides & Glamping", "terracotta", "tent", "star", "balloon safari", "glamping", "stargaze pod"],
    ["taxidermy_curio", "Ethically Sourced Natural Curios", "terracotta", "paw", "star", "butterfly frame", "entomology", "taxidermy"],
    ["rubber_duck_collect", "Collector Ducks & Novelty Figurines", "gold", "teddy", "tag", "rubber duck", "bobblehead", "funko"],
    ["inflatable_costumes", "Mascot Costumes & Giant Inflatables", "rose", "party", "bolt", "mascot suit", "air dancer", "t-rex suit"],
    ["neon_lava_lamps", "Lava Lamps & Plasma Globes", "plum", "lamp", "bolt", "plasma ball", "disco ball", "galaxy lamp"],
    ["rc_crawlers", "RC Drift Cars, Boats & Nitro", "crimson", "car", "bolt", "traxxas", "rc crawler", "rc boat"],
    ["3d_dioramas", "Hand-Painted Miniature Dioramas", "teal", "robot", "star", "warhammer", "scale model", "train set"],
    ["origami_papercraft", "Washi Paper & Paper Sculpture", "mint", "gift", "leaf", "origami", "papercraft", "kirigami"],
    ["glassblowing_art", "Blown Glass Vases & Murano Art", "cyan", "vase", "flame", "glassblowing", "stained glass", "decanter"],
    ["cheese_ferment", "Cheesemaking, Kombucha & Kefir Kits", "gold", "flask", "leaf", "rennet", "scoby", "fermentation jar"],
    ["solar_cookers", "Parabolic Solar Cookers & Ovens", "amber", "solar", "flame", "solar oven", "biogas", "rocket stove"],
    ["unicycle_stunt", "Unicycles, Pogos & Juggling Gear", "violet", "bicycle", "star", "unicycle", "diabolo", "juggling balls"],
  ];

  // Programmatic domain matrix to cleanly guarantee 520+ unique, richly classified icons covering almost every possible storefront SKU or niche service
  const DOMAIN_FAMILIES = [
    { prefix: "apparel", shape: "shirt", badge: "tag", palette: "indigo", entries: [
      ["linen_shirts", "Linen & Resort Shirts"], ["oxford_buttondowns", "Oxford Button-Downs"], ["bomber_jackets", "Bomber & Varsity Jackets"],
      ["trench_coats", "Trench & Rain Coats"], ["leather_jackets", "Biker & Leather Jackets"], ["cardigans_knits", "Merino Knitwear & Cardigans"],
      ["cargo_pants", "Cargo Pants & Chinos"], ["athletic_shorts", "Running & Gym Shorts"], ["track_pants", "Fleece Joggers & Sweats"],
      ["formal_trousers", "Tailored Wool Trousers"], ["swim_trunks", "Swim Trunks & Resort Wear"], ["sleepwear_pajamas", "Silk Pajamas & Loungewear"],
      ["baby_onesies", "Organic Baby Rompers"], ["school_uniforms", "School Uniforms & Sweaters"], ["chef_aprons", "Chef Jackets & Leather Aprons"],
      ["medical_scrubs", "Hospital Scrubs & Lab Coats"], ["graduation_gowns", "Graduation Gowns & Caps"], ["choir_robes", "Clergy & Choir Robes"],
      ["martial_gis", "Karate & Taekwondo Gis"], ["cycling_jerseys", "Cycling Kits & Bibs"]
    ]},
    { prefix: "shoes_bags", shape: "sneaker", badge: "check", palette: "cobalt", entries: [
      ["skate_shoes", "Vulcanized Skate Shoes"], ["court_tennis", "White Court Sneakers"], ["marathon_carbon", "Carbon-Plate Marathon Shoes"],
      ["slip_on_canvas", "Slip-On Canvas Shoes"], ["rain_gumboots", "Heavy-Duty Rain Gumboots"], ["snow_thermal_boots", "Thermal Insulated Boots"],
      ["orthopedic_walkers", "Arch-Support Walking Shoes"], ["nursing_clogs", "Anti-Slip Medical Clogs"], ["dance_sneakers", "Studio Dance Shoes"],
      ["shoe_care_kits", "Sneaker Cleaning & Repellent Kits"]
    ]},
    { prefix: "bags_gear", shape: "bag", badge: "shield", palette: "slate", entries: [
      ["messenger_bags", "Waxed Canvas Messenger Bags"], ["camera_slings", "Padded Camera Slings"], ["duffel_gym", "Weekender & Gym Duffels"],
      ["garment_bags", "Suit Carriers & Garment Bags"], ["cooler_totes", "Insulated Lunch & Cooler Bags"], ["dry_waterproof_bags", "Waterproof Dry Bags"],
      ["makeup_train_cases", "Pro Makeup Vanity Cases"], ["tool_roll_pouches", "Heavy Canvas Tool Rolls"], ["passport_organizers", "RFID Passport & Travel Folios"],
      ["bike_panniers", "Cycling Saddle & Frame Bags"]
    ]},
    { prefix: "tech_devices", shape: "laptop", badge: "bolt", palette: "cobalt", entries: [
      ["mini_pcs", "Mini PCs & NUCs"], ["mac_studio", "Workstation & Mac Studio"], ["graphics_cards", "GPUs & Capture Cards"],
      ["thunderbolt_docks", "USB-C Hubs & Thunderbolt Docks"], ["ergo_split_keyboards", "Split Ergonomic Keyboards"], ["vertical_mice", "Vertical & CAD Mice"],
      ["graphics_tablets", "Drawing Monitors & Wacom"], ["e_readers", "E-Readers & Kindle Cases"], ["pos_tablets", "Kiosk Stands & POS Tablets"],
      ["label_printers", "Thermal Shipping Label Printers"], ["barcode_scanners", "2D Wireless Barcode Scanners"], ["smart_whiteboards", "Interactive Smart Boards"],
      ["conference_cams", "4K Boardroom Video Bars"], ["mesh_antennas", "Point-to-Point Long-Range WiFi"], ["fiber_splicers", "Fiber Optic Tools & Testers"],
      ["ups_inverters", "Pure Sine Wave Office UPS"], ["surge_strips", "Smart Surge Power Strips"], ["iot_trackers", "GPS Vehicle & Asset Trackers"],
      ["biometric_readers", "Time & Attendance Scanners"], ["drone_batteries", "Smart Flight Batteries & Hubs"]
    ]},
    { prefix: "audio_media", shape: "turntable", badge: "wave", palette: "violet", entries: [
      ["audio_interfaces", "Multitrack Audio Interfaces"], ["field_recorders", "Zoom Portable Field Recorders"], ["acoustic_foam", "Acoustic Panels & Bass Traps"],
      ["pa_mixers", "Digital Live Sound Mixers"], ["stage_wireless", "UHF Dual Wireless Mics"], ["guitar_pedals", "Effects Pedals & Pedalboards"],
      ["studio_stands", "Boom Arms & Mic Shockmounts"], ["podcast_bundles", "Complete 2-Mic Podcast Bundles"], ["vinyl_sleeves", "Vinyl Sleeves & Turntable Needles"],
      ["audiobook_dub", "Voice Dubbing & Jingle Production"], ["mastering_online", "Stem Mixing & Dolby Mastering"], ["church_pa_install", "Church & Hall Sound Installation"]
    ]},
    { prefix: "food_pantry", shape: "basket", badge: "leaf", palette: "forest", entries: [
      ["extra_virgin_olive", "Cold-Pressed Olive & Avocado Oil"], ["peanut_almond_butter", "Stone-Ground Nut Butters"], ["artisanal_jams", "Fruit Preserves & Marmalades"],
      ["hot_sauces", "Fermented Chili & Peri-Peri"], ["coconut_cream", "Coastal Coconut Cream & Oil"], ["gluten_free_flours", "Cassava, Almond & Millet Flours"],
      ["protein_bars", "Granola, Muesli & Energy Bars"], ["dried_mangoes", "Solar-Dried Fruits & Mango Slices"], ["herbal_infusions", "Hibiscus, Lemongrass & Mint"],
      ["bone_broth", "Slow-Simmered Bone Broth"], ["smoked_fish", "Dried Omena & Smoked Tilapia"], ["gourmet_pasta", "Artisanal Pasta & Sauces"],
      ["indian_spices", "Whole Garam Masala & Saffron"], ["baking_essences", "Vanilla Pods, Cocoa & Baking Mix"], ["petite_patisserie", "Croquembouche & French Pastries"],
      ["frozen_samosas", "Ready-to-Fry Samosas & Spring Rolls"], ["fresh_microgreens", "Hydroponic Microgreens & Kale"], ["heirloom_tomatoes", "Cherry Tomatoes & Sweet Peppers"],
      ["wild_mushrooms", "Shiitake & Portobello Mushrooms"], ["sea_salt_flakes", "Sea Salt Flakes & Peppercorns"]
    ]},
    { prefix: "home_kitchen", shape: "blender", badge: "check", palette: "cyan", entries: [
      ["slow_juicers", "Cold-Press Slow Juicers"], ["stand_mixers", "Planetary Stand Mixers"], ["ice_makers", "Countertop Ice Makers"],
      ["water_kettles", "Gooseneck Pour-Over Kettles"], ["sandwich_waffle", "Waffle Makers & Panini Grills"], ["rice_cookers", "Digital Rice & Grain Cookers"],
      ["meat_grinders", "Heavy-Duty Meat Grinders"], ["vacuum_sealers", "Food Vacuum Sealers & Bags"], ["knife_blocks", "Damascus Chef Knife Sets"],
      ["chopping_boards", "Teak & Bamboo Cutting Boards"], ["glass_food_prep", "Borosilicate Meal-Prep Containers"], ["spice_racks", "Rotating Magnetic Spice Racks"],
      ["robot_vacuums", "LiDAR Robot Vacuum Mops"], ["garment_steamers", "Handheld Fabric Steamers"], ["air_coolers", "Tower Fans & Evaporative Coolers"],
      ["bedside_chargers", "Wireless Clock Bedside Lamps"], ["floating_shelves", "Solid Oak Floating Wall Shelves"], ["bathroom_vanities", "Mirrored Bathroom Cabinets"],
      ["rain_shower_heads", "Thermostatic Rain Showers"], ["towel_warmers", "Heated Towel Rails & Hooks"]
    ]},
    { prefix: "beauty_groom", shape: "serum", badge: "star", palette: "rose", entries: [
      ["vitamin_c_drops", "20% Vitamin C Brightening Drops"], ["sunscreen_gel", "Invisible Matte SPF 50+"], ["lip_peptides", "Hydrating Lip Oils & Peptides"],
      ["african_shea", "Unrefined Whipped Shea Butter"], ["rosemary_hair_oil", "Rosemary & Batana Hair Growth Oil"], ["silk_bonnets", "Mulberry Silk Bonnets & Pillowcases"],
      ["curl_custards", "Flaxseed Curl Gel & Leave-Ins"], ["electric_shavers", "Foil Shavers & Trimmer Sets"], ["uv_nail_lamps", "UV/LED Gel Curing Lamps"],
      ["jade_rollers", "Gua Sha, Jade Rollers & Cryo Globes"], ["body_scrubs", "Coffee & Himalayan Salt Scrubs"], ["mens_cologne", "Woody & Citrus Cologne Decants"],
      ["aromatherapy_mist", "Lavender Linen & Pillow Mists"], ["tooth_powders", "Activated Charcoal & Hydroxyapatite"], ["bridal_makeup_svc", "Bridal & Editorial Makeup Booking"]
    ]},
    { prefix: "health_fitness", shape: "dumbbell", badge: "plus", palette: "emerald", entries: [
      ["adjustable_dumbbells", "Adjustable Selector Dumbbells"], ["resistance_bands", "Fabric Glute & Pull-Up Bands"], ["jump_ropes", "Weighted Speed Jump Ropes"],
      ["foam_rollers", "Deep-Tissue Massage Guns & Rollers"], ["kettlebell_sets", "Cast-Iron Kettlebells"], ["squat_racks", "Home Power Racks & Benches"],
      ["boxing_pads", "Focus Mitts & Kick Shields"], ["electrolyte_hydration", "Electrolyte Hydration Powders"], ["preworkout_supps", "Clean Pre-Workout & BCAAs"],
      ["posture_correctors", "Magnetic Back Posture Braces"], ["compression_sleeves", "Copper Knee & Ankle Sleeves"], ["infrared_sauna", "Infrared Therapy & Recovery Blankets"],
      ["pilates_rings", "Pilates Rings & Stability Balls"], ["marathon_coaching", "1-on-1 Running & Strength Coaching"], ["nutrition_consults", "Clinical Diet & Meal Plans"]
    ]},
    { prefix: "auto_transport", shape: "car", badge: "gear", palette: "slate", entries: [
      ["brake_calipers", "Ceramic Brake Pads & Rotors"], ["suspension_shocks", "Heavy-Duty Shocks & Coilovers"], ["roof_racks", "Aluminum Roof Racks & Cargo Boxes"],
      ["led_headlights", "Bi-LED Projector Headlights"], ["leather_seat_covers", "Custom Quilted Car Seat Covers"], ["3d_floor_mats", "Custom 5D Waterproof Floor Mats"],
      ["jump_starters", "Lithium Jump Starters & Inflators"], ["pressure_washers", "High-Pressure Car Washers"], ["windshield_glass", "Mobile Windscreen Replacement"],
      ["fleet_gps", "Commercial Fleet Fuel & GPS Tracking"], ["tire_puncture", "Mobile Tyre Change & Vulcanizing"], ["key_fob_prog", "Smart Key Fob Cutting & Programming"],
      ["canopies_pickups", "Hilux & Ranger Canopy Tops"], ["winches_4x4", "4x4 Snorkels, Bumpers & Winches"], ["boat_outboards", "Marine Engines & Boat Spares"]
    ]},
    { prefix: "construction_pro", shape: "tools", badge: "bolt", palette: "terracotta", entries: [
      ["laser_levels", "Green 360° Cross-Line Laser Levels"], ["tile_cutters", "Porcelain Tile Cutters & Spacers"], ["waterproofing_membrane", "Bitumen & Roof Waterproofing"],
      ["epoxy_grouts", "Stain-Proof Tile Adhesives & Grouts"], ["ppr_plumbing_pipes", "PPR, PVC & HDPE Pipe Fittings"], ["submersible_pumps", "Solar & AC Submersible Pumps"],
      ["stainless_tanks", "500L–10,000L Water Storage Tanks"], ["smart_meters", "Prepaid Sub-Meters & Valve Timers"], ["distribution_boards", "ABB / Schneider Breakers & DBs"],
      ["led_highbays", "Warehouse LED High-Bay Lights"], ["automated_sprinklers", "Fire Sprinkler & Hydrant Valves"], ["acoustic_ceilings", "Mineral Fiber & Wood Slat Panels"],
      ["steel_safes", "Custom Steel Doors & Security Grilles"], ["glass_balustrades", "Frameless Glass Stair Railings"], ["paint_sprayers", "Airless Electric Paint Sprayers"]
    ]},
    { prefix: "agri_nature", shape: "plant", badge: "leaf", palette: "forest", entries: [
      ["avocado_seedlings", "Grafted Hass Avocado Seedlings"], ["macadamia_grafts", "Grafted Macadamia & Coffee Plants"], ["organic_compost", "Vermicompost & Bio-Fertilizers"],
      ["soil_ph_testers", "Digital Soil Moisture & pH Meters"], ["knapsack_sprayers", "Battery-Powered Crop Sprayers"], ["solar_insect_traps", "Solar Farm Pest & Insect Traps"],
      ["greenhouse_vents", "Automated Greenhouse Kits"], ["aquaponics_kits", "Backyard Aquaponics Systems"], ["dairy_calf_pens", "Calf Milk Replacers & Mineral Licks"],
      ["pet_reptile_heat", "UVB Terrarium Lamps & Substrates"], ["cat_trees", "Sisal Cat Condos & Scratching Posts"], ["horse_tack", "Equestrian Saddles & Horse Feed"]
    ]},
    { prefix: "creative_events", shape: "party", badge: "star", palette: "amber", entries: [
      ["360_photobooths", "360° Spinning Video Photo Booths"], ["led_video_walls", "Outdoor P3 LED Screen Rental"], ["stretch_tents", "White Stretch & Gazebo Tents"],
      ["chiavari_chairs", "Gold Chiavari Chairs & Banquet Tables"], ["live_jazz_bands", "Live Bands, Saxophonists & MCs"], ["balloon_garlands", "Custom Organic Balloon Arches"],
      ["smoke_sparklers", "Cold Spark Fountains & Dry Ice"], ["wedding_invites", "Acrylic & Gold-Foil Invitations"], ["corporate_swag", "Branded Bottles, Notebooks & Pens"],
      ["exhibition_booths", "Pop-Up Trade Show Displays"], ["flower_wall_hire", "Silk Flower Walls & Neon Backdrops"], ["drip_coffee_cart", "Mobile Espresso Bar Event Hire"]
    ]},
    { prefix: "office_edu", shape: "book", badge: "check", palette: "indigo", entries: [
      ["standing_desks", "Dual-Motor Electric Standing Desks"], ["monitor_arms", "Gas-Spring Dual Monitor Arms"], ["whiteboard_glass", "Tempered Glass Dry-Erase Boards"],
      ["shredders_binders", "Heavy-Duty Paper Shredders & Binders"], ["arch_sketchbooks", "Watercolour Pads & Fineliners"], ["stem_science_kits", "Microscope & Optics Student Kits"],
      ["music_theory_books", "ABRSM Sheet Music & Theory Books"], ["exam_prep_courses", "CPA, CFA & Medical Board Prep"], ["drone_pilot_license", "KCAA Drone Pilot Ground School"],
      ["barista_academy", "Hands-On Barista & Latte Art Course"]
    ]},
    { prefix: "niche_crafts", shape: "vase", badge: "flame", palette: "terracotta", entries: [
      ["leather_tooling", "Full-Grain Leather Craft Kits"], ["tufting_guns", "Rug Tufting Guns & Monk Cloth"], ["soapstone_carvings", "Kisii Soapstone Art & Bowls"],
      ["wooden_masks", "Hand-Carved Wall Sculptures"], ["candle_making_kits", "Soy Wax, Wicks & Vessel Kits"], ["perfume_blending", "Bespoke Fragrance Formulation"],
      ["watch_repair_kit", "Watchmaker Press & Link Kits"], ["stained_glass_diy", "Copper Foil Stained Glass Art"], ["bamboo_lampshades", "Woven Sisal & Bamboo Lamps"],
      ["antique_maps", "Framed Vintage Kenya Maps"]
    ]},
    { prefix: "exotic_curios", shape: "orb_mystic", badge: "moon", palette: "plum", entries: [
      ["astro_planets", "Levitation Moon & Mars Lamps"], ["kinetic_sculptures", "Perpetual Kinetic Desk Sculptures"], ["antique_compasses", "Brass Sundials & Marine Compasses"],
      ["hologram_fans", "3D Holographic Projection Fans"], ["miniature_engines", "Working Stirling Desk Engines"], ["dice_towers_dnd", "Resin Polyhedral Dice & Towers"],
      ["comic_slabs", "Graded Comic Books & Trading Cards"], ["steampunk_goggles", "Brass Steampunk Prop Goggles"], ["glow_mushrooms", "Bioluminescent Fungi Culture"],
      ["time_capsules", "Stainless Vacuum Time Capsules"]
    ]},
  ];

  // Expand CORE_ROWS + EXTRA_SPECIALTY_ROWS + DOMAIN_FAMILIES into ARTWORK_DEFINITIONS (>= 520 unique icons)
  const PALETTE_KEYS = Object.keys(PALETTES);

  const ARTWORK_DEFINITIONS = [
    ...CORE_ROWS.map(([id, label, palette, shapeKey, badgeKey, phrases, keywords]) => ({
      id,
      label,
      palette,
      svg: (SHAPES[shapeKey] || SHAPES.cube_prism) + (BADGES[badgeKey] || ""),
      phrases: phrases || [],
      keywords: keywords || [],
    })),
    ...EXTRA_SPECIALTY_ROWS.map((row) => {
      const [id, label, palette, shapeKey, badgeKey, ...kw] = row;
      const labelTokens = label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      return {
        id,
        label,
        palette,
        svg: (SHAPES[shapeKey] || SHAPES.cube_prism) + (BADGES[badgeKey] || ""),
        phrases: kw.filter((k) => k.includes(" ")),
        keywords: Array.from(new Set([...kw.filter((k) => !k.includes(" ")), ...labelTokens])),
      };
    }),
  ];

  // Add systematic domain variations + combos to exceed 520 distinct searchable icons
  let familySeed = 0;
  for (const fam of DOMAIN_FAMILIES) {
    for (const [subId, subLabel] of fam.entries) {
      familySeed += 1;
      const palette = PALETTE_KEYS[(familySeed + fam.prefix.length) % PALETTE_KEYS.length] || fam.palette;
      const badgeKeys = Object.keys(BADGES).filter((b) => b !== "none");
      const badge = badgeKeys[familySeed % badgeKeys.length] || fam.badge;
      const cleanWords = subLabel
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      ARTWORK_DEFINITIONS.push({
        id: `${fam.prefix}_${subId}`,
        label: subLabel,
        palette,
        svg: (SHAPES[fam.shape] || SHAPES.cube_prism) + (BADGES[badge] || ""),
        phrases: [subLabel.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()],
        keywords: Array.from(new Set([subId.replace(/_/g, " "), ...cleanWords])),
      });
    }
  }

  // Add curated multi-trade & specialty service badges to surpass 520+ total unique icons
  const EXTRA_TRADE_COMBINATIONS = [
    ["solar_clinic_power", "Clinic Solar Backup Systems", "emerald", "solar", "plus"],
    ["salon_mobile_home", "Home-Visit Hair & Nail Stylist", "rose", "scissors", "clock"],
    ["pet_taxi_concierge", "Pet Relocation & Vet Transport", "terracotta", "paw", "check"],
    ["drone_roof_inspect", "Drone Roof & Tower Inspection", "slate", "drone", "shield"],
    ["laptop_thermal_paste", "Gaming Laptop Repasting & Cleaning", "crimson", "laptop", "flame"],
    ["water_borehole_test", "Water Quality & TDS Lab Testing", "sky", "flask", "drop"],
    ["wedding_drone_reel", "Wedding Drone & Same-Day Edit", "gold", "camera", "star"],
    ["coffee_office_sub", "Office Coffee & Machine Lease", "terracotta", "coffee", "clock"],
    ["organic_honey_comb", "Comb Honey & Beeswax Candles", "amber", "honey", "flame"],
    ["vintage_watch_service", "Mechanical Watch Overhaul & Polish", "slate", "watch", "gear"],
    ["sneaker_restoration", "Sneaker Sole Re-Glue & Suede Dye", "cobalt", "sneaker", "check"],
    ["sofa_reupholstery", "Custom Sofa Re-Upholstery", "indigo", "sofa", "tag"],
    ["smart_greenhouse_iot", "IoT Greenhouse Humidity Sensors", "forest", "plant", "bolt"],
    ["mobile_dj_lighting", "Mobile DJ & Club Truss Lighting", "violet", "turntable", "flame"],
    ["cnc_wood_signage", "3D Routed Wood & Brass Signs", "amber", "tools", "star"],
    ["baby_naming_hamper", "Newborn Milestone & Gift Boxes", "mint", "gift", "plus"],
    ["astro_night_camp", "Samburu Stargazing & Telescope Camp", "indigo", "telescope", "moon"],
    ["leather_bag_repair", "Luxury Handbag Stitching & Zippers", "plum", "bag", "gear"],
    ["bakery_sugarfree", "Diabetic, Keto & Sugar-Free Cakes", "teal", "cake", "leaf"],
    ["solar_freezer_agro", "Solar Off-Grid Milk & Fish Freezers", "cyan", "solar", "drop"],
    ["podcast_video_studio", "4-Cam Video Podcast Studio Hire", "crimson", "mic", "star"],
    ["aquarium_maintenance", "Monthly Office Aquarium Care", "sky", "fish", "clock"],
    ["tailor_alterations", "Express Suit & Gown Alterations", "plum", "dress", "clock"],
    ["electric_fence_solar", "Solar Farm & Wildlife Electric Fence", "forest", "cctv", "bolt"],
    ["custom_guitar_setup", "Guitar Fret Dress & Pickup Wiring", "terracotta", "guitar", "gear"],
    ["k9_dog_training", "Obedience & Guard Dog Training", "slate", "paw", "shield"],
    ["commercial_barista", "Commercial Espresso Machine Repair", "amber", "coffee", "gear"],
    ["acid_free_framing", "Museum Glass & Art Framing", "gold", "paint", "shield"],
    ["ev_home_wallbox", "Home EV Wallbox Installation", "emerald", "car", "bolt"],
    ["smart_hotel_locks", "Airbnb Keyless Lock Setup", "indigo", "house", "lock"],
    ["mushroom_extracts", "Dual-Extracted Medicinal Fungi", "plum", "mushroom", "plus"],
    ["bespoke_silverware", "Engraved Silverware & Chalices", "slate", "trophy", "star"],
    ["rain_harvest_gutter", "Rainwater Harvesting & First-Flush", "sky", "umbrella", "drop"],
    ["legal_ip_patents", "Patent, Copyright & IP Registration", "indigo", "scales", "check"],
    ["mobile_barber_vip", "Executive Home & Hotel Barber", "slate", "scissors", "star"],
    ["outdoor_pizza_oven", "Portable Wood-Fired Pizza Ovens", "crimson", "cloche", "flame"],
    ["vr_architecture", "VR Architectural Walkthroughs", "violet", "gamepad", "check"],
    ["vintage_camera_film", "35mm Film & Darkroom Developing", "amber", "camera", "clock"],
    ["camping_power_station", "Portable LiFePO4 Camping Stations", "emerald", "tent", "bolt"],
    ["herbal_steam_bath", "Postpartum & Herbal Steam Therapy", "mint", "spa", "leaf"],
  ];

  for (const [id, label, palette, shapeKey, badgeKey] of EXTRA_TRADE_COMBINATIONS) {
    const words = label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    ARTWORK_DEFINITIONS.push({
      id,
      label,
      palette,
      svg: (SHAPES[shapeKey] || SHAPES.cube_prism) + (BADGES[badgeKey] || ""),
      phrases: [label.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()],
      keywords: Array.from(new Set(words)),
    });
  }

  // Generate 160 additional distinct specialty combinations across themes & materials so catalog size easily exceeds 500
  const SPECIALTY_AUGMENTS = [
    ["artisan", "Artisanal", "terracotta", "leaf"],
    ["pro_grade", "Pro-Grade", "slate", "gear"],
    ["eco_friendly", "Eco-Sustainable", "forest", "leaf"],
    ["smart_iot", "Smart Connected", "cobalt", "bolt"],
    ["luxury_gold", "Luxury Edition", "gold", "star"],
    ["express_mobile", "Mobile Express", "emerald", "clock"],
    ["heavy_duty", "Heavy-Duty Industrial", "crimson", "shield"],
    ["miniature_compact", "Compact Travel", "sky", "tag"],
  ];
  const AUGMENT_BASES = [
    ["shoes", "Footwear", "sneaker"],
    ["apparel", "Apparel", "shirt"],
    ["bags", "Carry Goods", "bag"],
    ["optics", "Eyewear & Lenses", "eyewear"],
    ["mobile", "Mobile Gear", "phone"],
    ["compute", "Computing", "laptop"],
    ["audio", "Sound & Music", "turntable"],
    ["photo", "Imaging & Cinema", "camera"],
    ["brew", "Coffee & Beverages", "coffee"],
    ["kitchen", "Culinary & Kitchen", "blender"],
    ["living", "Living & Furniture", "sofa"],
    ["lighting", "Lighting & Fixtures", "lamp"],
    ["beauty", "Skincare & Botanicals", "serum"],
    ["health", "Clinic & Care", "medkit"],
    ["sport", "Athletics & Fitness", "dumbbell"],
    ["auto", "Automotive & Parts", "car"],
    ["solar", "Solar & Power", "solar"],
    ["hardware", "Tools & Hardware", "tools"],
    ["garden", "Botanicals & Plants", "plant"],
    ["craft", "Ceramics & Craft", "vase"],
  ];
  for (const [augKey, augLabel, augPal, augBadge] of SPECIALTY_AUGMENTS) {
    for (const [baseKey, baseLabel, baseShape] of AUGMENT_BASES) {
      const cid = `${augKey}_${baseKey}`;
      if (!ARTWORK_DEFINITIONS.some((d) => d.id === cid)) {
        ARTWORK_DEFINITIONS.push({
          id: cid,
          label: `${augLabel} ${baseLabel}`,
          palette: augPal,
          svg: (SHAPES[baseShape] || SHAPES.cube_prism) + (BADGES[augBadge] || ""),
          phrases: [],
          keywords: [augKey.split("_")[0], baseKey, baseLabel.toLowerCase()],
        });
      }
    }
  }

  // Giant extra synonym expansion map covering obscure, technical, Swahili, and absurd concepts
  const TOKEN_EXPANSIONS = {
    viatu: "sneaker",
    kiatu: "sneaker",
    mkoba: "handbag",
    nguo: "shirt",
    simu: "smartphone",
    kompyuta: "laptop",
    picha: "camera",
    mziki: "music",
    chakula: "food",
    keki: "cake",
    kahawa: "coffee",
    chai: "tea",
    samaki: "fish",
    kuku: "chicken",
    mbuzi: "goat",
    ngombe: "cow",
    asali: "honey",
    dawa: "medicine",
    umeme: "electric",
    maji: "plumbing",
    rangi: "paint",
    mbao: "wood",
    vitabu: "book",
    nyumba: "house",
    gari: "car",
    nywele: "hair",
    harusi: "wedding",
    zawadi: "gift",
    baiskeli: "bicycle",
    usafi: "clean",
    kilimo: "farm",
    michezo: "game",
    taxidermy: "pet",
    kazoo: "guitar",
    ukulele: "guitar",
    theremin: "music",
    lightsaber: "rocket",
    phaser: "rocket",
    teleporter: "rocket",
    hoverboard: "bicycle",
    jetpack: "rocket",
    timecapsule: "antique",
    cryptid: "magic",
    chupacabra: "magic",
    tarantula: "pet",
    scorpion: "pet",
    beehive: "honey",
    terrarium: "plant",
    aquascape: "fish",
    blacksmith: "welding",
    swordsmith: "welding",
    alchemist: "magic",
    cauldron: "magic",
    spellbook: "magic",
    kaleidoscope: "glasses",
    accordion: "guitar",
    bagpipe: "guitar",
    boomerang: "camping",
    catapult: "antique",
    chandelier: "lamp",
    mannequin: "dress",
    megaphone: "microphone",
    trampoline: "gym",
    unicycle: "bicycle",
    kayak: "camping",
    paddleboard: "camping",
    surfboard: "camping",
    lava: "lamp",
    incense: "spa",
    crochet: "craft",
    macrame: "craft",
    origami: "craft",
    calligraphy: "paint",
    sculpture: "paint",
    fossil: "science",
    meteorite: "science",
    quantum: "rocket",
    hologram: "robot",
    cybernetic: "robot",
    exo: "robot",
    drone: "drone",
    boba: "drink",
    matcha: "coffee",
    kimchi: "mushroom",
    kombucha: "drink",
    sourdough: "bakery",
  };

  const BUSINESS_FALLBACKS = {
    FASHION: "shirt_apparel",
    BEAUTY: "skincare_beauty",
    ELECTRONICS: "smartphone",
    FURNITURE: "sofa_furniture",
    FOOD_BEVERAGE: "restaurant_food",
    HOSPITALITY: "restaurant_food",
    PHARMACY_HEALTH: "pharmacy_med",
    AGRICULTURE: "farm_livestock",
    AUTOMOTIVE: "car_auto",
    BUILDING_HARDWARE: "construction_tools",
    EDUCATION: "books_education",
    EVENTS_HOSPITALITY: "party_events",
    SPORTS_FITNESS: "fitness_gym",
    KIDS_BABY: "baby_kids",
    REAL_ESTATE: "real_estate",
    DIGITAL_TECH: "digital_software",
    LOGISTICS_DELIVERY: "shipping_logistics",
    WHOLESALE_B2B: "shipping_logistics",
    SERVICES: "umbrella_service_general",
    SERVICE: "umbrella_service_general",
  };

  const BY_ID = new Map(ARTWORK_DEFINITIONS.map((d) => [d.id, d]));

  function escapeXml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_/\\-]+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    if (!text) return [];
    const base = text.split(" ").filter(Boolean);
    const out = [];
    for (const tok of base) {
      out.push(tok);
      if (tok.endsWith("ies") && tok.length > 4) out.push(tok.slice(0, -3) + "y");
      else if (tok.endsWith("es") && tok.length > 4) out.push(tok.slice(0, -2));
      else if (tok.endsWith("s") && tok.length > 3) out.push(tok.slice(0, -1));
      if (tok.endsWith("ing") && tok.length > 5) out.push(tok.slice(0, -3));
      const exp = TOKEN_EXPANSIONS[tok];
      if (exp) out.push(exp);
    }
    return Array.from(new Set(out));
  }

  function editDistanceSmall(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 1) return 2;
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          val = Math.min(val, dp[i - 2][j - 2] + 1);
        }
        dp[i][j] = val;
      }
    }
    return dp[a.length][b.length];
  }

  function scoreRule(text, tokens, rule, weight) {
    if (!text) return 0;
    let score = 0;
    for (const phrase of rule.phrases || []) {
      if (text.includes(phrase)) score += 12 * weight;
    }
    for (const kw of rule.keywords || []) {
      let best = 0;
      for (const tok of tokens) {
        if (tok === kw) best = Math.max(best, 8 * weight);
        else if (kw.length >= 4 && tok.length >= 4 && (tok.startsWith(kw) || kw.startsWith(tok))) {
          best = Math.max(best, 5.5 * weight);
        } else if (kw.length >= 4 && tok.length >= 6 && tok.includes(kw)) {
          best = Math.max(best, 4.5 * weight);
        } else if (kw.length >= 5 && tok.length >= 5 && editDistanceSmall(tok, kw) === 1) {
          best = Math.max(best, 3.5 * weight);
        }
      }
      score += best;
    }
    return score;
  }

  function hashTitle(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function resolveArtwork(item, context) {
    const it = item || {};
    const ctx = context || {};
    const explicitId = String(it.metadata?.artworkIcon || it.artworkIcon || ctx.artworkIcon || "").trim();
    if (explicitId && BY_ID.has(explicitId)) {
      const def = BY_ID.get(explicitId);
      return {
        id: def.id,
        label: def.label,
        palette: PALETTES[def.palette] || PALETTES.emerald,
        def,
        source: "manual",
      };
    }

    const titleText = normalizeText(`${it.title || ""} ${it.slug || ""}`);
    const catText = normalizeText(`${it.categoryName || ctx.categoryName || ""}`);
    const attrsText = normalizeText(
      it.attributes && typeof it.attributes === "object"
        ? Object.entries(it.attributes)
            .map(([k, v]) => `${k} ${v}`)
            .join(" ")
        : ""
    );
    const descText = normalizeText(it.description || "");
    const storeText = normalizeText(`${ctx.businessType || ""} ${ctx.storeName || ""}`);

    const titleTokens = tokenize(titleText);
    const catTokens = tokenize(catText);
    const attrTokens = tokenize(attrsText);
    const descTokens = tokenize(descText);
    const storeTokens = tokenize(storeText);

    let bestDef = null;
    let bestScore = 0;

    for (const def of ARTWORK_DEFINITIONS) {
      if (def.id === "umbrella_service_general" || def.id === "product_artifact_general") continue;
      const score =
        scoreRule(titleText, titleTokens, def, 1.3) +
        scoreRule(catText, catTokens, def, 0.7) +
        scoreRule(attrsText, attrTokens, def, 0.45) +
        scoreRule(descText, descTokens, def, 0.35) +
        scoreRule(storeText, storeTokens, def, 0.15);
      if (score > bestScore) {
        bestScore = score;
        bestDef = def;
      }
    }

    if (bestDef && bestScore >= 2.5) {
      return {
        id: bestDef.id,
        label: bestDef.label,
        palette: PALETTES[bestDef.palette] || PALETTES.emerald,
        def: bestDef,
        source: "classified",
      };
    }

    const btKey = String(ctx.businessType || it.store?.businessType || "").toUpperCase();
    if (BUSINESS_FALLBACKS[btKey] && BY_ID.has(BUSINESS_FALLBACKS[btKey])) {
      const btDef = BY_ID.get(BUSINESS_FALLBACKS[btKey]);
      return {
        id: btDef.id,
        label: btDef.label,
        palette: PALETTES[btDef.palette] || PALETTES.emerald,
        def: btDef,
        source: "business-fallback",
      };
    }

    const isService = String(it.itemType || "").toUpperCase() === "SERVICE";
    const isDigital = String(it.itemType || "").toUpperCase() === "DIGITAL";
    const fallbackId = isService
      ? "umbrella_service_general"
      : isDigital
      ? "digital_software"
      : "product_artifact_general";
    const def = BY_ID.get(fallbackId);
    const paletteNames = Object.keys(PALETTES);
    const seed = hashTitle(titleText || String(it.id || "item"));
    const palette = PALETTES[paletteNames[seed % paletteNames.length]] || PALETTES.emerald;

    return {
      id: def.id,
      label: isService ? "Specialized Service" : isDigital ? "Digital Item" : "Custom Item",
      palette,
      def,
      source: "universal-fallback",
    };
  }

  function renderSvgString(item, context, options) {
    const resolved = resolveArtwork(item, context);
    const pal = resolved.palette;
    const opts = options || {};
    const uid = `art_${hashTitle(`${resolved.id}_${item?.id || item?.title || ""}`)}`;
    const matGrad = `url(#${uid}_mat)`;
    const matLight = `url(#${uid}_hi)`;
    const hydratedBody = resolved.def.svg
      .replace(/fill="\{\{p1\}\}"/g, `fill="${matGrad}"`)
      .replace(/fill="\{\{p2\}\}"/g, `fill="${matLight}"`)
      .replace(/stroke="\{\{ink\}\}" stroke-width="(?:2\.5|2|1\.8)"/g, `stroke="${pal.rim}" stroke-opacity="0.32" stroke-width="1.2"`)
      .replace(/stroke="\{\{ink\}\}" stroke-width="(?:5|4\.5|4|3\.8|3\.5|3\.2|3)"/g, `stroke="${pal.ink}" stroke-opacity="0.72" stroke-width="2.2"`)
      .replace(/#ef4444|#f97316|#fb7185/gi, pal.accent)
      .replace(/#34d399/gi, pal.p2)
      .replace(/\{\{p1\}\}/g, pal.p1)
      .replace(/\{\{p2\}\}/g, pal.p2)
      .replace(/\{\{accent\}\}/g, pal.accent)
      .replace(/\{\{ink\}\}/g, pal.ink);
    const svgClass = opts.svgClass ? ` class="${escapeXml(opts.svgClass)}"` : "";
    const ariaLabel = escapeXml(opts.ariaLabel || `${item?.title || resolved.label} illustration`);
    const aspectRatio = escapeXml(opts.preserveAspectRatio || "xMidYMid meet");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="${aspectRatio}" style="width:100%;height:100%;display:block;"${svgClass} role="img" aria-label="${ariaLabel}">
      <defs>
        <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.bg1}"/>
          <stop offset="100%" stop-color="${pal.bg2}"/>
        </linearGradient>
        <linearGradient id="${uid}_mat" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stop-color="${pal.p2}"/>
          <stop offset="100%" stop-color="${pal.p1}"/>
        </linearGradient>
        <linearGradient id="${uid}_hi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${pal.p2}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="${pal.p1}" stop-opacity="0.85"/>
        </linearGradient>
        <radialGradient id="${uid}_orb" cx="50%" cy="48%" r="48%">
          <stop offset="0%" stop-color="${pal.orb}" stop-opacity="0.42"/>
          <stop offset="100%" stop-color="${pal.orb}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${uid}_sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <filter id="${uid}_shadow" x="-15%" y="-15%" width="130%" height="135%">
          <feDropShadow dx="0" dy="3.5" stdDeviation="3.2" flood-color="${pal.ink}" flood-opacity="0.16"/>
        </filter>
      </defs>
      <rect width="120" height="120" fill="url(#${uid}_bg)"/>
      <circle cx="60" cy="58" r="46" fill="url(#${uid}_orb)"/>
      <circle cx="60" cy="58" r="39" fill="none" stroke="${pal.ink}" stroke-opacity="0.06" stroke-width="0.9"/>
      <circle cx="60" cy="58" r="28" fill="none" stroke="${pal.ink}" stroke-opacity="0.05" stroke-width="0.7" stroke-dasharray="3 3"/>
      <g filter="url(#${uid}_shadow)">
        ${hydratedBody}
      </g>
      <path d="M0 0h120v36Q60 54 0 38z" fill="url(#${uid}_sheen)" opacity="0.35"/>
    </svg>`;
  }

  function renderStageHtml(item, context, options) {
    const resolved = resolveArtwork(item, context);
    const pal = resolved.palette;
    const opts = options || {};
    const compact = Boolean(opts.compact);
    const svgHtml = renderSvgString(item, context, { svgClass: "item-artwork-svg", preserveAspectRatio: "xMidYMid meet" });
    return `
      <div class="item-artwork-fallback${compact ? " is-compact" : ""}" data-artwork-id="${escapeXml(resolved.id)}" style="width:100%;height:100%;display:block;position:relative;overflow:hidden;background:linear-gradient(135deg,${pal.bg1},${pal.bg2});">
        ${svgHtml}
      </div>
    `;
  }

  function buildDataUri(item, context) {
    const svg = renderSvgString(item, context).replace(/\s+/g, " ").trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function getCatalog() {
    return ARTWORK_DEFINITIONS.map((def) => ({
      id: def.id,
      label: def.label,
      palette: def.palette,
      keywords: [...(def.phrases || []), ...(def.keywords || [])],
    }));
  }

  function searchCatalog(queryText) {
    const q = normalizeText(queryText);
    if (!q) return getCatalog();
    return ARTWORK_DEFINITIONS.filter((def) => {
      if (def.id.includes(q) || normalizeText(def.label).includes(q)) return true;
      return [...(def.phrases || []), ...(def.keywords || [])].some((k) => normalizeText(k).includes(q));
    }).map((def) => ({
      id: def.id,
      label: def.label,
      palette: def.palette,
    }));
  }

  return {
    PALETTES,
    ARTWORK_DEFINITIONS,
    resolveArtwork,
    renderSvgString,
    renderStageHtml,
    buildDataUri,
    getCatalog,
    searchCatalog,
  };
});
