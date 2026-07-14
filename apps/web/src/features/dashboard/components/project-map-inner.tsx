'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, GraduationCap, Home, MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, Polygon, Popup, TileLayer, ZoomControl } from 'react-leaflet';

/**
 * Client-only Leaflet map with OSM tiles.
 * Loaded dynamically from ProjectMapCard so it doesn't run during SSR
 * (Leaflet requires window/document).
 */

// Chirchiq shahri approximate center
const CHIRCHIQ_CENTER: [number, number] = [41.4691, 69.5827];

// Rough mahalla boundaries (test-mode polygons around Chirchiq)
const KIMYOGAR_POLY: [number, number][] = [
  [41.478, 69.564],
  [41.482, 69.582],
  [41.474, 69.594],
  [41.466, 69.586],
  [41.468, 69.568],
];

const ABAY_POLY: [number, number][] = [
  [41.462, 69.594],
  [41.466, 69.606],
  [41.458, 69.616],
  [41.452, 69.604],
  [41.456, 69.594],
];

interface Marker {
  id: string;
  pos: [number, number];
  type: 'school' | 'kg' | 'univ' | 'mahalla-primary' | 'mahalla-danger';
  label: string;
}

const MARKERS: Marker[] = [
  // Schools scattered across Chirchiq
  { id: 's1',  pos: [41.4712, 69.5750], type: 'school', label: '1-son maktab' },
  { id: 's2',  pos: [41.4735, 69.5798], type: 'school', label: '2-son maktab' },
  { id: 's3',  pos: [41.4680, 69.5810], type: 'school', label: '5-son maktab' },
  { id: 's4',  pos: [41.4665, 69.5745], type: 'school', label: '8-son maktab' },
  { id: 's5',  pos: [41.4750, 69.5860], type: 'school', label: '12-son maktab' },
  { id: 's6',  pos: [41.4620, 69.5790], type: 'school', label: '15-son maktab' },
  { id: 's7',  pos: [41.4650, 69.5890], type: 'school', label: '17-son maktab' },
  { id: 's8',  pos: [41.4790, 69.5820], type: 'school', label: '19-son maktab' },
  { id: 's9',  pos: [41.4700, 69.5920], type: 'school', label: '22-son maktab' },
  { id: 's10', pos: [41.4595, 69.5850], type: 'school', label: '25-son maktab' },
  { id: 's11', pos: [41.4640, 69.5680], type: 'school', label: '27-son maktab' },
  { id: 's12', pos: [41.4805, 69.5900], type: 'school', label: '30-son maktab' },
  { id: 's13', pos: [41.4720, 69.5680], type: 'school', label: '31-son maktab' },
  { id: 's14', pos: [41.4670, 69.5960], type: 'school', label: '34-son maktab' },
  { id: 's15', pos: [41.4770, 69.5720], type: 'school', label: '38-son maktab' },

  { id: 'kg1',   pos: [41.4762, 69.5880], type: 'kg',              label: "12-son bog'cha" },
  { id: 'univ1', pos: [41.4700, 69.5810], type: 'univ',            label: 'ChDPU' },
  { id: 'mah1',  pos: [41.4735, 69.5780], type: 'mahalla-primary', label: 'Kimyogar mahallasi' },
  { id: 'mah2',  pos: [41.4600, 69.6050], type: 'mahalla-danger',  label: 'Abay mahallasi' },
];

const ICON_BY_TYPE = {
  school:            <Building2 className="h-3.5 w-3.5 text-white" />,
  kg:                <Home className="h-3.5 w-3.5 text-white" />,
  univ:              <GraduationCap className="h-3.5 w-3.5 text-white" />,
  'mahalla-primary': <MapPin className="h-3.5 w-3.5 text-white" />,
  'mahalla-danger':  <MapPin className="h-3.5 w-3.5 text-white" />,
} as const;

const COLOR_BY_TYPE: Record<Marker['type'], string> = {
  school:            '#16A34A',
  kg:                '#F97316',
  univ:              '#7C3AED',
  'mahalla-primary': '#16A34A',
  'mahalla-danger':  '#EF4444',
};

function buildDivIcon(type: Marker['type']): L.DivIcon {
  const bg = COLOR_BY_TYPE[type];
  const svg = renderToStaticMarkup(ICON_BY_TYPE[type]);
  return L.divIcon({
    className: 'eco-map-marker',
    html: `<span style="
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:26px;
      height:26px;
      border-radius:9999px;
      background:${bg};
      box-shadow:0 2px 6px rgba(0,0,0,.25);
      border:2px solid #fff;">${svg}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function ProjectMapInner() {
  return (
    <MapContainer
      center={CHIRCHIQ_CENTER}
      zoom={13}
      minZoom={11}
      maxZoom={17}
      scrollWheelZoom={false}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Polygon
        positions={KIMYOGAR_POLY}
        pathOptions={{
          color: '#16A34A',
          weight: 2,
          dashArray: '6 4',
          fillColor: '#16A34A',
          fillOpacity: 0.1,
        }}
      >
        <Popup>Kimyogar mahallasi (Chirchiq shahri)</Popup>
      </Polygon>

      <Polygon
        positions={ABAY_POLY}
        pathOptions={{
          color: '#EF4444',
          weight: 2,
          dashArray: '6 4',
          fillColor: '#EF4444',
          fillOpacity: 0.08,
        }}
      >
        <Popup>Abay mahallasi (Bektemir tumani)</Popup>
      </Polygon>

      {MARKERS.map((m) => (
        <Marker key={m.id} position={m.pos} icon={buildDivIcon(m.type)}>
          <Popup>{m.label}</Popup>
        </Marker>
      ))}

      <ZoomControl position="bottomright" />
    </MapContainer>
  );
}
