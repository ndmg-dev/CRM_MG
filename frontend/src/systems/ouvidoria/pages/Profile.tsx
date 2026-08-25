import { useOuvidoriaProfile } from '../lib/useOuvidoriaProfile'

// Port de main/profile.html — somente leitura, sem edição (o original
// também não tinha formulário de edição, só exibição).
export default function Profile() {
  const { data: user } = useOuvidoriaProfile()
  if (!user) return null

  const initials = user.full_name.slice(0, 2).toUpperCase()

  return (
    <>
      <div className="profile-header animate-fade">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.full_name} className="avatar avatar-xl" referrerPolicy="no-referrer" />
        ) : (
          <div className="avatar avatar-xl avatar-placeholder" style={{ fontSize: '1.5rem' }}>{initials}</div>
        )}
        <div className="profile-info">
          <h2>{user.full_name}</h2>
          <p>{user.email}</p>
          <span className="badge badge-gold" style={{ marginTop: '0.5rem' }}>
            {user.role === 'admin' ? 'Administrador' : 'Colaborador'}
          </span>
        </div>
      </div>

      <div className="profile-details">
        <div className="profile-detail-item animate-fade">
          <div className="profile-detail-label">Nome Completo</div>
          <div className="profile-detail-value">{user.full_name}</div>
        </div>
        <div className="profile-detail-item animate-fade">
          <div className="profile-detail-label">E-mail Corporativo</div>
          <div className="profile-detail-value">{user.email}</div>
        </div>
        <div className="profile-detail-item animate-fade">
          <div className="profile-detail-label">Perfil de Acesso</div>
          <div className="profile-detail-value">{user.role === 'admin' ? 'Administrador (RH)' : 'Colaborador'}</div>
        </div>
        <div className="profile-detail-item animate-fade">
          <div className="profile-detail-label">Departamento</div>
          <div className="profile-detail-value">{user.department || 'Não informado'}</div>
        </div>
      </div>
    </>
  )
}
