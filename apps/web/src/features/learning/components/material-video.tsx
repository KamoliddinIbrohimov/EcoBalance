'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { materialsApi, type CourseMaterialDto } from '@/features/learning/api/materials-api';

/**
 * Video materialni dars sahifasining o'zida o'ynatadi. Imzolangan URL 5 daqiqada
 * eskiradi — pauzadan keyin so'rov yiqilsa, yangi URL olib shu joydan davom etadi.
 */
export function MaterialVideo({ material }: { material: CourseMaterialDto }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const resumeAt = useRef(0);
  const retries = useRef(0);

  useEffect(() => {
    let alive = true;
    materialsApi
      .signedUrl(material.id)
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [material.id]);

  async function refresh() {
    const v = ref.current;
    if (!v || retries.current >= 3) {
      setFailed(true);
      return;
    }
    retries.current += 1;
    resumeAt.current = v.currentTime;
    try {
      setSrc(await materialsApi.signedUrl(material.id));
    } catch {
      setFailed(true);
    }
  }

  if (failed) {
    return <p className="py-4 text-center text-sm text-destructive">Videoni yuklab bo‘lmadi</p>;
  }
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-black/80">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    );
  }
  return (
    <video
      ref={ref}
      src={src}
      controls
      playsInline
      preload="metadata"
      className="mx-auto max-h-[75vh] w-full rounded-xl bg-black"
      onLoadedMetadata={(e) => {
        if (resumeAt.current > 0) {
          e.currentTarget.currentTime = resumeAt.current;
          void e.currentTarget.play().catch(() => undefined);
          resumeAt.current = 0;
        }
      }}
      onPlaying={() => {
        retries.current = 0;
      }}
      onError={() => void refresh()}
    >
      <track kind="captions" />
    </video>
  );
}
