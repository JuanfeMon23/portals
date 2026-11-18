// Cada proyecto es un portal. La URL se puede sobrescribir por entorno
// (VITE_URL_<ID en mayúsculas>) para apuntar a producción sin tocar este archivo.
const env = import.meta.env;
const url = (id, fallback) => env[`VITE_URL_${id.toUpperCase()}`] || fallback;

export const projects = [
  {
    id: 'vladimir',
    name: 'Vladimir',
    tagline: 'Panel de administración de los flujos de laboratorio',
    stack: ['FastAPI', 'Nuxt', 'PostgreSQL'],
    url: url('vladimir', 'http://localhost:3000'),
    color: '#ff3b2f',
    colorB: '#5a0606',
  },
  {
    id: 'leo',
    name: 'Leo',
    tagline: 'SSO, control de acceso y auditoría central del ecosistema',
    stack: ['FastAPI', 'Nuxt', 'SDK'],
    url: url('leo', 'http://localhost:3100'),
    color: '#ffc23a',
    colorB: '#5c3300',
  },
  {
    id: 'incubus',
    name: 'Incubus',
    tagline: 'Workflow del laboratorio: recepción, muestras y resultados',
    stack: ['FastAPI', 'Nuxt', 'Socket.IO'],
    url: url('incubus', 'http://localhost:3200'),
    color: '#4dff6a',
    colorB: '#063d10',
  },
  {
    id: 'acuarius',
    name: 'Acuarius',
    tagline: 'Portal de pacientes para consultar sus resultados',
    stack: ['FastAPI', 'Nuxt', 'SSO'],
    url: url('acuarius', 'http://localhost:3300'),
    color: '#36c8ff',
    colorB: '#03284d',
  },
  {
    id: 'andromeda',
    name: 'Andromeda',
    tagline: 'Sistema de diseño compartido del ecosistema',
    stack: ['Nuxt layer', 'Vue', 'Tailwind'],
    url: url('andromeda', 'https://github.com/JuanfeMon23/Andromeda'),
    color: '#b46bff',
    colorB: '#2a0a4d',
  },
  {
    id: 'taurus',
    name: 'Taurus',
    tagline: 'App personal de ganancias netas',
    stack: ['Nuxt', 'PWA', 'FastAPI'],
    url: url('taurus', 'http://localhost:4321'),
    color: '#ff8a1f',
    colorB: '#4a1a00',
  },
];
