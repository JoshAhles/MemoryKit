/**
 * Minimal OBJ parser for Web Worker. Parses v, vn, f (triangles and quads).
 * Outputs positions and normals as Float32Arrays (expanded per face vertex).
 * OBJ indices are 1-based; negative = relative.
 */
self.onmessage = function (e) {
  const text = e.data;
  if (typeof text !== "string") {
    self.postMessage({ error: "Expected string" });
    return;
  }
  const lines = text.split(/\r?\n/);
  const v = [];
  const vn = [];
  const outPositions = [];
  const outNormals = [];

  function parseVertexIndex(str) {
    const n = parseInt(str, 10);
    return n < 0 ? v.length / 3 + n : n - 1;
  }
  function parseNormalIndex(str) {
    const n = parseInt(str, 10);
    return n < 0 ? vn.length / 3 + n : n - 1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trim = line.trim();
    if (!trim || trim.startsWith("#")) continue;
    const parts = trim.split(/\s+/);
    const key = parts[0];
    if (key === "v" && parts.length >= 4) {
      v.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      continue;
    }
    if (key === "vn" && parts.length >= 4) {
      vn.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      continue;
    }
    if (key === "f" && parts.length >= 4) {
      const verts = [];
      for (let j = 1; j < parts.length; j++) {
        const segs = parts[j].split("/");
        const vi = parseVertexIndex(segs[0]);
        const ni = segs.length >= 3 && segs[2] ? parseNormalIndex(segs[2]) : -1;
        verts.push({ vi, ni });
      }
      for (let t = 1; t < verts.length - 1; t++) {
        const a = verts[0], b = verts[t], c = verts[t + 1];
        for (const { vi, ni } of [a, b, c]) {
          outPositions.push(v[vi * 3], v[vi * 3 + 1], v[vi * 3 + 2]);
          if (ni >= 0) {
            outNormals.push(vn[ni * 3], vn[ni * 3 + 1], vn[ni * 3 + 2]);
          } else {
            outNormals.push(0, 0, 0);
          }
        }
      }
    }
  }

  const positions = new Float32Array(outPositions);
  const normals = new Float32Array(outNormals);
  self.postMessage(
    { positions, normals },
    [positions.buffer, normals.buffer]
  );
};
