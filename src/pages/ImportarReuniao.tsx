/* SPEC-165: a importação agora fica dentro de "Reunião de projeto".
   Este endereço antigo só redireciona (mantendo ?pendente=). */
import { Navigate, useLocation } from 'react-router-dom'

export default function ImportarReuniao() {
  const { search } = useLocation()
  return <Navigate to={`/novo/reuniao_projeto${search}`} replace />
}
