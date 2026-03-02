import { useState } from 'react';
import Card from '../../components/common/Card/Card';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import { useNotification } from '../../context/NotificationContext';

const Profile = ({ user, onUpdate }) => {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const { addNotification } = useNotification();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = (e) => {
    e.preventDefault();
    onUpdate(form);
    addNotification('Perfil actualizado correctamente', 'success');
  };

  return (
    <div className="profile">
      <div className="profile__header">
        <h2 className="profile__title">Mi Perfil</h2>
        <p className="profile__subtitle">Gestiona tu información personal</p>
      </div>

      <div className="profile__content">
        <Card className="profile__card">
          <div className="profile__avatar-section">
            <div className="profile__avatar">
              {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="profile__avatar-info">
              <h3 className="profile__name">{user?.name}</h3>
              <span className="profile__role">
                {user?.role === 'admin' ? 'Administrador' : 'Barbero'}
              </span>
            </div>
          </div>

          <form className="profile__form" onSubmit={handleSave}>
            <Input
              label="Nombre completo"
              name="name"
              value={form.name}
              onChange={handleChange}
            />
            <Input
              label="Correo electrónico"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
            />
            <Input
              label="Teléfono"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />
            <Button variant="primary" size="md">
              Guardar Cambios
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
