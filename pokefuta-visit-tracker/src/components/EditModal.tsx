import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Pokefuta, PokefutaEntry } from "../types";

const pickIcon = L.divIcon({
  className: "pokefuta-marker-icon",
  html: `<span class="pokefuta-marker-dot" style="background:#1565c0"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function PickerMap({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  function ClickCatcher() {
    useMapEvents({
      click(e) {
        onPick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  return (
    <MapContainer center={[lat, lng]} zoom={13} className="mini-map">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatcher />
      <Marker
        position={[lat, lng]}
        icon={pickIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const m = e.target as L.Marker;
            const pos = m.getLatLng();
            onPick(pos.lat, pos.lng);
          },
        }}
      />
    </MapContainer>
  );
}

interface EditModalProps {
  initial: PokefutaEntry | null;
  onClose: () => void;
  onSave: (entry: Pokefuta) => void;
}

function makeId(name: string) {
  const base = name.trim().toLowerCase().replace(/\s+/g, "-");
  return `custom-${base || "entry"}-${Date.now()}`;
}

export function EditModal({ initial, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [prefecture, setPrefecture] = useState(initial?.prefecture ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState(initial?.lat ?? 35.6812);
  const [lng, setLng] = useState(initial?.lng ?? 139.7671);
  const [pokemonsText, setPokemonsText] = useState(initial?.pokemons.join(", ") ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [verified, setVerified] = useState(initial?.verified ?? false);

  const isEdit = initial !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prefecture.trim()) {
      window.alert("名前と都道府県は必須です。");
      return;
    }
    const entry: Pokefuta = {
      id: initial?.id ?? makeId(name),
      name: name.trim(),
      prefecture: prefecture.trim(),
      city: city.trim(),
      address: address.trim() || undefined,
      lat,
      lng,
      pokemons: pokemonsText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      note: note.trim() || undefined,
      verified,
    };
    onSave(entry);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "ポケふたを編集" : "ポケふたを追加"}</h2>
        <form onSubmit={handleSubmit} className="edit-form">
          <label>
            名前 *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="form-row">
            <label>
              都道府県 *
              <input
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                required
              />
            </label>
            <label>
              市区町村
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
          </div>
          <label>
            住所・設置場所メモ
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            ポケモン(カンマ区切り)
            <input
              value={pokemonsText}
              onChange={(e) => setPokemonsText(e.target.value)}
              placeholder="例: ピカチュウ, イーブイ"
            />
          </label>
          <label>
            メモ
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            位置情報・ポケモン名を公式サイト等で確認済み
          </label>

          <div className="coord-fields">
            <label>
              緯度
              <input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
              />
            </label>
            <label>
              経度
              <input
                type="number"
                step="0.000001"
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="hint">地図をクリック、またはピンをドラッグして位置を設定できます。</p>
          <PickerMap
            lat={lat}
            lng={lng}
            onPick={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="primary">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
