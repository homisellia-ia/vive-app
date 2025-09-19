import { BotState } from "@builderbot/bot/dist/types";

export interface IHomisellProperty {
  id: number;
  homisell_id: string;
  titulo: string;
  slug: string;
  url: string;
  descripcion_corta: string;
  precio: {
      valor_crudo: number;
      formato_humano: string;
      prefijo: string;
      sufijo: string;
  };
  habitaciones: number;
  banos: number;
  area: number;
  direccion: string;
  detalles: {
      generales: string[];
      comodidades: {
          piscina: boolean;
          jardin: boolean;
          balcon: boolean;
          terraza: boolean;
          gimnasio: boolean;
      };
      servicios: {
          calefaccion: boolean;
          aire_acondicionado: boolean;
          amueblado: boolean;
          estacionamiento: boolean;
      };
  };
  coordenadas: {
    lat: number;
    lng: number;
  }
  area_lote: number;
  garajes: number;
  fecha_publicacion: string;
  fecha_actualizada: string;
  status_wp: string;
}

interface Comodidades {
  piscina: boolean;
  jardin: boolean;
  balcon: boolean;
  terraza: boolean;
  gimnasio: boolean;
}

export interface IHomisellPropertyMapped {
    id: number;
    proyecto: string;
    distrito: string;
    habitaciones: number;
    area: number;
    precio: number;
    url: string;
    comodidades: Comodidades;
}

export interface IAvailability {
    proyecto: string;
    fecha: string;
    disponible: boolean;
}

export interface IConfirmedData {
  district: string | null
  bedrooms: number | null
  budget: string | null
  name: string | null
  chosen_project: string | null
  startDate: string | null
}
