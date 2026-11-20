'use strict';
(() => {
  function curvedRoof(T, {stamp, box, outline}, x, y, z, w, d, h, tileColor, ridgeColor, eaveColor, ridgeRatio = 0.28) {
    const p = [], ledge = 0.16;
    function quad(a, b, c, dPt) { p.push(...a, ...b, ...dPt, ...b, ...c, ...dPt); }
    const ring = (t) => {
      const v = [];
      for (const [ax, az, bx, bz] of [[-1, -1, -1, 1], [-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1]]) {
        for (let i = 0; i < 8; i++) {
          const u = i / 8, xx = ax + (bx - ax) * u, zz = az + (bz - az) * u;
          const corner = Math.pow(Math.min(Math.abs(xx), Math.abs(zz)), 4.5);
          v.push([
            x + xx * (w / 2 * (1 - t) + w * ridgeRatio * t),
            y + h * t * t + corner * (1 - t) * Math.min(0.48, h * 0.4),
            z + zz * (d / 2 * (1 - t))
          ]);
        }
      }
      return v;
    };
    let outer = ring(0), prev = outer;
    for (const t of [0.33, 0.67, 1]) {
      const next = ring(t);
      for (let j = 0; j < 32; j++) { const k = (j + 1) % 32; quad(prev[j], next[j], next[k], prev[k]); }
      prev = next;
    }
    for (let i = 0; i < p.length; i += 9) for (let axis = 0; axis < 3; axis++) [p[i + 3 + axis], p[i + 6 + axis]] = [p[i + 6 + axis], p[i + 3 + axis]];
    for (let j = 0; j < 32; j++) {
      const k = (j + 1) % 32, a = outer[j], b = outer[k];
      quad(a, b, [b[0], b[1] - ledge, b[2]], [a[0], a[1] - ledge, a[2]]);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    stamp(g, tileColor, 0, 0, 0);
    g.dispose();
    box(ridgeColor, x, y + h + 0.08, z, w * ridgeRatio * 2.12, 0.19, 0.24);
    for (const s of [-1, 1]) for (const f of [-1, 1]) {
      outline([[-0.32, 0], [0, 0.05], [0.22, 0.24], [0.38, 0.56], [0.42, 0.24], [0.26, -0.02], [0, -0.16]],
        eaveColor, x + s * w * 0.49, y + 0.34, z + f * (d / 2 - 0.1), 0.12, s === 1 ? 0 : Math.PI);
    }
  }

  // 1. Cầu Rồng – Đà Nẵng (Golden Steel Dragon Arch spanning Han River)
  function cauRong(T, {stamp, box, round, tapered}) {
    const gold = 0xe8b923, brightGold = 0xf4cd46, deepGold = 0xb88914;
    const concrete = 0xbcbab2, darkConcrete = 0x87867f, steel = 0xd6d3c8;
    const ember = 0xd94826, ivory = 0xf2ebd9;
    const shift = -62; // Center the camera right on the Eastern Dragon Head + front arches!

    // Median divider & flanking pedestrian parapets (keeping z = +-8.4m clear for driving!)
    box(concrete, -28 + shift, 0.45, 0, 290, 0.9, 2.2);
    for (const side of [-1, 1]) {
      box(concrete, -28 + shift, 0.55, side * 14.8, 290, 1.1, 0.75);
      box(steel, -28 + shift, 1.32, side * 14.8, 290, 0.14, 0.16);
      for (let px = -148; px <= 92; px += 48) {
        box(darkConcrete, px + shift, -3.9, side * 10.5, 4.2, 7.0, 4.6);
        box(concrete, px + shift, -0.95, 0, 5.2, 0.85, 30.8);
      }
      for (let lx = -152; lx <= 98; lx += 25) {
        stamp(round, deepGold, lx + shift, 3.8, side * 14.8, 0.1, 5.6, 0.1);
        box(brightGold, lx + shift, 6.45, side * 13.7, 0.26, 0.16, 2.1);
      }
    }

    // Undulating 5-arch Golden Dragon Spine
    const archY = (x) => {
      const t = (x + 165) / 265;
      const env = 0.65 + 0.45 * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
      const wave = Math.abs(Math.sin(t * Math.PI * 5));
      return 3.6 + wave * 17.5 * env;
    };
    const curvePts = [];
    for (let i = 0; i <= 110; i++) {
      const x = -165 + i * 265 / 110;
      curvePts.push(new T.Vector3(x + shift, archY(x), 0));
    }
    for (const [dy, dz, r, tint] of [
      [0.85, 0, 0.78, brightGold],
      [-0.55, -1.05, 0.62, gold],
      [-0.55, 1.05, 0.62, gold],
      [-1.55, -0.62, 0.48, deepGold],
      [-1.55, 0.62, 0.48, deepGold]
    ]) {
      const shifted = curvePts.map(pt => new T.Vector3(pt.x, pt.y + dy, pt.z + dz));
      const tube = new T.TubeGeometry(new T.CatmullRomCurve3(shifted), 140, r, 8, false);
      stamp(tube, tint, 0, 0, 0);
      tube.dispose();
    }
    for (let x = -160; x <= 96; x += 4.2) {
      const y = archY(x), dy = archY(x + 1) - archY(x - 1);
      const slope = Math.atan2(dy, 2);
      box(brightGold, x + shift, y + 1.85, 0, 1.85, 1.25, 0.24, 0, 0, slope);
      box(deepGold, x + shift, y - 0.55, 0, 0.45, 2.35, 2.45, 0, 0, slope);
      if (y > 5.5 && Math.abs(Math.round(x) % 8) < 4) {
        stamp(round, steel, x + shift, (y - 1.2) / 2, 0, 0.085, y - 1.4, 0.085);
      }
    }

    // Ornate Lý-dynasty Golden Dragon Head at East end (now right in the showcase focal zone!)
    const hx = 102 + shift, hy = 13.8;
    const neckPts = [
      new T.Vector3(96 + shift, archY(96), 0),
      new T.Vector3(100 + shift, 11.2, 0),
      new T.Vector3(103.5 + shift, 15.5, 0),
      new T.Vector3(107.5 + shift, 17.6, 0)
    ];
    const neckTube = new T.TubeGeometry(new T.CatmullRomCurve3(neckPts), 24, 1.85, 10, false);
    stamp(neckTube, gold, 0, 0, 0);
    neckTube.dispose();
    box(brightGold, hx + 6.8, hy + 4.4, 0, 9.2, 3.5, 4.6);
    box(gold, hx + 12.0, hy + 4.8, 0, 4.8, 2.45, 3.4, 0, 0, 0.14);
    box(brightGold, hx + 14.2, hy + 6.3, 0, 2.3, 2.2, 2.3, 0, 0, -0.32);
    box(deepGold, hx + 9.4, hy + 1.5, 0, 7.8, 1.5, 3.5, 0, 0, -0.24);
    box(ember, hx + 9.8, hy + 2.75, 0, 5.4, 1.5, 2.5);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        tapered(ivory, hx + 8.6 + i * 1.4, hy + 3.15, s * 1.32, 0.22, 0.04, 0.85, 1, 4);
        tapered(ivory, hx + 8.9 + i * 1.35, hy + 2.25, s * 1.24, 0.04, 0.2, 0.72, 1, 4);
      }
      const eye = new T.SphereGeometry(0.72, 10, 8);
      stamp(eye, ember, hx + 8.4, hy + 5.1, s * 2.25, 1.1, 0.9, 0.7);
      eye.dispose();
      box(brightGold, hx + 7.6, hy + 6.2, s * 2.2, 3.9, 0.68, 0.78, 0, 0, -0.22);
      box(brightGold, hx + 3.4, hy + 8.0, s * 1.7, 7.2, 0.82, 0.68, s * 0.18, 0, -0.45);
      for (let m = 0; m < 4; m++) {
        box(gold, hx + 2.8 - m * 1.2, hy + 6.2 - m * 1.3, s * 2.15, 4.4, 0.54, 0.44, s * 0.22, 0, -0.38);
      }
      box(brightGold, hx + 12.8, hy + 3.8, s * 2.35, 5.0, 0.3, 0.3, s * 0.42, 0, 0.28);
    }

    // Stylized Golden Lotus Tail at West end
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.34;
      box(i % 2 ? brightGold : gold, -168 + shift - Math.cos(a) * 4.2, 6.8 + i * 1.15, Math.sin(a) * 2.4, 7.6, 0.72, 1.45, a * 0.5, 0, -0.42 - i * 0.08);
    }
  }

  // 2. Hải Vân Quan (Đỉnh Đèo Hải Vân – Thiên Hạ Đệ Nhất Hùng Quan)
  function haiVanQuan(T, kit) {
    const {box, profile, outline, sign} = kit;
    const brick = [0x8e5642, 0x9b624b, 0x7d4c3b, 0x845542];
    const stone = 0x7a766d, mortar = 0xb7ae9c, dark = 0x4b463f, moss = 0x677052;

    // Deep mountain-pass stone foundation plinth so it seats solidly on ridge slopes
    box(stone, 0, -1.6, 0, 26.5, 3.6, 22.5);
    box(0x9a9384, 0, 0.28, 0, 25.4, 0.42, 21.6);

    function citadelGate(z, title, reverse = false) {
      const shape = new T.Shape();
      shape.moveTo(-6.6, 0); shape.lineTo(-2.15, 0); shape.lineTo(-2.15, 2.35);
      shape.absarc(0, 2.35, 2.15, Math.PI, 0, true);
      shape.lineTo(2.15, 0); shape.lineTo(6.6, 0); shape.lineTo(6.2, 5.25); shape.lineTo(-6.2, 5.25); shape.closePath();
      profile(shape, brick[0], 0, 0.45, z - 2.35, 4.7);
      // Weathered stone/brick blocks & arch voussoirs
      for (const face of [-1, 1]) {
        const fz = z + face * 2.38;
        for (let i = 0; i < 11; i++) {
          const a = i * Math.PI / 11, b = (i + 1) * Math.PI / 11 - 0.014, pt = (q, t) => [q * Math.cos(t), q * Math.sin(t)];
          outline([pt(2.15, a), pt(2.48, a), pt(2.48, b), pt(2.15, b)], i % 2 ? mortar : stone, 0, 2.8, fz - 0.05, 0.12);
        }
        for (let row = 0; row < 5; row++) {
          for (const s of [-1, 1]) {
            box(brick[(row + (s > 0 ? 1 : 0)) % 4], s * 4.3, 1.0 + row * 0.92, fz, 3.6, 0.82, 0.1);
          }
        }
      }
      // Upper parapet deck & battlements (lỗ châu mai)
      box(mortar, 0, 5.82, z, 12.9, 0.28, 5.1);
      for (const f of [-1, 1]) {
        box(brick[1], 0, 6.24, z + f * 2.32, 12.6, 0.56, 0.42);
        for (let i = -4; i <= 4; i++) box(i % 3 === 0 ? moss : brick[2], i * 1.44, 6.82, z + f * 2.32, 0.82, 0.68, 0.42);
      }
      // Stone inscribed plaque above the arch
      const faceZ = z + (reverse ? -2.44 : 2.44);
      box(mortar, 0, 5.25, faceZ, 4.1, 0.78, 0.14);
      sign(title, 0, 5.25, z + (reverse ? -2.53 : 2.53), 3.85, 0.56);
      if (reverse && kit.group.children.length) kit.group.children.at(-1).rotation.y = Math.PI;
    }

    // Front gate ("HẢI VÂN QUAN") & Rear gate ("THIÊN HẠ ĐỆ NHẤT HÙNG QUAN")
    citadelGate(6.8, 'HẢI VÂN QUAN', false);
    citadelGate(-6.8, 'ĐỆ NHẤT HÙNG QUAN', true);

    // Connecting thick stone-and-brick fortress side walls & stepped stairs up to battlements
    for (const s of [-1, 1]) {
      box(stone, s * 6.85, 2.45, 0, 1.85, 4.0, 11.4);
      box(mortar, s * 6.85, 4.55, 0, 2.05, 0.22, 11.6);
      for (let i = -3; i <= 3; i++) box(brick[Math.abs(i) % 4], s * 7.55, 5.1, i * 1.55, 0.48, 0.88, 0.86);
      // Outer mountain wing ramparts extending sideways
      box(stone, s * 10.2, 1.95, 2.5, 5.4, 3.1, 1.85, -s * 0.28);
      for (let j = 0; j < 4; j++) box(moss, s * (8.4 + j * 1.25), 3.85, 2.5 + j * 0.35, 0.72, 0.72, 0.55, -s * 0.28);
    }
    // Inner stone staircases leading to top of front gatehouse
    for (let st = 0; st < 11; st++) {
      box(stone, -4.6, 0.7 + st * 0.44, 3.8 - st * 0.46, 1.55, 0.44, 0.52);
    }
    // Historic watch bastion & cannon mount inside courtyard
    box(dark, 3.6, 1.05, 0.5, 3.2, 1.2, 2.6);
    box(0x3a3b39, 3.6, 1.88, 0.8, 0.36, 0.36, 2.45, 0, -0.15);
  }

  // 3. Chùa Linh Ứng Bãi Bụt – Bán đảo Sơn Trà (Đà Nẵng)
  function chuaLinhUng(T, kit) {
    const {box, stamp, round, tapered, sign} = kit;
    const marble = 0xebe8e0, pureWhite = 0xf4f2ec, lotusPink = 0xe4c7bf, gold = 0xd6b052;
    const tile = 0x9b4432, stone = 0x9e9a90, jade = 0x5c7f6f;

    // Coastal stone terrace platform (with deep base for hillside)
    box(stone, 0, -1.2, 0, 31, 3.0, 29);
    box(marble, 0, 0.45, 0, 29.5, 0.36, 27.5);

    // Monumental 17-metre-style Lotus Pedestal & White Guan Yin Sanctuary Spire (right-center)
    const gx = 4.5, gz = -2.2;
    tapered(marble, gx, 1.35, gz, 6.2, 5.6, 1.65, 1, 8);
    tapered(pureWhite, gx, 3.45, gz, 5.1, 4.75, 2.65, 1, 8);
    // Ornamental entrance arch at pedestal base
    box(gold, gx, 2.95, gz + 4.82, 2.6, 2.75, 0.32);
    box(0x523428, gx, 2.65, gz + 4.98, 1.75, 2.15, 0.14);
    // Multi-layered carved pink-and-white lotus blossom crown
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      box(lotusPink, gx + Math.sin(a) * 4.4, 5.45, gz + Math.cos(a) * 4.4, 1.95, 1.75, 0.45, a, 0.36);
      box(pureWhite, gx + Math.sin(a + 0.26) * 3.85, 6.15, gz + Math.cos(a + 0.26) * 3.85, 1.65, 1.45, 0.38, a + 0.26, 0.24);
    }
    // Graceful sculpted white Quan Âm monument silhouette rising above the lotus pedestal
    tapered(pureWhite, gx, 9.8, gz, 2.85, 1.85, 6.6, 1, 16);
    tapered(pureWhite, gx, 14.8, gz, 1.85, 1.45, 3.6, 1, 16);
    tapered(pureWhite, gx, 17.8, gz, 1.55, 2.15, 2.6, 0.76, 16); // flared robe & shoulders
    // Draped arms holding nectar vase & gesture
    for (const s of [-1, 1]) {
      stamp(round, pureWhite, gx + s * 1.55, 16.9, gz + 0.35, 0.65, 2.8, 0.72, 0, 0.25, s * 0.28);
    }
    stamp(round, marble, gx - 0.55, 16.3, gz + 1.35, 0.42, 0.85, 0.42);
    // Neck, draped veil mantle & serene crown
    tapered(marble, gx, 19.6, gz, 0.95, 0.78, 1.15, 1, 12);
    const head = new T.SphereGeometry(1.05, 14, 12);
    stamp(head, pureWhite, gx, 21.1, gz + 0.08, 0.92, 1.12, 0.94);
    head.dispose();
    tapered(pureWhite, gx, 22.35, gz, 0.95, 0.52, 1.2, 1, 12);
    // Flowing outer veil behind shoulders
    box(marble, gx, 19.6, gz - 0.75, 2.6, 4.8, 0.55);
    const halo = new T.TorusGeometry(2.15, 0.14, 8, 24);
    stamp(halo, gold, gx, 21.5, gz - 1.05, 1, 1, 1);
    halo.dispose();

    // 9-story octagonal Xá Lợi Stupa (Tháp Xá Lợi) on the left (-X)
    const sx = -8.5, sz = -3.8;
    tapered(stone, sx, 1.15, sz, 4.4, 4.1, 1.25, 1, 8);
    let sy = 1.75;
    for (let tier = 0; tier < 9; tier++) {
      const r = 3.25 - tier * 0.22, h = 1.78 - tier * 0.05;
      tapered(marble, sx, sy + h * 0.45, sz, r, r * 0.96, h * 0.85, 1, 8);
      for (let f = 0; f < 4; f++) {
        const a = f * Math.PI / 2;
        box(0x56392c, sx + Math.sin(a) * (r * 0.95), sy + h * 0.44, sz + Math.cos(a) * (r * 0.95), r * 0.34, h * 0.55, 0.1, a);
      }
      tapered(tile, sx, sy + h * 0.92, sz, r * 1.28, r * 0.88, h * 0.28, 1, 8);
      sy += h;
    }
    tapered(gold, sx, sy + 1.15, sz, 0.52, 0.06, 2.25, 1, 8);

    // Coastal Tam Quan Entrance Gate facing +Z
    for (const dx of [-5.8, -2.1, 2.1, 5.8]) {
      box(marble, dx, 2.65, 10.6, 0.86, 4.1, 0.86);
      box(gold, dx, 4.82, 10.6, 1.05, 0.22, 1.05);
    }
    box(marble, 0, 4.75, 10.6, 12.6, 0.82, 1.45);
    sign('CHÙA LINH ỨNG', 0, 4.82, 11.38, 4.2, 0.62);
    curvedRoof(T, kit, 0, 5.25, 10.6, 14.2, 3.6, 1.35, jade, gold, gold, 0.34);
    curvedRoof(T, kit, 0, 6.95, 10.6, 7.6, 2.8, 1.15, jade, gold, gold, 0.28);
  }

  // 4. Hội quán Phúc Kiến – Hội An (Đà Nẵng / Quảng Nam cũ)
  function hoiQuanPhucKien(T, kit) {
    const {box, stamp, outline, profile, round, sign} = kit;
    const coral = 0xd67c6a, rose = 0xc25f52, cream = 0xefe3c8, crimson = 0x8f2822;
    const jadeTile = 0x3b6e58, gold = 0xd9b04a, stone = 0x9b9589;

    // Ancient Hoi An stone threshold & approach steps
    box(stone, 0, 0.16, 0, 18.8, 0.32, 6.2);
    for (let s = 0; s < 2; s++) box(0xb4ad9f, 0, 0.09 + s * 0.09, 3.4 - s * 0.35, 8.2, 0.12, 0.42);

    function archedSpan(cx, w, h, r, sy, d) {
      const sh = new T.Shape();
      sh.moveTo(-w / 2, 0); sh.lineTo(-r, 0); sh.lineTo(-r, sy);
      sh.absarc(0, sy, r, Math.PI, 0, true);
      sh.lineTo(r, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.closePath();
      profile(sh, coral, cx, 0.32, -d / 2, d);
      for (const f of [-1, 1]) {
        const fz = f * (d / 2 + 0.03);
        for (let i = 0; i < 11; i++) {
          const a = i * Math.PI / 11, b = (i + 1) * Math.PI / 11 - 0.012, pt = (q, t) => [q * Math.cos(t), q * Math.sin(t)];
          outline([pt(r, a), pt(r + 0.2, a), pt(r + 0.2, b), pt(r, b)], i % 2 ? cream : rose, cx, 0.32 + sy, fz - 0.04, 0.09);
        }
      }
    }

    // Triple coral-pink arches
    archedSpan(0, 5.4, 5.25, 1.72, 2.65, 2.8);
    for (const s of [-1, 1]) {
      archedSpan(s * 5.2, 4.9, 4.1, 1.15, 1.95, 2.2);
      // Ornate circular lattice window medallion above side arches
      stamp(round, cream, s * 5.2, 3.65, 1.14, 0.62, 0.1, 0.62, 0, Math.PI / 2);
      stamp(round, jadeTile, s * 5.2, 3.65, 1.18, 0.44, 0.1, 0.44, 0, Math.PI / 2);
      // Side gate double curved jade-green roofs
      curvedRoof(T, kit, s * 5.2, 4.42, 0, 5.6, 3.4, 0.92, jadeTile, cream, gold, 0.3);
      // Crimson wooden doors slightly open
      box(crimson, s * 1.48, 1.72, 0.1, 0.14, 2.75, 1.05, s * 0.26);
      // Hanging glowing red Hoi An lanterns
      const lantern = new T.SphereGeometry(0.32, 10, 8);
      stamp(lantern, 0xd83226, s * 2.9, 3.45, 1.65, 0.88, 1.22, 0.88);
      stamp(lantern, 0xd83226, s * 7.2, 2.85, 1.42, 0.78, 1.12, 0.78);
      lantern.dispose();
    }

    // Center upper 2nd & 3rd ornate tiers with crimson-and-gold plaque
    box(cream, 0, 5.62, 0, 5.8, 0.26, 3.2);
    box(crimson, 0, 4.88, 1.46, 3.6, 0.78, 0.14);
    sign('HỘI QUÁN PHÚC KIẾN', 0, 4.88, 1.55, 3.35, 0.54);
    curvedRoof(T, kit, 0, 5.75, 0, 7.2, 4.4, 1.12, jadeTile, cream, gold, 0.34);

    // Upper pavilion attic with ornate pink/gold relief panels
    box(rose, 0, 7.25, 0, 4.4, 1.45, 2.45);
    for (const dx of [-1.4, 0, 1.4]) box(gold, dx, 7.25, 1.26, 0.65, 0.95, 0.08);
    curvedRoof(T, kit, 0, 7.95, 0, 5.8, 3.6, 1.18, jadeTile, cream, gold, 0.3);

    // Ornate roof crest (Lưỡng long tranh châu)
    for (const s of [-1, 1]) {
      outline([[-0.85, 0], [-0.45, 0.28], [-0.1, 0.2], [0.1, 0.62], [0.32, 0.44], [0.44, 0.15], [0.05, 0]],
        gold, s * 0.92, 9.2, -0.09, 0.18, s > 0 ? Math.PI : 0);
    }
    const orb = new T.SphereGeometry(0.28, 10, 8);
    stamp(orb, gold, 0, 9.75, 0, 1, 1, 0.5);
    orb.dispose();
  }

  // 5. Thánh địa Mỹ Sơn (Duy Xuyên, Đà Nẵng / Quảng Nam cũ) — Cham Kalan + Boat-roof B5
  function thanhDiaMySon(T, {box, outline, tapered, random}) {
    const brick = [0xa45238, 0x944831, 0xb05c40, 0x85422f];
    const sandstone = 0xb5a68e, moss = 0x5c6844, dark = 0x3b2821, earth = 0x9e8c73;

    // Low sandstone-paved sanctuary terrace & ruined enclosure wall
    box(earth, 0, 0.14, 0.5, 25.5, 0.28, 21.5);
    for (const [wx, wz, ww, wd] of [[-8.2, 10.2, 8.2, 0.68], [8.2, 10.2, 8.2, 0.68], [-12.2, 0.5, 0.68, 19.8], [12.2, 0.5, 0.68, 19.8], [0, -9.6, 25.0, 0.68]]) {
      box(brick[1], wx, 0.72, wz, ww, 1.05, wd);
    }

    // Main Cham Kalan Tower (Tháp C1 / B1 style)
    function kalan(cx, cz, w, h) {
      // Stepped sandstone & brick plinth
      for (let j = 0; j < 3; j++) box(j === 1 ? sandstone : brick[0], cx, 0.35 + j * 0.34, cz, w + 1.4 - j * 0.35, 0.34, w + 1.4 - j * 0.35);
      // Main tower body with rhythmic recessed pilasters
      box(brick[0], cx, 1.2 + h * 0.28, cz, w, h * 0.56, w);
      for (let face = 0; face < 4; face++) {
        const a = face * Math.PI / 2, s = Math.sin(a), c = Math.cos(a);
        for (const t of [-0.42, -0.26, 0.26, 0.42]) {
          box(brick[2], cx + c * w * t + s * w * 0.5, 1.2 + h * 0.28, cz - s * w * t + c * w * 0.5, w * 0.09, h * 0.52, 0.34, a);
        }
        // Iconic flame-shaped Cham Kala tympanum arch (vòm cửa lửa)
        const d = w * 0.51, dw = w * 0.26, dh = h * 0.31;
        outline([[-dw, 0], [-dw, dh * 0.68], [-dw * 0.5, dh * 0.96], [0, dh * 1.42], [dw * 0.5, dh * 0.96], [dw, dh * 0.68], [dw, 0]],
          brick[3], cx + s * d, 1.25, cz + c * d, 0.38, a);
        outline([[-dw * 0.62, 0], [-dw * 0.62, dh * 0.64], [0, dh * 1.04], [dw * 0.62, dh * 0.64], [dw * 0.62, 0]],
          face === 0 ? dark : brick[1], cx + s * (d + 0.32), 1.25, cz + c * (d + 0.32), 0.14, a);
      }
      // Front vestibule (tiền sảnh) with open dark portal & sandstone steps
      box(brick[2], cx, 3.05, cz + w * 0.64, w * 0.54, 3.65, w * 0.36);
      box(dark, cx, 2.45, cz + w * 0.83, w * 0.24, 2.55, 0.12);
      box(sandstone, cx, 3.82, cz + w * 0.84, w * 0.34, 0.22, 0.16);
      for (let st = 0; st < 4; st++) box(sandstone, cx, 0.36 + st * 0.24, cz + w * 0.92 + (3 - st) * 0.36, w * 0.36, 0.24, 0.42);
      // 3 diminishing upper false-roof tiers with miniature corner turrets
      let ty = 1.2 + h * 0.56;
      for (let tier = 0; tier < 3; tier++) {
        const tw = w * (0.86 - tier * 0.19), th = h * (0.14 - tier * 0.02);
        box(brick[tier % 3], cx, ty + th * 0.5, cz, tw, th, tw);
        box(brick[3], cx, ty + th, cz, tw * 1.08, 0.26, tw * 1.08);
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
          tapered(sandstone, cx + dx * tw * 0.46, ty + th * 0.72, cz + dz * tw * 0.46, 0.42, 0.14, 1.05, 1, 4);
        }
        ty += th + 0.18;
      }
      tapered(sandstone, cx, ty + 0.95, cz, w * 0.18, 0.12, 1.9, 1, 4);
      // Moss & weathered vegetation tufts on upper ledges
      for (let i = 0; i < 18; i++) {
        box(moss, cx + (random() - 0.5) * w * 0.7, ty - random() * 2.5, cz + (random() - 0.5) * w * 0.7, 0.45, 0.26, 0.45, random());
      }
    }
    kalan(0, -2.0, 6.8, 15.2);

    // Tháp B5 (Kosagraha — famous boat-shaped saddle roof) to the right
    const bx = 8.4, bz = 2.6;
    box(sandstone, bx, 0.48, bz, 5.4, 0.68, 7.6);
    box(brick[0], bx, 2.75, bz, 4.6, 3.85, 6.8);
    // Boat-shaped curved roof (mái hình thuyền yên ngựa)
    const boat = [[-2.75, 0], [-2.55, 1.65], [-1.7, 2.95], [0, 3.85], [1.7, 2.95], [2.55, 1.65], [2.75, 0]];
    outline(boat, brick[2], bx, 4.65, bz - 3.65, 7.3);
    // Sweeping flared boat-prow gable ends
    for (const s of [-1, 1]) {
      outline([[-2.95, 0], [-2.35, 2.3], [0, 4.45], [2.35, 2.3], [2.95, 0]], brick[3], bx, 4.65, bz + s * 3.55, 0.36);
    }
    box(dark, bx - 2.32, 2.35, bz, 0.16, 2.55, 1.45);

    // Secondary ruined Gate Tower (Gopura) to the left
    kalan(-8.4, 3.2, 4.6, 9.6);
  }

  (window.VietnamSights ??= []).push({
    id: 'cau-rong', name: 'Cầu Rồng', city: 'Đà Nẵng', province: 'Đà Nẵng', region: 'Trung Bộ',
    lon: 108.22923, lat: 16.06122, start: [108.227901, 16.061095], yaw: 0.034, viewAngle: 0.52, viewElevation: 0.20,
    width: 135, depth: 32, viewDistance: 1400,
    solids: [[-90, 0, 145, 1.4]],
    description: 'Cây cầu biểu tượng của Đà Nẵng bắc qua sông Hàn với thân thép vàng uốn lượn năm nhịp mô phỏng rồng thời Lý, đầu hướng ra biển Đông.',
    photo: 'https://danangfantasticity.com/en/attractions/dragon-bridge',
    source: 'https://vi.wikipedia.org/wiki/C%E1%BA%A7u_R%E1%BB%93ng',
    map: 'https://www.openstreetmap.org/way/694831926',
    build: cauRong
  }, {
    id: 'hai-van-quan', name: 'Hải Vân Quan', city: 'Đèo Hải Vân', province: 'Đà Nẵng', region: 'Trung Bộ',
    lon: 108.13060, lat: 16.18820, start: [108.130946, 16.188057], yaw: 1.166, width: 28, depth: 24,
    solids: [[-4.5, 6.8, 2.2, 2.4], [4.5, 6.8, 2.2, 2.4], [-4.5, -6.8, 2.2, 2.4], [4.5, -6.8, 2.2, 2.4], [-6.85, 0, 1.0, 5.7], [6.85, 0, 1.0, 5.7]],
    description: 'Cụm pháo đài cửa ải xây năm 1826 trên đỉnh đèo Hải Vân với hai cổng vòm gạch đá mang biển Hải Vân Quan và Thiên hạ đệ nhất hùng quan.',
    photo: 'https://vnexpress.net/hai-van-quan-sau-gan-3-nam-trung-tu-4775142.html',
    source: 'https://vi.wikipedia.org/wiki/H%E1%BA%A3i_V%C3%A2n_Quan',
    map: 'https://www.openstreetmap.org/?mlat=16.1882&mlon=108.1306#map=18/16.1882/108.1306',
    build: haiVanQuan
  }, {
    id: 'chua-linh-ung-son-tra', name: 'Chùa Linh Ứng Bãi Bụt', city: 'Sơn Trà', province: 'Đà Nẵng', region: 'Trung Bộ',
    lon: 108.277016, lat: 16.099686, start: [108.277460, 16.098590], yaw: 0.372, width: 34, depth: 32, viewElevation: 0.22,
    solids: [[4.5, -2.2, 5.5, 5.5], [-8.5, -3.8, 4.1, 4.1], [-5.8, 10.6, 0.7, 0.7], [5.8, 10.6, 0.7, 0.7]],
    description: 'Quần thể chùa ven biển trên bán đảo Sơn Trà nổi bật với đài sen trắng, tượng Quan Âm hướng vịnh Đà Nẵng, tháp Xá Lợi chín tầng và tam quan.',
    photo: 'https://danangfantasticity.com/en/culture-en/linh-ung-pagoda-on-son-tra-peninsula',
    source: 'https://vi.wikipedia.org/wiki/Ch%C3%B9a_Linh_%E1%BB%A8ng_(B%C3%A3i_B%E1%BB%A5t)',
    map: 'https://www.openstreetmap.org/way/420947244',
    build: chuaLinhUng
  }, {
    id: 'hoi-quan-phuc-kien', name: 'Hội quán Phúc Kiến', city: 'Hội An', province: 'Đà Nẵng', region: 'Trung Bộ', formerProvince: 'Quảng Nam',
    lon: 108.32930, lat: 15.87748, start: [108.329365, 15.877176], yaw: 0.19, width: 20, depth: 10,
    solids: [[-7.2, 0, 1.4, 1.5], [-3.4, 0, 0.7, 1.8], [3.4, 0, 0.7, 1.8], [7.2, 0, 1.4, 1.5]],
    description: 'Cổng tam quan hồng son ba tầng mái ngói ống men xanh, đèn lồng đỏ và lưỡng long tranh châu nổi bật giữa phố cổ Hội An.',
    photo: 'https://vinwonders.com/vi/wonderpedia/news/hoi-quan-phuc-kien-hoi-an/',
    source: 'https://vi.wikipedia.org/wiki/H%E1%BB%99i_qu%C3%A1n_Ph%C3%BAc_Ki%E1%BA%BFn',
    map: 'https://www.openstreetmap.org/?mlat=15.87748&mlon=108.3293#map=19/15.87748/108.3293',
    build: hoiQuanPhucKien
  });
})();
