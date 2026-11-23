// Held-out test set: written after the parser was tuned on cases.ts, and never used for tuning.
// Its score is the honest estimate of how the parser does on phrasing it hasn't seen.
import type { EvalCase } from './cases';

const D = (md: string) => `2026-${md}`;
const H = (id: number, group: EvalCase['group'], input: string, expected: EvalCase['expected']): EvalCase => ({ id: 1000 + id, group, input, expected });

export const HELDOUT: EvalCase[] = [
  H(1, 'English', 'call the insurance agent on friday at 11', [{ title: 'Call the insurance agent', due: D('11-27'), time: '11:00' }]),
  H(2, 'English', 'pay the water bill tomorrow', [{ title: 'Pay the water bill', due: D('11-24') }]),
  H(3, 'English', 'buy a new charger', [{ title: 'Buy a new charger' }]),
  H(4, 'Times', 'meet sameer for coffee on wednesday evening', [{ title: 'Meet sameer for coffee', due: D('11-25'), time: '18:00' }]),
  H(5, 'English', 'send the rent receipt to the tenant by the 2nd', [{ title: 'Send the rent receipt to the tenant', due: D('12-02') }]),
  H(6, 'English', 'renew the domain before 15 december', [{ title: 'Renew the domain', due: D('12-15') }]),
  H(7, 'Times', 'remind me to call the cable guy at 4', [{ title: 'Call the cable guy', due: D('11-23'), time: '16:00' }]),
  H(8, 'Times', 'groceries on sunday morning', [{ title: 'Groceries', due: D('11-29'), time: '09:00' }]),
  H(9, 'Repeats', 'take vitamins every morning', [{ title: 'Take vitamins', due: D('11-24'), time: '09:00', repeat: 'FREQ=DAILY' }]),
  H(10, 'Repeats', 'clean the balcony every saturday', [{ title: 'Clean the balcony', due: D('11-28'), repeat: 'FREQ=WEEKLY;BYDAY=SA' }]),
  H(11, 'Repeats', 'check the property tax on the 20th of every month', [{ title: 'Check the property tax', due: D('12-20'), repeat: 'FREQ=MONTHLY;BYMONTHDAY=20' }]),
  H(12, 'Repeats', 'pay the society maintenance every month on 10th', [{ title: 'Pay the society maintenance', due: D('12-10'), repeat: 'FREQ=MONTHLY;BYMONTHDAY=10' }]),
  H(13, 'Repeats', 'piano practice every tuesday and friday at 5', [{ title: 'Piano practice', due: D('11-24'), time: '17:00', repeat: 'FREQ=WEEKLY;BYDAY=TU,FR' }]),
  H(14, 'Repeats', 'run 5k every other saturday', [{ title: 'Run 5k', due: D('11-28'), repeat: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA' }]),
  H(15, 'Hinglish', 'kal dopahar 2 baje meeting hai', [{ title: 'Meeting', due: D('11-24'), time: '14:00' }]),
  H(16, 'Hinglish', 'budhvar ko dhobi ko kapde dene hain', [{ title: 'Dhobi ko kapde dene', due: D('11-25') }]),
  H(17, 'Hinglish', 'har shanivar ghar ki safai', [{ title: 'Ghar ki safai', due: D('11-28'), repeat: 'FREQ=WEEKLY;BYDAY=SA' }]),
  H(18, 'Hinglish', 'aaj shaam ko sabzi lani hai', [{ title: 'Sabzi lani', due: D('11-23'), time: '18:00' }]),
  H(19, 'Hinglish', 'agle mahine car service karwani hai', [{ title: 'Car service karwani', due: D('12-01') }]),
  H(20, 'Hinglish', 'parson subah 10 baje bank jana', [{ title: 'Bank jana', due: D('11-25'), time: '10:00' }]),
  H(21, 'Several tasks', 'call nisha and book the movie tickets', [{ title: 'Call nisha' }, { title: 'Book the movie tickets' }]),
  H(22, 'Several tasks', 'pay the gardener tomorrow and repot the money plant on sunday', [{ title: 'Pay the gardener', due: D('11-24') }, { title: 'Repot the money plant', due: D('11-29') }]),
  H(23, 'Priority', 'urgent call the bank about the blocked card', [{ title: 'Call the bank about the blocked card', priority: 'high' }]),
  H(24, 'Priority', 'sometime next month clean out the garage', [{ title: 'Clean out the garage', due: D('12-01'), priority: 'low' }]),
  H(25, 'Times', 'submit expense report before friday 6pm', [{ title: 'Submit expense report', due: D('11-27'), time: '18:00' }]),
  H(26, 'English', 'book train tickets to jaipur by 1st december', [{ title: 'Book train tickets to jaipur', due: D('12-01') }]),
  H(27, 'Times', 'doctor checkup for mom on 5th dec at 10am', [{ title: 'Doctor checkup for mom', due: D('12-05'), time: '10:00' }]),
  H(28, 'Times', 'call the school at half past nine tomorrow', [{ title: 'Call the school', due: D('11-24'), time: '09:30' }]),
  H(29, 'English', 'file gst return by the 20th', [{ title: 'File gst return', due: D('12-20') }]),
  H(30, 'Repeats', 'water the garden every evening', [{ title: 'Water the garden', due: D('11-23'), time: '18:00', repeat: 'FREQ=DAILY' }]),
  H(31, 'English', 'lock the car', [{ title: 'Lock the car' }]),
  H(32, 'Times', 'remember to switch off the geyser tonight', [{ title: 'Switch off the geyser', due: D('11-23'), time: '21:00' }]),
  H(33, 'Repeats', 'on the last friday of every month send the team update', [{ title: 'Send the team update', due: D('11-27'), repeat: 'FREQ=MONTHLY;BYDAY=-1FR' }]),
  H(34, 'English', 'call grandpa on his birthday on 9 december', [{ title: 'Call grandpa on his birthday', due: D('12-09') }]),
  H(35, 'Times', 'buy flowers for the puja on thursday morning', [{ title: 'Buy flowers for the puja', due: D('11-26'), time: '09:00' }]),
  H(36, 'Hinglish', 'mujhe kal yaad dilana ki electrician ko bulana hai', [{ title: 'Electrician ko bulana', due: D('11-24') }]),
  H(37, 'English', 'pay the internet bill and the phone bill by the 5th', [{ title: 'Pay the internet bill and the phone bill', due: D('12-05') }]),
  H(38, 'Repeats', 'check emails at 8 every morning', [{ title: 'Check emails', due: D('11-24'), time: '08:00', repeat: 'FREQ=DAILY' }]),
  H(39, 'Times', 'dinner reservation for saturday 8:30pm', [{ title: 'Dinner reservation', due: D('11-28'), time: '20:30' }]),
  H(40, 'Hinglish', 'kal se roz 6 baje uthna', [{ title: 'Uthna', due: D('11-24'), time: '06:00', repeat: 'FREQ=DAILY' }]),
];
