// assets
import { CalendarTodayTwoToneIcon as CalendarTodayTwoTone } from 'ui-component/icons';

// ==============================|| OVERRIDES - DATE PICKER ||============================== //

export default function DatePicker() {
  return {
    MuiDatePicker: {
      defaultProps: {
        slots: { openPickerIcon: () => <CalendarTodayTwoTone /> }
      }
    }
  };
}
