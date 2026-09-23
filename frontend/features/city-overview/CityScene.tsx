"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DistrictId } from "@/lib/contracts/ui";
import { Button, cx } from "@/components/ui";
import { useCityCopy } from "./use-city-copy";
import type { CitySceneHandle } from "./city-scene-engine";
import styles from "./city-scene.module.css";

export interface CitySceneProps {
  readonly districtIds: readonly DistrictId[];
  readonly selectedDistrictId: DistrictId | null;
  readonly onSelectDistrict: (districtId: DistrictId) => void;
}

const WIDE_QUERY = "(min-width: 900px)";
/** Hardware hints may be privacy-limited. Let the real renderer determine support. */
function canRender3D(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return window.matchMedia(WIDE_QUERY).matches && nav.connection?.saveData !== true;
}
function subscribeCapability(onChange: () => void) {
  const media = window.matchMedia(WIDE_QUERY);
  const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
  media.addEventListener("change", onChange);
  connection?.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    connection?.removeEventListener("change", onChange);
  };
}
const serverCapability = () => false;

type SceneStatus = "loading" | "ready" | "failed";

/**
 * Схематичная 3D-миниатюра. Пока сцена грузится, при ошибке, без WebGL,
 * на узком экране или при экономии трафика показывается снимок самой модели.
 * Выбор района доступен и обычными кнопками в разделе «Районы».
 */
export function CityScene({ districtIds, selectedDistrictId, onSelectDistrict }: CitySceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CitySceneHandle | null>(null);
  const onSelectRef = useRef(onSelectDistrict);
  const selectedRef = useRef(selectedDistrictId);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const { copy } = useCityCopy();
  const automatic = useSyncExternalStore(subscribeCapability, canRender3D, serverCapability);
  const enabled = automatic || attempt > 0;
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
  }, [enabled, idsKey, attempt]);

  useEffect(() => {
    engineRef.current?.setSelected(selectedDistrictId);
  }, [selectedDistrictId, status]);

  const showScene = enabled && status === "ready";

  return (
    <figure className={styles.scene}>
      <div className={styles.stage}>
        <div ref={hostRef} className={cx(styles.canvasHost, showScene && styles.canvasVisible)} />
        <div className={cx(styles.fallback, showScene && styles.fallbackHidden)} aria-hidden="true" />
      </div>
      {/* Подпись постоянная: смена текста при загрузке сцены сдвигала блок ниже */}
      <figcaption className={styles.caption}>
        {copy.sceneCaption}
      </figcaption>
      <div className={styles.status} aria-live="polite">
        {!showScene && <>
          <p>{!enabled ? copy.scenePaused : status === "failed" ? copy.sceneFailed : copy.sceneLoading}</p>
          {(!enabled || status === "failed") && <Button variant="secondary" onClick={() => {
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}>{copy.sceneRetry}</Button>}
        </>}
      </div>
    </figure>
  );
}
