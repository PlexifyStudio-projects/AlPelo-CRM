import { useState, useEffect } from 'react';
import Agenda from '../../../pages/Agenda/Agenda';
import staffMeService from '../../../services/staffMeService';

const StaffAgenda = ({ user }) => {
  const [commRate, setCommRate] = useState(0.45);

  useEffect(() => {
    staffMeService.getStats().then(s => {
      if (s?.commission_rate) setCommRate(s.commission_rate);
    }).catch(() => {});
  }, []);

  return <Agenda staffOnlyId={user?.id} staffCommissionRate={commRate} />;
};

export default StaffAgenda;
