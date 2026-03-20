import React, { useState, useRef } from 'react';
import { MapData, MapRoom, Child } from '../../types';

interface HomeMapProps {
  mapData: MapData;
  children: Child[];
  selectedChildId?: string;
  onLocationSet?: (x: number, y: number, roomName: string) => void;
  editMode?: boolean;
}

export default function HomeMap({ mapData, children, selectedChildId, onLocationSet, editMode = false }: HomeMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  const viewBox = `0 0 ${mapData.width} ${mapData.height}`;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editMode || !onLocationSet) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = mapData.width / rect.width;
    const scaleY = mapData.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find which room was clicked
    const clickedRoom = mapData.rooms.find(
      room => x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height
    );

    onLocationSet(x, y, clickedRoom?.nameHe || 'חדר לא מזוהה');
  };

  const getChildInRoom = (room: MapRoom) => {
    return children.filter(child => {
      const cx = child.wake_point_x;
      const cy = child.wake_point_y;
      return cx >= room.x && cx <= room.x + room.width && cy >= room.y && cy <= room.y + room.height;
    });
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={`w-full h-auto ${editMode ? 'cursor-crosshair' : 'cursor-default'}`}
        onClick={handleSvgClick}
        style={{ maxHeight: '60vh' }}
      >
        {/* Background */}
        <rect width={mapData.width} height={mapData.height} fill="#f8fafc" />

        {/* Rooms */}
        {mapData.rooms.map(room => {
          const isHovered = hoveredRoom === room.id;
          const childrenInRoom = getChildInRoom(room);

          return (
            <g key={room.id}>
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={isHovered ? '#dbeafe' : room.color}
                stroke="#94a3b8"
                strokeWidth={2}
                rx={4}
                onMouseEnter={() => setHoveredRoom(room.id)}
                onMouseLeave={() => setHoveredRoom(null)}
              />
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2 - (childrenInRoom.length > 0 ? 8 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fontWeight="600"
                fill="#475569"
                fontFamily="Arial, sans-serif"
              >
                {room.nameHe}
              </text>
              {childrenInRoom.map((child, idx) => (
                <text
                  key={child.id}
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 + 12 + idx * 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="#1e3a5f"
                  fontFamily="Arial, sans-serif"
                >
                  👤 {child.name}
                </text>
              ))}
            </g>
          );
        })}

        {/* Forbidden zones */}
        {mapData.forbiddenZones?.map((zone, idx) => (
          <rect
            key={idx}
            x={zone.x}
            y={zone.y}
            width={zone.width}
            height={zone.height}
            fill="rgba(239, 68, 68, 0.15)"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="6,3"
            rx={4}
          />
        ))}

        {/* Charging station */}
        {mapData.chargingStation && (
          <g>
            <circle
              cx={mapData.chargingStation.x}
              cy={mapData.chargingStation.y}
              r={12}
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth={2}
            />
            <text
              x={mapData.chargingStation.x}
              y={mapData.chargingStation.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={14}
            >
              ⚡
            </text>
          </g>
        )}

        {/* Robot position */}
        {mapData.robotPosition && (
          <g>
            <circle
              cx={mapData.robotPosition.x}
              cy={mapData.robotPosition.y}
              r={16}
              fill="#1e3a5f"
              stroke="white"
              strokeWidth={3}
              opacity={0.9}
            />
            <text
              x={mapData.robotPosition.x}
              y={mapData.robotPosition.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={16}
            >
              🤖
            </text>
          </g>
        )}

        {/* Wake points for children */}
        {children.map(child => {
          const isSelected = child.id === selectedChildId;
          const cx = child.wake_point_x;
          const cy = child.wake_point_y;

          if (!cx && !cy) return null;

          return (
            <g key={child.id}>
              {/* Safety radius */}
              <circle
                cx={cx}
                cy={cy}
                r={child.safety_radius || 30}
                fill={isSelected ? 'rgba(249, 115, 22, 0.15)' : 'rgba(30, 58, 95, 0.1)'}
                stroke={isSelected ? '#f97316' : '#1e3a5f'}
                strokeWidth={1.5}
                strokeDasharray="4,2"
              />
              {/* Wake point marker */}
              <circle
                cx={cx}
                cy={cy}
                r={10}
                fill={isSelected ? '#f97316' : '#1e3a5f'}
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fill="white"
                fontWeight="bold"
                fontFamily="Arial, sans-serif"
              >
                {child.name.charAt(0)}
              </text>
            </g>
          );
        })}

        {/* Edit mode hint */}
        {editMode && (
          <text
            x={mapData.width / 2}
            y={mapData.height - 15}
            textAnchor="middle"
            fontSize={11}
            fill="#6b7280"
            fontFamily="Arial, sans-serif"
          >
            לחץ על המפה לבחירת מיקום השכמה
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 border-t border-gray-100 flex-wrap text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-primary-700 border-2 border-white shadow-sm" />
          <span>נקודת השכמה</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-white shadow-sm" />
          <span>תחנת טעינה</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border-2 border-red-400 border-dashed bg-red-50" />
          <span>אזור אסור</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-primary-800 flex items-center justify-center">
            <span className="text-white text-xs">🤖</span>
          </div>
          <span>הרובוט</span>
        </div>
      </div>
    </div>
  );
}
