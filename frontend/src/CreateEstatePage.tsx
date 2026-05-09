/**
 * CreateEstatePage
 * – Google Earth-style toolbar (search, undo/redo, placemark, polygon, measure)
 * – 2D Leaflet map for drawing (dark CARTO tiles)
 * – 3D Cesium globe synced to drawn polygon (same token / quality as park dashboards)
 * – leaflet-draw loaded dynamically INSIDE useEffect after window.L is set
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { MapContainer, TileLayer, FeatureGroup, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './hooks/useAuth';

// ── LeafletMapCapture: captures Leaflet map instance into a ref ────────────────
function LeafletMapCapture({ mapRef }: { mapRef: React.MutableRefObject<any> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

// ── PlacemarkClickHandler: registers click-to-place when active ───────────────
function PlacemarkClickHandler({
  active,
  onPlace,
}: {
  active: boolean;
  onPlace: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!active) {
      map.getContainer().style.cursor = '';
      return;
    }
    map.getContainer().style.cursor = 'crosshair';
    const handler = (e: L.LeafletMouseEvent) => {
      onPlace(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
      map.getContainer().style.cursor = '';
    };
  }, [active, map, onPlace]);
  return null;
}

// Cesium — safe here because this file is lazy-loaded via React.lazy in App.tsx
import {
  Ion,
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  SceneMode,
  createWorldTerrainAsync,
  RequestScheduler,
  Color as CesiumColor,
  PolygonHierarchy,
  IonImageryProvider,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// ── Token (same as GlobeViewer) ──────────────────────────────────────────────
const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

// ── Types ────────────────────────────────────────────────────────────────────
interface PolyStats {
  areaHa: number;
  perimeterKm: number;
  centroidLat: number;
  centroidLon: number;
}
type LatLng = [number, number]; // [lat, lon]

interface PlacemarkData {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

// ── Draw Controller ──────────────────────────────────────────────────────────
// Loads leaflet-draw dynamically INSIDE useEffect — avoids top-level crash
function DrawController({
  onPolygonChange,
  onDrawReady,
  onUndoReady,
  initialPolygon,
}: {
  onPolygonChange: (coords: LatLng[] | null) => void;
  onDrawReady: (startDraw: () => void, clearDraw: () => void) => void;
  onUndoReady: (undo: () => void) => void;
  initialPolygon?: LatLng[] | null;
}) {
  const map = useMap();
  const drawnRef = useRef<L.FeatureGroup | null>(null);
  const controlRef = useRef<any>(null);
  const handlerRef = useRef<any>(null);
  const historyRef = useRef<LatLng[][]>([]); // undo stack

  useEffect(() => {
    (window as any).L = L;

    import('leaflet-draw')
      .then(() => {
        if (drawnRef.current) return; // already mounted

        const drawnItems = new L.FeatureGroup();
        drawnRef.current = drawnItems;
        map.addLayer(drawnItems);

        // ── FIXED options: no nested `edit: true`, no `showArea` ────────────
        const drawControl = new (L.Control as any).Draw({
          position: 'topright',
          draw: {
            polygon: {
              allowIntersection: false,
              shapeOptions: {
                color: '#00ffcc',
                weight: 2,
                fillColor: '#00ffcc',
                fillOpacity: 0.15,
              },
            },
            polyline: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
          },
          edit: {
            featureGroup: drawnItems,
          },
        });

        map.addControl(drawControl);
        controlRef.current = drawControl;

        // Polygon draw handler creator
        const createHandler = () =>
          new (L as any).Draw.Polygon(map, {
            allowIntersection: false,
            shapeOptions: {
              color: '#00ffcc',
              weight: 2,
              fillColor: '#00ffcc',
              fillOpacity: 0.15,
            },
          });

        // startDraw — called by toolbar button
        const startDraw = () => {
          if (handlerRef.current) {
            try { handlerRef.current.disable(); } catch {}
          }
          const h = createHandler();
          handlerRef.current = h;
          h.enable();
        };

        // clearDraw
        const clearDraw = () => {
          if (handlerRef.current) {
            try { handlerRef.current.disable(); } catch {}
          }
          drawnItems.clearLayers();
          onPolygonChange(null);
        };

        // undo — remove last vertex or last polygon
        const undo = () => {
          const layers = drawnItems.getLayers();
          if (layers.length > 0) {
            drawnItems.removeLayer(layers[layers.length - 1]);
            const remaining = drawnItems.getLayers();
            if (remaining.length > 0) {
              const latlngs = (remaining[remaining.length - 1] as any).getLatLngs()[0] as L.LatLng[];
              const coords: LatLng[] = latlngs.map((ll: L.LatLng) => [ll.lat, ll.lng]);
              onPolygonChange(coords);
              historyRef.current = [...historyRef.current, coords];
            } else {
              onPolygonChange(null);
            }
          }
        };

        onDrawReady(startDraw, clearDraw);
        onUndoReady(undo);

        // Pre-populate if editing
        if (initialPolygon && initialPolygon.length > 0) {
          const latlngs = initialPolygon.map(([lat, lng]) => L.latLng(lat, lng));
          const poly = (L as any).polygon(latlngs, {
             color: '#00ffcc', weight: 2, fillColor: '#00ffcc', fillOpacity: 0.15
          });
          drawnItems.addLayer(poly);
          map.fitBounds(poly.getBounds());
          // We do not immediately trigger onPolygonChange because useEffect in parent handles it
        }

        // Hide the default leaflet-draw toolbar (we use our own)
        const style = document.createElement('style');
        style.textContent = '.leaflet-draw-toolbar { display: none !important; }';
        document.head.appendChild(style);

        // Events
        map.on((L as any).Draw.Event.CREATED, (e: any) => {
          drawnItems.clearLayers();
          drawnItems.addLayer(e.layer);
          const latlngs = e.layer.getLatLngs()[0] as L.LatLng[];
          const coords: LatLng[] = latlngs.map((ll: L.LatLng) => [ll.lat, ll.lng]);
          historyRef.current.push(coords);
          onPolygonChange(coords);
        });

        map.on((L as any).Draw.Event.EDITED, (e: any) => {
          e.layers.eachLayer((layer: any) => {
            const latlngs = layer.getLatLngs()[0] as L.LatLng[];
            const coords: LatLng[] = latlngs.map((ll: L.LatLng) => [ll.lat, ll.lng]);
            onPolygonChange(coords);
          });
        });

        map.on((L as any).Draw.Event.DELETED, () => {
          if (!drawnRef.current || drawnRef.current.getLayers().length === 0) {
            onPolygonChange(null);
          }
        });
      })
      .catch((err) => console.error('leaflet-draw load failed:', err));

    return () => {
      if (controlRef.current) {
        try { map.removeControl(controlRef.current); } catch {}
        controlRef.current = null;
      }
      if (drawnRef.current) {
        try { map.removeLayer(drawnRef.current); } catch {}
        drawnRef.current = null;
      }
      if (handlerRef.current) {
        try { handlerRef.current.disable(); } catch {}
        handlerRef.current = null;
      }
    };
  }, [map]);

  return null;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CreateEstatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { user } = useAuth();
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const entityRef = useRef<any>(null);

  const [initialLoading, setInitialLoading] = useState(!!editId);
  const [initialPolygon, setInitialPolygon] = useState<LatLng[] | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [polygonCoords, setPolygonCoords] = useState<LatLng[] | null>(null);
  const [name, setName] = useState('');
  const [stats, setStats] = useState<PolyStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  // Measurement state — manual click-based approach
  const [measureActive, setMeasureActive] = useState(false);
  const [measureToast, setMeasureToast] = useState<string | null>(null);
  const measurePointsRef = useRef<L.LatLng[]>([]);
  const measureLayerRef = useRef<L.Polyline | null>(null);
  const measureStartMarkerRef = useRef<L.Marker | null>(null);
  const measureEndMarkerRef = useRef<L.Marker | null>(null);
  const measureClickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  const measureDblClickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);

  // Placemark state — click-to-place with name/edit/delete
  const [placemarkMode, setPlacemarkMode] = useState(false);
  const [placemarks, setPlacemarks] = useState<PlacemarkData[]>([]);
  const [editingPlacemarkId, setEditingPlacemarkId] = useState<string | null>(null);
  const [editingPlacemarkName, setEditingPlacemarkName] = useState('');

  // Ref to Leaflet map instance (set via LeafletFlyController inside MapContainer)
  const leafletMapRef = useRef<any>(null);

  // Refs to draw control functions (set when leaflet-draw loads)
  const startDrawRef = useRef<(() => void) | null>(null);
  const clearDrawRef = useRef<(() => void) | null>(null);
  const undoRef = useRef<(() => void) | null>(null);

  // ── Fetch existing estate if edit mode ────────────────────────────────────
  useEffect(() => {
    if (!editId) return;
    let isMounted = true;
    const fetchEstateForEdit = async () => {
      try {
        const { data, error } = await supabase.from('estates').select('*').eq('id', editId).single();
        if (error) throw error;
        if (data && isMounted) {
          setName(data.name || '');
          if (data.boundary && data.boundary.coordinates && data.boundary.coordinates[0]) {
            const rawCoords = data.boundary.coordinates[0];
            const coords: LatLng[] = rawCoords.map((pt: number[]) => [pt[1], pt[0]] as LatLng);
            
            // Remove the exact closure vertex for Leaflet drawing state
            if (
              coords.length > 3 &&
              coords[0][0] === coords[coords.length - 1][0] &&
              coords[0][1] === coords[coords.length - 1][1]
            ) {
              coords.pop();
            }
            setInitialPolygon(coords);
            setPolygonCoords(coords);
          }
        }
      } catch (err) {
        console.error('Error fetching estate for edit:', err);
        if (isMounted) setError('Failed to load estate for editing.');
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };
    fetchEstateForEdit();
    return () => { isMounted = false; };
  }, [editId]);

  // ── Polygon change ────────────────────────────────────────────────────────
  const handlePolygonChange = useCallback((coords: LatLng[] | null) => {
    setPolygonCoords(coords);
    setIsDrawing(false);
    setError(null);
  }, []);

  // ── finishMeasure — declared before handlers that reference it ───────────
  const finishMeasure = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    // Remove click/dblclick listeners
    if (measureClickHandlerRef.current) {
      map.off('click', measureClickHandlerRef.current);
      measureClickHandlerRef.current = null;
    }
    if (measureDblClickHandlerRef.current) {
      map.off('dblclick', measureDblClickHandlerRef.current);
      measureDblClickHandlerRef.current = null;
    }
    // Calculate total distance
    const pts = measurePointsRef.current;
    if (pts.length >= 2) {
      let dist = 0;
      for (let i = 1; i < pts.length; i++) dist += pts[i - 1].distanceTo(pts[i]);
      const label = dist > 1000
        ? `${(dist / 1000).toFixed(2)} km`
        : `${Math.round(dist)} m`;
      setMeasureToast(`Distance: ${label}`);
      setTimeout(() => setMeasureToast(null), 6000);
    }
    // Remove temp polyline and markers
    if (measureLayerRef.current) {
      map.removeLayer(measureLayerRef.current);
      measureLayerRef.current = null;
    }
    if (measureStartMarkerRef.current) {
      map.removeLayer(measureStartMarkerRef.current);
      measureStartMarkerRef.current = null;
    }
    if (measureEndMarkerRef.current) {
      map.removeLayer(measureEndMarkerRef.current);
      measureEndMarkerRef.current = null;
    }
    measurePointsRef.current = [];
    setMeasureActive(false);
    map.getContainer().style.cursor = '';
  }, []);

  // ── Escape key cancels active tools ──────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (measureActive) { measurePointsRef.current = []; finishMeasure(); }
        if (placemarkMode) setPlacemarkMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [measureActive, placemarkMode, finishMeasure]);

  // ── Draw ready callback ───────────────────────────────────────────────────
  const handleDrawReady = useCallback(
    (startDraw: () => void, clearDraw: () => void) => {
      startDrawRef.current = startDraw;
      clearDrawRef.current = clearDraw;
    },
    []
  );

  const handleUndoReady = useCallback((undo: () => void) => {
    undoRef.current = undo;
  }, []);

  // ── Toolbar actions ───────────────────────────────────────────────────────
  const handleStartPolygon = () => {
    if (viewMode !== '2d') setViewMode('2d');
    // Cancel any active tools that intercept map clicks
    setPlacemarkMode(false);
    if (measureActive) { measurePointsRef.current = []; finishMeasure(); }
    setIsDrawing(true);
    setTimeout(() => startDrawRef.current?.(), 100);
  };

  const handleUndo = () => undoRef.current?.();

  const handleClear = () => {
    clearDrawRef.current?.();
    setIsDrawing(false);
    setPlacemarks([]);
  };

  // ── Placemark mode — toggle click-to-place mode ────────────────────────────
  const handlePlacemark = () => {
    // Toggle placemark placement mode
    setPlacemarkMode(prev => !prev);
    // Cancel any active measure
    if (measureActive) finishMeasure();
  };

  const handleMeasure = () => {
    const map = leafletMapRef.current;
    if (!map) return;
    if (viewMode !== '2d') setViewMode('2d');
    // Cancel placemark mode if active
    setPlacemarkMode(false);
    setMeasureActive(true);
    measurePointsRef.current = [];
    map.getContainer().style.cursor = 'crosshair';

    // Draw live polyline on clicks
    const clickHandler = (e: L.LeafletMouseEvent) => {
      measurePointsRef.current = [...measurePointsRef.current, e.latlng];
      const pts = measurePointsRef.current;
      
      if (measureLayerRef.current) map.removeLayer(measureLayerRef.current);
      if (measureStartMarkerRef.current) map.removeLayer(measureStartMarkerRef.current);
      if (measureEndMarkerRef.current) map.removeLayer(measureEndMarkerRef.current);

      if (pts.length >= 2) {
        measureLayerRef.current = L.polyline(pts, {
          color: '#facc15',
          weight: 2.5,
          dashArray: '6 4',
          opacity: 0.9,
        }).addTo(map);
      }

      if (pts.length > 0) {
        const createDot = () => L.divIcon({
          className: '',
          html: `<div style="width:8px;height:8px;background:#facc15;border-radius:50%;box-shadow:0 0 12px 4px #facc15aa, 0 0 4px #fff"></div>`,
          iconAnchor: [4, 4]
        });
        measureStartMarkerRef.current = L.marker(pts[0], { icon: createDot(), interactive: false }).addTo(map);
        if (pts.length > 1) {
          measureEndMarkerRef.current = L.marker(pts[pts.length - 1], { icon: createDot(), interactive: false }).addTo(map);
        }
      }
    };

    // Double-click finishes
    const dblClickHandler = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e);
      finishMeasure();
    };

    measureClickHandlerRef.current = clickHandler;
    measureDblClickHandlerRef.current = dblClickHandler;
    map.on('click', clickHandler);
    map.on('dblclick', dblClickHandler);
  };

  const handleSearch = async (e: React.FormEvent | null, overrideLat?: number, overrideLon?: number) => {
    if (e) e.preventDefault();

    let lat: number;
    let lon: number;

    if (overrideLat !== undefined && overrideLon !== undefined) {
      lat = overrideLat;
      lon = overrideLon;
    } else {
      if (!searchQuery.trim()) return;
      setSearchLoading(true);
      setShowSuggestions(false);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
        );
        const results: { display_name: string; lat: string; lon: string }[] = await res.json();
        setSearchLoading(false);
        if (!results.length) return;
        // Show suggestions if multiple results, auto-fly to first
        if (results.length > 1) {
          setSearchSuggestions(results);
          setShowSuggestions(true);
        }
        lat = parseFloat(results[0].lat);
        lon = parseFloat(results[0].lon);
      } catch {
        setSearchLoading(false);
        return;
      }
    }

    // In 2D mode: fly the Leaflet map
    if (viewMode === '2d') {
      if (leafletMapRef.current) {
        leafletMapRef.current.flyTo([lat, lon], 13, { duration: 1.5 });
      }
      return;
    }

    // In 3D mode: fly Cesium if mounted, else switch to 2D and fly Leaflet
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      viewerRef.current.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, 8_000),
        orientation: { heading: 0, pitch: CesiumMath.toRadians(-45), roll: 0 },
        duration: 2,
      });
    }
  };

  const handleSuggestionClick = (s: { lat: string; lon: string; display_name: string }) => {
    setSearchQuery(s.display_name.split(',')[0]);
    setShowSuggestions(false);
    handleSearch(null, parseFloat(s.lat), parseFloat(s.lon));
  };

  // ── Compute PostGIS stats ──────────────────────────────────────────────────
  useEffect(() => {
    if (!polygonCoords || polygonCoords.length < 3) { setStats(null); return; }
    
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const ring = polygonCoords.map(([lat, lon]) => [lon, lat] as [number, number]);
        ring.push(ring[0]);
        
        const geojson = {
          type: 'Polygon',
          coordinates: [ring]
        };

        const { data, error } = await supabase.rpc('analyze_estate_polygon', { geojson });
        if (error) {
          setError(`PostGIS Error: ${error.message} - Please run the updated SQL function.`);
          setStats(null);
          return;
        }

        if (isMounted && data && data.length > 0) {
          const stats = data[0];
          setStats({
            areaHa: stats.area_ha,
            perimeterKm: stats.perimeter_m / 1000,
            centroidLat: stats.centroid_lat,
            centroidLon: stats.centroid_lon,
          });
        }
      } catch (err) {
        console.error('Failed to compute estate stats via PostGIS:', err);
        if (isMounted) setStats(null);
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, [polygonCoords]);

  // ── Cesium init on 3D switch ──────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== '3d' || !cesiumContainerRef.current) return;

    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      syncCesiumPolygon(viewerRef.current);
      return;
    }

    Ion.defaultAccessToken = ION_TOKEN;
    (RequestScheduler as any).maximumRequestsPerServer = 18;

    const viewer = new Viewer(cesiumContainerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      creditContainer: document.createElement('div'),
      sceneMode: SceneMode.SCENE3D,
      requestRenderMode: true,
    });

    viewer.scene.maximumRenderTimeChange = Infinity;
    viewer.scene.postProcessStages.fxaa.enabled = false;
    viewer.resolutionScale = 0.9;

    // Advanced performance settings for snappy 3D
    const globe = viewer.scene.globe;
    globe.enableLighting = false;
    globe.maximumScreenSpaceError = 2.5; // Fast tile loading
    globe.tileCacheSize = 1_000;
    globe.preloadAncestors = true;
    globe.preloadSiblings = true;

    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
    if (viewer.scene.fog) viewer.scene.fog.enabled = false;

    // Bing satellite imagery (same as park dashboards via Ion asset 2)
    IonImageryProvider.fromAssetId(2).then(provider => {
      if (!viewer.isDestroyed()) {
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(provider);
      }
    }).catch(() => {});

    createWorldTerrainAsync()
      .then(tp => { if (!viewer.isDestroyed()) viewer.terrainProvider = tp; })
      .catch(() => {});

    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.minimumZoomDistance = 200;
    ctrl.maximumZoomDistance = 20_000_000;
    ctrl.inertiaSpin = 0.93;
    ctrl.inertiaTranslate = 0.93;
    ctrl.inertiaZoom = 0.8;

    viewerRef.current = viewer;
    syncCesiumPolygon(viewer);
  }, [viewMode]);

  // ── Sync polygon → Cesium ─────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode === '3d' && viewerRef.current && !viewerRef.current.isDestroyed()) {
      syncCesiumPolygon(viewerRef.current);
    }
  }, [polygonCoords, viewMode]);

  function syncCesiumPolygon(viewer: Viewer) {
    if (entityRef.current) { viewer.entities.remove(entityRef.current); entityRef.current = null; }

    if (!polygonCoords || polygonCoords.length < 3) {
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(78, 20, 15_000_000),
        orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      });
      return;
    }

    const positions = polygonCoords.map(([lat, lon]) => Cartesian3.fromDegrees(lon, lat));
    entityRef.current = viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: CesiumColor.fromCssColorString('#00ffcc').withAlpha(0.25),
        outline: true,
        outlineColor: CesiumColor.fromCssColorString('#00ffcc'),
        outlineWidth: 2,
      },
    });

    viewer.flyTo(entityRef.current, {
      duration: 1.5,
      offset: { heading: 0, pitch: CesiumMath.toRadians(-55), range: 0 },
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const toGeoJSON = () => {
    if (!polygonCoords || polygonCoords.length < 3) return null;
    const ring = polygonCoords.map(([lat, lon]) => [lon, lat] as [number, number]);
    ring.push(ring[0]);
    return { type: 'Polygon' as const, coordinates: [ring] };
  };

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name.trim()) { setError('Estate name is required'); return; }
    if (!polygonCoords || polygonCoords.length < 3) { setError('Draw a boundary first'); return; }
    if (!stats) { setError('No valid polygon computed'); return; }
    if (!user) { setError('Not authenticated'); return; }
    const geojson = toGeoJSON();
    if (!geojson) { setError('Invalid polygon geometry'); return; }

    setSaving(true);
    try {
      if (editId) {
        const { error: estateErr } = await supabase
          .from('estates')
          .update({
            name: name.trim(),
            boundary: geojson,
            centroid_lat: stats.centroidLat,
            centroid_lon: stats.centroidLon,
            area_ha: stats.areaHa,
            perimeter_km: stats.perimeterKm,
          })
          .eq('id', editId);
        if (estateErr) throw estateErr;

        // Update the Boundary zone too
        await supabase.from('zones')
          .update({ polygon: geojson })
          .eq('estate_id', editId)
          .eq('name', 'Boundary');
        navigate(`/estate/${editId}`);
      } else {
        const { data: estate, error: estateErr } = await supabase
          .from('estates')
          .insert({
            owner_id: user.id,
            name: name.trim(),
            boundary: geojson,
            centroid_lat: stats.centroidLat,
            centroid_lon: stats.centroidLon,
            area_ha: stats.areaHa,
            perimeter_km: stats.perimeterKm,
          })
          .select('id')
          .single();
        if (estateErr) throw estateErr;

        await supabase.from('zones').insert({
          estate_id: estate.id,
          name: 'Boundary',
          status: 'normal',
          polygon: geojson,
        });
        navigate(`/estate/${estate.id}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save estate');
    } finally {
      setSaving(false);
    }
  }, [name, polygonCoords, stats, user, navigate]);

  // ── Destroy Cesium on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex flex-col bg-[#1a1a1a] text-white overflow-hidden">

      {/* ══ Google Earth–style Top Toolbar ════════════════════════════════ */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#202124] border-b border-[#3c3c3c] shrink-0 z-[2000] overflow-visible">

        {/* Logo / back button */}
        <button
          onClick={() => navigate('/dashboard')}
          title="Back to Dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-vanguard-species/20 hover:bg-vanguard-species/40 transition-colors cursor-pointer shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffcc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Search bar with suggestions */}
        <form onSubmit={(e) => handleSearch(e)} className="relative flex items-center">
          {searchLoading ? (
            <svg className="absolute left-3 text-vanguard-species/70 animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          ) : (
            <svg className="absolute left-3 text-white/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(false); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search location..."
            className="w-60 pl-8 pr-3 py-1.5 bg-[#303134] text-white text-sm rounded-full placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-vanguard-species/60 font-mono"
          />
          {/* Suggestions dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-[#2a2a2a] border border-[#3c3c3c] rounded-lg shadow-2xl z-[3000] overflow-hidden">
              {searchSuggestions.slice(0, 5).map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => handleSuggestionClick(s)}
                  className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-[#3c3c3c] font-mono truncate border-b border-[#3c3c3c] last:border-0"
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Divider */}
        <div className="w-px h-5 bg-[#3c3c3c]" />

        {/* Undo */}
        <ToolbarBtn
          title="Undo"
          onClick={handleUndo}
          disabled={!polygonCoords}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          }
        />

        {/* Redo (visual only for now) */}
        <ToolbarBtn
          title="Redo"
          onClick={() => {}}
          disabled={true}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" />
            </svg>
          }
        />

        {/* Divider */}
        <div className="w-px h-5 bg-[#3c3c3c]" />

        {/* Add Placemark — toggles click-to-place mode */}
        <ToolbarBtn
          title={placemarkMode ? 'Cancel Placemark (click map to place)' : 'Add Placemark'}
          onClick={handlePlacemark}
          active={placemarkMode}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
        />

        {/* Draw Polygon — PRIMARY ACTION */}
        <ToolbarBtn
          title="Draw Estate Boundary"
          onClick={handleStartPolygon}
          active={isDrawing}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3,17 7,3 14,9 21,6 18,20" />
            </svg>
          }
        />

        {/* Measure / ruler */}
        <ToolbarBtn
          title="Measure Distance"
          onClick={handleMeasure}
          active={measureActive}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17L21 17"/><path d="M3 7L21 7"/><path d="M9 3L9 21"/><path d="M15 3L15 21"/>
            </svg>
          }
        />

        {/* Clear */}
        {polygonCoords && (
          <ToolbarBtn
            title="Clear Boundary"
            onClick={handleClear}
            danger
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            }
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* 2D / 3D toggle (right side, like Google Earth) */}
        <div className="flex items-center rounded-full overflow-hidden border border-[#3c3c3c] bg-[#303134]">
          <button
            onClick={() => setViewMode('2d')}
            className={`px-4 py-1.5 text-xs font-mono tracking-wider transition-all cursor-pointer ${
              viewMode === '2d' ? 'bg-vanguard-species/80 text-vanguard-bg font-bold' : 'text-white/60 hover:text-white/90'
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`px-4 py-1.5 text-xs font-mono tracking-wider transition-all cursor-pointer ${
              viewMode === '3d' ? 'bg-vanguard-species/80 text-vanguard-bg font-bold' : 'text-white/60 hover:text-white/90'
            }`}
          >
            3D
          </button>
        </div>

        {/* Page title */}
        <span className="font-sans text-xs text-white/40 tracking-widest uppercase ml-2">
          Create Estate
        </span>
      </div>

      {/* ══ Main Content ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* Map area */}
        <div className="flex-1 relative">

          {/* 2D Leaflet */}
          <div className="absolute inset-0" style={{ display: viewMode === '2d' ? 'block' : 'none' }}>
            {!initialLoading && (
              <MapContainer
                center={[20, 78]}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                minZoom={3}
                maxBounds={[[-90, -180], [90, 180]]}
                maxBoundsViscosity={1.0}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  className="dark-osm-tiles"
                />
                <FeatureGroup>
                  <DrawController
                    onPolygonChange={handlePolygonChange}
                    onDrawReady={handleDrawReady}
                    onUndoReady={handleUndoReady}
                    initialPolygon={initialPolygon}
                  />
                    {/* Captures Leaflet map instance so search + placemark work */}
                  <LeafletMapCapture mapRef={leafletMapRef} />

                  {/* Click-to-place handler — only active in placemark mode */}
                  <PlacemarkClickHandler
                    active={placemarkMode}
                    onPlace={(lat, lng) => {
                      setPlacemarks(prev => {
                        const newPm: PlacemarkData = {
                          id: `pm-${Date.now()}`,
                          lat,
                          lng,
                          name: `Waypoint ${prev.length + 1}`,
                        };
                        return [...prev, newPm];
                      });
                      // Stay in placemark mode so user can add multiple
                    }}
                  />
                </FeatureGroup>

                {/* Named, editable, removable placemarks */}
                {placemarks.map((pm) => (
                  <Marker
                    key={pm.id}
                    position={[pm.lat, pm.lng]}
                    icon={L.divIcon({
                      className: '',
                      html: `
                        <div style="
                          display:flex;flex-direction:column;align-items:center;
                          pointer-events:none;
                        ">
                          <div style="
                            background:#00ffcc;color:#0a0f1a;font-family:monospace;
                            font-size:9px;font-weight:700;padding:2px 5px;
                            border-radius:3px;white-space:nowrap;margin-bottom:3px;
                            box-shadow:0 2px 8px #00ffcc55;
                          ">${pm.name}</div>
                          <div style="
                            width:10px;height:10px;background:#00ffcc;
                            border:2px solid #fff;border-radius:50%;
                            box-shadow:0 0 8px #00ffcc99;
                          "></div>
                        </div>`,
                      iconAnchor: [0, 28],
                    })}
                  >
                    <Popup
                      className="placemark-popup"
                      closeButton={false}
                      offset={[0, -30]}
                    >
                      <div style={{
                        background: '#1a1f2e',
                        border: '1px solid #00ffcc44',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        minWidth: '160px',
                        fontFamily: 'monospace',
                      }}>
                        {editingPlacemarkId === pm.id ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              autoFocus
                              defaultValue={pm.name}
                              onChange={e => setEditingPlacemarkName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  setPlacemarks(prev => prev.map(p =>
                                    p.id === pm.id ? { ...p, name: editingPlacemarkName || p.name } : p
                                  ));
                                  setEditingPlacemarkId(null);
                                }
                                if (e.key === 'Escape') setEditingPlacemarkId(null);
                              }}
                              style={{
                                flex: 1, background: '#0a0f1a', border: '1px solid #00ffcc55',
                                borderRadius: '3px', padding: '3px 6px', color: '#00ffcc',
                                fontSize: '11px', fontFamily: 'monospace', outline: 'none',
                              }}
                            />
                            <button
                              onClick={() => {
                                setPlacemarks(prev => prev.map(p =>
                                  p.id === pm.id ? { ...p, name: editingPlacemarkName || p.name } : p
                                ));
                                setEditingPlacemarkId(null);
                              }}
                              style={{ background: '#00ffcc', border: 'none', borderRadius: '3px', padding: '3px 6px', cursor: 'pointer', color: '#0a0f1a', fontWeight: 700, fontSize: '10px' }}
                            >✓</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#00ffcc', fontSize: '11px', fontWeight: 700 }}>{pm.name}</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => { setEditingPlacemarkId(pm.id); setEditingPlacemarkName(pm.name); }}
                                title="Rename"
                                style={{ background: 'transparent', border: '1px solid #3c3c3c', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', color: '#aaa', fontSize: '10px' }}
                              >✎</button>
                              <button
                                onClick={() => setPlacemarks(prev => prev.filter(p => p.id !== pm.id))}
                                title="Remove"
                                style={{ background: 'transparent', border: '1px solid #ff4444aa', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', color: '#ff6666', fontSize: '10px' }}
                              >✕</button>
                            </div>
                          </div>
                        )}
                        <div style={{ color: '#ffffff44', fontSize: '9px', marginTop: '4px' }}>
                          {pm.lat.toFixed(5)}°, {pm.lng.toFixed(5)}°
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

              </MapContainer>
            )}

            {/* Leaflet zoom control — bottom right */}
            <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-1">
              {/* zoom handled by leaflet default, we'll leave space for it */}
            </div>
          </div>

          {/* 3D Cesium */}
          <div
            ref={cesiumContainerRef}
            className="absolute inset-0"
            style={{ display: viewMode === '3d' ? 'block' : 'none', background: '#0a0f1a' }}
          />

          {/* 2D hint */}
          {viewMode === '2d' && !polygonCoords && !isDrawing && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#202124]/90 backdrop-blur border border-[#3c3c3c] rounded-full z-[1000] pointer-events-none">
              <p className="font-mono text-[10px] text-white/50 tracking-wide whitespace-nowrap">
                CLICK <span className="text-vanguard-species">▣ DRAW BOUNDARY</span> IN THE TOOLBAR TO START
              </p>
            </div>
          )}

          {/* Drawing hint */}
          {viewMode === '2d' && isDrawing && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-vanguard-species/10 backdrop-blur border border-vanguard-species/40 rounded-full z-[1000] pointer-events-none">
              <p className="font-mono text-[10px] text-vanguard-species tracking-wide whitespace-nowrap">
                CLICK TO ADD VERTICES · CLICK FIRST POINT TO CLOSE POLYGON
              </p>
            </div>
          )}

          {/* 3D hint */}
          {viewMode === '3d' && polygonCoords && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#202124]/90 backdrop-blur border border-[#3c3c3c] rounded-full z-[1000] pointer-events-none">
              <p className="font-mono text-[10px] text-white/50 tracking-wide">
                3D PREVIEW — SWITCH TO 2D TO EDIT
              </p>
            </div>
          )}

          {/* Measure active banner — shows instructions + Finish/Cancel */}
          {measureActive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-yellow-950/90 backdrop-blur border border-yellow-400/50 rounded-full z-[1000]">
              <p className="font-mono text-[10px] text-yellow-300 tracking-wide whitespace-nowrap">
                CLICK TO ADD POINTS · DOUBLE-CLICK TO FINISH
              </p>
              <button
                onClick={finishMeasure}
                className="font-mono text-[10px] text-yellow-900 bg-yellow-400 hover:bg-yellow-300 px-3 py-1 rounded-full font-bold tracking-wide transition-colors cursor-pointer"
              >
                FINISH
              </button>
              <button
                onClick={() => { measurePointsRef.current = []; finishMeasure(); }}
                className="font-mono text-[10px] text-yellow-300/60 hover:text-yellow-300 tracking-wide transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Measure result toast */}
          {measureToast && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-500/20 border border-yellow-400/40 rounded-full z-[1000] pointer-events-none">
              <p className="font-mono text-[11px] text-yellow-300 tracking-wide">{measureToast}</p>
            </div>
          )}

          {/* Placemark mode banner */}
          {placemarkMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-vanguard-species/10 backdrop-blur border border-vanguard-species/50 rounded-full z-[1000]">
              <p className="font-mono text-[10px] text-vanguard-species tracking-wide whitespace-nowrap">
                CLICK MAP TO PLACE WAYPOINT
              </p>
              <button
                onClick={() => setPlacemarkMode(false)}
                className="font-mono text-[10px] text-vanguard-species/60 hover:text-vanguard-species tracking-wide transition-colors cursor-pointer"
              >
                DONE ✕
              </button>
            </div>
          )}
        </div>

        {/* ── Right Panel ─────────────────────────────────────────────────── */}
        <div className="w-72 border-l border-[#3c3c3c] bg-[#202124] flex flex-col p-5">
          <h3 className="font-sans font-bold text-sm tracking-widest mb-5 text-white/80 uppercase">
            Estate Details
          </h3>

          <label className="block font-mono text-[10px] text-white/40 tracking-widest mb-1.5 uppercase">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Bannerghatta Reserve"
            className="w-full bg-[#303134] border border-[#3c3c3c] rounded px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/20 focus:border-vanguard-species/50 focus:outline-none transition-colors mb-5"
          />

          {stats ? (
            <div className="space-y-2.5 mb-5 p-3 bg-[#303134] rounded border border-[#3c3c3c]">
              <StatRow label="Area" value={`${stats.areaHa.toFixed(2)} ha`} />
              <StatRow label="Perimeter" value={`${stats.perimeterKm.toFixed(2)} km`} />
              <StatRow label="Centroid" value={`${stats.centroidLat.toFixed(4)}° ${stats.centroidLon.toFixed(4)}°`} />
              <StatRow label="Vertices" value={`${polygonCoords?.length ?? 0}`} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center mb-5">
              {/* Polygon icon placeholder */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white/10 mb-3">
                <polygon points="3,17 7,3 14,9 21,6 18,20" />
              </svg>
              <p className="font-mono text-[10px] text-white/20 tracking-wide text-center leading-loose">
                CLICK <span className="text-white/40">DRAW BOUNDARY</span><br />IN THE TOOLBAR TO START
              </p>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded mb-4">
              <span className="font-mono text-xs text-red-400">{error}</span>
            </div>
          )}

          {/* Placemarks List */}
          {placemarks.length > 0 && (
            <div className="mb-5 flex-1 overflow-hidden flex flex-col">
              <h3 className="font-sans font-bold text-[10px] tracking-widest mb-3 text-white/50 uppercase border-b border-[#3c3c3c] pb-2">
                Waypoints ({placemarks.length})
              </h3>
              <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                {placemarks.map((pm) => (
                  <div key={pm.id} className="flex flex-col bg-[#303134] p-2.5 rounded border border-[#3c3c3c] hover:border-[#00ffcc55] filter drop-shadow-sm transition-all">
                    <div className="flex justify-between items-center mb-1">
                      {editingPlacemarkId === pm.id ? (
                        <input
                          autoFocus
                          defaultValue={pm.name}
                          onChange={e => setEditingPlacemarkName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              setPlacemarks(prev => prev.map(p => p.id === pm.id ? { ...p, name: editingPlacemarkName || p.name } : p));
                              setEditingPlacemarkId(null);
                            }
                            if (e.key === 'Escape') setEditingPlacemarkId(null);
                          }}
                          className="flex-1 bg-[#0a0f1a] border border-[#00ffcc] rounded px-1.5 py-0.5 text-[#00ffcc] text-[10px] font-mono outline-none mr-2"
                        />
                      ) : (
                        <span className="font-mono text-[11px] text-[#00ffcc] font-bold truncate pr-2">{pm.name}</span>
                      )}
                      <div className="flex gap-2 shrink-0">
                        {editingPlacemarkId !== pm.id && (
                          <button onClick={() => { setEditingPlacemarkId(pm.id); setEditingPlacemarkName(pm.name); }} className="text-white/40 hover:text-[#00ffcc] text-[11px] transition-colors cursor-pointer" title="Rename">✎</button>
                        )}
                        <button onClick={() => setPlacemarks(prev => prev.filter(p => p.id !== pm.id))} className="text-red-400/60 hover:text-red-400 text-[11px] transition-colors cursor-pointer" title="Remove">✕</button>
                      </div>
                    </div>
                    <span className="font-mono text-[9px] text-white/30">{pm.lat.toFixed(5)}°, {pm.lng.toFixed(5)}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto space-y-2 shrink-0 border-t border-[#3c3c3c] pt-4">
            {polygonCoords && polygonCoords.length >= 3 && (
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full py-2.5 bg-vanguard-species/90 hover:bg-vanguard-species text-[#0a0f1a] font-sans font-bold text-sm tracking-widest rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? 'SAVING...' : editId ? 'SAVE CHANGES' : 'CREATE ESTATE'}
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2 bg-transparent border border-[#3c3c3c] hover:border-white/30 text-white/40 hover:text-white/70 font-mono text-xs tracking-widest rounded transition-all cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar Button ────────────────────────────────────────────────────────────
function ToolbarBtn({
  title,
  icon,
  onClick,
  active = false,
  disabled = false,
  danger = false,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative group flex items-center justify-center w-8 h-8 rounded transition-all cursor-pointer
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
        ${active ? 'bg-vanguard-species/20 text-vanguard-species' : danger ? 'text-red-400 hover:bg-red-500/20' : 'text-white/60 hover:bg-[#3c3c3c] hover:text-white/90'}
      `}
    >
      {icon}
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#303134] text-white/80 text-[10px] font-mono tracking-wide rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        {title}
      </span>
    </button>
  );
}

// ── Stat Row ──────────────────────────────────────────────────────────────────
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="font-mono text-[10px] text-white/40 tracking-widest uppercase">{label}</span>
      <span className="font-mono text-xs text-white/80">{value}</span>
    </div>
  );
}
