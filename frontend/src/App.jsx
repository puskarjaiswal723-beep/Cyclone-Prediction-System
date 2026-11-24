
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import MonitoredAreas from "./MonitoredAreas";

import {
  Activity,
  Wind,
  Gauge,
  Waves,
  MapPin,
  Search,
  Bell,
  ChevronDown,
  Compass,
  CircleDot,
  ArrowUpRight,
  Clock3,
  SlidersHorizontal,
  Eye,
  Radio,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar
} from "recharts";

// --------------------------------------------------
// ILLUSTRATIVE CHART DATA
// --------------------------------------------------

const windData = [
  { time: "06:00", speed: 92 },
  { time: "08:00", speed: 98 },
  { time: "10:00", speed: 105 },
  { time: "12:00", speed: 112 },
  { time: "14:00", speed: 118 },
  { time: "16:00", speed: 124 },
  { time: "18:00", speed: 121 }
];

const historyData = [
  { month: "Jan", count: 2 },
  { month: "Feb", count: 1 },
  { month: "Mar", count: 3 },
  { month: "Apr", count: 4 },
  { month: "May", count: 7 },
  { month: "Jun", count: 5 },
  { month: "Jul", count: 3 },
  { month: "Aug", count: 6 },
  { month: "Sep", count: 8 },
  { month: "Oct", count: 9 },
  { month: "Nov", count: 7 },
  { month: "Dec", count: 3 }
];

// --------------------------------------------------
// DEFAULT MONITORED LOCATIONS
// --------------------------------------------------

const STORAGE_KEY = "cyclonex-monitored-areas";

const DEFAULT_MONITORED_AREAS = [
  {
    id: "mumbai",
    name: "Mumbai",
    latitude: 19.076,
    longitude: 72.8777
  },
  {
    id: "goa",
    name: "Panaji",
    latitude: 15.4909,
    longitude: 73.8278
  },
  {
    id: "kochi",
    name: "Kochi",
    latitude: 9.9312,
    longitude: 76.2673
  },
  {
    id: "chennai",
    name: "Chennai",
    latitude: 13.0827,
    longitude: 80.2707
  },
  {
    id: "vizag",
    name: "Visakhapatnam",
    latitude: 17.6868,
    longitude: 83.2185
  },
  {
    id: "puri",
    name: "Puri",
    latitude: 19.8135,
    longitude: 85.8312
  },
  {
    id: "kolkata",
    name: "Kolkata",
    latitude: 22.5726,
    longitude: 88.3639
  },
  {
    id: "port-blair",
    name: "Port Blair",
    latitude: 11.6234,
    longitude: 92.7265
  }
];

// --------------------------------------------------
// WEATHER DESCRIPTION
// --------------------------------------------------

function getWeatherDescription(code) {
  const descriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail"
  };

  return descriptions[code] || "Unknown conditions";
}

// --------------------------------------------------
// DATE FORMATTER
// --------------------------------------------------

function formatAlertDate(value) {
  if (!value) return "Not provided";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// --------------------------------------------------
// SAFETY LEVEL CLASSIFICATION
// --------------------------------------------------

function getSafetyLevel(grade) {
  const value = String(grade || "").toLowerCase();

  if (value.includes("typhoon")) {
    return {
      level: 4,
      label: "Severe",
      color: "#ef4444",
      background: "rgba(239, 68, 68, 0.12)",
      description:
        "Very intense cyclone category. Follow official warnings and safety instructions."
    };
  }

  if (
    value.includes("severe tropical storm") ||
    value.includes("tropical cyclone of ts intensity or higher")
  ) {
    return {
      level: 3,
      label: "High Alert",
      color: "#f97316",
      background: "rgba(249, 115, 22, 0.12)",
      description:
        "High-intensity cyclone category. Monitor official advisories."
    };
  }

  if (value.includes("tropical storm")) {
    return {
      level: 2,
      label: "Caution",
      color: "#eab308",
      background: "rgba(234, 179, 8, 0.12)",
      description:
        "Tropical storm category. Continue monitoring weather conditions."
    };
  }

  if (value.includes("tropical depression")) {
    return {
      level: 1,
      label: "Monitor",
      color: "#22c55e",
      background: "rgba(34, 197, 94, 0.12)",
      description:
        "Lower-intensity cyclone category. Continue monitoring weather updates."
    };
  }

  return {
    level: null,
    label: "Unclassified",
    color: "#94a3b8",
    background: "rgba(148, 163, 184, 0.12)",
    description:
      "No safety level mapping is available for this predicted category."
  };
}

// --------------------------------------------------
// METRIC COMPONENT
// --------------------------------------------------

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  tone = "cyan"
}) {
  return (
    <article className="metric card">
      <div className="metric-top">
        <span className={`metric-icon ${tone}`}>
          <Icon size={18} />
        </span>

        <span className="trend">{trend}</span>
      </div>

      <div className="metric-label">{label}</div>

      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
    </article>
  );
}

// --------------------------------------------------
// MAP STYLES
// --------------------------------------------------

const NORMAL_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";

const SATELLITE_STYLE = {
  version: 8,

  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      attribution: "Tiles © Esri"
    }
  },

  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "esri",
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

// --------------------------------------------------
// MAP PANEL
// --------------------------------------------------

