import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HeartHandshake,
  MapPin,
  PawPrint,
  Users,
  X,
} from "lucide-react";
import type { AnyRecord } from "../types";
import {
  initialMunicipalities,
  initialRequestTypes,
  initialTeams,
  normalizeRequest,
  requestHasTag,
  statusLabels,
} from "../domain";
import { DataBarChart, DataDonutChart, Metric, PanelHeader } from "../components/ui";
import { escapeHtml, isGlobalRole } from "../utils";
import { countBy, getRequestClosedByName, getRequestTypeName, topItems } from "../analytics";

export function DashboardView({ requests, adoptionAnimals = [], scheduleDays = [], municipalities = initialMunicipalities, requestTypes = initialRequestTypes, teams = initialTeams, currentUser = null }: AnyRecord) {
  const [dashboardTab, setDashboardTab] = useState("geral");
  const activeSchedules = scheduleDays.filter((day) => day.active !== false);
  const normalizedRequests = requests.map(normalizeRequest);
  const completedRequests = normalizedRequests.filter((request) => requestHasTag(request, "COMPARECEU"));
  const mutiraoCount = activeSchedules.filter((day) => day.kind === "Mutirao").length;
  const activeAdoptions = adoptionAnimals.filter((animal) => animal.status !== "adotado");
  const adoptedAnimals = adoptionAnimals.filter((animal) => animal.status === "adotado");
  const approvedRequests = normalizedRequests.filter((request) => requestHasTag(request, "DEFERIDA"));
  const rejectedRequests = normalizedRequests.filter((request) => requestHasTag(request, "INDEFERIDA"));
  const adoptionInterestCount = adoptionAnimals.reduce((total, animal) => total + (animal.interests?.length || 0), 0);
  const adoptionSpecies = countBy(adoptionAnimals, (animal) => animal.species);
  const adoptionByStatus = countBy(adoptionAnimals, (animal) => animal.status === "adotado" ? "Adotados" : "Disponíveis");
  const adoptionInterestRanking = topItems(
    adoptionAnimals
      .map((animal) => ({ label: animal.name || animal.animal_name || "Animal sem nome", value: animal.interests?.length || 0 }))
      .sort((a, b) => b.value - a.value),
  );
  const adoptionProfile = countBy(adoptionAnimals, (animal) => animal.sex || "Sem perfil");
  const castrationByStatus = countBy(normalizedRequests, (request) => statusLabels[request.status] || request.status);
  const castrationByType = countBy(requests, (request) => getRequestTypeName(request, requestTypes));
  const requestsByMunicipality = topItems(countBy(normalizedRequests, (request) => {
    const municipality = municipalities.find((item) => item.id === request.municipalityId);
    return municipality ? [municipality.name, municipality.state].filter(Boolean).join("/") : request.municipalityName || "Sem município";
  }), 8);
  const castrationByNeighborhood = topItems(countBy(requests, (request) => request.neighborhood));
  const closedRequests = normalizedRequests.filter((request) => request.status === "ARQUIVADA");
  const closedByUser = topItems(countBy(closedRequests, (request) => getRequestClosedByName(request, teams, currentUser)));
  const scheduleUsage = topItems(activeSchedules.map((day) => {
    const used = requests.filter((request) => request.preferredSchedule === day.date || request.appointment === day.date).length;
    return { label: day.date, value: used, secondary: `${Math.max(Number(day.vacancies || 0) - used, 0)} vagas` };
  }), 6);
  const nextSchedule = activeSchedules[0];
  const dashboardSummary = [
    { label: "Fila ativa", value: normalizedRequests.filter((request) => request.status !== "ARQUIVADA").length, helper: "processos em andamento" },
    { label: "Aprovadas", value: approvedRequests.length, helper: "aptas para procedimento" },
    { label: "Compareceram", value: completedRequests.length, helper: "procedimentos registrados" },
  ];
  const dashboardTabs = [
    { id: "geral", label: "Geral", helper: "Visão executiva", value: activeSchedules.length + normalizedRequests.length + adoptionAnimals.length, icon: Activity },
    { id: "adocao", label: "Adoção", helper: "Animais e interesse", value: activeAdoptions.length, icon: HeartHandshake },
    { id: "castracao", label: "Castração", helper: "Fila e procedimentos", value: normalizedRequests.length, icon: ClipboardList },
  ];

  return (
    <section className="map-dashboard">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="eyebrow">Painel operacional</span>
          <h2>VisÃ£o geral da gestÃ£o animal</h2>
          <p>Acompanhe agenda, fila de castraÃ§Ã£o, adoÃ§Ã£o e execuÃ§Ã£o do atendimento municipal em um painel Ãºnico.</p>
        </div>
        <div className="dashboard-hero-metrics" aria-label="Resumo do dashboard">
          {dashboardSummary.map((item) => (
            <div className="dashboard-hero-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
          <div className="dashboard-hero-card dashboard-hero-card--accent">
            <span>PrÃ³xima agenda</span>
            <strong>{nextSchedule?.date || "Sem data"}</strong>
            <small>{nextSchedule?.locationName || nextSchedule?.kind || "Nenhuma agenda ativa"}</small>
          </div>
        </div>
      </div>

      <div className="dashboard-tabs" aria-label="Visões do dashboard">
        {dashboardTabs.map((tab) => {
          const Icon = tab.icon;
          return (
          <button key={tab.id} className={dashboardTab === tab.id ? "selected" : ""} type="button" onClick={() => setDashboardTab(tab.id)}>
            <span className="dashboard-tab-icon"><Icon size={18} /></span>
            <span className="dashboard-tab-copy">
              <strong>{tab.label}</strong>
              <small>{tab.helper}</small>
            </span>
            <span className="dashboard-tab-count">{tab.value}</span>
          </button>
          );
        })}
      </div>

      {dashboardTab === "geral" && (
        <>
          <div className="map-kpi-grid">
            <Metric title="Agendas" value={activeSchedules.length} icon={CalendarDays} />
            <Metric title="Mutirões" value={mutiraoCount} icon={MapPin} />
            <Metric title="Realizadas" value={completedRequests.length} icon={CheckCircle2} />
            <Metric title="Municípios" value={municipalities.length} icon={MapPin} />
          </div>

          <div className="map-dashboard-grid">
            <div className="map-side-stack">
              <div className="panel">
                <PanelHeader title="Agenda" />
                <DonutChart
                  segments={[
                    { label: "Agenda", value: Math.max(activeSchedules.length - mutiraoCount, 0), color: "var(--teal)" },
                    { label: "Mutirão", value: mutiraoCount, color: "#f97316" },
                  ]}
                />
              </div>
              <div className="panel">
                <PanelHeader title="Execução" />
                <DonutChart
                  segments={[
                    { label: "Realizadas", value: completedRequests.length, color: "#16a34a" },
                    { label: "Pendentes", value: Math.max(requests.length - completedRequests.length, 0), color: "#94a3b8" },
                  ]}
                />
              </div>
            </div>

            <div className="panel map-panel">
              <PanelHeader title="Mapa de castrações e microchipados" />
              <GoogleDashboardMap
                completedRequests={completedRequests}
              />
            </div>
          </div>
          {isGlobalRole(currentUser?.role) && (
            <div className="panel wide">
              <PanelHeader title="Registros por município" />
              <DataBarChart title="Municípios com mais solicitações" items={requestsByMunicipality} />
            </div>
          )}
        </>
      )}

      {dashboardTab === "adocao" && (
        <>
          <div className="map-kpi-grid">
            <Metric title="Disponíveis" value={activeAdoptions.length} icon={HeartHandshake} />
            <Metric title="Adotados" value={adoptedAnimals.length} icon={CheckCircle2} />
            <Metric title="Interessados" value={adoptionInterestCount} icon={Users} />
            <Metric title="Total" value={adoptionAnimals.length} icon={PawPrint} />
          </div>
          <div className="panel wide">
            <PanelHeader title="Painel de adoção" />
            <div className="charts-grid">
              <DataBarChart title="Ranking real de interesses" items={adoptionInterestRanking} />
              <DataBarChart title="Perfil dos animais" items={adoptionProfile} />
              <DataBarChart title="Espécies em adoção" items={adoptionSpecies} />
              <DataDonutChart title="Status dos animais" items={adoptionByStatus} />
            </div>
          </div>
        </>
      )}

      {dashboardTab === "castracao" && (
        <>
          <div className="map-kpi-grid">
            <Metric title="Solicitações" value={requests.length} icon={FileText} />
            <Metric title="Aprovadas" value={approvedRequests.length} icon={CheckCircle2} />
            <Metric title="Reprovadas" value={rejectedRequests.length} icon={X} />
            <Metric title="Realizadas" value={completedRequests.length} icon={ClipboardCheck} />
          </div>
          <div className="charts-grid">
            <DataDonutChart title="Distribuição por status" items={castrationByStatus} />
            <DataBarChart title="Tipos de solicitação" items={castrationByType} />
            <DataBarChart title="Processos encerrados por usuário" items={closedByUser} />
            <DataBarChart title="Solicitações por bairro" items={castrationByNeighborhood} />
            <DataBarChart title="Ocupação da agenda" items={scheduleUsage} />
          </div>
        </>
      )}
    </section>
  );
}

function GoogleDashboardMap({ completedRequests = [] }: AnyRecord) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState(apiKey ? "Carregando Google Maps..." : "Configure a chave do Google Maps para visualizar o dashboard.");

  const points = useMemo(() => {
    return completedRequests
      .filter((request) => {
        const lat = Number(request.latitude);
        const lng = Number(request.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) &&
          lat >= -33.75 && lat <= 5.27 &&
          lng >= -73.99 && lng <= -29.35;
      })
      .map((request) => {
        const hasMicrochip = request.animals?.some((a) => a.microchip);
        const castrated = true;
        const type = hasMicrochip ? "both" : "castrated";
        return {
          lat: Number(request.latitude),
          lng: Number(request.longitude),
          type,
          label: type === "both" ? "Castrado e microchipado" : "Castrado",
          title: request.tutor || "Castração realizada",
          detail: request.scheduleLocationName || request.neighborhood || request.address || "Local informado",
          color: type === "both" ? "#7c3aed" : "#16a34a",
        };
      });
  }, [completedRequests]);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let active = true;
    window.gm_authFailure = () => {
      setStatus("Google Maps recusou a chave configurada. Verifique restrições, faturamento e Maps JavaScript API.");
    };

    loadGoogleMapsApi(apiKey)
      .then((google) => {
        if (!active) return;
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: -27.2423, lng: -50.2189 },
          zoom: 6,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
        setStatus(points.length ? "" : "Nenhum ponto com coordenadas para exibir.");
      })
      .catch(() => setStatus("Não foi possível carregar o Google Maps."));

    return () => {
      active = false;
      if (window.gm_authFailure) window.gm_authFailure = undefined;
    };
  }, [apiKey]);

  useEffect(() => {
    const google = window.google;
    const map = mapInstanceRef.current;
    if (!google?.maps || !map) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!points.length) {
      setStatus("Nenhum ponto com coordenadas para exibir.");
      return;
    }

    const infoWindow = new google.maps.InfoWindow();

    points.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      const marker = new google.maps.Marker({
        map,
        position,
        title: point.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: point.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 9,
        },
      });
      marker.addListener("click", () => {
        infoWindow.setContent(`<strong>${escapeHtml(point.title)}</strong><br>${escapeHtml(point.detail)}`);
        infoWindow.open({ anchor: marker, map });
      });
      markersRef.current.push(marker);
    });

    setStatus("");
  }, [points]);

  if (!apiKey) {
    return (
      <div className="google-map-fallback">
        <p>{status}</p>
      </div>
    );
  }

  return (
    <div className="google-dashboard-map">
      <div className="google-map-canvas dashboard" ref={mapRef} />
      {status && <p className="helper-text">{status}</p>}
      <div className="map-legend">
        <span><i className="legend-dot completed" /> Castrado</span>
        <span><i className="legend-dot microchipped" /> Castrado e microchipado</span>
      </div>
    </div>
  );
}

function loadGoogleMapsApi(apiKey) {
  if (window.google?.maps?.Map) return Promise.resolve(window.google);

  const scriptId = "google-maps-js-api";
  const existing = document.getElementById(scriptId);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=console.debug&libraries=maps,marker&v=beta`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function DonutChart({ segments }: AnyRecord) {
  const total = segments.reduce((sum, segment) => sum + Number(segment.value || 0), 0) || 1;
  let start = 0;
  const gradient = segments.map((segment) => {
    const size = (Number(segment.value || 0) / total) * 100;
    const part = `${segment.color} ${start}% ${start + size}%`;
    start += size;
    return part;
  }).join(", ");

  return (
    <div className="map-donut-wrap">
      <div className="map-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <strong>{total}</strong>
      </div>
      <div className="map-donut-legend">
        {segments.map((segment) => (
          <span key={segment.label}>
            <i style={{ background: segment.color }} />
            {segment.label}: {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}
