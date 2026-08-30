import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { getSetting, setSetting } from './db';
import { SalaryType } from './types';

export type Lang = 'en' | 'hi';

/**
 * Wording rule for this app: one short everyday word per action. Households
 * using it are not payroll clerks, so "Absent" beats "Mark as absent" and
 * "Advance" beats "Ledger entry". Keep new strings to one or two words.
 */
const en = {
  workers: 'Workers',
  worker: 'Worker',
  addWorker: 'Add worker',
  editWorker: 'Edit worker',
  newWorker: 'New worker',
  noWorkers: 'No workers yet',
  noWorkersBody: 'Add your maid, cook, milkman or anyone you pay.',
  tracking: (n: number) => `${n} ${n === 1 ? 'worker' : 'workers'}`,
  markedOf: (a: number, b: number) => `${a} of ${b} marked`,

  present: 'Present',
  absent: 'Absent',
  half: 'Half day',
  leave: 'Leave',
  weekOff: 'Week off',
  holiday: 'Holiday',

  today: 'Today',
  calendar: 'Calendar',
  salary: 'Salary',
  settings: 'Settings',

  name: 'Name',
  work: 'Work',
  workHint: 'Maid, cook, milkman, driver…',
  phone: 'Phone',
  phoneHint: 'For WhatsApp slip — optional',
  perMonth: 'Per month',
  perDay: 'Per day',
  monthlySalary: 'Monthly salary',
  dailyWage: 'Daily wage',
  hiredOn: 'Hired on',
  howLong: 'How long?',
  ongoing: 'Ongoing',
  forDays: 'For days',
  forMonths: 'For months',
  numberOf: (unit: string) => `Number of ${unit}`,

  save: 'Save',
  cancel: 'Cancel',
  change: 'Change',
  delete: 'Delete',
  archive: 'Archive',
  remove: 'Remove worker',

  dayRate: 'Day rate',
  payableDays: 'Payable days',
  earned: 'Earned',
  bonus: 'Bonus',
  advance: 'Advance',
  deduction: 'Deduction',
  netPayable: 'Net payable',
  partMonth: 'Part month',
  whatsapp: 'WhatsApp',
  pdfSlip: 'PDF slip',

  daysBlank: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} not marked`,
  notCounted: 'Not counted in salary. Tap to mark all present.',
  daysMarked: (n: number) => `${n} marked`,
  stillBlank: (n: number) => `${n} blank`,
  tapHint: 'Tap a day to change it.',

  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  language: 'Language',
  freePlan: 'Free plan',
  slotsUsed: (a: number, b: number) => `${a} of ${b} workers used`,
  limitReached: 'Limit reached',
  olderMonths: 'Older months',
  olderMonthsBody: 'The free plan shows 2 months. Older records are still saved.',
  futureDay: 'Not yet',
  futureDayBody: 'You cannot mark a day that has not happened.',
  beforeStart: 'Too early',
  beforeStartBody: 'This is before they were hired.',
  afterEnd: 'Too late',
  afterEndBody: 'This is after their work ended.',
  confirmChange: 'Change this day?',

  perUnit: 'Per unit',
  unit: 'Unit',
  unitHint: 'kg, litre, piece',
  ratePerUnit: 'Rate per unit',
  usualQty: 'Usual quantity',
  quantity: 'Quantity',
  totalQty: 'Total',
  daysOf: (a: number, b: number) => `${a}/${b} days`,

  perHour: 'Per hour',
  hourlyRate: 'Rate per hour',
  hoursWorked: 'Hours worked',
  helpHoursWorked: 'How many hours they worked this day. Needed for hourly pay to add up correctly.',

  feedback: 'Help us improve',
  feedbackHint: 'One thing that would make GharKhata better for you…',
  send: 'Send',
  feedbackEmpty: 'Write something first.',

  upgrade: 'Upgrade',
  upgradeBody: 'Unlimited workers, full history, branded slips, reminders.',
  comingSoon: 'Coming soon',
  comingSoonBody: 'Payments are not switched on yet. The app is fully free.',
  clear: 'Clear',

  roleMaid: 'Maid',
  roleCook: 'Cook',
  roleMilkman: 'Milkman',
  roleDriver: 'Driver',
  roleNanny: 'Nanny',
  roleGardener: 'Gardener',
  roleGuard: 'Guard',
  roleSweeper: 'Sweeper',
  roleLabour: 'Labour',

  now: 'NOW',
  withUpgrade: 'With Upgrade',
  onPremiumTitle: 'You’re on Premium',
  onPremiumBody: 'Unlimited workers, full history, and every premium feature is unlocked.',
  freeWorkers: (n: number) => `${n} workers`,
  freeHistory: (n: number) => `Last ${n} months history only`,
  freeRestoreLine: 'Restore your data anytime, always free',
  featUnlimited: 'Add as many workers as you want',
  featHistory: 'Previous months history',
  featUnlimitedExport: 'Unlimited exports',
  featReminders: 'Monthly reminder for timely salary pay',
  featAppLock: 'Lock the app with a PIN',

  balanceDue: 'Balance due',
  allSettled: 'All settled',
  paidExtra: 'Paid extra',
  recordPayment: 'Record payment',
  addEntry: 'Add entry',
  addAdvance: 'Add advance',
  history: 'History',
  noEntries: 'Nothing recorded yet.',
  deleteEntry: 'Delete this entry?',
  deleteEntryBody: 'This cannot be undone.',

  backup: 'Backup',
  backupHint: 'Save everything to a file, or bring it back on a new phone.',
  exportBackup: 'Export',
  restore: 'Restore',
  restoreWarnTitle: 'Restore backup?',
  restoreWarnBody:
    'This replaces everything currently on this phone with the backup file. This cannot be undone.',
  restoreDoneTitle: 'Restored',
  restoreDoneBody: 'Close and reopen the app to see everything.',
  restoreBadTitle: 'Could not restore',
  restoreBadBody: 'That file does not look like a GharKhata backup.',

  guideTitle: 'How GharKhata works',
  guideDone: 'Got it',
  guideHomeTitle: 'Mark attendance daily',
  guideHomeBody: 'Home shows every worker with one-tap Present, Half day, or Absent for today.',
  guideCalendarTitle: 'Fix a past day',
  guideCalendarBody: 'Open Calendar, tap any day, and pick the correct status — a past day asks you to confirm.',
  guideSalaryTitle: 'Salary calculates itself',
  guideSalaryBody: 'Salary adds up marked days automatically using each worker’s rate. Unmarked days are not paid until you mark them.',
  guideBalanceTitle: 'Advances and balance due',
  guideBalanceBody: 'Tap the + on a worker’s card to record an advance. Balance due carries forward automatically until you record a payment.',
  guideShareTitle: 'Share the slip',
  guideShareBody: 'Send a WhatsApp message or a PDF slip straight from the Salary screen.',
  guideBackupTitle: 'Back up regularly',
  guideBackupBody: 'Everything lives only on this phone. Export a backup from Settings before switching phones or reinstalling.',
  reminderTitle: 'Backup reminder',
  reminderBody: 'A notification every 15 days to export your data.',
  reminderDeniedTitle: 'Notifications blocked',
  reminderDeniedBody: 'Turn on notifications for GharKhata in your phone’s settings to get this reminder.',
  dueReminderTitle: 'Salary due reminder',
  dueReminderBody: 'A monthly nudge to check pending balances and pay workers on time.',
  fine: 'Fine',
  amount: 'Amount',
  noteOptional: 'Note (optional)',
  method: 'Method',
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',

  nameRequiredBody: 'Enter a name before saving.',
  amountRequiredBody: 'Enter an amount greater than zero.',
  payType: 'Pay type',
  upiIdLabel: 'UPI ID',
  upiIdHint: 'name@bank — optional',
  daysHiredHint: (role: string) => `Number of days ${role} is hired`,
  monthsHiredHint: 'Total months hired',

  helpName: 'The worker’s name, shown throughout the app and on payslips.',
  helpWork: 'What they do — helps you tell workers apart at a glance.',
  helpPhone: 'Used to open WhatsApp directly with their payslip. 10 digits, optional.',
  helpUpi: 'Their UPI ID (VPA), used only for the "Pay via UPI" shortcut when recording a payment. Optional.',
  helpPayType: 'Fixed monthly wage, a daily wage, an hourly rate, or a rate per unit like per litre of milk.',
  helpUnit: 'The unit they’re paid by — kg, litre, piece, and so on.',
  helpAmount: (type: SalaryType): string =>
    type === 'monthly'
      ? 'The full amount paid each month if they work every day.'
      : type === 'per_unit'
        ? 'The rate paid for one unit — for example ₹40 per litre.'
        : type === 'hourly'
          ? 'The rate paid for one hour of work.'
          : 'The amount paid for one full day of work.',
  helpUsualQty: 'The amount they usually deliver each day. Pre-fills on Home so marking a normal day is one tap.',
  helpHiredOn: 'The date they started. Attendance and salary only count from this date onward.',
  helpHowLong: 'Ongoing if there’s no fixed end date, or set a duration for a fixed-term job.',
  weeklyOffLabel: 'Weekly off',
  helpWeeklyOff: 'Which day(s) are their regular day off, if any? That day is automatically counted as paid, whether or not you mark it on the Calendar. Leave blank if they work every day, or if their off day changes week to week.',

  notStarted: 'Not started',
  payingNow: 'Paying now',
  payViaUpi: 'Pay via UPI',
  noUpiTitle: 'No UPI ID saved',
  noUpiBody: 'Add this worker’s UPI ID from Edit worker to use this shortcut.',
  noUpiAppBody: 'No UPI app found on this phone to handle the payment.',

  ok: 'OK',
  deleteWorkerTitle: (name: string) => `Delete ${name}?`,
  deleteWorkerBody: 'Their attendance and payment history stays saved — you just won’t see them day to day.',

  backupGuideTitle: 'Backup & Restore, explained',
  backupGuideBody:
    'Export saves everything — every worker, every day marked, every advance and payment — into one file, and opens your phone’s share screen so you can send it to yourself or save it (WhatsApp, email, Drive, "Save to device" — wherever you pick).\n\nRestore does the opposite: pick a file you exported earlier and it REPLACES everything currently on this phone with it. Use Export regularly as a safety net, and Restore when you\'ve switched phones or reinstalled the app.\n\nFree plan: Export is limited to 2 a month. Restore is always free and unlimited — getting your own data back is never behind a limit.',
  backupLimitTitle: 'Free limit reached',
  backupLimitBody: 'The free plan allows 2 exports a month. Upgrade for unlimited exports — Restore is always free.',
  exportUsageHint: (used: number, limit: number) => `${used} of ${limit} exports used this month`,
  exportDoneTitle: 'Backup ready',
  exportDoneBody: (fileName: string) => `Saved as ${fileName}`,

  yourProfile: 'Your profile',
  yourProfileHint: 'Your own details — not a worker\'s. Stays on this phone, shows on payslips if filled in.',
  emailLabel: 'Email',
  emailHint: 'Optional',
  addPhoto: 'Add photo',
  changePhoto: 'Change photo',
  photoPermissionBody: 'GharKhata needs access to your photos to set a picture.',
  photoErrorBody: 'Could not use that photo. Try a different one.',

  accentColor: 'Accent color',
  accentBlue: 'Blue',
  accentViolet: 'Violet',
  accentRose: 'Rose',
  accentGold: 'Gold',

  weeklyOffBadge: 'Weekly off (auto-paid)',
  weeklyOffOverrideHint: 'Already paid in full — no need to mark anything. Only tap Present if they exceptionally worked; it will not add extra pay, it is just for your record.',
  weeklyOffTapTitle: 'Weekly off — already paid',
  weeklyOffTapBody: (name: string) => `This is ${name}'s regular day off. It is already counted as a paid day automatically — there is nothing to mark.`,

  devPremiumOnTitle: 'Preview premium?',
  devPremiumOnBody: 'Turns on every premium feature on this phone for testing, before real payments exist. Turn off any time from the same place.',
  devPremiumOffTitle: 'Back to free plan?',
  devPremiumOffBody: 'Turns premium preview off and brings back the free-plan limits.',
  devPremiumOn: 'Preview on',
  devPremiumOff: 'Preview off',
};

