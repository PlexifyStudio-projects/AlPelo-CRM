import { useState } from 'react';
import Card from '../../components/common/Card/Card';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import { useNotification } from '../../context/NotificationContext';

const ChangePassword = () => {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [error, setError] = useState('');
  const { addNotification } = useNotification();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.current || !form.newPass || !form.confirm) {
      setError('Todos los campos son obligatorios');
      return;
    }
    if (form.newPass !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.newPass.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    addNotification('Contraseña actualizada correctamente', 'success');
    setForm({ current: '', newPass: '', confirm: '' });
  };

  return (
    <div className="change-password">
      <div className="change-password__header">
        <h2 className="change-password__title">Cambiar Contraseña</h2>
        <p className="change-password__subtitle">Actualiza tu contraseña de acceso</p>
      </div>

      <div className="change-password__content">
        <Card className="change-password__card">
          <form className="change-password__form" onSubmit={handleSubmit}>
            <Input
              label="Contraseña actual"
              type="password"
              name="current"
              value={form.current}
              onChange={handleChange}
              placeholder="Ingresa tu contraseña actual"
            />
            <Input
              label="Nueva contraseña"
              type="password"
              name="newPass"
              value={form.newPass}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
            />
            <Input
              label="Confirmar nueva contraseña"
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              placeholder="Repite la nueva contraseña"
            />
            {error && <p className="change-password__error">{error}</p>}
            <Button variant="primary" size="md">
              Actualizar Contraseña
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ChangePassword;
