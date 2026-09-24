"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type * as THREE from "three";

export type ModelViewerHandle = {
  /** いまの表示を PNG 画像にする (読み込み前は null) */
  capture: () => Promise<Blob | null>;
  /** 向きを 90° 変える (Z 軸が上のデータと Y 軸が上のデータの違いを直す) */
  rotate: () => void;
  /** モデル全体が見える視点に戻す */
  resetView: () => void;
};

type Props = {
  /** モデルファイルの URL (期限付き)。null の間は読み込み中の表示 */
  url: string | null;
  /** STL / OBJ / 3MF */
  format: string;
  className?: string;
};

type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  object: THREE.Object3D | null;
  fit: () => void;
};

/** ブラウザで 3D モデル (STL / OBJ / 3MF) を回転・拡大して確認するビューア (three.js) */
export const ModelViewer = forwardRef<ModelViewerHandle, Props>(function ModelViewer({ url, format, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    capture: () =>
      new Promise((resolve) => {
        const s = stage.current;
        if (!s?.object) return resolve(null);
        s.renderer.render(s.scene, s.camera);
        s.renderer.domElement.toBlob((blob) => resolve(blob), "image/png");
      }),
    rotate: () => {
      const s = stage.current;
      if (!s?.object) return;
      s.object.rotateX(-Math.PI / 2);
      s.fit();
    },
    resetView: () => stage.current?.fit(),
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !url) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    setStatus("loading");
    setError(null);

    (async () => {
      const three = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (disposed) return;

      // preserveDrawingBuffer: 表示中の画像を toBlob で保存できるようにする
      const renderer = new three.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.setClearColor(0xf6f1ea, 1);
      host.appendChild(renderer.domElement);

      const scene = new three.Scene();
      scene.add(new three.HemisphereLight(0xffffff, 0xb9a38c, 1.6));
      const key = new three.DirectionalLight(0xffffff, 1.8);
      key.position.set(1, 2, 1.5);
      scene.add(key);
      const rim = new three.DirectionalLight(0xffffff, 0.6);
      rim.position.set(-1.5, 0.5, -1);
      scene.add(rim);

      const camera = new three.PerspectiveCamera(40, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      let grid: THREE.GridHelper | null = null;

      const s: Stage = { renderer, scene, camera, object: null, fit: () => {} };
      // モデルを床の中央に置き、全体が収まる距離にカメラを置く
      s.fit = () => {
        const obj = s.object;
        if (!obj) return;
        obj.position.set(0, 0, 0);
        obj.updateMatrixWorld(true);
        const box = new three.Box3().setFromObject(obj);
        const size = box.getSize(new three.Vector3());
        const center = box.getCenter(new three.Vector3());
        obj.position.set(-center.x, -box.min.y, -center.z);

        const radius = Math.max(size.x, size.y, size.z) || 1;
        const distance = (radius / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.8;
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.position.set(distance * 0.7, size.y / 2 + distance * 0.55, distance);
        camera.updateProjectionMatrix();
        controls.target.set(0, size.y / 2, 0);
        controls.update();

        if (grid) {
          scene.remove(grid);
          grid.dispose();
        }
        grid = new three.GridHelper(radius * 2, 20, 0xc9b8a6, 0xe3d8cc);
        scene.add(grid);
      };
      stage.current = s;

      const resize = new ResizeObserver(() => {
        const w = host.clientWidth;
        const h = Math.max(host.clientHeight, 1);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      resize.observe(host);
      renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
      });

      cleanup = () => {
        resize.disconnect();
        renderer.setAnimationLoop(null);
        controls.dispose();
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          materials.forEach((m) => m.dispose());
        });
        renderer.dispose();
        renderer.domElement.remove();
        stage.current = null;
      };

      const res = await fetch(url);
      if (!res.ok) throw new Error(`モデルファイルを取得できませんでした (${res.status})`);
      const material = new three.MeshStandardMaterial({ color: 0xc08a58, roughness: 0.55, metalness: 0.05 });
      let object: THREE.Object3D;
      switch (format.toUpperCase()) {
        case "STL": {
          const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
          const geometry = new STLLoader().parse(await res.arrayBuffer());
          geometry.computeVertexNormals();
          object = new three.Mesh(geometry, material);
          object.rotateX(-Math.PI / 2); // 3Dプリント用のデータは Z 軸が上
          break;
        }
        case "OBJ": {
          const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
          object = new OBJLoader().parse(await res.text());
          object.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
            mesh.material = material;
          });
          break;
        }
        case "3MF": {
          const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
          object = new ThreeMFLoader().parse(await res.arrayBuffer());
          object.rotateX(-Math.PI / 2);
          break;
        }
        default:
          throw new Error(`${format} はブラウザでプレビューできません`);
      }
      if (disposed) return;
      scene.add(object);
      s.object = object;
      s.fit();
      setStatus("ready");
    })()
      .catch((e: unknown) => {
        if (disposed) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "3Dモデルを表示できませんでした");
      })
      .finally(() => {
        if (disposed) cleanup?.();
      });

    return () => {
      disposed = true;
      cleanup?.();
      cleanup = null;
    };
  }, [url, format]);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#f6f1ea] ${className ?? ""}`}>
      <div ref={hostRef} className="absolute inset-0 touch-none" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-coffee-500 animate-pulse-soft">
          3Dモデルを読み込み中…
        </div>
      )}
      {status === "error" && (
        <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-red-700">{error}</div>
      )}
    </div>
  );
});
