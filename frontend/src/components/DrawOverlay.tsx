import { useCallback, useRef, useEffect, type MouseEvent } from 'react';
import type { DrawPoint } from '../hooks/useDrawPolygon';

interface DrawOverlayProps {
  points: DrawPoint[];
  isClosed: boolean;
  hoverPoint: DrawPoint | null;
  isDragging: boolean;
  dragIndex: number | null;
  canClose: boolean;
  snapDistancePx: number;
  onAddPoint: (pt: DrawPoint) => void;
  onClosePolygon: () => void;
  onSetHover: (pt: DrawPoint | null) => void;
  onMoveVertex: (index: number, pt: DrawPoint) => void;
  onStartDrag: (index: number) => void;
  onStopDrag: () => void;
  onDeleteVertex: (index: number) => void;
  /** Convert screen coords → lat/lon. Provided by parent (globe) */
  screenToLatLon: (x: number, y: number) => DrawPoint | null;
  /** Convert lat/lon → screen coords. Provided by parent (globe) */
  latLonToScreen: (pt: DrawPoint) => { x: number; y: number } | null;
}

export default function DrawOverlay({
  points,
  isClosed,
  hoverPoint,
  isDragging,
  dragIndex,
  canClose,
  snapDistancePx,
  onAddPoint,
  onClosePolygon,
  onSetHover,
  onMoveVertex,
  onStartDrag,
  onStopDrag,
  onDeleteVertex,
  screenToLatLon,
  latLonToScreen,
}: DrawOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Convert all points to screen coords
  const screenPoints = points.map((p) => latLonToScreen(p)).filter(Boolean) as {
    x: number;
    y: number;
  }[];
  const hoverScreen = hoverPoint ? latLonToScreen(hoverPoint) : null;

  // Check if cursor is near the first point (for snap-to-close)
  const isNearFirst = (): boolean => {
    if (points.length < 3 || isClosed || !hoverScreen || screenPoints.length === 0) return false;
    const first = screenPoints[0];
    const dx = hoverScreen.x - first.x;
    const dy = hoverScreen.y - first.y;
    return Math.sqrt(dx * dx + dy * dy) < snapDistancePx;
  };

  const nearFirst = isNearFirst();

  // Handle click on SVG
  const handleClick = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (isClosed) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check snap-to-close
      if (canClose && screenPoints.length > 0) {
        const first = screenPoints[0];
        const dx = x - first.x;
        const dy = y - first.y;
        if (Math.sqrt(dx * dx + dy * dy) < snapDistancePx) {
          onClosePolygon();
          return;
        }
      }

      const pt = screenToLatLon(x, y);
      if (pt) onAddPoint(pt);
    },
    [isClosed, canClose, screenPoints, snapDistancePx, onClosePolygon, screenToLatLon, onAddPoint]
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pt = screenToLatLon(x, y);

      if (isDragging && dragIndex !== null && pt) {
        onMoveVertex(dragIndex, pt);
      } else {
        onSetHover(pt);
      }
    },
    [isDragging, dragIndex, screenToLatLon, onMoveVertex, onSetHover]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) onStopDrag();
  }, [isDragging, onStopDrag]);

  // Global mouseup to catch release outside SVG
  useEffect(() => {
    if (!isDragging) return;
    const up = () => onStopDrag();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [isDragging, onStopDrag]);

  // Build path
  const buildPath = (): string => {
    if (screenPoints.length === 0) return '';
    let d = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
    for (let i = 1; i < screenPoints.length; i++) {
      d += ` L ${screenPoints[i].x} ${screenPoints[i].y}`;
    }
    if (isClosed) d += ' Z';
    return d;
  };

  // Build preview line (last point → cursor)
  const previewLine = (): string | null => {
    if (isClosed || screenPoints.length === 0 || !hoverScreen) return null;
    const last = screenPoints[screenPoints.length - 1];
    return `M ${last.x} ${last.y} L ${hoverScreen.x} ${hoverScreen.y}`;
  };

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full z-20"
      style={{
        cursor: isClosed ? (isDragging ? 'grabbing' : 'default') : 'crosshair',
        pointerEvents: 'all',
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Polygon fill (when closed) */}
      {isClosed && screenPoints.length >= 3 && (
        <path
          d={buildPath()}
          fill="rgba(16, 185, 129, 0.2)"
          stroke="rgba(16, 185, 129, 0.8)"
          strokeWidth="2"
        />
      )}

      {/* Edges (when open) */}
      {!isClosed && screenPoints.length >= 2 && (
        <path d={buildPath()} fill="none" stroke="rgba(16, 185, 129, 0.8)" strokeWidth="2" />
      )}

      {/* Preview line (dashed, cursor → last point) */}
      {previewLine() && (
        <path
          d={previewLine()!}
          fill="none"
          stroke="rgba(16, 185, 129, 0.4)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
      )}

      {/* Snap indicator on first point */}
      {nearFirst && screenPoints.length > 0 && (
        <circle
          cx={screenPoints[0].x}
          cy={screenPoints[0].y}
          r={snapDistancePx}
          fill="rgba(16, 185, 129, 0.1)"
          stroke="rgba(16, 185, 129, 0.6)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}

      {/* Vertex circles */}
      {screenPoints.map((sp, i) => (
        <circle
          key={i}
          cx={sp.x}
          cy={sp.y}
          r={i === 0 && !isClosed ? 7 : 5}
          fill={i === 0 && !isClosed ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.9)'}
          stroke="white"
          strokeWidth="1.5"
          style={{ cursor: isClosed ? 'grab' : 'pointer' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (isClosed) onStartDrag(i);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isClosed) onDeleteVertex(i);
          }}
        />
      ))}

      {/* Edge midpoints (insert vertex) — only when closed */}
      {isClosed &&
        screenPoints.map((sp, i) => {
          const next = screenPoints[(i + 1) % screenPoints.length];
          const mx = (sp.x + next.x) / 2;
          const my = (sp.y + next.y) / 2;
          return (
            <circle
              key={`mid-${i}`}
              cx={mx}
              cy={my}
              r={3}
              fill="rgba(16, 185, 129, 0.3)"
              stroke="rgba(16, 185, 129, 0.5)"
              strokeWidth="1"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                // Insert midpoint as new vertex
                const pt = screenToLatLon(mx, my);
                if (pt) {
                  const newPts = [...points];
                  newPts.splice(i + 1, 0, pt);
                  onMoveVertex(i + 1, pt); // hacky but triggers re-render
                }
              }}
            />
          );
        })}
    </svg>
  );
}