function MapPanel({ selectedLocation }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const searchMarkerRef = useRef(null);

  const [mapMode, setMapMode] = useState("normal");
  const [mapReady, setMapReady] = useState(false);

  // INITIALIZE MAP

  useEffect(() => {
    if (!mapContainer.current) return;

    setMapReady(false);

    const is3D = mapMode === "3d";

    const map = new maplibregl.Map({
      container: mapContainer.current,

      style:
        mapMode === "satellite"
          ? SATELLITE_STYLE
          : NORMAL_STYLE,

      center: [87.2, 17.5],
      zoom: 4.2,
      pitch: is3D ? 55 : 0,
      bearing: is3D ? -18 : 0,
      maxPitch: 80,

      ...(is3D
        ? { projection: { type: "globe" } }
        : {})
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true
      }),
      "top-right"
    );

    map.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
      }),
      "bottom-left"
    );

    map.on("load", () => {
      // Illustrative sample track.
      // NOT a real cyclone observation.

      map.addSource("sample-cyclone-track", {
        type: "geojson",

        data: {
          type: "Feature",

          geometry: {
            type: "LineString",

            coordinates: [
              [91.1, 12.8],
              [90.0, 14.0],
              [89.1, 15.2],
              [88.0, 16.7],
              [87.2, 17.5]
            ]
          },

          properties: {}
        }
      });

      map.addLayer({
        id: "sample-cyclone-track-line",
        type: "line",
        source: "sample-cyclone-track",

        paint: {
          "line-color": "#00e5ff",
          "line-width": 3,
          "line-dasharray": [2, 1.5]
        }
      });

      if (is3D) {
        try {
          map.addSource("cyclonex-terrain", {
            type: "raster-dem",
            url: "https://demotiles.maplibre.org/terrain-tiles/tiles.json",
            tileSize: 256,
            maxzoom: 12
          });

          map.setTerrain({
            source: "cyclonex-terrain",
            exaggeration: 1.25
          });
        } catch (error) {
          console.warn(
            "Terrain could not be enabled:",
            error
          );
        }
      }

      setMapReady(true);
    });

    map.on("error", (event) => {
      console.warn(
        "Map error:",
        event.error || event
      );
    });

    return () => {
      map.remove();
      mapRef.current = null;
      searchMarkerRef.current = null;
    };
  }, [mapMode]);

  // SEARCHED LOCATION MARKER

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady || !selectedLocation) {
      return;
    }

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
    }

    const popupContent = document.createElement("div");

    popupContent.style.background = "#101e2b";
    popupContent.style.color = "#eaf4fb";
    popupContent.style.padding = "8px";
    popupContent.style.borderRadius = "8px";
    popupContent.style.fontFamily = "Arial, sans-serif";

    const heading = document.createElement("h3");
    heading.textContent = selectedLocation.name;
    heading.style.margin = "0";
    heading.style.color = "#35c9dc";
    heading.style.fontSize = "15px";

    const coordinates = document.createElement("p");
    coordinates.textContent =
      `${selectedLocation.latitude.toFixed(3)}°, ${selectedLocation.longitude.toFixed(3)}°`;
    coordinates.style.color = "#eaf4fb";
    coordinates.style.fontSize = "12px";
    coordinates.style.margin = "8px 0 0";

    popupContent.append(heading, coordinates);

    const popup = new maplibregl.Popup({
      offset: 22,
      maxWidth: "280px",
      className: "cyclonex-weather-popup"
    }).setDOMContent(popupContent);

    const marker = new maplibregl.Marker({
      color: "#00ff88"
    })
      .setLngLat([
        selectedLocation.longitude,
        selectedLocation.latitude
      ])
      .setPopup(popup)
      .addTo(map);

    searchMarkerRef.current = marker;

    map.flyTo({
      center: [
        selectedLocation.longitude,
        selectedLocation.latitude
      ],
      zoom: 6,
      essential: true
    });

    return () => {
      marker.remove();

      if (searchMarkerRef.current === marker) {
        searchMarkerRef.current = null;
      }
    };
  }, [selectedLocation, mapReady]);

  // MONITORED LOCATION MARKERS

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) return;

    let cancelled = false;
    const markers = [];

    async function loadMonitoredLocations() {
      let areas = DEFAULT_MONITORED_AREAS;

      try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            areas = parsed;
          }
        }
      } catch (error) {
        console.error(
          "Unable to load monitored locations:",
          error
        );
      }

      areas = areas.filter((area) =>
        area &&
        typeof area.name === "string" &&
        Number.isFinite(Number(area.latitude)) &&
        Number.isFinite(Number(area.longitude))
      );

      const results = await Promise.allSettled(
        areas.map(async (area) => {
          const params = new URLSearchParams({
            latitude: area.latitude,
            longitude: area.longitude,

            current:
              "temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m",

            wind_speed_unit: "kmh",
            timezone: "auto"
          });

          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?${params}`
          );

          if (!response.ok) {
            throw new Error(
              `Weather unavailable for ${area.name}`
            );
          }

          const data = await response.json();

          if (!data.current) {
            throw new Error(
              `No weather data for ${area.name}`
            );
          }

          return {
            area,
            weather: data.current
          };
        })
      );

      if (cancelled) return;

      results.forEach((result) => {
        if (result.status !== "fulfilled") {
          console.warn(
            "Monitored location weather error:",
            result.reason
          );
          return;
        }

        const { area, weather } = result.value;

        const wind = weather.wind_speed_10m;
        const gust = weather.wind_gusts_10m;

        let color = "#22c55e";
        let status = "Normal conditions";

        if (wind >= 60 || gust >= 80) {
          color = "#ef4444";
          status = "Strong winds";
        } else if (wind >= 40 || gust >= 55) {
          color = "#facc15";
          status = "Elevated winds";
        }

        const popupContent = document.createElement("div");

        popupContent.style.minWidth = "210px";
        popupContent.style.padding = "8px";
        popupContent.style.background = "#101e2b";
        popupContent.style.color = "#eaf4fb";
        popupContent.style.fontFamily = "Arial, sans-serif";
        popupContent.style.borderRadius = "10px";

        const heading = document.createElement("h3");

        heading.textContent = area.name;
        heading.style.margin = "0 0 10px";
        heading.style.fontSize = "17px";
        heading.style.fontWeight = "700";
        heading.style.color = "#35c9dc";

        const statusText = document.createElement("p");

        statusText.textContent = status;
        statusText.style.fontWeight = "bold";
        statusText.style.margin = "0 0 12px";
        statusText.style.color = color;
        statusText.style.fontSize = "13px";

        const details = document.createElement("div");

        const weatherDetails = [
          `Temperature: ${weather.temperature_2m} °C`,
          `Wind speed: ${wind} km/h`,
          `Wind gusts: ${gust} km/h`,
          `Humidity: ${weather.relative_humidity_2m}%`,
          `Pressure: ${weather.pressure_msl} hPa`
        ];

        weatherDetails.forEach((item) => {
          const line = document.createElement("p");

          line.textContent = item;
          line.style.margin = "7px 0";
          line.style.fontSize = "12px";
          line.style.color = "#eaf4fb";
          line.style.fontWeight = "500";

          details.appendChild(line);
        });

        const source = document.createElement("small");

        source.textContent = "Source: Open-Meteo";
        source.style.display = "block";
        source.style.marginTop = "12px";
        source.style.paddingTop = "8px";
        source.style.borderTop = "1px solid #33485b";
        source.style.color = "#9db4c8";
        source.style.fontSize = "10px";

        popupContent.append(
          heading,
          statusText,
          details,
          source
        );

        const popup = new maplibregl.Popup({
          offset: 25,
          closeButton: true,
          closeOnClick: false,
          maxWidth: "280px",
          className: "cyclonex-weather-popup"
        }).setDOMContent(popupContent);

        const marker = new maplibregl.Marker({
          color,
          scale: 1.15
        })
          .setLngLat([
            Number(area.longitude),
            Number(area.latitude)
          ])
          .setPopup(popup)
          .addTo(map);

        markers.push(marker);
      });
    }

    loadMonitoredLocations();

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
    };
  }, [mapReady]);

  // MAP MODE BUTTONS

  const modes = [
    {
      id: "satellite",
      label: "Satellite",
      icon: MapPin
    },
    {
      id: "normal",
      label: "Normal",
      icon: MapPin
    },
    {
      id: "3d",
      label: "3D Globe",
      icon: Compass
    }
  ];

  return (
    <section className="card map-card real-map-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            GEOSPATIAL MONITORING
          </div>

          <h2>Live cyclone tracking</h2>
        </div>

        <span className="map-live-state">
          <i className={mapReady ? "ready" : ""} />

          {mapReady ? "MAP READY" : "LOADING MAP"}
        </span>
      </div>

      <div
        className="map-mode-toolbar"
        role="group"
        aria-label="Map display mode"
      >
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMapMode(id)}
            className={
              mapMode === id
                ? "map-mode active"
                : "map-mode"
            }
            aria-pressed={mapMode === id}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}

        <span className="map-updated">
          <span className="pulse" />
          Interactive map
        </span>
      </div>

      <div
        className={`maplibre-frame ${
          mapMode === "satellite"
            ? "satellite-frame"
            : ""
        }`}
      >
        <div
          ref={mapContainer}
          className="maplibre-container"
        />

        {!mapReady && (
          <div className="map-loading">
            Loading map tiles…
          </div>
        )}

        <div className="map-mode-caption">
          {mapMode === "satellite"
            ? "ESRI SATELLITE IMAGERY"
            : mapMode === "3d"
              ? "3D GLOBE · TERRAIN WHEN AVAILABLE"
              : "OPEN STREET MAP · STANDARD"}
        </div>
      </div>

      <div className="map-marker-legend">
        <span>
          <i style={{ background: "#22c55e" }} />
          Normal
        </span>

        <span>
          <i style={{ background: "#facc15" }} />
          Elevated winds
        </span>

        <span>
          <i style={{ background: "#ef4444" }} />
          Strong winds
        </span>
      </div>

      <div className="map-footer">
        <span>
          <MapPin size={14} />

          {selectedLocation
            ? selectedLocation.name
            : "North Indian Ocean region"}
        </span>

        <span>
          {selectedLocation
            ? "Selected location"
            : "Illustrative sample track"}
        </span>
      </div>
    </section>
  );
}

// --------------------------------------------------
// CYCLONE ALERTS PANEL
// --------------------------------------------------

function CycloneAlertsPanel({
  alerts,
  loading,
  error,
  updatedAt,
  onRefresh
}) {
  return (
    <section className="card cyclone-alerts-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            OFFICIAL WEATHER ALERTS
          </div>

          <h2>Cyclone alerts & affected areas</h2>
        </div>

        <button
          className="alert-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh cyclone alerts"
          aria-label="Refresh cyclone alerts"
        >
          <RefreshCw
            size={15}
            className={loading ? "refresh-spinning" : ""}
          />

          {loading ? "Updating..." : "Refresh"}
        </button>
      </div>

      <div className="alert-source-row">
        <span className="alert-source">
          <ShieldCheck size={14} />
          India Meteorological Department
        </span>

        <span className="alert-update-time">
          {updatedAt
            ? `Updated ${formatAlertDate(updatedAt)}`
            : "Waiting for feed"}
        </span>
      </div>

      {error && (
        <div className="alert-message alert-error">
          <AlertTriangle size={17} />

          <div>
            <b>Unable to retrieve cyclone alerts</b>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!error && loading && alerts.length === 0 && (
        <div className="alert-empty">
          <RefreshCw
            size={20}
            className="refresh-spinning"
          />

          <p>Checking the IMD alert feed...</p>
        </div>
      )}

      {!error && !loading && alerts.length === 0 && (
        <div className="alert-empty">
          <ShieldCheck size={22} />

          <div>
            <b>No matching cyclone alerts in the feed</b>

            <p>
              The latest feed response contains no alerts
              matching the current cyclone filter. This does
              not establish that no cyclone exists or that
              no other weather warnings are active.
            </p>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="alerts-list">
          {alerts.map((alert, index) => {
            const severity = (
              alert.severity || "Unknown"
            ).toLowerCase();

            const severityClass =
              severity === "extreme"
                ? "severity-extreme"
                : severity === "severe"
                  ? "severity-severe"
                  : severity === "moderate"
                    ? "severity-moderate"
                    : "severity-unknown";

            const title =
              alert.headline ||
              alert.event ||
              "Cyclone-related weather alert";

            const affectedAreas =
              alert.areaDesc ||
              alert.affected_areas ||
              alert.area ||
              "";

            const description =
              alert.description ||
              alert.summary ||
              "No additional description provided.";

            return (
              <article
                className="alert-item"
                key={alert.id || alert.identifier || index}
              >
                <div className="alert-item-top">
                  <div className="alert-item-title">
                    <AlertTriangle size={17} />
                    <b>{title}</b>
                  </div>

                  <span
                    className={`alert-severity ${severityClass}`}
                  >
                    {alert.severity || "Unknown severity"}
                  </span>
                </div>

                <p className="alert-description">
                  {description}
                </p>

                {affectedAreas && (
                  <div className="alert-area">
                    <MapPin size={14} />

                    <div>
                      <b>Affected areas</b>
                      <span>{affectedAreas}</span>
                    </div>
                  </div>
                )}

                <div className="alert-metadata">
                  {alert.urgency && (
                    <span>
                      Urgency: {alert.urgency}
                    </span>
                  )}

                  {alert.certainty && (
                    <span>
                      Certainty: {alert.certainty}
                    </span>
                  )}
                </div>

                <div className="alert-dates">
                  {alert.effective && (
                    <span>
                      Effective: {formatAlertDate(alert.effective)}
                    </span>
                  )}

                  {alert.expires && (
                    <span>
                      Expires: {formatAlertDate(alert.expires)}
                    </span>
                  )}
                </div>

                {alert.link && (
                  <a
                    className="alert-link"
                    href={alert.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View original alert
                    <ExternalLink size={13} />
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="alert-disclaimer">
        <AlertTriangle size={14} />

        <span>
          Alerts are retrieved from the configured IMD feed.
          Always consult official IMD bulletins for current
          warnings and safety instructions.
        </span>
      </div>
    </section>
  );
}

// --------------------------------------------------
// AI CLASSIFICATION PANEL
// --------------------------------------------------

function AIClassificationPanel({
  selectedLocation,
  weatherData,
  weatherLoading,
  weatherError,
  prediction,
  predictionLoading,
  error,
  onPredict
}) {
  const current = weatherData?.current;

  const safety = prediction
    ? getSafetyLevel(prediction.predicted_grade)
    : null;

  return (
    <section className="card ai-classification-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            MACHINE LEARNING
          </div>

          <h2>AI cyclone intensity classification</h2>

          <p>
            Automatically fetch atmospheric conditions
            and run the trained ML model.
          </p>
        </div>

        <span className="live-pill">
          <i /> MODEL READY
        </span>
      </div>

      {!selectedLocation ? (
        <div className="alert-empty">
          <Search size={24} />

          <div>
            <b>No location selected</b>

            <p>
              Search for a location using the search bar above.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="storm-name">
            <div className="storm-symbol">
              <MapPin size={22} />
            </div>

            <div>
              <b>{selectedLocation.name}</b>

              <small>
                {selectedLocation.latitude.toFixed(3)}°,
                {" "}
                {selectedLocation.longitude.toFixed(3)}°
              </small>
            </div>
          </div>

          <div className="ai-weather-grid">
            <div className="ai-weather-item">
              <span>Mean sea-level pressure</span>

              <b>
                {weatherLoading
                  ? "Loading..."
                  : current
                    ? `${current.pressure_msl} hPa`
                    : "--"}
              </b>
            </div>

            <div className="ai-weather-item">
              <span>Temperature</span>

              <b>
                {current
                  ? `${current.temperature_2m} °C`
                  : "--"}
              </b>
            </div>

            <div className="ai-weather-item">
              <span>Humidity</span>

              <b>
                {current
                  ? `${current.relative_humidity_2m}%`
                  : "--"}
              </b>
            </div>

            <div className="ai-weather-item">
              <span>Wind speed</span>

              <b>
                {current
                  ? `${current.wind_speed_10m} km/h`
                  : "--"}
              </b>
            </div>

            <div className="ai-weather-item">
              <span>Wind gusts</span>

              <b>
                {current
                  ? `${current.wind_gusts_10m} km/h`
                  : "--"}
              </b>
            </div>

            <div className="ai-weather-item">
              <span>Wind direction</span>

              <b>
                {current
                  ? `${current.wind_direction_10m}°`
                  : "--"}
              </b>
            </div>
          </div>

          {weatherLoading && (
            <div className="alert-empty">
              <RefreshCw
                className="refresh-spinning"
                size={18}
              />

              <p>Fetching weather observations...</p>
            </div>
          )}

          {weatherError && (
            <div className="alert-message alert-error">
              <AlertTriangle size={17} />
              <p>{weatherError}</p>
            </div>
          )}

          <button
            className="full-btn"
            onClick={onPredict}
            disabled={
              predictionLoading ||
              weatherLoading ||
              !current
            }
          >
            {predictionLoading
              ? "Classifying..."
              : "Run AI Classification"}

            <ArrowUpRight size={16} />
          </button>

          {error && (
            <p
              style={{
                color: "#ff7777",
                fontSize: "12px"
              }}
            >
              {error}
            </p>
          )}

          {prediction && (
            <div className="ai-result-panel">
              <div className="eyebrow">
                MODEL CLASSIFICATION RESULT
              </div>

              <h2>{prediction.predicted_grade}</h2>

              <div className="confidence">
                <div>
                  <span>Model confidence</span>
                  <b>{prediction.confidence}%</b>
                </div>

                <div className="progress">
                  <i
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          Number(prediction.confidence)
                        )
                      )}%`
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: "24px",
                  padding: "20px",
                  borderRadius: "12px",
                  background: safety.background,
                  border: `1px solid ${safety.color}55`
                }}
              >
                <div className="eyebrow">
                  INDICATIVE SAFETY ASSESSMENT
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    marginTop: "16px"
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      minWidth: "64px",
                      borderRadius: "14px",
                      display: "grid",
                      placeItems: "center",
                      background: `${safety.color}22`,
                      border: `1px solid ${safety.color}`,
                      color: safety.color,
                      fontSize: "26px",
                      fontWeight: "800"
                    }}
                  >
                    {safety.level ?? "—"}
                  </div>

                  <div>
                    <h2
                      style={{
                        color: safety.color,
                        margin: 0,
                        fontSize: "22px"
                      }}
                    >
                      {safety.label}
                    </h2>

                    <p
                      style={{
                        margin: "5px 0 0",
                        color: "#a8b8c8",
                        fontSize: "13px"
                      }}
                    >
                      {safety.level
                        ? `Safety Level ${safety.level}`
                        : "No mapped level"}
                    </p>
                  </div>
                </div>

                <p
                  style={{
                    marginTop: "16px",
                    lineHeight: "1.6",
                    fontSize: "13px",
                    color: "#c4d2df"
                  }}
                >
                  {safety.description}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "7px",
                    marginTop: "18px"
                  }}
                >
                  {[
                    {
                      level: 1,
                      label: "Monitor",
                      color: "#22c55e"
                    },
                    {
                      level: 2,
                      label: "Caution",
                      color: "#eab308"
                    },
                    {
                      level: 3,
                      label: "High",
                      color: "#f97316"
                    },
                    {
                      level: 4,
                      label: "Severe",
                      color: "#ef4444"
                    }
                  ].map((item) => (
                    <div
                      key={item.level}
                      style={{
                        padding: "9px 3px",
                        borderRadius: "7px",
                        textAlign: "center",
                        background:
                          safety.level === item.level
                            ? `${item.color}25`
                            : "rgba(255,255,255,0.035)",
                        border:
                          safety.level === item.level
                            ? `1px solid ${item.color}`
                            : "1px solid rgba(255,255,255,0.08)"
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "800",
                          color: item.color
                        }}
                      >
                        L{item.level}
                      </div>

                      <div
                        style={{
                          fontSize: "10px",
                          marginTop: "4px",
                          color: "#a8b8c8"
                        }}
                      >
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="insight">
            <span className="insight-icon">
              <ShieldCheck size={16} />
            </span>

            <div>
              <b>Research prototype</b>

              <p>
                Weather observations are retrieved automatically
                from Open-Meteo. Mean sea-level pressure is not
                necessarily cyclone central pressure. The safety
                level is an experimental mapping of the model's
                predicted category, not a verified local safety
                assessment or an official cyclone warning.
                Always follow official IMD advisories.
              </p>
            </div>
          </div>

          {current && (
            <div className="weather-info">
              <p>
                <Clock3
                  size={13}
                  style={{ display: "inline" }}
                />

                {" "}Observation time: {current.time}
                {" · Timezone: "}
                {weatherData.timezone}
                {" · Source: Open-Meteo"}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// --------------------------------------------------
// DEDICATED LIVE TRACKING PAGE
// --------------------------------------------------

function LiveTrackingPage({
  selectedLocation,
  weatherData,
  weatherLoading,
  weatherError,
  cycloneAlerts,
  alertsLoading,
  alertsError,
  alertsUpdatedAt,
  onRefreshAlerts
}) {
  const current = weatherData?.current;

  return (
    <>
      {/* PAGE HEADER */}

      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="pulse" />
            REAL-TIME WEATHER MONITORING
          </div>

          <h1>
            Live tracking center<span>.</span>
          </h1>

          <p>
            Monitor geographical locations, atmospheric
            conditions and available cyclone alerts.
          </p>
        </div>

        <span className="live-pill">
          <i /> MONITORING ACTIVE
        </span>
      </div>

      {/* LIVE WEATHER METRICS */}

      <div className="metrics-grid">
        <Metric
          icon={Wind}
          label="WIND SPEED"
          value={
            current
              ? current.wind_speed_10m
              : weatherLoading
                ? "..."
                : "—"
          }
          unit=" km/h"
          trend={
            current
              ? `Direction ${current.wind_direction_10m}°`
              : "Awaiting weather data"
          }
          tone="orange"
        />

        <Metric
          icon={Waves}
          label="WIND GUSTS"
          value={
            current
              ? current.wind_gusts_10m
              : weatherLoading
                ? "..."
                : "—"
          }
          unit=" km/h"
          trend="Current reported gust speed"
          tone="cyan"
        />

        <Metric
          icon={Gauge}
          label="SEA LEVEL PRESSURE"
          value={
            current
              ? current.pressure_msl
              : weatherLoading
                ? "..."
                : "—"
          }
          unit=" hPa"
          trend="Mean sea-level pressure"
          tone="purple"
        />

        <Metric
          icon={Activity}
          label="TEMPERATURE"
          value={
            current
              ? current.temperature_2m
              : weatherLoading
                ? "..."
                : "—"
          }
          unit=" °C"
          trend={
            current
              ? `Humidity ${current.relative_humidity_2m}%`
              : "Awaiting weather data"
          }
          tone="green"
        />
      </div>

      {/* WEATHER STATUS */}

      {selectedLocation && (
        <div className="weather-info">
          {weatherLoading && (
            <p>
              <RefreshCw
                size={13}
                style={{ display: "inline" }}
                className="refresh-spinning"
              />
              {" "}Updating weather for {selectedLocation.name}...
            </p>
          )}

          {weatherError && (
            <p style={{ color: "#ff7777" }}>
              {weatherError}
            </p>
          )}

          {current && (
            <p>
              <Clock3
                size={13}
                style={{ display: "inline" }}
              />
              {" "}Last observation: {current.time}
              {" · Timezone: "}
              {weatherData.timezone}
              {" · Source: Open-Meteo"}
            </p>
          )}
        </div>
      )}

      {/* SELECTED LOCATION */}

      <section
        className="card"
        style={{ marginBottom: "20px" }}
      >
        <div className="section-head">
          <div>
            <div className="eyebrow">
              LOCATION MONITORING
            </div>

            <h2>Currently selected location</h2>
          </div>

          <MapPin size={19} className="muted-icon" />
        </div>

        {selectedLocation ? (
          <div className="storm-name">
            <div className="storm-symbol">
              <MapPin size={22} />
            </div>

            <div>
              <b>{selectedLocation.name}</b>

              <small>
                Latitude: {selectedLocation.latitude.toFixed(4)}°
                {" · "}
                Longitude: {selectedLocation.longitude.toFixed(4)}°
              </small>
            </div>
          </div>
        ) : (
          <div className="storm-name">
            <div className="storm-symbol">
              <Search size={22} />
            </div>

            <div>
              <b>No location selected</b>

              <small>
                Search for a location above to focus the map.
              </small>
            </div>
          </div>
        )}
      </section>

      {/* INTERACTIVE MAP */}

      <MapPanel selectedLocation={selectedLocation} />

      {/* TRACK INFORMATION */}

      <div
        className="insight"
        style={{ marginTop: "16px" }}
      >
        <span className="insight-icon">
          <ShieldCheck size={16} />
        </span>

        <div>
          <b>Track data information</b>

          <p>
            The displayed cyclone path is currently an illustrative
            sample track, not a verified live cyclone trajectory.
            Colored location markers use weather observations from
            Open-Meteo. Do not interpret these markers as official
            cyclone warnings.
          </p>
        </div>
      </div>

      {/* CYCLONE ALERTS */}

      <div style={{ marginTop: "22px" }}>
        <CycloneAlertsPanel
          alerts={cycloneAlerts}
          loading={alertsLoading}
          error={alertsError}
          updatedAt={alertsUpdatedAt}
          onRefresh={onRefreshAlerts}
        />
      </div>
    </>
  );
}

// --------------------------------------------------
// MAIN APP
// --------------------------------------------------

function App() {
  const [active, setActive] = useState("Overview");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);

  // WEATHER STATES

  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  // ML STATES

  const [prediction, setPrediction] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [error, setError] = useState("");

  // CYCLONE ALERT STATES

  const [cycloneAlerts, setCycloneAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState("");
  const [alertsUpdatedAt, setAlertsUpdatedAt] = useState(null);
  const [alertRefreshCount, setAlertRefreshCount] = useState(0);

  // SIDEBAR NAVIGATION

  const nav = [
    { name: "Overview", icon: Activity },
    { name: "Live Tracking", icon: Compass },
    { name: "Monitored Areas", icon: MapPin },
    { name: "AI Classification", icon: CircleDot }
  ];

  // ------------------------------------------------
  // FETCH IMD CYCLONE ALERTS
  // ------------------------------------------------

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchCycloneAlerts = async () => {
      try {
        setAlertsLoading(true);
        setAlertsError("");

        const response = await fetch(
          "http://127.0.0.1:5000/api/cyclone-alerts",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to connect to the cyclone alerts service."
          );
        }

        const data = await response.json();

        if (!isMounted) return;

        if (!Array.isArray(data.alerts)) {
          throw new Error(
            "The server returned an unexpected alert response."
          );
        }

        setCycloneAlerts(data.alerts);

        setAlertsUpdatedAt(
          data.fetched_at || new Date().toISOString()
        );
      } catch (err) {
        if (err.name !== "AbortError" && isMounted) {
          setAlertsError(err.message);
        }
      } finally {
        if (isMounted) {
          setAlertsLoading(false);
        }
      }
    };

    fetchCycloneAlerts();

    const interval = setInterval(
      fetchCycloneAlerts,
      5 * 60 * 1000
    );

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [alertRefreshCount]);

  // ------------------------------------------------
  // AUTOMATIC WEATHER DATA FETCHING
  // ------------------------------------------------

  useEffect(() => {
    if (!selectedLocation) {
      setWeatherData(null);
      setWeatherError("");
      setWeatherLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError("");
        setWeatherData(null);
        setPrediction(null);

        const params = new URLSearchParams({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,

          current: [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "weather_code",
            "pressure_msl",
            "wind_speed_10m",
            "wind_direction_10m",
            "wind_gusts_10m"
          ].join(","),

          wind_speed_unit: "kmh",
          timezone: "auto"
        });

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to retrieve weather data."
          );
        }

        const data = await response.json();

        if (!data.current) {
          throw new Error(
            "Weather observations are unavailable."
          );
        }

        setWeatherData(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setWeatherError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setWeatherLoading(false);
        }
      }
    };

    fetchWeather();

    return () => controller.abort();
  }, [selectedLocation]);

  // ------------------------------------------------
  // LOCATION SEARCH
  // ------------------------------------------------

  const handleLocationSearch = async (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setError("Please enter a location.");
      return;
    }

    try {
      setSearchLoading(true);
      setError("");
      setPrediction(null);
      setWeatherData(null);
      setWeatherError("");
      setSelectedLocation(null);

      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchQuery
        )}&count=1&language=en&format=json`
      );

      if (!response.ok) {
        throw new Error(
          "Location service is unavailable."
        );
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error(
          "Location not found. Try another name."
        );
      }

      const place = data.results[0];

      setSelectedLocation({
        name: [
          place.name,
          place.admin1,
          place.country
        ].filter(Boolean).join(", "),

        latitude: place.latitude,
        longitude: place.longitude
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // ------------------------------------------------
  // ML PREDICTION USING AUTOMATIC WEATHER DATA
  // ------------------------------------------------

  const handlePrediction = async () => {
    if (!selectedLocation) {
      setError("Search for a location first.");
      return;
    }

    if (!weatherData?.current) {
      setError("Weather data is not available yet.");
      return;
    }

    const pressure = Number(
      weatherData.current.pressure_msl
    );

    if (
      !Number.isFinite(pressure) ||
      pressure < 800 ||
      pressure > 1100
    ) {
      setError(
        "Fetched atmospheric pressure is invalid."
      );
      return;
    }

    try {
      setPredictionLoading(true);
      setError("");
      setPrediction(null);

      const observationTime = new Date(
        weatherData.current.time
      );

      const validTime = Number.isNaN(
        observationTime.getTime()
      )
        ? new Date()
        : observationTime;

      const payload = {
        year: validTime.getFullYear(),
        month: validTime.getMonth() + 1,
        day: validTime.getDate(),
        hour: validTime.getHours(),

        "Latitude of the center":
          selectedLocation.latitude * 10,

        "Longitude of the center":
          selectedLocation.longitude * 10,

        "Central pressure": pressure
      };

      const response = await fetch(
        "http://127.0.0.1:5000/predict",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Prediction request failed."
        );
      }

      setPrediction(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPredictionLoading(false);
    }
  };

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <div className="app-shell">

      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Wind size={22} />
          </div>

          <div>
            <b>CYCLONEX</b>
            <small>INTELLIGENCE SYSTEM</small>
          </div>
        </div>

        <div className="side-caption">
          WORKSPACE
        </div>

        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className={
                active === name
                  ? "nav-item selected"
                  : "nav-item"
              }
            >
              <Icon size={17} />

              {name}

              {name === "Live Tracking" && (
                <i className="nav-live" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="pulse" />

            <div>
              <b>System operational</b>
              <small>Research prototype</small>
            </div>
          </div>

          <div className="profile">
            <div className="avatar">CX</div>

            <div>
              <b>Research workspace</b>
              <small>Project dashboard</small>
            </div>

            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main">

        {/* TOPBAR */}

        <header className="topbar">
          <div className="mobile-brand">
            <Wind size={20} />
            CYCLONEX
          </div>

          <div className="breadcrumb">
            Workspace <span>/</span> <b>{active}</b>
          </div>

          <div className="top-actions">
            <form
              className="search"
              onSubmit={handleLocationSearch}
            >
              <Search size={15} />

              <input
                placeholder="Search storms, locations..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
              />

              <button
                type="submit"
                disabled={searchLoading}
              >
                {searchLoading
                  ? "Searching..."
                  : "Search"}
              </button>
            </form>

            <button className="icon-btn">
              <Bell size={18} />
              <i />
            </button>

            <div className="top-date">
              <Clock3 size={14} />

              {new Date().toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                }
              ).toUpperCase()}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}

        <div className="content">

          {active === "Monitored Areas" ? (

            <MonitoredAreas />

          ) : active === "AI Classification" ? (

            <AIClassificationPanel
              selectedLocation={selectedLocation}
              weatherData={weatherData}
              weatherLoading={weatherLoading}
              weatherError={weatherError}
              prediction={prediction}
              predictionLoading={predictionLoading}
              error={error}
              onPredict={handlePrediction}
            />

          ) : active === "Live Tracking" ? (

            <LiveTrackingPage
              selectedLocation={selectedLocation}
              weatherData={weatherData}
              weatherLoading={weatherLoading}
              weatherError={weatherError}
              cycloneAlerts={cycloneAlerts}
              alertsLoading={alertsLoading}
              alertsError={alertsError}
              alertsUpdatedAt={alertsUpdatedAt}
              onRefreshAlerts={() =>
                setAlertRefreshCount(value => value + 1)
              }
            />

          ) : (

            <>

              {/* OVERVIEW HEADER */}

              <div className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <span className="pulse" />
                    TROPICAL CYCLONE MONITORING
                  </div>

                  <h1>
                    Situation overview<span>.</span>
                  </h1>

                  <p>
                    Monitor geographical locations, historical
                    cyclone classifications, and atmospheric
                    conditions.
                  </p>
                </div>

                <button className="primary-btn">
                  <Radio size={16} />
                  Monitoring center
                  <ArrowUpRight size={15} />
                </button>
              </div>

              {/* REAL-TIME WEATHER METRICS */}

              <div className="metrics-grid">
                <Metric
                  icon={Activity}
                  label="TEMPERATURE"
                  value={
                    weatherData
                      ? weatherData.current.temperature_2m
                      : weatherLoading
                        ? "..."
                        : "—"
                  }
                  unit=" °C"
                  trend={
                    weatherData
                      ? `Feels like ${weatherData.current.apparent_temperature} °C`
                      : weatherError || "Search a location"
                  }
                  tone="cyan"
                />

                <Metric
                  icon={Wind}
                  label="WIND SPEED"
                  value={
                    weatherData
                      ? weatherData.current.wind_speed_10m
                      : weatherLoading
                        ? "..."
                        : "—"
                  }
                  unit=" km/h"
                  trend={
                    weatherData
                      ? `Direction ${weatherData.current.wind_direction_10m}° · Gusts ${weatherData.current.wind_gusts_10m} km/h`
                      : "Awaiting weather data"
                  }
                  tone="orange"
                />

                <Metric
                  icon={Gauge}
                  label="SEA LEVEL PRESSURE"
                  value={
                    weatherData
                      ? weatherData.current.pressure_msl
                      : weatherLoading
                        ? "..."
                        : "—"
                  }
                  unit=" hPa"
                  trend="Mean sea-level atmospheric pressure"
                  tone="purple"
                />

                <Metric
                  icon={Waves}
                  label="RELATIVE HUMIDITY"
                  value={
                    weatherData
                      ? weatherData.current.relative_humidity_2m
                      : weatherLoading
                        ? "..."
                        : "—"
                  }
                  unit="%"
                  trend={
                    weatherData
                      ? getWeatherDescription(
                          weatherData.current.weather_code
                        )
                      : "Awaiting weather data"
                  }
                  tone="green"
                />
              </div>

              {/* WEATHER INFORMATION */}

              {selectedLocation && (
                <div className="weather-info">
                  {weatherLoading && (
                    <p>
                      Fetching current weather for{" "}
                      {selectedLocation.name}...
                    </p>
                  )}

                  {weatherError && (
                    <p style={{ color: "#ff7777" }}>
                      Weather error: {weatherError}
                    </p>
                  )}

                  {weatherData && (
                    <p>
                      <Clock3
                        size={13}
                        style={{ display: "inline" }}
                      />

                      {" "}Weather data time:{" "}
                      {weatherData.current.time}

                      {" · Timezone: "}
                      {weatherData.timezone}

                      {" · Source: Open-Meteo"}
                    </p>
                  )}
                </div>
              )}

              {/* CHARTS */}

              <div className="bottom-grid">

                <section className="card chart-card">
                  <div className="section-head">
                    <div>
                      <div className="eyebrow">
                        INTENSITY ANALYSIS
                      </div>

                      <h2>Wind speed progression</h2>
                    </div>

                    <span className="chart-unit">km/h</span>
                  </div>

                  <div className="chart-wrap">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <AreaChart
                        data={windData}
                        margin={{
                          top: 8,
                          right: 8,
                          left: -22,
                          bottom: 0
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="windFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#35c9dc"
                              stopOpacity={0.3}
                            />

                            <stop
                              offset="100%"
                              stopColor="#35c9dc"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          stroke="#1b2a38"
                          strokeDasharray="3 5"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="time"
                          tick={{
                            fill: "#74889b",
                            fontSize: 11
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{
                            fill: "#74889b",
                            fontSize: 11
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#101e2b",
                            border: "1px solid #26394a",
                            borderRadius: 8,
                            color: "#eaf4fb"
                          }}
                        />

                        <Area
                          type="monotone"
                          dataKey="speed"
                          stroke="#35c9dc"
                          strokeWidth={2.5}
                          fill="url(#windFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="card chart-card">
                  <div className="section-head">
                    <div>
                      <div className="eyebrow">
                        SEASONAL INSIGHTS
                      </div>

                      <h2>Monthly cyclone activity</h2>
                    </div>

                    <span className="chart-unit">Systems</span>
                  </div>

                  <div className="chart-wrap">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={historyData}
                        margin={{
                          top: 8,
                          right: 8,
                          left: -22,
                          bottom: 0
                        }}
                      >
                        <CartesianGrid
                          stroke="#1b2a38"
                          strokeDasharray="3 5"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="month"
                          tick={{
                            fill: "#74889b",
                            fontSize: 10
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{
                            fill: "#74889b",
                            fontSize: 11
                          }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          contentStyle={{
                            background: "#101e2b",
                            border: "1px solid #26394a",
                            borderRadius: 8,
                            color: "#eaf4fb"
                          }}
                        />

                        <Bar
                          dataKey="count"
                          fill="#6b8df7"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* INSIGHTS */}

                <section className="card insight-card">
                  <div className="section-head">
                    <div>
                      <div className="eyebrow">
                        AI OBSERVATIONS
                      </div>

                      <h2>Pattern insights</h2>
                    </div>

                    <ShieldCheck
                      size={18}
                      className="muted-icon"
                    />
                  </div>

                  <div className="insight">
                    <span className="insight-icon">
                      <Eye size={16} />
                    </span>

                    <div>
                      <b>Cloud organization</b>

                      <p>
                        Satellite imagery can help identify
                        developing storm structures.
                      </p>
                    </div>
                  </div>

                  <div className="insight">
                    <span className="insight-icon purple-bg">
                      <Activity size={16} />
                    </span>

                    <div>
                      <b>Intensity trend</b>

                      <p>
                        Compare wind and pressure changes across
                        sequential observations.
                      </p>
                    </div>
                  </div>

                  <div className="insight">
                    <span className="insight-icon orange-bg">
                      <SlidersHorizontal size={16} />
                    </span>

                    <div>
                      <b>Model validation</b>

                      <p>
                        Evaluate classifications against verified
                        historical storm records.
                      </p>
                    </div>
                  </div>
                </section>

              </div>

              {/* FOOTER */}

              <footer>
                <span>
                  CYCLONEX <i>•</i> Research prototype
                </span>

                <span>
                  Weather: Open-Meteo API · Charts: Illustrative
                  sample data. Model results are not operational
                  forecasts.
                </span>
              </footer>

            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
