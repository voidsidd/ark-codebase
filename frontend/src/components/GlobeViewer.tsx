import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Ion,
  Viewer,
  Cartesian3,
  Color,
  HeightReference,
  Math as CesiumMath,
  ScreenSpaceEventType,
  CameraEventType,
  RequestScheduler,
  createWorldTerrainAsync,
  ClassificationType,
  PolygonHierarchy,
  ShadowMode,
  UrlTemplateImageryProvider,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { resolveEstateId } from '../lib/estatesData';
import type { ZonePolygon } from './ZoneManager';

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

RequestScheduler.maximumRequestsPerServer = 18;

interface Zone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: 'critical' | 'warning' | 'normal';
  alerts: number;
}

export interface GlobeRef {
  flyTo: (lat: number, lon: number) => void;
}

interface EstateBoundaryData {
  name: string;
  boundary: { type: string; coordinates: [number, number][][] } | null;
  centroid_lat: number | null;
  centroid_lon: number | null;
}

interface GlobeViewerProps {
  estateId: string;
  zones?: Zone[];
  zonePolygons?: ZonePolygon[]; // actual estate polygon shapes from estatesData
  alerts?: any[];
  onZoneClick?: (zone: Zone) => void;
  estateBoundary?: EstateBoundaryData | null;
}

const ESTATE_COORDS: Record<string, { lat: number; lon: number; alt: number }> = {
  nagarhole:     { lat: 11.9833, lon: 76.1167, alt: 15_000_000 },
  corbett:       { lat: 29.5300, lon: 78.7747, alt: 15_000_000 },
  kaziranga:     { lat: 26.5775, lon: 93.1711, alt: 15_000_000 },
  sundarbans:    { lat: 21.9497, lon: 88.9468, alt: 15_000_000 },
  'maasai-mara': { lat: -1.4061, lon: 35.1019, alt: 15_000_000 },
  kruger:        { lat: -23.9884, lon: 31.5547, alt: 15_000_000 },
};

const ZONE_COLORS: Record<string, { fill: string; outline: string }> = {
  critical: { fill: 'rgba(255,51,102,0.18)',  outline: '#ff3366' },
  warning:  { fill: 'rgba(255,170,51,0.18)',  outline: '#ffaa33' },
  normal:   { fill: 'rgba(51,204,255,0.12)',  outline: '#33ccff' },
};

// Pitch limits — prevents flipping upside down in any direction
const MIN_PITCH = CesiumMath.toRadians(-89.9); // never quite straight down (avoids gimbal)
const MAX_PITCH = CesiumMath.toRadians(-5);    // never look up above horizon

