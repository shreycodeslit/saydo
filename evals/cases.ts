// Hand-checked test set for the task parser.
// Every case is scored as if spoken on Monday 23 Nov 2026 at 10:00 in India (Asia/Kolkata).
// Conventions (the AI prompt states the same ones):
//   morning 09:00 · noon 12:00 · afternoon 14:00 · evening 18:00 · night / tonight 21:00
//   a bare hour 1–7 means pm, 8–11 means am · "before/by X" → due X · "next <weekday>" → the coming one
//   "next week" → next Monday · "next month" → the 1st · a repeating task's due date is its next occurrence

export const EVAL_NOW = '2026-11-23T10:00:00+05:30';
export const EVAL_TZ = 'Asia/Kolkata';

export interface Expected { title: string; due?: string | null; time?: string | null; repeat?: string | null; priority?: 'high' | 'normal' | 'low' }
export interface EvalCase { id: number; group: 'English' | 'Times' | 'Repeats' | 'Hinglish' | 'Several tasks' | 'Priority' | 'Tricky'; input: string; expected: Expected[] }

const D = (md: string) => `2026-${md}`;

export const CASES: EvalCase[] = [
  // English: dates
  { id: 1, group: 'English', input: 'buy milk', expected: [{ title: 'Buy milk' }] },
  { id: 2, group: 'English', input: 'call the plumber tomorrow', expected: [{ title: 'Call the plumber', due: D('11-24') }] },
  { id: 3, group: 'English', input: 'pay the electricity bill before the 10th', expected: [{ title: 'Pay the electricity bill', due: D('12-10') }] },
  { id: 4, group: 'English', input: 'submit the report by friday', expected: [{ title: 'Submit the report', due: D('11-27') }] },
  { id: 5, group: 'English', input: 'meeting with the client tomorrow at 5', expected: [{ title: 'Meeting with the client', due: D('11-24'), time: '17:00' }] },
  { id: 6, group: 'English', input: 'dentist appointment on 3 dec at 11am', expected: [{ title: 'Dentist appointment', due: D('12-03'), time: '11:00' }] },
  { id: 7, group: 'English', input: 'call papa tonight', expected: [{ title: 'Call papa', due: D('11-23'), time: '21:00' }] },
  { id: 8, group: 'English', input: 'pick up the dry cleaning this evening', expected: [{ title: 'Pick up the dry cleaning', due: D('11-23'), time: '18:00' }] },
  { id: 9, group: 'English', input: 'book the venue next week', expected: [{ title: 'Book the venue', due: D('11-30') }] },
  { id: 10, group: 'English', input: 'renew my passport next month', expected: [{ title: 'Renew my passport', due: D('12-01') }] },
  { id: 11, group: 'English', input: 'send the invoice in 2 days', expected: [{ title: 'Send the invoice', due: D('11-25') }] },
  { id: 12, group: 'English', input: 'get a haircut on saturday', expected: [{ title: 'Get a haircut', due: D('11-28') }] },
  { id: 13, group: 'English', input: 'order the birthday cake for sunday', expected: [{ title: 'Order the birthday cake', due: D('11-29') }] },
  { id: 14, group: 'English', input: 'call the bank at 3:30 pm', expected: [{ title: 'Call the bank', due: D('11-23'), time: '15:30' }] },
  { id: 15, group: 'English', input: 'email the landlord at 9', expected: [{ title: 'Email the landlord', due: D('11-24'), time: '09:00' }] },
  { id: 16, group: 'English', input: 'team standup on monday at 10', expected: [{ title: 'Team standup', due: D('11-30'), time: '10:00' }] },
  { id: 17, group: 'English', input: 'finish the presentation by end of month', expected: [{ title: 'Finish the presentation', due: D('11-30') }] },
  { id: 18, group: 'English', input: "buy a gift for riya's birthday on 2nd december", expected: [{ title: "Buy a gift for riya's birthday", due: D('12-02') }] },
  { id: 19, group: 'English', input: 'check the car tyres this weekend', expected: [{ title: 'Check the car tyres', due: D('11-28') }] },
  { id: 20, group: 'English', input: 'visit nani day after tomorrow', expected: [{ title: 'Visit nani', due: D('11-25') }] },
  { id: 21, group: 'English', input: 'remind me to drink water', expected: [{ title: 'Drink water' }] },
  { id: 22, group: 'English', input: 'pay the credit card bill by the 15th', expected: [{ title: 'Pay the credit card bill', due: D('12-15') }] },
  { id: 23, group: 'English', input: 'collect the parcel from the post office tomorrow afternoon', expected: [{ title: 'Collect the parcel from the post office', due: D('11-24'), time: '14:00' }] },
  { id: 24, group: 'English', input: 'wish rahul happy birthday on 30th november', expected: [{ title: 'Wish rahul happy birthday', due: D('11-30') }] },
  { id: 25, group: 'English', input: 'cancel the netflix subscription before 1st december', expected: [{ title: 'Cancel the netflix subscription', due: D('12-01') }] },
  { id: 26, group: 'English', input: 'renew gym membership on 1 jan', expected: [{ title: 'Renew gym membership', due: '2027-01-01' }] },
  { id: 27, group: 'English', input: 'buy diwali sweets', expected: [{ title: 'Buy diwali sweets' }] },
  { id: 28, group: 'English', input: 'tomorrow i have to call the gas agency', expected: [{ title: 'Call the gas agency', due: D('11-24') }] },
  { id: 29, group: 'English', input: 'pay emi on 7th', expected: [{ title: 'Pay emi', due: D('12-07') }] },
  { id: 30, group: 'English', input: 'book doctor appointment for papa this friday at 10:30am', expected: [{ title: 'Book doctor appointment for papa', due: D('11-27'), time: '10:30' }] },

  // Times and parts of the day
  { id: 31, group: 'Times', input: 'go for a run tomorrow morning', expected: [{ title: 'Go for a run', due: D('11-24'), time: '09:00' }] },
  { id: 32, group: 'Times', input: 'call the electrician at 6', expected: [{ title: 'Call the electrician', due: D('11-23'), time: '18:00' }] },
  { id: 33, group: 'Times', input: "doctor's appointment wednesday at 4:15pm", expected: [{ title: "Doctor's appointment", due: D('11-25'), time: '16:15' }] },
  { id: 34, group: 'Times', input: 'take the dog to the vet saturday at noon', expected: [{ title: 'Take the dog to the vet', due: D('11-28'), time: '12:00' }] },
  { id: 35, group: 'Times', input: 'lunch with priya on thursday afternoon', expected: [{ title: 'Lunch with priya', due: D('11-26'), time: '14:00' }] },
  { id: 36, group: 'Times', input: 'watch the match sunday night', expected: [{ title: 'Watch the match', due: D('11-29'), time: '21:00' }] },
  { id: 37, group: 'Times', input: 'book a cab for 6am tomorrow', expected: [{ title: 'Book a cab', due: D('11-24'), time: '06:00' }] },
  { id: 38, group: 'Times', input: 'in the evening tomorrow call the carpenter', expected: [{ title: 'Call the carpenter', due: D('11-24'), time: '18:00' }] },
  { id: 39, group: 'Times', input: 'submit assignment before 11:59 tonight', expected: [{ title: 'Submit assignment', due: D('11-23'), time: '23:59' }] },
  { id: 40, group: 'Times', input: 'schedule car service for next saturday morning', expected: [{ title: 'Schedule car service', due: D('11-28'), time: '09:00' }] },

  // Repeats
  { id: 41, group: 'Repeats', input: 'take medicine every night', expected: [{ title: 'Take medicine', due: D('11-23'), time: '21:00', repeat: 'FREQ=DAILY' }] },
  { id: 42, group: 'Repeats', input: 'gym every weekday at 7am', expected: [{ title: 'Gym', due: D('11-24'), time: '07:00', repeat: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' }] },
  { id: 43, group: 'Repeats', input: 'water the plants every other day', expected: [{ title: 'Water the plants', due: D('11-23'), repeat: 'FREQ=DAILY;INTERVAL=2' }] },
  { id: 44, group: 'Repeats', input: 'pay rent on the 5th of every month', expected: [{ title: 'Pay rent', due: D('12-05'), repeat: 'FREQ=MONTHLY;BYMONTHDAY=5' }] },
  { id: 45, group: 'Repeats', input: 'get the car washed every second saturday', expected: [{ title: 'Get the car washed', due: D('12-12'), repeat: 'FREQ=MONTHLY;BYDAY=2SA' }] },
  { id: 46, group: 'Repeats', input: 'yoga every monday and thursday at 6', expected: [{ title: 'Yoga', due: D('11-23'), time: '18:00', repeat: 'FREQ=WEEKLY;BYDAY=MO,TH' }] },
  { id: 47, group: 'Repeats', input: 'call grandma every sunday', expected: [{ title: 'Call grandma', due: D('11-29'), repeat: 'FREQ=WEEKLY;BYDAY=SU' }] },
  { id: 48, group: 'Repeats', input: 'clean the fridge every month', expected: [{ title: 'Clean the fridge', due: D('11-23'), repeat: 'FREQ=MONTHLY' }] },
  { id: 49, group: 'Repeats', input: 'backup the laptop every friday evening', expected: [{ title: 'Backup the laptop', due: D('11-27'), time: '18:00', repeat: 'FREQ=WEEKLY;BYDAY=FR' }] },
  { id: 50, group: 'Repeats', input: 'pay the maid on the 1st of every month', expected: [{ title: 'Pay the maid', due: D('12-01'), repeat: 'FREQ=MONTHLY;BYMONTHDAY=1' }] },
  { id: 51, group: 'Repeats', input: 'change the bedsheets every weekend', expected: [{ title: 'Change the bedsheets', due: D('11-28'), repeat: 'FREQ=WEEKLY;BYDAY=SA,SU' }] },
  { id: 52, group: 'Repeats', input: 'review my budget every 2 weeks', expected: [{ title: 'Review my budget', due: D('11-23'), repeat: 'FREQ=WEEKLY;INTERVAL=2' }] },
  { id: 53, group: 'Repeats', input: 'evening walk every day at 7pm', expected: [{ title: 'Evening walk', due: D('11-23'), time: '19:00', repeat: 'FREQ=DAILY' }] },
  { id: 54, group: 'Repeats', input: 'standup every weekday at 10:30', expected: [{ title: 'Standup', due: D('11-23'), time: '10:30', repeat: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' }] },
  { id: 55, group: 'Repeats', input: 'pay the electricity bill every month before the 10th', expected: [{ title: 'Pay the electricity bill', due: D('12-10'), repeat: 'FREQ=MONTHLY;BYMONTHDAY=10' }] },
  { id: 56, group: 'Repeats', input: 'call mom every alternate sunday', expected: [{ title: 'Call mom', due: D('11-29'), repeat: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU' }] },
  { id: 57, group: 'Repeats', input: 'pay the newspaper bill every month on the 3rd', expected: [{ title: 'Pay the newspaper bill', due: D('12-03'), repeat: 'FREQ=MONTHLY;BYMONTHDAY=3' }] },
  { id: 58, group: 'Repeats', input: 'send weekly report every friday at 5pm', expected: [{ title: 'Send weekly report', due: D('11-27'), time: '17:00', repeat: 'FREQ=WEEKLY;BYDAY=FR' }] },

  // Hinglish
  { id: 59, group: 'Hinglish', input: 'kal subah 8 baje doctor ke paas jana hai', expected: [{ title: 'Doctor ke paas jana', due: D('11-24'), time: '08:00' }] },
  { id: 60, group: 'Hinglish', input: 'mummy ko call karna sunday shaam ko', expected: [{ title: 'Mummy ko call karna', due: D('11-29'), time: '18:00' }] },
  { id: 61, group: 'Hinglish', input: 'bijli ka bill bharna 10 tarikh se pehle', expected: [{ title: 'Bijli ka bill bharna', due: D('12-10') }] },
  { id: 62, group: 'Hinglish', input: 'parson bank jana hai', expected: [{ title: 'Bank jana', due: D('11-25') }] },
  { id: 63, group: 'Hinglish', input: 'har roz subah yoga karna', expected: [{ title: 'Yoga karna', due: D('11-24'), time: '09:00', repeat: 'FREQ=DAILY' }] },
  { id: 64, group: 'Hinglish', input: 'aaj raat ko dawai leni hai', expected: [{ title: 'Dawai leni', due: D('11-23'), time: '21:00' }] },
  { id: 65, group: 'Hinglish', input: 'shaniwar ko gaadi dhulwani hai', expected: [{ title: 'Gaadi dhulwani', due: D('11-28') }] },
  { id: 66, group: 'Hinglish', input: 'agle hafte passport office jana', expected: [{ title: 'Passport office jana', due: D('11-30') }] },
  { id: 67, group: 'Hinglish', input: 'har mahine 5 tarikh ko rent dena', expected: [{ title: 'Rent dena', due: D('12-05'), repeat: 'FREQ=MONTHLY;BYMONTHDAY=5' }] },
  { id: 68, group: 'Hinglish', input: 'doodh lana aur sabzi lana', expected: [{ title: 'Doodh lana' }, { title: 'Sabzi lana' }] },
  { id: 69, group: 'Hinglish', input: 'papa ko kal shaam 7 baje call karna', expected: [{ title: 'Papa ko call karna', due: D('11-24'), time: '19:00' }] },
  { id: 70, group: 'Hinglish', input: 'zaroori: insurance ka premium bharna friday tak', expected: [{ title: 'Insurance ka premium bharna', due: D('11-27'), priority: 'high' }] },
  { id: 71, group: 'Hinglish', input: 'somvar ko office mein report submit karni hai', expected: [{ title: 'Office mein report submit karni', due: D('11-30') }] },
  { id: 72, group: 'Hinglish', input: 'har ravivar ko nani se baat karni hai', expected: [{ title: 'Nani se baat karni', due: D('11-29'), repeat: 'FREQ=WEEKLY;BYDAY=SU' }] },
  { id: 73, group: 'Hinglish', input: 'मम्मी को कल फ़ोन करना', expected: [{ title: 'मम्मी को फ़ोन करना', due: D('11-24') }] },

  // Several tasks in one go
  { id: 74, group: 'Several tasks', input: 'pay the electricity bill before the 10th, call mom sunday evening, and every second saturday get the car washed', expected: [
    { title: 'Pay the electricity bill', due: D('12-10') }, { title: 'Call mom', due: D('11-29'), time: '18:00' }, { title: 'Get the car washed', due: D('12-12'), repeat: 'FREQ=MONTHLY;BYDAY=2SA' }] },
  { id: 75, group: 'Several tasks', input: 'buy milk and call the plumber', expected: [{ title: 'Buy milk' }, { title: 'Call the plumber' }] },
  { id: 76, group: 'Several tasks', input: 'remind me to buy milk, eggs and bread tomorrow morning', expected: [{ title: 'Buy milk, eggs and bread', due: D('11-24'), time: '09:00' }] },
  { id: 77, group: 'Several tasks', input: 'book flight tickets then email the hotel', expected: [{ title: 'Book flight tickets' }, { title: 'Email the hotel' }] },
  { id: 78, group: 'Several tasks', input: 'call dad tomorrow at 9 and pay the wifi bill on friday', expected: [{ title: 'Call dad', due: D('11-24'), time: '09:00' }, { title: 'Pay the wifi bill', due: D('11-27') }] },
  { id: 79, group: 'Several tasks', input: 'clean the room. do laundry tomorrow', expected: [{ title: 'Clean the room' }, { title: 'Do laundry', due: D('11-24') }] },
  { id: 80, group: 'Several tasks', input: 'get groceries, pick up the kids at 3 and cook dinner', expected: [{ title: 'Get groceries' }, { title: 'Pick up the kids', due: D('11-23'), time: '15:00' }, { title: 'Cook dinner' }] },
  { id: 81, group: 'Several tasks', input: 'mom ko call karna aur kal subah gym jana', expected: [{ title: 'Mom ko call karna' }, { title: 'Gym jana', due: D('11-24'), time: '09:00' }] },

  // Priority
  { id: 82, group: 'Priority', input: 'urgent: submit the tax documents today', expected: [{ title: 'Submit the tax documents', due: D('11-23'), priority: 'high' }] },
  { id: 83, group: 'Priority', input: 'important call the lawyer tomorrow', expected: [{ title: 'Call the lawyer', due: D('11-24'), priority: 'high' }] },
  { id: 84, group: 'Priority', input: 'fix the leaking tap sometime', expected: [{ title: 'Fix the leaking tap', priority: 'low' }] },
  { id: 85, group: 'Priority', input: 'read that book whenever', expected: [{ title: 'Read that book', priority: 'low' }] },
  { id: 86, group: 'Priority', input: 'asap reply to the hr email', expected: [{ title: 'Reply to the hr email', priority: 'high' }] },

  // Tricky: phrasing the rules don't cover, where the AI should take over
  { id: 87, group: 'Tricky', input: 'after the meeting on thursday send the minutes to everyone', expected: [{ title: 'Send the minutes to everyone', due: D('11-26') }] },
  { id: 88, group: 'Tricky', input: 'the gas cylinder needs booking by thursday', expected: [{ title: 'Book the gas cylinder', due: D('11-26') }] },
  { id: 89, group: 'Tricky', input: 'every 3rd thursday of the month society meeting at 7pm', expected: [{ title: 'Society meeting', due: D('12-17'), time: '19:00', repeat: 'FREQ=MONTHLY;BYDAY=3TH' }] },
  { id: 90, group: 'Tricky', input: 'pay school fees by the last day of the month', expected: [{ title: 'Pay school fees', due: D('11-30') }] },
  { id: 91, group: 'Tricky', input: 'call aunty on her birthday 4th december morning', expected: [{ title: 'Call aunty on her birthday', due: D('12-04'), time: '09:00' }] },
  { id: 92, group: 'Tricky', input: 'next to next monday client demo', expected: [{ title: 'Client demo', due: D('12-07') }] },
  { id: 93, group: 'Tricky', input: 'dentist at quarter past four on wednesday', expected: [{ title: 'Dentist', due: D('11-25'), time: '16:15' }] },
  { id: 94, group: 'Tricky', input: 'on the first monday of every month check the inverter battery', expected: [{ title: 'Check the inverter battery', due: D('12-07'), repeat: 'FREQ=MONTHLY;BYDAY=1MO' }] },
  { id: 95, group: 'Tricky', input: 'call the society office between 2 and 4 tomorrow', expected: [{ title: 'Call the society office', due: D('11-24'), time: '14:00' }] },
  { id: 96, group: 'Tricky', input: 'call ravi when i reach home', expected: [{ title: 'Call ravi when I reach home' }] },
];
