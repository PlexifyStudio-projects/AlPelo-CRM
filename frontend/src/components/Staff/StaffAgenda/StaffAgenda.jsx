import Agenda from '../../../pages/Agenda/Agenda';

const StaffAgenda = ({ user }) => <Agenda staffOnlyId={user?.id} />;

export default StaffAgenda;
