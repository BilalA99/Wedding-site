"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Floating stitch particles: tiny elongated thread-like marks drifting in
 * shallow 3D space with gentle breathing and subtle pointer parallax.
 * Deliberately restrained — depth in service of the typography above it.
 */

interface StitchInstancesProps {
  count: number;
}

/** Deterministic PRNG — keeps render pure and the field stable across mounts. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function StitchInstances({ count }: StitchInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport, pointer } = useThree();

  const seeds = useMemo(() => {
    const rand = mulberry32(20261003);
    return new Array(count).fill(0).map(() => ({
      x: (rand() - 0.5) * 14,
      y: (rand() - 0.5) * 9,
      z: -1 - rand() * 4,
      rot: (rand() - 0.5) * Math.PI * 0.6,
      speed: 0.05 + rand() * 0.12,
      phase: rand() * Math.PI * 2,
      scale: 0.5 + rand() * 0.9,
    }));
  }, [count]);

  const colors = useMemo(() => {
    const rand = mulberry32(20261004);
    const warm = new THREE.Color("#cbb98f");
    const red = new THREE.Color("#a34a40");
    const ivory = new THREE.Color("#f7f2e9");
    const array = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = rand();
      c.copy(r < 0.72 ? warm : r < 0.86 ? red : ivory);
      c.toArray(array, i * 3);
    }
    return array;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const s = seeds[i]!;
      const breathe = 1 + Math.sin(t * 0.6 + s.phase) * 0.12;
      dummy.position.set(
        s.x + Math.sin(t * s.speed + s.phase) * 0.6,
        s.y + Math.cos(t * s.speed * 0.8 + s.phase) * 0.45,
        s.z,
      );
      dummy.rotation.set(0, 0, s.rot + Math.sin(t * 0.2 + s.phase) * 0.08);
      dummy.scale.setScalar(s.scale * breathe);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Subtle pointer parallax (no-op on touch where pointer stays at 0,0).
    const targetX = pointer.x * 0.25;
    const targetY = pointer.y * 0.15;
    mesh.rotation.y += (targetX * 0.08 - mesh.rotation.y) * 0.03;
    mesh.rotation.x += (-targetY * 0.05 - mesh.rotation.x) * 0.03;
  });

  void viewport;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <planeGeometry args={[0.018, 0.28]}>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </planeGeometry>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export default function StitchField({ particleCount }: { particleCount: number }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <StitchInstances count={particleCount} />
    </Canvas>
  );
}
