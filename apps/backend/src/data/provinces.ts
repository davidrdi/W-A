import type { LatLon } from "@w-a/shared";

/**
 * Las 52 provincias españolas con un punto representativo.
 *
 * Es una tabla estática a propósito: el nivel "provincia" es la vista
 * inicial del mapa (España entera) y resolverlo por Overpass significaría
 * una consulta pesada y lenta justo en el primer render. La lista no cambia,
 * así que vivir en el repo es más barato y más fiable que consultarla.
 *
 * `center` es un punto interior representativo de la provincia (no el
 * centroide exacto: para meteo a escala provincial da igual).
 * `seaPoint` solo lo tienen las provincias con costa y es un punto SOBRE EL
 * MAR — la API marina devuelve nulos en tierra, así que el chip del modo mar
 * se ancla ahí y no en el centro de la provincia.
 */
export interface Province {
  /** Slug estable; el id del chip es `provincia/<slug>`. */
  slug: string;
  name: string;
  center: LatLon;
  seaPoint?: LatLon;
}

export const PROVINCES: readonly Province[] = [
  { slug: "a-coruna", name: "A Coruña", center: { lat: 43.15, lon: -8.45 }, seaPoint: { lat: 43.42, lon: -8.4 } },
  { slug: "alava", name: "Álava", center: { lat: 42.85, lon: -2.7 } },
  { slug: "albacete", name: "Albacete", center: { lat: 38.85, lon: -2.0 } },
  { slug: "alicante", name: "Alicante", center: { lat: 38.5, lon: -0.6 }, seaPoint: { lat: 38.3, lon: -0.42 } },
  { slug: "almeria", name: "Almería", center: { lat: 37.2, lon: -2.35 }, seaPoint: { lat: 36.78, lon: -2.45 } },
  { slug: "asturias", name: "Asturias", center: { lat: 43.3, lon: -6.1 }, seaPoint: { lat: 43.62, lon: -5.7 } },
  { slug: "avila", name: "Ávila", center: { lat: 40.5, lon: -5.0 } },
  { slug: "badajoz", name: "Badajoz", center: { lat: 38.7, lon: -6.3 } },
  { slug: "baleares", name: "Baleares", center: { lat: 39.6, lon: 2.95 }, seaPoint: { lat: 39.48, lon: 2.6 } },
  { slug: "barcelona", name: "Barcelona", center: { lat: 41.65, lon: 1.95 }, seaPoint: { lat: 41.33, lon: 2.2 } },
  { slug: "burgos", name: "Burgos", center: { lat: 42.35, lon: -3.6 } },
  { slug: "caceres", name: "Cáceres", center: { lat: 39.7, lon: -6.2 } },
  { slug: "cadiz", name: "Cádiz", center: { lat: 36.55, lon: -5.85 }, seaPoint: { lat: 36.5, lon: -6.35 } },
  { slug: "cantabria", name: "Cantabria", center: { lat: 43.2, lon: -4.0 }, seaPoint: { lat: 43.52, lon: -3.8 } },
  { slug: "castellon", name: "Castellón", center: { lat: 40.2, lon: -0.15 }, seaPoint: { lat: 39.98, lon: 0.1 } },
  { slug: "ceuta", name: "Ceuta", center: { lat: 35.89, lon: -5.32 }, seaPoint: { lat: 35.93, lon: -5.32 } },
  { slug: "ciudad-real", name: "Ciudad Real", center: { lat: 38.95, lon: -3.9 } },
  { slug: "cordoba", name: "Córdoba", center: { lat: 38.0, lon: -4.8 } },
  { slug: "cuenca", name: "Cuenca", center: { lat: 40.0, lon: -2.1 } },
  { slug: "girona", name: "Girona", center: { lat: 42.15, lon: 2.65 }, seaPoint: { lat: 41.9, lon: 3.25 } },
  { slug: "granada", name: "Granada", center: { lat: 37.3, lon: -3.3 }, seaPoint: { lat: 36.68, lon: -3.52 } },
  { slug: "guadalajara", name: "Guadalajara", center: { lat: 40.9, lon: -2.6 } },
  { slug: "gipuzkoa", name: "Gipuzkoa", center: { lat: 43.15, lon: -2.15 }, seaPoint: { lat: 43.37, lon: -2.0 } },
  { slug: "huelva", name: "Huelva", center: { lat: 37.65, lon: -6.75 }, seaPoint: { lat: 37.05, lon: -6.9 } },
  { slug: "huesca", name: "Huesca", center: { lat: 42.3, lon: -0.2 } },
  { slug: "jaen", name: "Jaén", center: { lat: 38.0, lon: -3.4 } },
  { slug: "leon", name: "León", center: { lat: 42.6, lon: -5.85 } },
  { slug: "lleida", name: "Lleida", center: { lat: 42.0, lon: 1.1 } },
  { slug: "lugo", name: "Lugo", center: { lat: 43.1, lon: -7.4 }, seaPoint: { lat: 43.62, lon: -7.35 } },
  { slug: "madrid", name: "Madrid", center: { lat: 40.45, lon: -3.7 } },
  { slug: "malaga", name: "Málaga", center: { lat: 36.8, lon: -4.7 }, seaPoint: { lat: 36.65, lon: -4.42 } },
  { slug: "melilla", name: "Melilla", center: { lat: 35.29, lon: -2.94 }, seaPoint: { lat: 35.33, lon: -2.94 } },
  { slug: "murcia", name: "Murcia", center: { lat: 38.0, lon: -1.45 }, seaPoint: { lat: 37.55, lon: -0.95 } },
  { slug: "navarra", name: "Navarra", center: { lat: 42.7, lon: -1.65 } },
  { slug: "ourense", name: "Ourense", center: { lat: 42.2, lon: -7.55 } },
  { slug: "palencia", name: "Palencia", center: { lat: 42.4, lon: -4.55 } },
  { slug: "las-palmas", name: "Las Palmas", center: { lat: 28.1, lon: -15.45 }, seaPoint: { lat: 27.9, lon: -15.4 } },
  { slug: "pontevedra", name: "Pontevedra", center: { lat: 42.4, lon: -8.55 }, seaPoint: { lat: 42.2, lon: -8.9 } },
  { slug: "la-rioja", name: "La Rioja", center: { lat: 42.3, lon: -2.5 } },
  { slug: "salamanca", name: "Salamanca", center: { lat: 40.75, lon: -6.1 } },
  {
    slug: "santa-cruz-de-tenerife",
    name: "Santa Cruz de Tenerife",
    center: { lat: 28.35, lon: -16.6 },
    seaPoint: { lat: 28.1, lon: -16.6 },
  },
  { slug: "segovia", name: "Segovia", center: { lat: 41.1, lon: -4.05 } },
  { slug: "sevilla", name: "Sevilla", center: { lat: 37.5, lon: -5.8 } },
  { slug: "soria", name: "Soria", center: { lat: 41.7, lon: -2.6 } },
  { slug: "tarragona", name: "Tarragona", center: { lat: 41.1, lon: 0.9 }, seaPoint: { lat: 41.05, lon: 1.3 } },
  { slug: "teruel", name: "Teruel", center: { lat: 40.6, lon: -0.8 } },
  { slug: "toledo", name: "Toledo", center: { lat: 39.85, lon: -4.05 } },
  { slug: "valencia", name: "Valencia", center: { lat: 39.4, lon: -0.8 }, seaPoint: { lat: 39.45, lon: -0.25 } },
  { slug: "valladolid", name: "Valladolid", center: { lat: 41.65, lon: -4.8 } },
  { slug: "bizkaia", name: "Bizkaia", center: { lat: 43.2, lon: -2.8 }, seaPoint: { lat: 43.42, lon: -3.05 } },
  { slug: "zamora", name: "Zamora", center: { lat: 41.7, lon: -5.9 } },
  { slug: "zaragoza", name: "Zaragoza", center: { lat: 41.6, lon: -0.9 } },
];

export function findProvinceBySlug(slug: string): Province | undefined {
  return PROVINCES.find((p) => p.slug === slug);
}
