import "./MonitoredAreas.css";
import React, { useEffect, useState } from "react";
import {
  Search,
  MapPin,
  Wind,
  Gauge,
  Thermometer,
  RefreshCw,
  X
} from "lucide-react";

import "./MonitoredAreas.css";

const STORAGE_KEY = "cyclonex-monitored-areas";

const DEFAULT_AREAS = [
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    latitude: 19.076,
    longitude: 72.8777
  },
  {
    id: "goa",
    name: "Panaji",
    country: "India",
    latitude: 15.4909,
    longitude: 73.8278
  },
  {
    id: "kochi",
    name: "Kochi",
    country: "India",
    latitude: 9.9312,
    longitude: 76.2673
  },
  {
    id: "chennai",
    name: "Chennai",
    country: "India",
    latitude: 13.0827,
    longitude: 80.2707
  },
  {
    id: "vizag",
    name: "Visakhapatnam",
    country: "India",
    latitude: 17.6868,
    longitude: 83.2185
  },
  {
    id: "puri",
    name: "Puri",
    country: "India",
    latitude: 19.8135,
    longitude: 85.8312
  },
  {
    id: "kolkata",
    name: "Kolkata",
    country: "India",
    latitude: 22.5726,
    longitude: 88.3639
  },
  {
    id: "port-blair",
    name: "Port Blair",
    country: "India",
    latitude: 11.6234,
    longitude: 92.7265
  }
];

// Load saved locations from localStorage
function getSavedAreas() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    return DEFAULT_AREAS;
  } catch (error) {
    console.error("Error loading monitored areas:", error);
    return DEFAULT_AREAS;
  }
}

// Simple weather status based on wind speed
function getWeatherStatus(wind, gust) {
  if (wind >= 60 || gust >= 80) {
    return {
      label: "Strong winds",
      className: "strong"
    };
  }

  if (wind >= 40 || gust >= 55) {
    return {
      label: "Elevated winds",
      className: "elevated"
    };
  }

  return {
    label: "Normal conditions",
    className: "normal"
  };
}

