"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DistrictId } from "@/lib/contracts/ui";
import { cx } from "@/components/ui";
import { AtlasSketch } from "./AtlasSketch";
import { useCityCopy } from "./use-city-copy";
import type { CitySceneHandle } from "./city-scene-engine";
import styles from "./city-scene.module.css";

export interface CitySceneProps {
  readonly districtIds: readonly DistrictId[];
  readonly selectedDistrictId: DistrictId | null;
  readonly onSelectDistrict: (districtId: DistrictId) => void;
}

/** 3D только на достаточно мощном устройстве с WebGL и шириной от 900 px. */
let capability: boolean | null = null;
function canRender3D(): boolean {
  if (capability !== null) return capability;
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const weak =
      (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
      (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) ||
      nav.connection?.saveData === true;
    const wide = window.matchMedia("(min-width: 900px)").matches;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    capability = !weak && wide && gl !== null;
  } catch {
    capability = false;
  }
  return capability;
}
const noopSubscribe = () => () => {};
const serverCapability = () => false;

type SceneStatus = "loading" | "ready" | "failed";

/**
 * Схематичная 3D-миниатюра. Пока сцена грузится, при ошибке, без WebGL,
 * на узком экране или слабом устройстве показывается статичная схема.
 * Выбор района доступен и обычными кнопками в разделе «Районы».
 */
export function CityScene({ districtIds, selectedDistrictId, onSelectDistrict }: CitySceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CitySceneHandle | null>(null);
  const onSelectRef = useRef(onSelectDistrict);
  const selectedRef = useRef(selectedDistrictId);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const { copy } = useCityCopy();
  const enabled = useSyncExternalStore(noopSubscribe, canRender3D, serverCapability);
  const idsKey = districtIds.join("|");

  useEffect(() => {
    onSelectRef.current = onSelectDistrict;
    selectedRef.current = selectedDistrictId;
  });

  useEffect(() => {
    if (!enabled) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: CitySceneHandle | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("./city-scene-engine")
      .then(({ createCityScene }) => {
        if (cancelled) return;
        engine = createCityScene(host, {
          districtIds: idsKey ? idsKey.split("|") : [],
          selectedDistrictId: selectedRef.current,
          reducedMotion,
          onSelectDistrict: (id) => onSelectRef.current(id),
          onFailure: () => {
            engine?.dispose();
            engine = null;
            engineRef.current = null;
            setStatus("failed");
          },
        });
        engineRef.current = engine;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    // Тема меняется атрибутом data-theme на <html>
    const themeObserver = new MutationObserver(() => engineRef.current?.refreshPalette());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelled = true;
      themeObserver.disconnect();
      engine?.dispose();
      engineRef.current = null;
    };
  }, [enabled, idsKey]);

  useEffect(() => {
    engineRef.current?.setSelected(selectedDistrictId);
  }, [selectedDistrictId, status]);

  const showScene = enabled && status === "ready";

  return (
    <figure className={styles.scene}>
      <div className={styles.stage}>
        <div ref={hostRef} className={cx(styles.canvasHost, showScene && styles.canvasVisible)} />
        <div className={cx(styles.fallback, showScene && styles.fallbackHidden)} aria-hidden="true">
          <AtlasSketch />
        </div>
      </div>
      {/* Подпись постоянная: смена текста при загрузке сцены сдвигала блок ниже */}
      <figcaption className={styles.caption}>
        {copy.sceneCaption}
      </figcaption>
    </figure>
  );
}
