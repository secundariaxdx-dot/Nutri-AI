import { BarChart3, BookOpen, Home, Settings, User } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/diario', label: 'Diario', icon: BookOpen },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/perfil', label: 'Perfil', icon: User },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];