export default function MonitoredAreas() {
  const [areas, setAreas] = useState(getSavedAreas);

  const [weather, setWeather] = useState({});

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");

  const [searching, setSearching] = useState(false);

  const [searchError, setSearchError] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  // Manual refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Save monitored locations
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(areas)
      );
    } catch (error) {
      console.error("Unable to save monitored areas:", error);
    }
  }, [areas]);

  // Fetch live weather for all monitored locations
  useEffect(() => {
    let cancelled = false;

    async function loadWeather(isManual = false) {
      if (isManual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const results = await Promise.allSettled(
        areas.map(async (area) => {
          const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${area.latitude}` +
            `&longitude=${area.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m` +
            `&wind_speed_unit=kmh` +
            `&timezone=auto`;

          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(
              `Weather request failed for ${area.name}`
            );
          }

          const data = await response.json();

          if (!data.current) {
            throw new Error(
              `Weather data unavailable for ${area.name}`
            );
          }

          return {
            id: area.id,
            temperature: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m,
            pressure: data.current.pressure_msl,
            wind: data.current.wind_speed_10m,
            gust: data.current.wind_gusts_10m,
            time: data.current.time
          };
        })
      );

      if (cancelled) return;

      setWeather((previous) => {
        const next = { ...previous };

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            next[result.value.id] = result.value;
          }
        });

        return next;
      });

      results.forEach((result) => {
        if (result.status === "rejected") {
          console.error(
            "Weather fetch error:",
            result.reason
          );
        }
      });

      setLastUpdated(new Date());

      setLoading(false);

      setRefreshing(false);
    }

    loadWeather();

    // Automatic refresh every 10 minutes
    const interval = setInterval(() => {
      loadWeather(true);
    }, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [areas, refreshKey]);

  // Search and add a new location
  async function addArea(event) {
    event.preventDefault();

    const search = query.trim();

    if (!search) return;

    setSearching(true);
    setSearchError("");

    try {
      const url =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(search)}` +
        `&count=5&language=en&format=json`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Location search failed");
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        setSearchError(
          "No matching location found. Try another name."
        );
        return;
      }

      const result = data.results[0];

      const newArea = {
        id: `${result.latitude}-${result.longitude}`,
        name: result.name,
        country: result.country || "",
        latitude: result.latitude,
        longitude: result.longitude
      };

      // Prevent duplicate locations
      const alreadyExists = areas.some(
        (area) =>
          Math.abs(area.latitude - newArea.latitude) < 0.01 &&
          Math.abs(area.longitude - newArea.longitude) < 0.01
      );

      if (alreadyExists) {
        setSearchError(
          "This location is already being monitored."
        );
        return;
      }

      setAreas((previous) => [
        ...previous,
        newArea
      ]);

      setQuery("");
    } catch (error) {
      console.error("Location search error:", error);

      setSearchError(
        "Unable to search right now. Please try again."
      );
    } finally {
      setSearching(false);
    }
  }

  // Remove a location from the watchlist
  function removeArea(id) {
    setAreas((previous) =>
      previous.filter((area) => area.id !== id)
    );

    setWeather((previous) => {
      const next = { ...previous };

      delete next[id];

      return next;
    });
  }

  // Manually refresh weather
  function handleRefresh() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <section className="monitored-page">

      {/* Header */}
      <div className="monitored-heading">
        <div>
          <p className="section-eyebrow">
            CYCLONEX MONITORING
          </p>

          <h2>Monitored Areas</h2>

          <p className="monitored-subtitle">
            Keep track of current weather conditions
            across selected locations.
          </p>
        </div>

        <button
          className="monitor-refresh"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh weather"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "refresh-spinning" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Location Search */}
      <form
        className="area-search"
        onSubmit={addArea}
      >
        <Search size={19} />

        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a city or coastal location..."
        />

        <button
          type="submit"
          disabled={searching || !query.trim()}
        >
          {searching ? "Searching..." : "Add location"}
        </button>
      </form>

      {searchError && (
        <p className="area-error">
          {searchError}
        </p>
      )}

      {/* Summary */}
      <div className="monitor-summary">

        <div>
          <span>Locations monitored</span>
          <strong>{areas.length}</strong>
        </div>

        <div>
          <span>Weather source</span>
          <strong>Open-Meteo</strong>
        </div>

        <div>
          <span>Last updated</span>

          <strong>
            {lastUpdated
              ? lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "Waiting..."}
          </strong>
        </div>

      </div>

      {/* Location Cards */}
      <div className="area-grid">

        {areas.map((area) => {
          const data = weather[area.id];

          const status = data
            ? getWeatherStatus(data.wind, data.gust)
            : null;

          return (
            <article
              className="area-card"
              key={area.id}
            >

              {/* Location Name */}
              <div className="area-card-top">

                <div className="area-name">
                  <MapPin size={17} />

                  <div>
                    <h3>{area.name}</h3>
                    <span>{area.country}</span>
                  </div>
                </div>

                <button
                  className="area-remove"
                  onClick={() => removeArea(area.id)}
                  title={`Remove ${area.name}`}
                  aria-label={`Remove ${area.name}`}
                >
                  <X size={17} />
                </button>

              </div>

              {data ? (
                <>

                  {/* Temperature */}
                  <div className="area-temperature">
                    <Thermometer size={21} />

                    <strong>
                      {data.temperature}°C
                    </strong>
                  </div>

                  {/* Weather Metrics */}
                  <div className="area-metrics">

                    <div>
                      <Wind size={16} />
                      <span>Wind</span>

                      <strong>
                        {data.wind} km/h
                      </strong>
                    </div>

                    <div>
                      <Gauge size={16} />
                      <span>Pressure</span>

                      <strong>
                        {data.pressure} hPa
                      </strong>
                    </div>

                    <div>
                      <span className="humidity-symbol">
                        %
                      </span>

                      <span>Humidity</span>

                      <strong>
                        {data.humidity}%
                      </strong>
                    </div>

                    <div>
                      <Wind size={16} />
                      <span>Wind gusts</span>

                      <strong>
                        {data.gust} km/h
                      </strong>
                    </div>

                  </div>

                  {/* Weather Status */}
                  <div
                    className={`area-status ${status.className}`}
                  >
                    <span className="status-dot" />

                    {status.label}
                  </div>

                  <p className="area-time">
                    Weather observation: {data.time}
                  </p>

                </>
              ) : (
                <div className="area-loading">
                  {loading
                    ? "Loading weather..."
                    : "Weather data unavailable"}
                </div>
              )}

            </article>
          );
        })}

      </div>

      {/* Empty Watchlist */}
      {areas.length === 0 && (
        <div className="empty-areas">
          No locations in your watchlist.
          Search for a location above to add one.
        </div>
      )}

      {/* Disclaimer */}
      <p className="monitor-disclaimer">
        Weather conditions are informational indicators,
        not official cyclone alerts or predictions.
        Follow IMD and local authorities for warnings.
      </p>

    </section>
  );
}
