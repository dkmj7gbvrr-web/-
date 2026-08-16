import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { useEffect } from "react";
import type { PokefutaEntry } from "../types";

const JAPAN_CENTER: [number, number] = [36.2048, 138.2529];

function makeIcon(visited: boolean) {
  const color = visited ? "#2e7d32" : "#c62828";
  return L.divIcon({
    className: "pokefuta-marker-icon",
    html: `<span class="pokefuta-marker-dot" style="background:${color}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

const visitedIcon = makeIcon(true);
const unvisitedIcon = makeIcon(false);

function FlyToFocus({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, Math.max(map.getZoom(), 12), { duration: 0.6 });
    }
  }, [target, map]);
  return null;
}

function ClickToPick({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface MapViewProps {
  entries: PokefutaEntry[];
  focusTarget: [number, number] | null;
  onToggleVisited: (id: string) => void;
  onEdit: (entry: PokefutaEntry) => void;
  onDateChange: (id: string, date: string) => void;
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
}

export function MapView({
  entries,
  focusTarget,
  onToggleVisited,
  onEdit,
  onDateChange,
  pickMode,
  onPick,
}: MapViewProps) {
  return (
    <MapContainer
      center={JAPAN_CENTER}
      zoom={6}
      className="map-container"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToFocus target={focusTarget} />
      {pickMode && <ClickToPick onPick={onPick} />}
      <MarkerClusterGroup chunkedLoading>
        {entries.map((entry) => (
          <Marker
            key={entry.id}
            position={[entry.lat, entry.lng]}
            icon={entry.visit.visited ? visitedIcon : unvisitedIcon}
          >
            <Popup>
              <div className="popup-content">
                <strong>{entry.name}</strong>
                <div className="popup-sub">
                  {entry.prefecture} {entry.city}
                </div>
                {entry.pokemons.length > 0 && (
                  <div className="popup-pokemons">{entry.pokemons.join(" / ")}</div>
                )}
                {!entry.verified && (
                  <div className="popup-unverified">⚠ 情報未確認(目安の座標です)</div>
                )}
                <label className="popup-visited-toggle">
                  <input
                    type="checkbox"
                    checked={entry.visit.visited}
                    onChange={() => onToggleVisited(entry.id)}
                  />
                  訪問済み
                </label>
                {entry.visit.visited && (
                  <input
                    type="date"
                    value={entry.visit.visitedDate ?? ""}
                    onChange={(e) => onDateChange(entry.id, e.target.value)}
                    className="popup-date-input"
                  />
                )}
                <button className="popup-edit-btn" onClick={() => onEdit(entry)}>
                  編集
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
