import * as THREE from "three";
import { buildLathe, profileFor } from "./mesh";
import type { MeshName } from "./mesh";

export const PROFILE_STEPS = 48;
export const LATHE_SEGMENTS = 96;

export interface SceneBundle {
  scene: THREE.Scene;
  subject: THREE.Mesh;
  backdrop: THREE.Mesh;
  floor: THREE.Mesh;
  light: THREE.DirectionalLight;
  geometries: Record<MeshName, THREE.BufferGeometry>;
  setMesh(name: MeshName): void;
  dispose(): void;
}

/**
 * Mütevazı sahne: tek özne, arkada bir pano, altında bir zemin.
 * Pano ve zemin `MeshBasicMaterial` — aydınlatmaya girmiyorlar ki üç materyalin
 * draw call farkı YALNIZCA `transmission`'ın ikinci geçişinden gelsin.
 */
export function buildScene(): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);

  const geometries: Record<MeshName, THREE.BufferGeometry> = {
    candle: buildLathe(profileFor("candle", PROFILE_STEPS), LATHE_SEGMENTS),
    blob: buildLathe(profileFor("blob", PROFILE_STEPS), LATHE_SEGMENTS),
  };

  const subject = new THREE.Mesh(
    geometries.candle,
    new THREE.MeshBasicMaterial(),
  );
  subject.name = "subject";
  scene.add(subject);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3.4),
    new THREE.MeshBasicMaterial({ color: 0x1a1d24 }),
  );
  backdrop.position.set(0, 0.4, -1.6);
  scene.add(backdrop);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ color: 0x14161c }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.02;
  scene.add(floor);

  // Yalnız MeshPhysicalMaterial yolu için. Elle yazdığımız materyal aynı yönü
  // `uLightDirection` uniform'u olarak görüyor.
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(0, 0, 5);
  scene.add(light);
  scene.add(light.target);

  return {
    scene,
    subject,
    backdrop,
    floor,
    light,
    geometries,
    setMesh(name) {
      subject.geometry = geometries[name];
    },
    dispose() {
      for (const geometry of Object.values(geometries)) geometry.dispose();
      backdrop.geometry.dispose();
      (backdrop.material as THREE.Material).dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
    },
  };
}