export const GlobeViewer = forwardRef<GlobeRef, GlobeViewerProps>(
  ({ estateId, zones = [], zonePolygons = [], estateBoundary }, ref) => {
    const resolvedEstateId = resolveEstateId(estateId);
    const isEstate = !!estateBoundary;
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef    = useRef<Viewer | null>(null);
    const estateIdRef    = useRef(estateId);
    const zonesRef     = useRef(zones);

    estateIdRef.current = estateId;
    zonesRef.current  = zones;

    useImperativeHandle(ref, () => ({
      flyTo: (lat: number, lon: number) => {
        const v = viewerRef.current;
        if (!v || v.isDestroyed()) return;
        v.camera.flyTo({
          destination: Cartesian3.fromDegrees(lon, lat, 8000),
          orientation: {
            heading: CesiumMath.toRadians(0),
            pitch:   CesiumMath.toRadians(-40),
            roll: 0,
          },
          duration: 2,
        });
      },
    }));

    useEffect(() => {
      if (!containerRef.current || viewerRef.current) return;

      const viewer = new Viewer(containerRef.current, {
        timeline:              false,
        animation:             false,
        homeButton:            false,
        sceneModePicker:       false,
        baseLayerPicker:       false,
        navigationHelpButton:  false,
        geocoder:              false,
        fullscreenButton:      false,
        infoBox:               false,
        selectionIndicator:    false,
      });

      // ── PERFORMANCE OPTIMIZATIONS ──────────────────────────────────────────
      // Request render mode stops rendering when camera is still -> HUGE CPU savings
      viewer.scene.requestRenderMode = true;
      viewer.scene.maximumRenderTimeChange = Infinity;

      // Drop anti-aliasing (FXAA) since modern high-DPI screens don't need it much
      viewer.scene.postProcessStages.fxaa.enabled = false;
      viewer.resolutionScale = 0.85; // 15% cheaper with barely visible quality change on HiDPI

      // Disable shadow map — single biggest GPU saving on most hardware
      viewer.shadowMap.enabled = false;

      // Aggressive tile loading for "instantaneous" panning -> reduces white box flashing
      const globe = viewer.scene.globe;
      globe.maximumScreenSpaceError = 3; // Slightly blockier tiles load MUCH faster initially
      globe.tileCacheSize = 1200;
      globe.preloadAncestors = true;
      globe.preloadSiblings = true;
      globe.enableLighting = false; // Disable sun lighting computations

      // Strip unnecessary celestial bodies
      if (viewer.scene.sun) viewer.scene.sun.show = false;
      if (viewer.scene.moon) viewer.scene.moon.show = false;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
      if (viewer.scene.fog) viewer.scene.fog.enabled = false;
      // Disable starfield — small JS overhead, also cleaner look on dark UI
      if ((viewer.scene as any).skyBox) (viewer.scene as any).skyBox.show = false;

      // ── EARTH ENGINE / SATELLITE TILES ────────────────────────────────────
      // Fetch dynamic Sentinel-2 tiles from our Node.js/EE backend
      fetch('/api/earthengine/tiles')
        .then(r => r.json())
        .then(data => {
          if (viewer.isDestroyed()) return;
          const url = data.urlFormat || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
          viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({ url }));
        })
        .catch(() => {
          if (viewer.isDestroyed()) return;
          // Fallback to ArcGIS World Imagery if backend/EE is offline
          viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          }));
        });

      viewerRef.current = viewer;

      const MAX_ZOOM_OUT = 20_000_000;
      const ctrl = viewer.scene.screenSpaceCameraController;

      ctrl.inertiaSpin             = 0.93;
      ctrl.inertiaTranslate        = 0.93;
      ctrl.inertiaZoom             = 0.8;
      ctrl.minimumZoomDistance     = 300;        // never closer than 300m above ground
      ctrl.maximumZoomDistance     = MAX_ZOOM_OUT;
      ctrl.enableCollisionDetection = true;      // FIX: prevents camera going inside globe
      ctrl.maximumMovementRatio    = 0.02;

      // ── Pitch clamp on every frame — the core fix for flipping ──────────
      // Runs after each render frame and corrects pitch if it drifted out of range
      const pitchClampHandler = viewer.scene.preRender.addEventListener(() => {
        const cam = viewer.camera;
        const pitch = cam.pitch;

        if (pitch > MAX_PITCH) {
          // Camera looking too far up — clamp down
          cam.setView({
            orientation: {
              heading: cam.heading,
              pitch: MAX_PITCH,
              roll: 0,
            },
          });
        } else if (pitch < MIN_PITCH) {
          // Camera went past straight down — clamp back
          cam.setView({
            orientation: {
              heading: cam.heading,
              pitch: MIN_PITCH,
              roll: 0,
            },
          });
        }

        // Also clamp roll to zero — prevents Dutch roll / tilt during fast spins
        if (Math.abs(cam.roll) > CesiumMath.toRadians(0.5)) {
          cam.setView({
            orientation: {
              heading: cam.heading,
              pitch: cam.pitch,
              roll: 0,
            },
          });
        }
      });

      // ── Custom inertia wheel zoom ────────────────────────────────────────
      let zoomVelocity = 0;
      let zoomRafId: number | null = null;

      const animateZoom = () => {
        const v = viewerRef.current;
        if (!v || v.isDestroyed() || Math.abs(zoomVelocity) < 0.5) {
          zoomVelocity = 0;
          zoomRafId = null;
          return;
        }
        const height = v.camera.positionCartographic?.height ?? 1_000_000;
        const zoomAmount = height * 0.05 * Math.abs(zoomVelocity);
        if (zoomVelocity > 0) {
          // Zoom in — respect minimum zoom
          if (height > ctrl.minimumZoomDistance + zoomAmount) {
            v.camera.zoomIn(zoomAmount);
          }
        } else {
          if (height < MAX_ZOOM_OUT) v.camera.zoomOut(zoomAmount);
        }
        zoomVelocity *= 0.82;
        zoomRafId = requestAnimationFrame(animateZoom);
      };

      // Disable default wheel zoom — use custom handler instead
      ctrl.zoomEventTypes = [CameraEventType.PINCH];

      viewer.screenSpaceEventHandler.setInputAction((wheelDelta: number) => {
        const v = viewerRef.current;
        if (!v || v.isDestroyed()) return;
        const height = v.camera.positionCartographic?.height ?? 1_000_000;
        if (wheelDelta < 0 && height >= MAX_ZOOM_OUT) return;
        // Hard block: prevent zooming closer than minimum distance
        if (wheelDelta > 0 && height <= ctrl.minimumZoomDistance + 50) return;
        zoomVelocity += Math.sign(wheelDelta) * Math.min(Math.abs(wheelDelta) / 100, 4);
        zoomVelocity = Math.max(-8, Math.min(8, zoomVelocity)); // tighter clamp = more control
        if (!zoomRafId) zoomRafId = requestAnimationFrame(animateZoom);
      }, ScreenSpaceEventType.WHEEL);

      // Remove double-click zoom
      viewer.screenSpaceEventHandler.removeInputAction(
        ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );



      createWorldTerrainAsync({ requestWaterMask: true, requestVertexNormals: true })
        .then(provider => {
          if (!viewer.isDestroyed()) viewer.terrainProvider = provider;
        })
        .catch(() => {});

      viewer.resize();

      const resizeObserver = new ResizeObserver(() => {
        if (!viewer.isDestroyed()) viewer.resize();
      });
      if (containerRef.current) resizeObserver.observe(containerRef.current);

      // For estate mode: fly to estate centroid at close-up zoom
      // For estate mode: use instant setView (no animation) for maximum speed
      const initView = () => {
        if (isEstate && estateBoundary) {
          const lat = estateBoundary.centroid_lat ?? 20;
          const lon = estateBoundary.centroid_lon ?? 78;
          setTimeout(() => {
            if (!viewer.isDestroyed()) {
              viewer.camera.flyTo({
                destination: Cartesian3.fromDegrees(lon, lat, 25_000),
                orientation: {
                  heading: CesiumMath.toRadians(0),
                  pitch: CesiumMath.toRadians(-55),
                  roll: 0,
                },
                duration: 2,
              });
            }
          }, 600);
        } else {
          // PERFORMANCE: setView is instant (no animation delay)
          const c = ESTATE_COORDS[resolvedEstateId] || ESTATE_COORDS['nagarhole'];
          viewer.camera.setView({
            destination: Cartesian3.fromDegrees(c.lon, c.lat, c.alt),
            orientation: {
              heading: CesiumMath.toRadians(0),
              pitch: CesiumMath.toRadians(-90),
              roll: 0,
            },
          });
        }
      };
      initView();

      return () => {
        pitchClampHandler();   // remove preRender listener
        resizeObserver.disconnect();
        if (zoomRafId) cancelAnimationFrame(zoomRafId);
        if (!viewer.isDestroyed()) viewer.destroy();
        viewerRef.current = null;
      };
    }, []);

    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      const c = ESTATE_COORDS[estateId] || ESTATE_COORDS['nagarhole'];
      setTimeout(() => {
        if (!viewer.isDestroyed()) {
          viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(c.lon, c.lat, c.alt),
            orientation: {
              heading: CesiumMath.toRadians(0),
              pitch:   CesiumMath.toRadians(-90),
              roll: 0,
            },
            duration: 2.5,
          });
        }
      }, 200);
    }, [estateId]);

    // ── Re-render zones when zone data or alert status changes ────────────
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      viewer.entities.removeAll();

      // Priority: render actual polygon zones from estatesData (matches the 2D map exactly)
      if (zonePolygons && zonePolygons.length > 0) {
        zonePolygons.forEach(zone => {
          const colors = ZONE_COLORS[zone.status] || ZONE_COLORS.normal;
          // estatesData stores [lat, lon] but Cesium needs fromDegrees(lon, lat)
          const positions = zone.coords.map(([lat, lon]) =>
            Cartesian3.fromDegrees(lon, lat)
          );
          if (positions.length < 3) return;

          viewer.entities.add({
            name: zone.id,
            polygon: {
              hierarchy: new PolygonHierarchy(positions),
              material: Color.fromCssColorString(colors.fill),
              outline: true,
              outlineColor: Color.fromCssColorString(colors.outline),
              outlineWidth: 2,
              height: 0,
              classificationType: ClassificationType.TERRAIN,
            },
          });
        });
      } else {
        // Fallback: render circle ellipses for legacy Zone[] objects
        zones.forEach(zone => {
          const colors = ZONE_COLORS[zone.status] || ZONE_COLORS.normal;
          viewer.entities.add({
            name: zone.name,
            position: Cartesian3.fromDegrees(zone.longitude, zone.latitude),
            ellipse: {
              semiMajorAxis: zone.radius,
              semiMinorAxis: zone.radius,
              material: Color.fromCssColorString(colors.fill),
              outline: true,
              outlineColor: Color.fromCssColorString(colors.outline),
              outlineWidth: 2,
              heightReference: HeightReference.CLAMP_TO_GROUND,
              classificationType: ClassificationType.TERRAIN,
            },
          });
        });
      }
    }, [zones, zonePolygons]);

    // ── Estate mode: render the estate polygon ────────────────────────────
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      if (isEstate && estateBoundary?.boundary?.coordinates[0]) {
        viewer.entities.removeAll();
        viewer.dataSources.removeAll();

        const coords = estateBoundary.boundary.coordinates[0];
        const positions = coords.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));

        viewer.entities.add({
          name: estateBoundary.name,
          polygon: {
            hierarchy: new PolygonHierarchy(positions),
            // Extruded height gives the polygon a visible 3D volume above the terrain
            extrudedHeight: 120,
            height: 0,
            perPositionHeight: false,
            material: Color.fromCssColorString('#00ffcc').withAlpha(0.18),
            outline: true,
            outlineColor: Color.fromCssColorString('#00ffcc').withAlpha(0.9),
            outlineWidth: 3,
            shadows: ShadowMode.DISABLED,
            closeTop: true,
            closeBottom: false,
          },
        });

        // Also add a ground-level outline for crisp edge on terrain
        viewer.entities.add({
          polyline: {
            positions: [...positions, positions[0]], // close the ring
            width: 2.5,
            material: Color.fromCssColorString('#00ffcc').withAlpha(0.95),
            clampToGround: true,
          },
        });

        // Fly to estate
        const lat = estateBoundary.centroid_lat ?? 20;
        const lon = estateBoundary.centroid_lon ?? 78;
        setTimeout(() => {
          if (!viewer.isDestroyed()) {
            viewer.camera.flyTo({
              destination: Cartesian3.fromDegrees(lon, lat, 25_000),
              orientation: {
                heading: CesiumMath.toRadians(0),
                pitch: CesiumMath.toRadians(-55),
                roll: 0,
              },
              duration: 1.5,
            });
          }
        }, 300);
        return;
      }

      // ── Estate mode: render zone polygons as ground-clamped outlines ──────
      // Use estatesData zones directly so shapes match the 2D MapPanel exactly.
      // Do nothing here — zone polygons are handled by the zones useEffect above.
    }, [estateId, isEstate, estateBoundary]);


    const handleReset = () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      const c = ESTATE_COORDS[resolvedEstateId] || ESTATE_COORDS['nagarhole'];
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(c.lon, c.lat, c.alt),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-90),
          roll: 0,
        },
      });
    };

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%', background: '#0a0f1a' }}
        />
        <button
          onClick={handleReset}
          title="Reset view"
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 10,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid rgba(0, 255, 200, 0.25)',
            background: 'rgba(10, 15, 26, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color 0.2s, background 0.2s',
            outline: 'none',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0, 255, 200, 0.7)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 255, 200, 0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0, 255, 200, 0.25)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(10, 15, 26, 0.65)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,255,200,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <circle cx="12" cy="12" r="2" fill="rgba(0,255,200,0.85)" />
          </svg>
        </button>
      </div>
    );
  }
);

export default GlobeViewer;
