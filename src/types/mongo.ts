export interface TelemetriaRaw {
  _id?: unknown;
  metadata: {
    dispositivo_id: string;
    zona?: string;
    tipo_sensor?: string;
  };
  valor: number;
  unidad?: string;
  timestamp: string | Date;
  n8n_execution_id?: string;
}

export interface LogAutomatizacion {
  _id?: unknown;
  evento: string;
  zona_afectada?: string;
  detalles?: Record<string, unknown>;
  fecha: string | Date;
  estado?: string;
}

export interface ReporteGenerado {
  _id?: unknown;
  tipo: string;
  periodo?: string;
  zona_id?: number;
  resumen?: Record<string, unknown>;
  data_points?: unknown[];
  creado_en?: string | Date;
}
