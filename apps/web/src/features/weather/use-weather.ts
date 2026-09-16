'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Chirchiq (41.47°N, 69.58°E) uchun Open-Meteo API'dan real vaqtdagi ob-havo.
 * API bepul va API key talab qilmaydi — https://open-meteo.com
 */

export interface WeatherNow {
  temperatureC: number;
  weatherCode: number;
  isDay: boolean;
  windKph: number;
  humidity: number;
}

// Weather code → label uz — WMO code mapping (qisqartirilgan asosiy holatlar)
const WMO_LABELS_UZ: Record<number, string> = {
  0: 'Ochiq havo',
  1: 'Yaxshi',
  2: 'Qisman bulutli',
  3: 'Bulutli',
  45: 'Tumanli',
  48: 'Tumanli (muzli)',
  51: "Yengil yomg'ir",
  53: "Yomg'ir",
  55: "Kuchli yomg'ir",
  61: "Yomg'ir",
  63: "Yomg'ir",
  65: "Kuchli yomg'ir",
  71: 'Qor',
  73: 'Qor',
  75: 'Qor (kuchli)',
  77: 'Qor donalari',
  80: "Yomg'ir jala",
  81: "Kuchli jala",
  82: "Juda kuchli jala",
  95: "Momoqaldiroqli yomg'ir",
  96: 'Momoqaldiroq (do‘l bilan)',
  99: 'Kuchli momoqaldiroq',
};

export function weatherLabelUz(code: number): string {
  return WMO_LABELS_UZ[code] ?? 'Ma’lumot yo‘q';
}

const CHIRCHIQ_LAT = 41.47;
const CHIRCHIQ_LON = 69.58;

async function fetchWeather(): Promise<WeatherNow> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${CHIRCHIQ_LAT}&longitude=${CHIRCHIQ_LON}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=Asia%2FTashkent`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather http ${res.status}`);
  const json = (await res.json()) as {
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      is_day: number;
      weather_code: number;
      wind_speed_10m: number;
    };
  };
  const c = json.current;
  return {
    temperatureC: c.temperature_2m,
    weatherCode: c.weather_code,
    isDay: c.is_day === 1,
    windKph: c.wind_speed_10m,
    humidity: c.relative_humidity_2m,
  };
}

export function useChirchiqWeather() {
  return useQuery({
    queryKey: ['weather', 'chirchiq'],
    queryFn: fetchWeather,
    // Ob-havo tez o'zgarmaydi — 10 daqiqada bir yangilaymiz
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
