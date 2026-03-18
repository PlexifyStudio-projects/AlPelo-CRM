import Agenda from '../../../pages/Agenda/Agenda';

const StaffAgenda = ({ user }) => {
  return <Agenda staffOnlyId={user?.id} />;
};

export default StaffAgenda;