type Dict = typeof en;

const hi: Dict = {
  workers: 'कामगार',
  worker: 'कामगार',
  addWorker: 'कामगार जोड़ें',
  editWorker: 'बदलाव करें',
  newWorker: 'नया कामगार',
  noWorkers: 'कोई कामगार नहीं',
  noWorkersBody: 'अपनी बाई, रसोइया, दूधवाला या किसी को भी जोड़ें।',
  tracking: (n: number) => `${n} कामगार`,
  markedOf: (a: number, b: number) => `${b} में से ${a} लगाए`,

  present: 'हाज़िर',
  absent: 'गैरहाज़िर',
  half: 'आधा दिन',
  leave: 'छुट्टी',
  weekOff: 'साप्ताहिक छुट्टी',
  holiday: 'त्योहार',

  today: 'आज',
  calendar: 'कैलेंडर',
  salary: 'तनख्वाह',
  settings: 'सेटिंग',

  name: 'नाम',
  work: 'काम',
  workHint: 'बाई, रसोइया, दूधवाला, ड्राइवर…',
  phone: 'फ़ोन',
  phoneHint: 'व्हाट्सएप पर्ची के लिए — ज़रूरी नहीं',
  perMonth: 'महीने का',
  perDay: 'दिन का',
  monthlySalary: 'महीने की तनख्वाह',
  dailyWage: 'दिन की मज़दूरी',
  hiredOn: 'कब से',
  howLong: 'कितने समय के लिए?',
  ongoing: 'लगातार',
  forDays: 'दिनों के लिए',
  forMonths: 'महीनों के लिए',
  numberOf: (unit: string) => `कितने ${unit}`,

  save: 'सेव करें',
  cancel: 'रद्द करें',
  change: 'बदलें',
  delete: 'हटाएँ',
  archive: 'हटाएँ',
  remove: 'कामगार हटाएँ',

  dayRate: 'दिन का रेट',
  payableDays: 'देय दिन',
  earned: 'कमाया',
  bonus: 'बोनस',
  advance: 'एडवांस',
  deduction: 'कटौती',
  netPayable: 'कुल देना है',
  partMonth: 'आधा महीना',
  whatsapp: 'व्हाट्सएप',
  pdfSlip: 'पीडीएफ पर्ची',

  daysBlank: (n: number) => `${n} दिन नहीं लगाए`,
  notCounted: 'तनख्वाह में नहीं गिने। सबको हाज़िर लगाने के लिए दबाएँ।',
  daysMarked: (n: number) => `${n} लगाए`,
  stillBlank: (n: number) => `${n} बाकी`,
  tapHint: 'दिन बदलने के लिए उस पर दबाएँ।',

  theme: 'रंग-रूप',
  dark: 'गहरा',
  light: 'हल्का',
  language: 'भाषा',
  freePlan: 'मुफ़्त प्लान',
  slotsUsed: (a: number, b: number) => `${b} में से ${a} कामगार`,
  limitReached: 'सीमा पूरी',
  olderMonths: 'पुराने महीने',
  olderMonthsBody: 'मुफ़्त प्लान में 2 महीने दिखते हैं। पुराना रिकॉर्ड सुरक्षित है।',
  futureDay: 'अभी नहीं',
  futureDayBody: 'आने वाले दिन पर हाज़िरी नहीं लगा सकते।',
  beforeStart: 'बहुत पहले',
  beforeStartBody: 'यह दिन काम शुरू होने से पहले का है।',
  afterEnd: 'बहुत बाद',
  afterEndBody: 'यह दिन काम खत्म होने के बाद का है।',
  confirmChange: 'यह दिन बदलें?',

  perUnit: 'प्रति यूनिट',
  unit: 'यूनिट',
  unitHint: 'किलो, लीटर, नग',
  ratePerUnit: 'एक यूनिट का रेट',
  usualQty: 'रोज़ कितना',
  quantity: 'मात्रा',
  totalQty: 'कुल',
  daysOf: (a: number, b: number) => `${b} में से ${a} दिन`,

  perHour: 'प्रति घंटा',
  hourlyRate: 'एक घंटे का रेट',
  hoursWorked: 'काम के घंटे',
  helpHoursWorked: 'इस दिन कितने घंटे काम किया। घंटे के हिसाब से तनख्वाह सही जुड़ने के लिए यह ज़रूरी है।',

  feedback: 'हमें बेहतर बनाएँ',
  feedbackHint: 'एक चीज़ जो GharKhata को बेहतर बनाए…',
  send: 'भेजें',
  feedbackEmpty: 'पहले कुछ लिखें।',

  upgrade: 'अपग्रेड करें',
  upgradeBody: 'अनगिनत कामगार, पूरा रिकॉर्ड, ब्रांडेड पर्ची, याद दिलाना।',
  comingSoon: 'जल्द आ रहा है',
  comingSoonBody: 'भुगतान अभी चालू नहीं है। ऐप फ़िलहाल पूरी तरह मुफ़्त है।',
  clear: 'हटाएँ',

  roleMaid: 'बाई',
  roleCook: 'रसोइया',
  roleMilkman: 'दूधवाला',
  roleDriver: 'ड्राइवर',
  roleNanny: 'आया',
  roleGardener: 'माली',
  roleGuard: 'चौकीदार',
  roleSweeper: 'सफ़ाईवाला',
  roleLabour: 'मज़दूर',

  now: 'अभी',
  withUpgrade: 'अपग्रेड के बाद',
  onPremiumTitle: 'आप प्रीमियम पर हैं',
  onPremiumBody: 'असीमित कामगार, पूरा इतिहास, और हर प्रीमियम सुविधा अनलॉक है।',
  freeWorkers: (n: number) => `${n} कामगार`,
  freeHistory: (n: number) => `पिछले ${n} महीनों का ही रिकॉर्ड`,
  freeRestoreLine: 'अपना डेटा कभी भी वापस लाएं, हमेशा मुफ़्त',
  featUnlimited: 'जितने चाहें उतने कामगार जोड़ें',
  featHistory: 'पिछले महीनों का रिकॉर्ड',
  featUnlimitedExport: 'असीमित एक्सपोर्ट',
  featReminders: 'समय पर तनख्वाह देने की महीने की याद',
  featAppLock: 'ऐप को पिन से लॉक करें',

  balanceDue: 'बाकी रकम',
  allSettled: 'हिसाब बराबर',
  paidExtra: 'ज़्यादा दिया',
  recordPayment: 'भुगतान दर्ज करें',
  addEntry: 'एंट्री जोड़ें',
  addAdvance: 'एडवांस जोड़ें',
  history: 'हिस्ट्री',
  noEntries: 'अभी कुछ भी दर्ज नहीं है।',
  deleteEntry: 'यह एंट्री हटाएँ?',
  deleteEntryBody: 'यह वापस नहीं होगा।',

  backup: 'बैकअप',
  backupHint: 'सब कुछ एक फ़ाइल में सेव करें, या नए फ़ोन में वापस लाएँ।',
  exportBackup: 'एक्सपोर्ट',
  restore: 'वापस लाएँ',
  restoreWarnTitle: 'बैकअप वापस लाएँ?',
  restoreWarnBody:
    'इस फ़ोन पर मौजूद सब कुछ बैकअप फ़ाइल से बदल दिया जाएगा। यह वापस नहीं होगा।',
  restoreDoneTitle: 'वापस आ गया',
  restoreDoneBody: 'सब कुछ देखने के लिए ऐप बंद करके दोबारा खोलें।',
  restoreBadTitle: 'वापस नहीं ला सके',
  restoreBadBody: 'यह फ़ाइल GharKhata का बैकअप नहीं लगती।',

  guideTitle: 'GharKhata कैसे काम करता है',
  guideDone: 'समझ गया',
  guideHomeTitle: 'रोज़ हाज़िरी लगाएँ',
  guideHomeBody: 'होम स्क्रीन पर हर कामगार के लिए आज का हाज़िर, आधा दिन या गैरहाज़िर एक टैप में लगाएँ।',
  guideCalendarTitle: 'पुराना दिन ठीक करें',
  guideCalendarBody: 'कैलेंडर खोलें, किसी भी दिन पर दबाएँ और सही स्थिति चुनें — पुराना दिन बदलने से पहले पूछा जाता है।',
  guideSalaryTitle: 'तनख्वाह खुद बनती है',
  guideSalaryBody: 'हर कामगार के रेट से लगाए गए दिनों का हिसाब खुद जुड़ता है। जो दिन नहीं लगाया, उसका भुगतान तब तक नहीं गिना जाता।',
  guideBalanceTitle: 'एडवांस और बाकी रकम',
  guideBalanceBody: 'एडवांस दर्ज करने के लिए कामगार के कार्ड पर + दबाएँ। बाकी रकम अपने आप अगले महीने जुड़ती रहती है, जब तक भुगतान दर्ज न करें।',
  guideShareTitle: 'पर्ची भेजें',
  guideShareBody: 'सैलरी स्क्रीन से सीधे व्हाट्सएप मैसेज या पीडीएफ पर्ची भेजें।',
  guideBackupTitle: 'बैकअप ज़रूर लें',
  guideBackupBody: 'सारा डेटा सिर्फ़ इस फ़ोन में रहता है। फ़ोन बदलने या ऐप फिर से डालने से पहले Settings से बैकअप एक्सपोर्ट करें।',
  reminderTitle: 'बैकअप याद',
  reminderBody: 'हर 15 दिन में डेटा एक्सपोर्ट करने की सूचना।',
  reminderDeniedTitle: 'सूचना बंद है',
  reminderDeniedBody: 'यह याद पाने के लिए फ़ोन की सेटिंग में GharKhata की सूचना चालू करें।',
  dueReminderTitle: 'तनख्वाह याद',
  dueReminderBody: 'बकाया रकम देखने और समय पर भुगतान करने के लिए हर महीने एक याद।',
  fine: 'कटौती',
  amount: 'रकम',
  noteOptional: 'नोट (ज़रूरी नहीं)',
  method: 'तरीका',
  cash: 'नकद',
  upi: 'यूपीआई',
  bank: 'बैंक',

  nameRequiredBody: 'सेव करने से पहले नाम लिखें।',
  amountRequiredBody: 'शून्य से बड़ी रकम डालें।',
  payType: 'भुगतान का तरीका',
  upiIdLabel: 'यूपीआई आईडी',
  upiIdHint: 'name@bank — ज़रूरी नहीं',
  daysHiredHint: (role: string) => `${role} कितने दिन के लिए रखा है`,
  monthsHiredHint: 'कुल कितने महीने के लिए',

  helpName: 'कामगार का नाम — ऐप और पर्ची पर हर जगह दिखेगा।',
  helpWork: 'यह क्या काम करते हैं — एक नज़र में पहचानने में मदद करता है।',
  helpPhone: 'व्हाट्सएप पर सीधे पर्ची भेजने के लिए। 10 अंक, ज़रूरी नहीं।',
  helpUpi: 'भुगतान दर्ज करते समय "यूपीआई से भुगतान करें" के लिए इनका यूपीआई आईडी। ज़रूरी नहीं।',
  helpPayType: 'महीने की तय तनख्वाह, दिन की मज़दूरी, घंटे का रेट, या दूध जैसा प्रति यूनिट रेट।',
  helpUnit: 'यह जिस यूनिट में भुगतान पाते हैं — किलो, लीटर, नग वगैरह।',
  helpAmount: (type: SalaryType) =>
    type === 'monthly'
      ? 'हर महीने पूरा काम करने पर मिलने वाली पूरी रकम।'
      : type === 'per_unit'
        ? 'एक यूनिट का रेट — जैसे ₹40 प्रति लीटर।'
        : type === 'hourly'
          ? 'एक घंटे के काम का रेट।'
          : 'एक पूरे दिन के काम की रकम।',
  helpUsualQty: 'रोज़ जितना देते हैं। होम स्क्रीन पर पहले से भरा रहेगा, आम दिन एक टैप में लगेगा।',
  helpHiredOn: 'जिस दिन से शुरू किया। हाज़िरी और तनख्वाह इसी दिन से गिनी जाएगी।',
  helpHowLong: 'कोई तय तारीख नहीं तो लगातार चुनें, वरना समय सीमा तय करें।',
  weeklyOffLabel: 'साप्ताहिक छुट्टी',
  helpWeeklyOff: 'इनकी हफ़्ते में कौन सी छुट्टी तय है, अगर कोई है? उस दिन का भुगतान अपने आप गिना जाएगा, चाहे कैलेंडर में लगाएं या नहीं। अगर हर दिन काम करते हैं, या छुट्टी का दिन बदलता रहता है, तो खाली छोड़ दें।',

  notStarted: 'अभी शुरू नहीं हुआ',
  payingNow: 'अभी कितना दे रहे हैं',
  payViaUpi: 'यूपीआई से भुगतान करें',
  noUpiTitle: 'यूपीआई आईडी नहीं है',
  noUpiBody: 'यह शॉर्टकट इस्तेमाल करने के लिए Edit worker से यूपीआई आईडी जोड़ें।',
  noUpiAppBody: 'इस फ़ोन पर भुगतान के लिए कोई यूपीआई ऐप नहीं मिला।',

  ok: 'ठीक है',
  deleteWorkerTitle: (name: string) => `${name} को हटाएँ?`,
  deleteWorkerBody: 'इनकी हाज़िरी और भुगतान का रिकॉर्ड सुरक्षित रहेगा — बस रोज़ाना दिखना बंद हो जाएगा।',

  backupGuideTitle: 'बैकअप और रीस्टोर — पूरी जानकारी',
  backupGuideBody:
    'एक्सपोर्ट सब कुछ एक फ़ाइल में सेव करता है — हर कामगार, हर दिन की हाज़िरी, हर एडवांस और भुगतान — और फ़ोन की शेयर स्क्रीन खोल देता है ताकि आप उसे खुद को भेज सकें या सेव कर सकें (व्हाट्सएप, ईमेल, ड्राइव, "Save to device" — कहीं भी)।\n\nरीस्टोर उल्टा काम करता है: पहले एक्सपोर्ट की गई फ़ाइल चुनें और यह इस फ़ोन पर मौजूद सब कुछ उससे बदल देगा। सुरक्षा के लिए नियमित रूप से एक्सपोर्ट करें, और फ़ोन बदलने या ऐप फिर से डालने पर रीस्टोर करें।\n\nमुफ़्त प्लान: महीने में 2 एक्सपोर्ट। रीस्टोर हमेशा मुफ़्त और बिना सीमा के है — अपना ही डेटा वापस पाना कभी सीमित नहीं होगा।',
  backupLimitTitle: 'मुफ़्त सीमा पूरी',
  backupLimitBody: 'मुफ़्त प्लान में महीने में 2 एक्सपोर्ट मिलते हैं। बिना सीमा के लिए अपग्रेड करें — रीस्टोर हमेशा मुफ़्त है।',
  exportUsageHint: (used: number, limit: number) => `${limit} में से ${used} एक्सपोर्ट इस्तेमाल`,
  exportDoneTitle: 'बैकअप तैयार',
  exportDoneBody: (fileName: string) => `${fileName} नाम से सेव किया गया`,

  yourProfile: 'आपकी प्रोफ़ाइल',
  yourProfileHint: 'यह आपकी अपनी जानकारी है, किसी कामगार की नहीं। यह सिर्फ़ इस फ़ोन पर रहती है, और भरने पर सैलरी पर्ची में दिखती है।',
  emailLabel: 'ईमेल',
  emailHint: 'ज़रूरी नहीं',
  addPhoto: 'फ़ोटो जोड़ें',
  changePhoto: 'फ़ोटो बदलें',
  photoPermissionBody: 'फ़ोटो लगाने के लिए GharKhata को आपकी फ़ोटो तक पहुँच चाहिए।',
  photoErrorBody: 'यह फ़ोटो इस्तेमाल नहीं हो सकी। कोई और फ़ोटो आज़माएं।',

  accentColor: 'रंग चुनें',
  accentBlue: 'नीला',
  accentViolet: 'बैंगनी',
  accentRose: 'गुलाबी',
  accentGold: 'सुनहरा',

  weeklyOffBadge: 'साप्ताहिक छुट्टी (अपने आप भुगतान)',
  weeklyOffOverrideHint: 'इसका पूरा भुगतान पहले से तय है — कुछ लगाने की ज़रूरत नहीं। सिर्फ़ तभी "हाज़िर" लगाएं जब आज खास तौर पर काम किया हो — इससे अलग से पैसा नहीं जुड़ेगा, यह सिर्फ़ रिकॉर्ड के लिए है।',
  weeklyOffTapTitle: 'साप्ताहिक छुट्टी — भुगतान पहले से तय',
  weeklyOffTapBody: (name: string) => `यह ${name} की तय साप्ताहिक छुट्टी है। इसका भुगतान अपने आप जुड़ जाता है — कुछ लगाने की ज़रूरत नहीं।`,

  devPremiumOnTitle: 'प्रीमियम आज़माएं?',
  devPremiumOnBody: 'असली भुगतान शुरू होने से पहले, इस फ़ोन पर सभी प्रीमियम सुविधाएं जांचने के लिए चालू करता है। जब चाहें यहीं से बंद कर सकते हैं।',
  devPremiumOffTitle: 'मुफ़्त प्लान पर वापस जाएं?',
  devPremiumOffBody: 'प्रीमियम आज़माना बंद करेगा और मुफ़्त प्लान की सीमाएं वापस लौट आएंगी।',
  devPremiumOn: 'आज़माना चालू',
  devPremiumOff: 'आज़माना बंद',
};

const DICTS: Record<Lang, Dict> = { en, hi };

export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

const LANG_KEY = 'language';

interface I18nValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function readStoredLang(): Lang {
  return getSetting(LANG_KEY) === 'hi' ? 'hi' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setSetting(LANG_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, t: DICTS[lang], setLang }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
