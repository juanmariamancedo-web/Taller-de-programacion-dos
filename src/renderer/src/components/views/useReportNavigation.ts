import { useNavigate } from 'react-router-dom'

export function useReportNavigation(): (panel: 'productos' | 'clientes' | 'ordenes') => void {
  const navigate = useNavigate()
  return (panel) => navigate(`/reportes/${panel}`)
}
