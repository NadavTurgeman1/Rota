import type { Lang } from "../domain";
import { tx } from "../domain/text";
import type { ConstraintReason } from "../parser";
import { ru } from "./ru";

export interface Copy {
  demo: string;
  manager: string;
  previousWeek: string;
  nextWeek: string;
  pickWeek: string;
  thisWeek: string;
  previousMonth: string;
  nextMonth: string;
  hebrewCalendar: string;
  hebrewCalendarHint: string;
  previousYear: string;
  nextYear: string;
  monthLabel: string;
  yearLabel: string;
  generate: string;
  regenerate: string;
  slotLock: string;
  slotLockHint: string;
  slotLockEmpty: string;
  copySchedule: string;
  pasteSchedule: string;
  clearSchedule: string;
  editShiftLabel: (filled: number, required: number) => string;
  requiredOnShift: string;
  fewerRequired: string;
  moreRequired: string;
  startHourLabel: (name: string) => string;
  endHourLabel: (name: string) => string;
  resetShiftHours: string;
  shiftHoursHint: string;
  coverageTitle: string;
  callOffHint: string;
  closePanel: string;
  publish: string;
  publishAskTitle: string;
  publishAnyway: string;
  publishStay: string;
  revert: string;
  undo: string;
  redo: string;
  publishedLock: string;
  createBeforePublish: string;
  allClear: string;
  publishedClear: string;
  noSchedule: string;
  issues: string;
  violations: string;
  laborTitle: string;
  laborOpen: string;
  laborClose: string;
  laborWillAsk: string;
  laborAskLead: string;
  openShifts: string;
  underQuota: string;
  summaryTitle: string;
  summaryHint: string;
  summaryEmployee: string;
  summaryShifts: string;
  summaryHours: string;
  summaryStatus: string;
  withinQuota: string;
  noQuota: string;
  summaryTotal: string;
  approve: string;
  solutionAdd: string;
  solutionExtend: string;
  solutionChange: string;
  addEmployee: string;
  availableForShift: string;
  unavailableForShift: string;
  nobodyToAdd: string;
  remove: string;
  covered: string;
  cancelSelection: string;
  scrollHint: string;
  closed: string;
  overQuota: string;
  hebrew: string;
  english: string;
  russian: string;
  calendars: string;
  christianHolidays: string;
  muslimHolidays: string;
  calendarsHint: string;
  navSchedule: string;
  navTeam: string;
  navMine: string;
  navEmpty: string;
  authorityTitle: string;
  authorityHint: string;
  directManager: string;
  directManagerEmpty: string;
  transferManager: string;
  reportsBlock: string;
  capClock: string;
  capConstraints: string;
  capAbsences: string;
  capTrades: string;
  capScheduleView: string;
  capScheduleEdit: string;
  capSiteSettings: string;
  capPeopleSite: string;
  capPeopleEdit: string;
  capMessages: string;
  capInsights: string;
  capDocuments: string;
  createPerson: string;
  personWorker: string;
  personLead: string;
  personBoth: string;
  personWorkerHint: string;
  personLeadHint: string;
  personBothHint: string;
  siteManagers: string;
  staffGroup: string;
  managerNotScheduled: string;
  managedSites: string;
  personEmail: string;
  personSchedulable: string;
  personSchedulableHint: string;
  employeeName: string;
  contact: string;
  loginEmailHint: string;
  loginOpen: string;
  loginNone: string;
  saveChanges: string;
  cancelChanges: string;
  unsavedTitle: string;
  unsavedBody: string;
  unsavedSave: string;
  unsavedDiscard: string;
  unsavedStay: string;
  showPassword: string;
  hidePassword: string;
  phone: string;
  profilePersonal: string;
  profileContact: string;
  profileEmployment: string;
  profileFamily: string;
  profileBank: string;
  nationalId: string;
  birthDate: string;
  gender: string;
  genderFemale: string;
  genderMale: string;
  mobile: string;
  city: string;
  street: string;
  houseNumber: string;
  zip: string;
  startedOn: string;
  endedOn: string;
  department: string;
  employeeNumber: string;
  maritalStatus: string;
  maritalSingle: string;
  maritalMarried: string;
  maritalDivorced: string;
  maritalWidowed: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  employeeForms: string;
  employeeFormsHint: string;
  employeeFormsEmpty: string;
  employeeFormsUpload: string;
  employeeFormsUploading: string;
  employeeFormsView: string;
  employeeFormsDelete: string;
  employeeFormsClose: string;
  employeeFormsDownload: string;
  employeeFormsOpenHint: string;
  employeeFormsLoading: string;
  employeeFormsTooBig: string;
  employeeFormsType: string;
  employeeFormsFull: string;
  employeeFormsFailed: string;
  employeeSites: string;
  employeeSitesHint: string;
  primarySite: string;
  reliefSite: string;
  primarySiteTitle: string;
  primarySiteHint: string;
  reliefSitesTitle: string;
  reliefSitesHint: string;
  noReliefSites: string;
  reliefRoster: string;
  reliefConstraints: string;
  reliefHeld: string;
  role: string;
  primaryRole: string;
  secondaryRoles: string;
  secondaryRolesHint: string;
  noRole: string;
  qualifications: string;
  quota: string;
  hourCap: string;
  hourCapHint: string;
  hourCapNone: string;
  active: string;
  inactive: string;
  observesShabbat: string;
  observesShabbatHint: string;
  observesHolidays: string;
  observesHolidaysHint: string;
  observanceShabbat: string;
  observanceHoliday: string;
  holidayStaffing: string;
  agreement: string;
  preferenceTitle: string;
  preferenceHint: string;
  agreementForbids: string;
  unavailableWeek: string;
  availableWeek: string;
  siteClosed: string;
  copyPrevious: string;
  notSubmitted: string;
  submitted: string;
  availabilityLocked: string;
  agreementReadOnly: string;
  unlockAgreement: string;
  lockAgreement: string;
  addPerson: string;
  pickEmployee: string;
  scheduleReadOnly: string;
  callOff: string;
  calledOff: string;
  callOffReturn: string;
  replacements: string;
  noReplacement: string;
  rejectedTitle: string;
  emergency: string;
  publishedOpen: string;
  assignReplacement: string;
  pasteTitle: string;
  pasteHint: string;
  pastePlaceholder: string;
  approvePaste: string;
  lineRecognized: string;
  lineAmbiguous: string;
  lineUnparsed: string;
  draftTitle: string;
  beforeAfter: string;
  noCellChange: string;
  nothingToWrite: string;
  polarityOff: string;
  polarityOn: string;
  polarityOnly: string;
  allShifts: string;
  employeeMatched: string;
  askModel: string;
  modelWorking: string;
  modelOff: string;
  modelFailed: string;
  modelNothing: string;
  modelSuggestion: string;
  acceptSuggestion: string;
  rejectSuggestion: string;
  explain: string;
  versionsTitle: string;
  noVersions: string;
  versionPublish: string;
  versionCalloff: string;
  restoreVersion: string;
  diffAdded: string;
  diffRemoved: string;
  diffExtended: string;
  diffCalledOff: string;
  noDiff: string;
  firstVersion: string;
  showChanges: string;
  hideChanges: string;
  exportPng: string;
  exportExcel: string;
  exportCsv: string;
  exportCalendar: string;
  exportText: string;
  exportTextCopied: string;
  exportJson: string;
  backupSectionTitle: string;
  backupSectionHint: string;
  downloadBackupJson: string;
  restoreBackupJson: string;
  backupRestored: string;
  backupInvalid: string;
  exportPublishedOnly: string;
  exportOpen: string;
  exportClosed: string;
  exportLegend: string;
  navBusiness: string;
  navConstraints: string;
  submittedCount: string;
  submittedShort: string;
  notSubmittedShort: string;
  themeDark: string;
  themeLight: string;
  exportMenu: string;
  businessTitle: string;
  businessReadOnly: string;
  bizName: string;
  bizType: string;
  minRest: string;
  maxHours: string;
  maxShift: string;
  maxDayHours: string;
  shiftsTitle: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  requiredRole: string;
  anyRole: string;
  rolesTitle: string;
  rolesHint: string;
  addRole: string;
  roleName: string;
  deleteRole: string;
  staffingHint: string;
  blockLimitTitle: string;
  blockLimitHint: string;
  blockLimitCount: string;
  blockLimitStatus: (used: number, max: number) => string;
  blockLimitReached: string;
  blockSplitTitle: string;
  blockSplitGeneral: string;
  blockSplitWeekday: string;
  blockSplitShift: string;
  blockSplitGeneralHint: string;
  blockSplitWeekdayHint: string;
  blockSplitShiftHint: string;
  blockWeekdays: string;
  blockWeekend: string;
  blockLimitBucket: (label: string, used: number, max: number) => string;
  blockLimitHome: (name: string) => string;
  customBlocksTitle: string;
  customBlocksHint: string;
  customBlocksPerRole: string;
  customBlocksHome: (name: string) => string;
  markAll: string;
  clearEverything: string;
  addShift: string;
  deleteShift: string;
  newShift: string;
  signInTitle: string;
  signInHint: string;
  email: string;
  password: string;
  signIn: string;
  signOut: string;
  signInFailed: string;
  demoAccounts: string;
  createAccount: string;
  goToSignup: string;
  goToLogin: string;
  forgotPassword: string;
  forgotHint: string;
  forgotSend: string;
  forgotSent: string;
  forgotFailed: string;
  backToSignIn: string;
  backToLanding: string;
  rememberMe: string;
  rememberMeHint: string;
  newPasswordTitle: string;
  newPasswordHint: string;
  savePassword: string;
  newPasswordFailed: string;
  signupTitle: string;
  signupHint: string;
  passwordTooShort: string;
  signupFailed: string;
  signupRateLimit: string;
  privacyPolicy: string;
  termsOfService: string;
  refundPolicy: string;
  cookiePolicy: string;
  legalDocuments: string;
  signupTermsBefore: string;
  signupTermsBetween: string;
  signupTermsAfter: string;
  signupAdult: string;
  signupConsentNeeded: string;
  cookieNotice: string;
  cookieNoticeDismiss: string;
  deleteData: string;
  deleteLogin: string;
  deleteLoginHint: string;
  deleteBusiness: string;
  deleteBusinessHint: string;
  deleteTypeName: string;
  deleteSoleOwner: string;
  deleteUnavailable: string;
  deleteFailed: string;
  deleteWorking: string;
  deleteClose: string;
  profileOptional: string;
  bankOptional: string;
  businessDetails: string;
  fullName: string;
  accountNotApproved: string;
  approvalsTitle: string;
  adminTabApprove: string;
  adminTabEnter: string;
  enterCompany: string;
  supportBanner: string;
  leaveSupport: string;
  approvalsHint: string;
  ownerName: string;
  approveFounder: string;
  approvalOpen: string;
  approvalUsed: string;
  notApprovedTitle: string;
  inviteUser: string;
  inviteHint: string;
  inviteSaved: string;
  suspendCompany: string;
  activateCompany: string;
  tenantSuspended: string;
  accountPending: string;
  createOrgTitle: string;
  createOrgAction: string;
  createSiteTitle: string;
  createSiteAction: string;
  remoteDbMissing: string;
  appDisconnected: string;
  saveFailed: string;
  constraintHomeOnly: string;
  accessOwner: string;
  accessWrite: string;
  accessRead: string;
  readOnlyBanner: string;
  site: string;
  sitesTitle: string;
  siteSettings: string;
  siteName: string;
  orgName: string;
  orgReadOnly: string;
  addSite: string;
  deleteSite: string;
  newSiteName: string;
  siteNameTaken: string;
  usersTitle: string;
  usersHint: string;
  addUser: string;
  removeUser: string;
  you: string;
  deleteEmployee: string;
  noEmployees: string;
  settings: string;
  appearance: string;
  lightShort: string;
  darkShort: string;
  language: string;
  selectAll: string;
  clearAll: string;
  navDashboard: string;
  navInsights: string;
  navReports: string;
  navMessages: string;
  messagesHint: string;
  messagesCompose: string;
  messagesBody: string;
  messagesAudience: string;
  messagesAudienceAll: string;
  messagesAudiencePeople: string;
  messagesAudienceShift: string;
  messagesDeliver: string;
  messagesDeliverNow: string;
  messagesDeliverAt: string;
  messagesDeliverShift: string;
  messagesWhen: string;
  messagesPickPeople: string;
  messagesPickShift: string;
  messagesSend: string;
  messagesSending: string;
  messagesEmpty: string;
  messagesNone: string;
  messagesScheduled: string;
  messagesSent: string;
  messagesDelete: string;
  messagesFailed: string;
  messagesBodyNeeded: string;
  messagesNoRecipients: string;
  messagesReadOnly: string;
  messagesReadCount: (read: number, total: number) => string;
  messagesFrom: (name: string) => string;
  messagesInbox: string;
  messagesInboxEmpty: string;
  messagesPopupTitle: string;
  messagesPopupOk: string;
  messagesUnread: (count: number) => string;
  messagesCloseInbox: string;
  navAbsences: string;
  absencesHint: string;
  absencesStaffHint: string;
  absencesKind: string;
  absenceSick: string;
  absenceVacation: string;
  absencesFrom: string;
  absencesTo: string;
  absencesDays: string;
  absencesDaysHint: string;
  absencesNote: string;
  absencesFiles: string;
  absencesFilesHint: string;
  absencesUpload: string;
  absencesSend: string;
  absencesSending: string;
  absencesNone: string;
  absencesPending: string;
  absencesApproved: string;
  absencesRejected: string;
  absencesCancelled: string;
  absencesApprove: string;
  absencesReject: string;
  absencesCancel: string;
  absencesDelete: string;
  absencesFailed: string;
  absencesOverlap: string;
  absencesWhen: string;
  absencesPerson: string;
  absencesRecord: string;
  absencesLock: string;
  railLabel: string;
  staffRail: string;
  nameSearch: string;
  noNameMatches: string;
  inviteStaff: string;
  inviteStaffHint: string;
  invitePending: string;
  staffConstraints: string;
  staffSchedule: string;
  staffAttendance: string;
  staffAbsences: string;
  attendanceHint: string;
  attendanceIn: string;
  attendanceOut: string;
  attendanceHello: (name: string) => string;
  attendanceReportIn: string;
  attendanceReportOut: string;
  attendanceLast: (kind: string, when: string) => string;
  attendanceAlreadyIn: string;
  attendanceAlreadyOut: string;
  attendanceClockOk: string;
  attendanceClockBad: string;
  attendanceClockSkew: string;
  attendanceClockZone: string;
  attendanceAsking: string;
  attendanceAllow: string;
  attendanceRetry: string;
  attendanceLocating: string;
  attendanceLocatingMeters: (meters: string) => string;
  attendanceCoarse: (meters: string) => string;
  attendanceLocked: (meters: string) => string;
  attendanceDenied: string;
  attendanceForbidden: string;
  attendanceNoFix: string;
  attendanceWide: string;
  attendanceSaved: string;
  attendanceEmpty: string;
  attendanceDate: string;
  attendanceInAt: string;
  attendanceOutAt: string;
  attendanceDuration: string;
  attendancePlace: string;
  attendanceMap: string;
  attendanceOpen: string;
  attendanceSince: (time: string) => string;
  attendanceLog: string;
  attendanceLogHint: string;
  attendanceShowMore: string;
  attendanceShowLess: string;
  attendanceLoading: string;
  attendanceCorrectHint: string;
  attendanceAddTitle: string;
  attendanceAddSave: string;
  attendanceEditTime: string;
  attendanceSaveTime: string;
  attendanceTime: string;
  attendanceKind: string;
  attendanceOriginal: (time: string) => string;
  attendanceAdded: string;
  attendanceFuture: string;
  attendanceOld: string;
  attendanceSequence: string;
  attendanceDuplicate: string;
  attendanceBadTime: string;
  attendanceRemove: string;
  attendanceRemoveConfirm: string;
  attendanceNoSite: string;
  staffConstraintsHint: string;
  staffUnpublished: string;
  staffUnlinked: string;
  addToCalendar: string;
  calendarEmpty: string;
  addEmployeesTitle: string;
  noShiftManagers: string;
  noStaffLogins: string;
  loginAlreadyOpen: (email: string) => string;
  editAccess: string;
  deleteAccess: string;
  saveAccess: string;
  cancelEdit: string;
  loginPending: string;
  managerSitesRequired: string;
  staffAccess: string;
  staffAccessHint: string;
  constraintWindow: string;
  constraintWindowHint: string;
  constraintStart: string;
  constraintEnd: string;
  constraintStartTime: string;
  constraintEndTime: string;
  staffWindowClosed: string;
  staffAccessOff: string;
  staffSubmit: string;
  staffSave: string;
  staffAutoHint: string;
  staffPending: string;
  staffSameRequest: string;
  staffWeekOnly: string;
  exceptionGrant: string;
  exceptionGrantHint: string;
  exceptionGranted: string;
  extraWindow: string;
  extraWindowHint: string;
  extraWindowOpen: string;
  extraWindowClose: string;
  extraWindowHours: string;
  extraWindowMinutes: string;
  extraWindowRemaining: (time: string) => string;
  requestApproved: string;
  requestRejected: string;
  requestDecisionOk: string;
  tradeSwap: string;
  tradeGiveaway: string;
  tradePickMine: string;
  tradePickTarget: string;
  tradePickGiveaway: string;
  tradeChecking: string;
  tradeNoTargets: string;
  tradeNoSeats: string;
  tradeSend: string;
  tradeOffer: string;
  tradeBack: string;
  tradeClose: string;
  tradeApprove: string;
  tradeReject: string;
  tradeTake: string;
  tradeLater: string;
  tradeNotNow: string;
  tradeBothAgreed: string;
  tradeGiveawayAsk: string;
  tradeSwapAsk: string;
  tradeAnyone: string;
  tradeMine: string;
  tradeWithdraw: string;
  tradeManagerQueue: (count: number) => string;
  tradeStatus: Record<"open" | "accepted" | "approved" | "rejected" | "declined" | "cancelled", string>;
  tradeError: Record<"conflict" | "stale" | "duplicate" | "forbidden" | "failed", string>;
  versionTrade: string;
  staffRequestTitle: string;
  approveRequest: string;
  rejectRequest: string;
  hourlyWage: string;
}

export const copy: Record<Lang, Copy> = {
  he: {
    demo: "דמו מקומי",
    manager: "מנהל",
    previousWeek: "השבוע הקודם",
    nextWeek: "השבוע הבא",
    pickWeek: "בחירת שבוע מלוח השנה",
    thisWeek: "השבוע",
    previousMonth: "החודש הקודם",
    nextMonth: "החודש הבא",
    hebrewCalendar: "לוח שנה עברי",
    hebrewCalendarHint: "דלוק: התאריך העברי והחגים מופיעים בקטן ליד התאריך הלועזי, בסידור, באילוצים, בלוח השנה ובייצוא. כבוי: רק תאריכים לועזיים.",
    previousYear: "השנה הקודמת",
    nextYear: "השנה הבאה",
    monthLabel: "חודש",
    yearLabel: "שנה",
    generate: "יצירת סידור",
    regenerate: "יצירה מחדש",
    slotLock: "נעילת משמרת",
    slotLockHint: "האנשים במשמרת הזו נשארים. יצירה מחדש מערבבת את שאר המשמרות לפי האילוצים והחוקים.",
    slotLockEmpty: "אפשר לנעול משמרת אחרי שמשובץ בה מישהו.",
    copySchedule: "העתקת סידור",
    pasteSchedule: "הדבקת סידור",
    clearSchedule: "נקה סידור",
    editShiftLabel: (filled, required) => `עריכת משמרת, ${filled} מתוך ${required}`,
    requiredOnShift: "עובדים נדרשים",
    fewerRequired: "פחות עובדים",
    moreRequired: "יותר עובדים",
    startHourLabel: (name) => `שעת התחלה של ${name}`,
    endHourLabel: (name) => `שעת סיום של ${name}`,
    resetShiftHours: "לשעות המשמרת",
    shiftHoursHint: "כל עובד מתחיל בשעות המשמרת. שעות שממשיכות למשמרת הבאה נספרות שם. חוסר או עודף שנשאר מופיע בהערות, והפרסום מבקש אישור.",
    coverageTitle: "חוסר ועודף",
    callOffHint: "אפשר לסמן חיסור על עובד במשמרת הזו.",
    closePanel: "סגירה",
    publish: "פרסום",
    publishAskTitle: "לפרסם בכל זאת?",
    publishAnyway: "פרסום בכל זאת",
    publishStay: "להשאיר טיוטה",
    revert: "ערוך סידור",
    undo: "ביטול פעולה",
    redo: "שחזור פעולה",
    publishedLock: "השבוע פורסם. העריכה נעולה עד החזרה לטיוטה.",
    createBeforePublish: "צרו סידור לפני פרסום.",
    allClear: "אין הפרות ואין חורים. אפשר לפרסם.",
    publishedClear: "אין הפרות ואין חורים.",
    noSchedule: "אין עדיין שיבוץ. יצירת הסידור תמלא את המושבים לפי המנוע.",
    issues: "בעיות",
    violations: "הפרות",
    laborTitle: "הפרות חוקי עבודה ומנוחה",
    laborOpen: "לפתוח",
    laborClose: "לסגור",
    laborWillAsk: "יש הערות לחוק שעות עבודה ומנוחה. הפרסום ישאל לפני כן.",
    laborAskLead: "בסידור יש הערות לפי חוק שעות עבודה ומנוחה. השיבוץ נשאר מותר, והפרסום מחכה לאישור.",
    openShifts: "משמרות פתוחות",
    underQuota: "מתחת למכסה",
    summaryTitle: "סיכום שבועי",
    summaryHint: "כמה משמרות קיבל כל עובד ביחס למכסה שלו.",
    summaryEmployee: "עובד",
    summaryShifts: "משמרות / מכסה",
    summaryHours: "שעות",
    summaryStatus: "מצב",
    withinQuota: "במכסה",
    noQuota: "ללא מכסה",
    summaryTotal: "סה״כ",
    approve: "אישור",
    solutionAdd: "הוספת עובד זמין למשמרת",
    solutionExtend: "הארכת משמרות קיימות",
    solutionChange: "שינויים, מעברים והחלפות",
    addEmployee: "הוספת עובד",
    availableForShift: "זמינים",
    unavailableForShift: "לא זמינים",
    nobodyToAdd: "אין מי להוסיף",
    remove: "הסרה",
    covered: "מכוסה בהארכה",
    cancelSelection: "ביטול בחירה",
    scrollHint: "גלול לצדדים כדי לראות את כל השבוע.",
    closed: "סגור",
    overQuota: "מעל המכסה",
    hebrew: "עברית",
    english: "English",
    russian: "Русский",
    calendars: "לוחות שנה",
    christianHolidays: "חגים נוצרים",
    muslimHolidays: "חגים מוסלמים",
    calendarsHint: "אפשר להציג לוח שנה עברי, חגים נוצרים או חגים מוסלמים.",
    navSchedule: "יצירת סידור",
    navTeam: "ניהול עובדים",
    navMine: "כניסה ויציאה",
    navEmpty: "אין מסך פתוח לחשבון הזה.",
    authorityTitle: "ניהול והרשאות",
    authorityHint: "המנהל הישיר הוא מי שיצר את העובד. ניתן להעביר את הניהול הישיר למנהל אחר בחברה.",
    directManager: "מנהל ישיר",
    directManagerEmpty: "האדם הבכיר בחברה",
    transferManager: "העברת ניהול",
    reportsBlock: "יש עובדים תחתיו. מעבירים אותם למנהל אתר אחר לפני המחיקה.",
    capClock: "כניסה ויציאה לעבודה",
    capConstraints: "הגשת אילוצים שבועיים",
    capAbsences: "הגשת בקשת היעדרות",
    capTrades: "בקשת החלפת משמרת",
    capScheduleView: "צפייה בסידור העבודה",
    capScheduleEdit: "עריכת סידור העבודה",
    capSiteSettings: "עריכת הגדרות האתר",
    capPeopleSite: "צפייה ברשימת העובדים באתר",
    capPeopleEdit: "עריכת פרטי העובדים שבניהולו",
    capMessages: "שליחת הודעות",
    capInsights: "דשבורד ותובנות",
    capDocuments: "צפייה ועריכה בטפסי העובד",
    createPerson: "אדם חדש",
    personWorker: "עובד משובץ",
    personLead: "מנהל אתר",
    personBoth: "עובד ומנהל אתר",
    personWorkerHint: "מופיע בצוות האתר ואפשר לשבץ אותו למשמרות.",
    personLeadHint: "מנהל את האתר ואת האנשים, בלי שיבוץ למשמרות.",
    personBothHint: "מנהל את האתר, ואפשר גם לשבץ אותו למשמרות.",
    siteManagers: "מנהלי אתר",
    staffGroup: "עובדים",
    managerNotScheduled: "מנהל אתר בלי שיבוץ. הוא לא מופיע בסידור ולא ברשימת העובדים של האתר.",
    managedSites: "אתרים בניהול",
    personEmail: "אימייל לכניסה",
    personSchedulable: "ניתן לשיבוץ",
    personSchedulableHint: "מנהל אתר שאפשר גם לשבץ למשמרות. כיבוי מחזיר אותו לניהול בלבד.",
    employeeName: "שם",
    contact: "אימייל",
    loginEmailHint: "הזנת אימייל מאפשרת לעובד לפתוח משתמש ב־Rota. הגישה שלו למסכים השונים תיקבע עפ״י ההרשאות שלו.",
    loginOpen: "הכניסה פתוחה.",
    loginNone: "בלי אימייל אין כניסה. מנהל מזין את האילוצים.",
    saveChanges: "שמירת שינויים",
    cancelChanges: "ביטול",
    unsavedTitle: "לשמור את השינויים?",
    unsavedBody: "יש שינויים שלא נשמרו.",
    unsavedSave: "שמור שינויים",
    unsavedDiscard: "ביטול שינויים",
    unsavedStay: "להישאר",
    showPassword: "הצגת סיסמה",
    hidePassword: "הסתרת סיסמה",
    phone: "טלפון",
    profilePersonal: "פרטים אישיים",
    profileContact: "פרטי קשר וכתובת",
    profileEmployment: "תעסוקה",
    profileFamily: "מצב משפחתי",
    profileBank: "פרטי בנק",
    nationalId: "ת.ז.",
    birthDate: "תאריך לידה",
    gender: "מין",
    genderFemale: "נקבה",
    genderMale: "זכר",
    mobile: "טלפון נייד",
    city: "עיר",
    street: "רחוב",
    houseNumber: "מספר בית",
    zip: "מיקוד",
    startedOn: "תאריך תחילה",
    endedOn: "תאריך סיום",
    department: "מחלקה",
    employeeNumber: "מספר עובד",
    maritalStatus: "מצב משפחתי",
    maritalSingle: "רווק/ה",
    maritalMarried: "נשוי/אה",
    maritalDivorced: "גרוש/ה",
    maritalWidowed: "אלמן/ה",
    bankName: "בנק",
    bankBranch: "סניף",
    bankAccount: "מספר חשבון",
    employeeForms: "טפסי עובד",
    employeeFormsHint: "חוזים, אישורים ומסמכים של העובד.",
    employeeFormsEmpty: "אין טפסים.",
    employeeFormsUpload: "העלאת טופס",
    employeeFormsUploading: "מעלה…",
    employeeFormsView: "צפייה",
    employeeFormsDelete: "מחיקה",
    employeeFormsClose: "סגירה",
    employeeFormsDownload: "הורדה",
    employeeFormsOpenHint: "הקובץ זמין להורדה.",
    employeeFormsLoading: "טוען את הטפסים…",
    employeeFormsTooBig: "הקובץ גדול מ-8 מגה.",
    employeeFormsType: "אפשר להעלות PDF, תמונה, וורד, אקסל או טקסט.",
    employeeFormsFull: "אפשר לשמור עד 30 טפסים לעובד.",
    employeeFormsFailed: "הפעולה נכשלה. נסו שוב.",
    employeeSites: "אתרים",
    employeeSitesHint: "האילוצים וההסכם זהים בכל האתרים.",
    primarySite: "ראשי",
    reliefSite: "תגבור",
    primarySiteTitle: "אתר ראשי",
    primarySiteHint: "כאן העובד משובץ אוטומטית, וכאן נספרות המכסה וכל המשמרות שלו.",
    reliefSitesTitle: "אתרי תגבור (לא חובה)",
    reliefSitesHint: "באתרי תגבור העובד לא משובץ אוטומטית. אפשר לשבץ אותו ידנית רק אחרי שהסידור באתר הראשי מוכן לפרסום.",
    noReliefSites: "אין אתרים נוספים בעסק.",
    reliefRoster: "מתגברים",
    reliefConstraints: "האילוצים נקבעים באתר הראשי. כאן אפשר רק לראות אותם.",
    reliefHeld: "{name} יכול להשלים את המשמרת רק כשהסידור באתר הראשי מוכן לפרסום, בלי הפרות ובלי משמרות פתוחות.",
    role: "תפקיד",
    primaryRole: "תפקיד ראשי",
    secondaryRoles: "תפקידים משניים",
    secondaryRolesHint: "השיבוץ האוטומטי משתמש רק בתפקיד הראשי. תפקיד משני אפשר לשבץ ידנית, או כפתרון לחור במשמרת שדורשת אותו.",
    noRole: "ללא תפקיד",
    qualifications: "הסמכות",
    quota: "משמרות בשבוע",
    hourCap: "תקרת שעות",
    hourCapHint: "ללא: תקרת האתר",
    hourCapNone: "ללא",
    active: "פעיל",
    inactive: "לא פעיל",
    observesShabbat: "עובד שומר שבת",
    observesShabbatHint: "אין שיבוץ במשמרת שנוגעת בחלון מיום שישי ב-15:00 עד מוצאי שבת ב-21:00. החסימה נשמרת בהסכם לפי שעות המשמרת, ואי אפשר להחזיר אותה בלחיצה.",
    observesHolidays: "עובד שומר חגי ישראל",
    observesHolidaysHint: "נדלק יחד עם שבת, ואפשר לכבות רק אותו. בשבוע שיש בו חג החסימה מופיעה באילוצים, מ-15:00 בערב החג עד 21:00 במוצאי החג, ואי אפשר להוריד אותה בלחיצה. זה חל על שני ימי ראש השנה, יום כיפור, סוכות, שמיני עצרת, פסח ושבועות.",
    observanceShabbat: "שבת",
    observanceHoliday: "חג",
    holidayStaffing: "ביום חג התקן הוא תקן השבת.",
    agreement: "הסכם",
    preferenceTitle: "העדפות משמרת",
    preferenceHint: "השיבוץ מעדיף את המשמרות המסומנות כשאפשר. משמרת לא מסומנת עדיין מותרת לפי ההסכם.",
    agreementForbids: "ההסכם אוסר",
    unavailableWeek: "לא זמין השבוע",
    availableWeek: "זמין השבוע",
    siteClosed: "האתר סגור",
    copyPrevious: "העתקה מהשבוע הקודם",
    notSubmitted: "לא הוגשה זמינות. המנוע מתייחס לזמינות לפי ההסכם.",
    submitted: "הזמינות הוגשה לשבוע הזה.",
    availabilityLocked: "ניתן לשנות זמינות רק על משמרות שאינן חסומות ע״י ההסכם.",
    agreementReadOnly: "ההסכם לקריאה בלבד.",
    unlockAgreement: "ביטול נעילת ההסכם",
    lockAgreement: "נעילת ההסכם",
    addPerson: "הוספת עובד",
    pickEmployee: "בחרו עובד מהרשימה.",
    scheduleReadOnly: "הסידור לקריאה בלבד.",
    callOff: "חיסור",
    calledOff: "חיסור",
    callOffReturn: "החזרה לסידור",
    replacements: "מחליפים מתאימים",
    noReplacement: "אין מחליף שעבר את כל הכללים. המושב נשאר פתוח.",
    rejectedTitle: "נפסלו",
    emergency: "חלופות חירום",
    publishedOpen: "השבוע נשאר פורסם. יש מושב פתוח אחרי חיסור.",
    assignReplacement: "שיבוץ",
    pasteTitle: "אילוצים בכתב",
    pasteHint: "ניתן להזין אילוצים שהתקבלו מהעובד בפורמט מסודר. האילוצים יתעדכנו בהתאם.",
    pastePlaceholder: "לדוגמה:\nשם עובד\nראשון - לא עובד בוקר\nשלישי - לא עובד לילה\nמיום רביעי עד יום שישי - לא זמין",
    approvePaste: "אישור הזמינות",
    lineRecognized: "זוהתה",
    lineAmbiguous: "לא חד-משמעית",
    lineUnparsed: "לא הובנה",
    draftTitle: "טיוטה",
    beforeAfter: "לפני ואחרי",
    noCellChange: "אין שינוי בתאים. ההסכם כבר קובע את הזמינות הזו.",
    nothingToWrite: "אין שורה שזוהתה לכתיבה.",
    polarityOff: "לא זמין",
    polarityOn: "זמין",
    polarityOnly: "רק",
    allShifts: "כל המשמרות",
    employeeMatched: "עובד",
    askModel: "הצעה מהמודל לשורות הפתוחות",
    modelWorking: "המודל קורא את השורות…",
    modelOff: "הצעות מודל כבויות בסביבה הזו. המפרש והאישור ממשיכים לעבוד.",
    modelFailed: "המודל לא ענה. השורות נשארות לתיקון ידני.",
    modelNothing: "המודל לא הציע קריאה בטוחה. השורות נשארות לתיקון ידני.",
    modelSuggestion: "הצעת מודל",
    acceptSuggestion: "קבלה",
    rejectSuggestion: "דחייה",
    explain: "הסבר",
    versionsTitle: "גרסאות",
    noVersions: "עדיין אין גרסאות. פרסום יוצר את הראשונה.",
    versionPublish: "פרסום",
    versionCalloff: "כיסוי חיסור",
    restoreVersion: "שחזור כטיוטה",
    diffAdded: "נוסף",
    diffRemoved: "הוסר",
    diffExtended: "שעות שונו",
    diffCalledOff: "חיסור",
    noDiff: "אין שינוי בשיבוץ.",
    firstVersion: "הגרסה הראשונה של השבוע.",
    showChanges: "הצגת השינויים",
    hideChanges: "הסתרת השינויים",
    exportPng: "ייצוא PNG",
    exportExcel: "Excel",
    exportCsv: "ייצוא CSV",
    exportCalendar: "ייצוא ללוח שנה (ICS)",
    exportText: "העתקה לוואטסאפ",
    exportTextCopied: "הועתק ללוח",
    exportJson: "גיבוי JSON",
    backupSectionTitle: "גיבוי ושחזור אתר (JSON — מנהל מערכת)",
    backupSectionHint:
      "קובץ ה-JSON שומר עותק מלא של האתר הפעיל: הגדרות האתר, משמרות ותקן, רשימת העובדים וההסכמים שלהם, אילוצים שבועיים וכל סידורי העבודה והגרסאות. העלאת קובץ גיבוי תשחזר את כל הנתונים האלה לאתר הפעיל ותשמור אותם לענן.",
    downloadBackupJson: "הורדת גיבוי JSON",
    restoreBackupJson: "שחזור מקובץ JSON",
    backupRestored: "הגיבוי שוחזר לאתר הפעיל ונשמר.",
    backupInvalid: "קובץ הגיבוי לא תקין או שלא נוצר ב-Rota.",
    exportPublishedOnly: "זמין אחרי פרסום הסידור.",
    exportOpen: "חסר",
    exportClosed: "סגור",
    exportLegend: "אדום: הארכה או מושב חסר",
    navBusiness: "הגדרות עסק",
    navConstraints: "אילוצים שבועיים",
    submittedCount: "הגישו זמינות לשבוע",
    submittedShort: "הוגש",
    notSubmittedShort: "לא הוגש, לפי ההסכם",
    themeDark: "מצב כהה",
    themeLight: "מצב בהיר",
    exportMenu: "ייצוא הסידור",
    businessTitle: "פרטי העסק",
    businessReadOnly: "רק משתמש עם הרשאת כתיבה יכול לשנות את הגדרות האתר.",
    bizName: "שם",
    bizType: "סוג",
    minRest: "מנוחה מינימלית בין משמרות (שעות)",
    maxHours: "תקרת שעות שבועית",
    maxShift: "אורך משמרת מקסימלי בכיסוי חור (שעות)",
    maxDayHours: "תקרת שעות ביום (0 = בלי תקרה)",
    shiftsTitle: "משמרות ותקן",
    shiftName: "משמרת",
    shiftStart: "התחלה",
    shiftEnd: "סיום",
    requiredRole: "תפקיד נדרש",
    anyRole: "כל תפקיד",
    rolesTitle: "תפקידים",
    rolesHint: "התפקידים שמהם בוחרים לעובדים ולמשמרות.",
    addRole: "הוספת תפקיד",
    roleName: "שם התפקיד",
    deleteRole: "מחיקה",
    staffingHint: "המספרים הם עובדים נדרשים בכל יום (0 = סגור). משמרת שמסתיימת לפני שעת ההתחלה שלה חוצה חצות. ביום חג התקן של שבת חל על יום החג.",
    blockLimitTitle: "הגבלת כמות חסימות באילוצים השבועיים",
    blockLimitHint: "כבוי: בלי הגבלה. דלוק: בוחרים איך לחלק את החסימות, ומספר לכל חלק.",
    blockLimitCount: "כמה חסימות מותר",
    blockLimitStatus: (used, max) => `חסימות השבוע: ${used} מתוך ${max}.`,
    blockLimitReached: "אי אפשר לחסום עוד משמרת.",
    blockSplitTitle: "איך מחלקים את החסימות",
    blockSplitGeneral: "כללי",
    blockSplitWeekday: "ימי שבוע וסופ״ש",
    blockSplitShift: "לפי משמרות",
    blockSplitGeneralHint: "מספר אחד לכל השבוע.",
    blockSplitWeekdayHint: "ראשון עד חמישי בנפרד, ושישי ושבת בנפרד.",
    blockSplitShiftHint: "מספר נפרד לכל משמרת, לאורך כל השבוע.",
    blockWeekdays: "ראשון–חמישי",
    blockWeekend: "שישי–שבת",
    blockLimitBucket: (label, used, max) => `${label}: ${used} מתוך ${max}.`,
    blockLimitHome: (name) => `החלוקה לפי האתר הראשי, ${name}.`,
    customBlocksTitle: "אילוצים מותאמים אישית",
    customBlocksHint: "כבוי: המספרים של האתר הראשי. דלוק: מספרים משלו, באותה חלוקה.",
    customBlocksPerRole: "כשיש כמה תפקידים, כל תפקיד מקבל את המכסה הזו בנפרד. משמרות באותן שעות מקבלות את אותה מכסה.",
    customBlocksHome: (name) => `החלוקה נקבעת באתר הראשי, ${name}.`,
    markAll: "סמן הכל",
    clearEverything: "נקה הכל",
    addShift: "הוספת משמרת",
    deleteShift: "מחיקה",
    newShift: "משמרת חדשה",
    signInTitle: "היי!",
    signInHint: "נפגשנו כבר?",
    email: "אימייל",
    password: "סיסמה",
    signIn: "כניסה",
    signOut: "יציאה",
    signInFailed: "האימייל או הסיסמה לא נכונים.",
    demoAccounts: "חשבון הדמו",
    createAccount: "יצירת חשבון",
    goToSignup: "אין חשבון?",
    goToLogin: "יש חשבון?",
    forgotPassword: "שכחתי סיסמה",
    forgotHint: "בחרו סיסמה חדשה לאימייל הזה. לא נשלח מייל.",
    forgotSend: "שמירת סיסמה",
    forgotSent: "הסיסמה עודכנה. אפשר להיכנס.",
    forgotFailed: "לא הצלחנו לעדכן את הסיסמה. בדקו את האימייל ונסו שוב.",
    backToSignIn: "חזרה לכניסה",
    backToLanding: "חזרה לעמוד הראשי",
    rememberMe: "תזכור אותי",
    rememberMeHint: "נשארים מחוברים במכשיר הזה, בלי להקליד סיסמה בכל כניסה.",
    newPasswordTitle: "סיסמה חדשה",
    newPasswordHint: "בחרו סיסמה של 6 תווים לפחות.",
    savePassword: "שמירת סיסמה",
    newPasswordFailed: "לא הצלחנו לעדכן את הסיסמה. נסו שוב.",
    signupTitle: "יצירת חשבון",
    signupHint: "בוחרים כאן סיסמה של 6 תווים לפחות.",
    passwordTooShort: "הסיסמה צריכה 6 תווים לפחות.",
    signupFailed: "יצירת החשבון נכשלה. נסו שוב.",
    signupRateLimit: "נשלחו יותר מדי אימיילי אישור, והחשבון לא נוצר. ממתינים כשעה ולוחצים שוב על יצירת חשבון עם אותו מייל ואותה סיסמה.",
    privacyPolicy: "מדיניות פרטיות",
    termsOfService: "תנאי שימוש",
    refundPolicy: "מדיניות החזרים",
    cookiePolicy: "מדיניות עוגיות",
    legalDocuments: "מסמכים",
    signupTermsBefore: "קראתי את ",
    signupTermsBetween: " ואת ",
    signupTermsAfter: ", ואני מסכים/ה להם.",
    signupAdult: "אני בגיל 18 או יותר. החשבון מיועד למי שפותח עסק, לא לילדים.",
    signupConsentNeeded: "אפשר ליצור חשבון רק אחרי שתי ההסכמות.",
    cookieNotice: "במכשיר הזה נשמרים החיבור, ערכת הנושא ולוחות השנה. אין עוגיות פרסום ואין מדידת תנועה.",
    cookieNoticeDismiss: "הבנתי",
    deleteData: "מחיקת נתונים",
    deleteLogin: "מחיקת הכניסה שלי",
    deleteLoginHint: "החשבון נמחק. שם, שיבוצים ומסמכים שהעסק שמר נשארים אצלו, עד שמנהל מוחק את העובד.",
    deleteBusiness: "מחיקת העסק",
    deleteBusinessHint: "נמחקים האתרים, הסידורים, העובדים, המסמכים וההחתמות של העסק הזה. חשבונות של אנשים אחרים לא נמחקים. אם זו הכניסה היחידה שלך, גם היא נמחקת.",
    deleteTypeName: "כדי לאשר, כותבים כאן את שם העסק בדיוק.",
    deleteSoleOwner: "זה החשבון היחיד של העסק. מחיקת הכניסה לבד תשאיר עסק בלי בעלים, ולכן היא נעצרת. מוחקים את העסק.",
    deleteUnavailable: "אי אפשר למחוק נתונים מתוך כניסת מנהל המערכת לעסק של מישהו אחר.",
    deleteFailed: "המחיקה לא הושלמה. נסו שוב.",
    deleteWorking: "מוחקים…",
    deleteClose: "סגירה",
    profileOptional: "רשות. השיבוץ לא משתמש בפרטים האלה. משאירים ריק כל מה שהעסק לא צריך.",
    bankOptional: "רשות. Rota לא מעבירה כסף ולא גובה עמלה.",
    businessDetails: "פרטי העסק",
    fullName: "שם מלא",
    accountNotApproved: "המייל הזה לא מאושר. בעל עסק צריך אישור ממנהל המערכת. עובד יכול ליצור חשבון אחרי שהמייל נשמר בכרטיס שלו.",
    approvalsTitle: "אישור מייל",
    adminTabApprove: "הוספת הרשאה",
    adminTabEnter: "כניסה לעסקים",
    enterCompany: "כניסה",
    supportBanner: "נכנסת לעסק הזה כמנהל המערכת, עם הממשק של מנהל העסק.",
    leaveSupport: "חזרה לניהול",
    approvalsHint: "מאשרים כאן את המייל ואת שם הבעלים. אחר כך הוא יוצר חשבון עם סיסמה, ופותח את העסק.",
    ownerName: "שם הבעלים",
    approveFounder: "אישור",
    approvalOpen: "ממתין להרשמה",
    approvalUsed: "העסק נפתח",
    notApprovedTitle: "אין אישור למייל הזה. מנהל המערכת פותח את העסק ומאשר את המייל.",
    inviteUser: "הוספת מנהל משמרות",
    inviteHint: "מנהל המשמרות נכנס לאתרים שמסומנים. אפשר לסמן כמה אתרים.",
    inviteSaved: "האתרים נשמרו. בלי חשבון הוא נרשם עם המייל ובוחר סיסמה. עם חשבון קיים האתרים נפתחים בכניסה הבאה.",
    suspendCompany: "השעיה",
    activateCompany: "הפעלה",
    tenantSuspended: "העסק מושעה. פונים למנהל המערכת.",
    accountPending: "החשבון נוצר. נשלח אימייל אישור אל הכתובת שהזנת. פותחים אותו, ואז נכנסים.",
    createOrgTitle: "העסק הראשון",
    createOrgAction: "צור עסק",
    createSiteTitle: "האתר הראשון",
    createSiteAction: "צור אתר",
    remoteDbMissing: "חסרה כתובת מסד הנתונים בשרת. מוסיפים SUPABASE_DB_URL לקובץ הסביבה המקומי.",
    appDisconnected: "Rota לא מחובר לענן. צריך קובץ בשם .env.local ליד הפרויקט, ואז להפעיל מחדש את השרת. בלי החיבור הזה האפליקציה לא נפתחת.",
    saveFailed: "השמירה לענן נכשלה.",
    constraintHomeOnly: "האילוצים נשמרים באתר הראשי.",
    accessOwner: "מנהל עסק",
    accessWrite: "מנהל משמרות",
    accessRead: "עובד",
    readOnlyBanner: "יש לך הרשאת קריאה: אפשר לראות הכול, ושינויים נעולים.",
    site: "אתר",
    sitesTitle: "אתרים",
    siteSettings: "הגדרות האתר",
    siteName: "שם האתר",
    orgName: "שם העסק",
    orgReadOnly: "רק מנהל העסק יכול לשנות את שם העסק ואת הסוג.",
    addSite: "הוספת אתר",
    deleteSite: "מחיקת האתר",
    newSiteName: "שם האתר החדש",
    siteNameTaken: "כבר יש אתר בשם הזה.",
    usersTitle: "הוספת מנהלי משמרת",
    usersHint: "עובד נכנס ויוצא, מגיש אילוצים ורואה סידור אחרי פרסום. מנהל משמרות עורך את האתרים שלו. רק בעל העסק מנהל משתמשים.",
    addUser: "הוספת משתמש",
    removeUser: "הסרה",
    you: "(את/ה)",
    deleteEmployee: "מחיקת העובד",
    noEmployees: "אין עדיין עובדים באתר הזה.",
    settings: "הגדרות",
    appearance: "מצב תצוגה",
    lightShort: "בהיר",
    darkShort: "כהה",
    language: "שפה",
    selectAll: "בחר הכל",
    clearAll: "נקה",
    navDashboard: "דשבורד",
    navInsights: "תובנות",
    navReports: "הפקת דוחות",
    navMessages: "הודעות",
    messagesHint: "הודעה לעובדים באתר הזה. בוחרים למי, ומתי היא תופיע אצלם.",
    messagesCompose: "הודעה חדשה",
    messagesBody: "תוכן ההודעה",
    messagesAudience: "למי שולחים",
    messagesAudienceAll: "לכל העובדים באתר",
    messagesAudiencePeople: "בחירת עובדים",
    messagesAudienceShift: "לעובדים במשמרת",
    messagesDeliver: "מתי שולחים",
    messagesDeliverNow: "מיד",
    messagesDeliverAt: "בתאריך ושעה",
    messagesDeliverShift: "בתחילת משמרת",
    messagesWhen: "תאריך ושעה",
    messagesPickPeople: "בחירת עובדים",
    messagesPickShift: "בחירת משמרת",
    messagesSend: "שליחה",
    messagesSending: "שולח…",
    messagesEmpty: "כתבו הודעה, בחרו למי, ואז שלחו.",
    messagesNone: "עדיין אין הודעות באתר הזה.",
    messagesScheduled: "מתוזמן",
    messagesSent: "נשלח",
    messagesDelete: "מחיקה",
    messagesFailed: "השליחה נכשלה. נסו שוב.",
    messagesBodyNeeded: "חסר טקסט להודעה.",
    messagesNoRecipients: "אין נמענים לבחירה הזו.",
    messagesReadOnly: "רק מנהל משמרות יכול לשלוח הודעה.",
    messagesReadCount: (read, total) => `${read} מתוך ${total} קראו`,
    messagesFrom: (name) => (name ? `מאת ${name}` : "מהמנהל"),
    messagesInbox: "הודעות מהמנהל",
    messagesInboxEmpty: "אין הודעות.",
    messagesPopupTitle: "הודעה מהמנהל",
    messagesPopupOk: "הבנתי",
    messagesUnread: (count) => (count === 1 ? "הודעה אחת שלא נקראה" : `${count} הודעות שלא נקראו`),
    messagesCloseInbox: "סגירה",
    navAbsences: "היעדרויות",
    absencesHint: "דיווחי מחלה וחופשה מהעובדים. אחרי אישור הימים נחסמים בסידור ולא נספרים באילוצים השבועיים.",
    absencesStaffHint: "מדווחים כאן מחלה או חופשה, עם תאריכים. למחלה מצרפים אישור. אחרי אישור המנהל הימים נחסמים אוטומטית, ואישור המחלה נשמר בטפסי העובד. אפשר עדיין להגיש אילוצים לימים הפנויים.",
    absencesKind: "סוג",
    absenceSick: "מחלה",
    absenceVacation: "חופשה",
    absencesFrom: "מתאריך",
    absencesTo: "עד תאריך",
    absencesDays: "ימים",
    absencesDaysHint: "לוחצים על יום אחד. לטווח לוחצים על יום נוסף. לחיצה חוזרת על אותו יום מבטלת.",
    absencesNote: "הערה",
    absencesFiles: "אישור מחלה",
    absencesFilesHint: "מצרפים כאן את אישור המחלה. אחרי אישור המנהל הקובץ נשמר גם בטפסי העובד.",
    absencesUpload: "העלאת אישור",
    absencesSend: "שליחת דיווח",
    absencesSending: "שולח…",
    absencesNone: "אין דיווחים.",
    absencesPending: "ממתין לאישור",
    absencesApproved: "אושר",
    absencesRejected: "נדחה",
    absencesCancelled: "בוטל",
    absencesApprove: "אישור",
    absencesReject: "דחייה",
    absencesCancel: "ביטול",
    absencesDelete: "מחיקה",
    absencesFailed: "הפעולה נכשלה. נסו שוב.",
    absencesOverlap: "כבר יש דיווח פתוח או מאושר שחופף לתאריכים האלה.",
    absencesWhen: "בחרו טווח תאריכים תקין.",
    absencesPerson: "עובד",
    absencesRecord: "רישום היעדרות",
    absencesLock: "היעדרות מאושרת",
    railLabel: "ניהול",
    staffRail: "שלי",
    nameSearch: "חיפוש שם",
    noNameMatches: "אין שמות תואמים",
    inviteStaff: "פתיחת כניסה",
    inviteStaffHint: "העובד נכנס לכניסה ויציאה, להגשת האילוצים שלו ולסידור אחרי שהוא מתפרסם.",
    invitePending: "ממתין לכניסה",
    staffConstraints: "האילוצים שלי",
    staffSchedule: "הסידור",
    staffAttendance: "כניסה ויציאה",
    staffAbsences: "היעדרויות",
    attendanceHint: "השעה נלקחת משעון הטלפון ונבדקת מול השרת ואזור הזמן של האתר. הגישה למיקום מתבקשת עם פתיחת המסך, והכניסה נפתחת רק אחרי שהמיקום נעול.",
    attendanceIn: "כניסה",
    attendanceOut: "יציאה",
    attendanceHello: (name) => `שלום, ${name}`,
    attendanceReportIn: "דיווח כניסה",
    attendanceReportOut: "דיווח יציאה",
    attendanceLast: (kind, when) => `דיווח אחרון: ${kind} ${when}`,
    attendanceAlreadyIn: "כבר יש כניסה פתוחה.",
    attendanceAlreadyOut: "אין כניסה פתוחה ליציאה.",
    attendanceClockOk: "השעון מעודכן",
    attendanceClockBad: "השעון לא תקין",
    attendanceClockSkew: "שעון הטלפון לא מעודכן. מפעילים שעון אוטומטי ומרעננים.",
    attendanceClockZone: "אזור הזמן בטלפון לא תואם לאתר. צריך לכוון את השעון לאזור הזמן של האתר.",
    attendanceAsking: "מבקש גישה למיקום…",
    attendanceAllow: "אשר מיקום",
    attendanceRetry: "נסה שוב",
    attendanceLocating: "מאתר מיקום…",
    attendanceLocatingMeters: (meters) => `מאתר מיקום… ${meters} מ׳`,
    attendanceCoarse: (meters) => `הרדיוס עכשיו ${meters} מ׳. הכניסה תיפתח כשהמיקום יינעל.`,
    attendanceLocked: (meters) => `המיקום נעול, ${meters} מ׳`,
    attendanceDenied: "כדי להירשם צריך לאשר גישה למיקום בעת השימוש.",
    attendanceForbidden: "אין הרשאת כניסה ויציאה באתר הזה.",
    attendanceNoFix: "לא התקבל מיקום. יוצאים החוצה ומחכים שה-GPS יינעל.",
    attendanceWide: "המיקום רחב מדי. צריך עד 100 מטר. יוצאים החוצה ומפעילים מיקום מדויק.",
    attendanceSaved: "נשמר",
    attendanceEmpty: "אין עדיין כניסות ויציאות.",
    attendanceDate: "תאריך",
    attendanceInAt: "כניסה",
    attendanceOutAt: "יציאה",
    attendanceDuration: "משך",
    attendancePlace: "מיקום",
    attendanceMap: "מפה",
    attendanceOpen: "פתוח",
    attendanceSince: (time) => `נכנסת ב-${time}`,
    attendanceLog: "כניסות ויציאות",
    attendanceLogHint: "השעה היא שעת השרת. המיקום והרדיוס הם מה שהטלפון מדד.",
    attendanceShowMore: "הצג עוד",
    attendanceShowLess: "הצג פחות",
    attendanceLoading: "טוען…",
    attendanceCorrectHint: "אפשר להוסיף כניסה או יציאה ששכחו, ולתקן את השעה עד 90 יום אחורה. השעה המקורית נשמרת. מחיקה מוחקת את כל הדיווח, כניסה ויציאה יחד.",
    attendanceAddTitle: "הוספת כניסה או יציאה",
    attendanceAddSave: "הוספה",
    attendanceEditTime: "עריכת שעה",
    attendanceSaveTime: "שמירת השעה",
    attendanceTime: "שעה",
    attendanceKind: "סוג",
    attendanceOriginal: (time) => `שעה מקורית: ${time}`,
    attendanceAdded: "נוסף בניהול",
    attendanceFuture: "אי אפשר לשמור שעה שעוד לא הגיעה.",
    attendanceOld: "אפשר לתקן רק 90 יום אחורה.",
    attendanceSequence: "השעה הזו שוברת את הסדר: כניסה, ואז יציאה.",
    attendanceDuplicate: "כבר יש דיווח באותה דקה.",
    attendanceBadTime: "השעה לא תקינה.",
    attendanceRemove: "מחיקת דיווח",
    attendanceRemoveConfirm: "למחוק את כל הדיווח הזה? כניסה ויציאה נמחקות יחד.",
    attendanceNoSite: "אין אתר לשמירה.",
    staffConstraintsHint: "בלי מגבלת חסימות, השליחה יוצרת בקשה למנהל המשמרות. האילוצים השבועיים משתנים רק אחרי אישור.",
    staffUnpublished: "הסידור לשבוע הזה עוד לא פורסם.",
    staffUnlinked: "החשבון הזה עדיין לא מקושר לעובד בסידור.",
    addToCalendar: "הוספה ללוח שנה",
    calendarEmpty: "אין משמרות שלך בסידור הזה.",
    addEmployeesTitle: "הוספת עובדים",
    noShiftManagers: "עדיין אין מנהלי משמרות באתר הזה.",
    noStaffLogins: "עדיין אין עובדים עם כניסה.",
    loginAlreadyOpen: (email) => `למשתמש זה כבר נפתחה כניסה במייל: ${email}`,
    editAccess: "עריכה",
    deleteAccess: "מחיקה",
    saveAccess: "שמירה",
    cancelEdit: "ביטול",
    loginPending: "ממתין להרשמה",
    managerSitesRequired: "צריך לבחור לפחות אתר אחד.",
    staffAccess: "גישה לעובדים",
    staffAccessHint: "כבוי: מנהל המשמרות מזין את האילוצים. דלוק: לעובד יש משתמש, והוא מגיש בקשה רק בחלון הזמן.",
    constraintWindow: "חלון הגשת אילוצים",
    constraintWindowHint: "מי שיש לו הרשאת הגשת אילוצים מגיש אותם בעצמו רק בחלון הזה.",
    constraintStart: "יום התחלה",
    constraintEnd: "יום סיום",
    constraintStartTime: "שעת התחלה",
    constraintEndTime: "שעת סיום",
    staffWindowClosed: "אפשר להגיש אילוצים רק בחלון הזמן של האתר",
    staffAccessOff: "מנהל המשמרות מזין את האילוצים. אין כניסה עצמאית לאתר הזה.",
    staffSubmit: "שליחת בקשה",
    staffSave: "שמירת אילוצים",
    staffAutoHint: "האילוצים בתוך המגבלה ונשמרים מיד, בלי אישור של מנהל.",
    staffPending: "הבקשה ממתינה לאישור מנהל המשמרות",
    staffSameRequest: "האילוצים זהים לאילוצים שכבר אושרו לשבוע הזה. שנו לפחות משמרת אחת כדי לשלוח בקשה חדשה.",
    staffWeekOnly: "אפשר להגיש אילוצים רק לשבוע הבא, לא לשבוע שכבר מתקיים ולא לשבוע רחוק יותר.",
    exceptionGrant: "אילוצים בלי מגבלה",
    exceptionGrantHint: "העובד יכול לחסום כל מספר משמרות השבוע, כולל את כולן.",
    exceptionGranted: "המנהל אישר לך להגיש אילוצים בלי מגבלת חסימות.",
    extraWindow: "חלון הגשה נוסף",
    extraWindowHint: "נפתח לכל העובדים, בנוסף לחלון הקבוע, ונסגר כשהזמן נגמר. עד 23 שעות ו-59 דקות.",
    extraWindowOpen: "פתיחת חלון",
    extraWindowClose: "סגירת חלון",
    extraWindowHours: "שעות",
    extraWindowMinutes: "דקות",
    extraWindowRemaining: (time) => `החלון הנוסף פתוח עוד ${time}`,
    requestApproved: "בקשת האילוצים שלך אושרה",
    requestRejected: "בקשת האילוצים שלך נדחתה",
    requestDecisionOk: "הבנתי",
    tradeSwap: "בקשת החלפה",
    tradeGiveaway: "בקשת מסירה",
    tradePickMine: "בחר/י משמרת שלך. בטבלה מופיעות רק המשמרות שלך.",
    tradePickTarget: "בחר/י משמרת של עובד אחר. בטבלה מופיעים רק עובדים שאפשר להחליף איתם את המשמרת בלי להפר אילוץ או חוק של העסק או האתר.",
    tradePickGiveaway: "בחר/י את המשמרת שברצונך למסור. בטבלה מופיעות רק המשמרות שלך, והיא תוצע לכל עובד שיכול לקחת אותה.",
    tradeChecking: "בודק אילו משמרות מתאימות…",
    tradeNoTargets: "אין משמרת שאפשר להחליף אותה בלי להפר אילוץ או חוק.",
    tradeNoSeats: "אין לך משמרות עתידיות בסידור שפורסם לשבוע הזה.",
    tradeSend: "שליחת הבקשה",
    tradeOffer: "פרסום המסירה",
    tradeBack: "חזרה",
    tradeClose: "סגירה",
    tradeApprove: "אישור",
    tradeReject: "דחייה",
    tradeTake: "לקחת את המשמרת",
    tradeLater: "אחר כך",
    tradeNotNow: "לא תודה",
    tradeBothAgreed: "שני העובדים אישרו את הבקשה",
    tradeGiveawayAsk: "המשמרת הזו מוצעת למסירה ואפשר לקחת אותה.",
    tradeSwapAsk: "מבקשים להחליף איתך משמרת.",
    tradeAnyone: "עובד שיקח",
    tradeMine: "בקשות החלפה ומסירה",
    tradeWithdraw: "ביטול הבקשה",
    tradeManagerQueue: (count) => `בקשות החלפה (${count})`,
    tradeStatus: {
      open: "ממתין לעובד",
      accepted: "ממתין למנהל המשמרת",
      approved: "אושר",
      rejected: "נדחה על ידי המנהל",
      declined: "העובד דחה",
      cancelled: "בוטל",
    },
    tradeError: {
      conflict: "הבקשה כבר לא עומדת באילוצים או בחוקי העסק והאתר.",
      stale: "הבקשה כבר לא בתוקף. הסידור השתנה או שמישהו כבר טיפל בה.",
      duplicate: "כבר יש בקשה פתוחה על המשמרת הזו.",
      forbidden: "אין לך הרשאה לפעולה הזו.",
      failed: "הפעולה נכשלה. נסו שוב.",
    },
    versionTrade: "החלפה או מסירה",
    staffRequestTitle: "בקשת אילוצים",
    approveRequest: "אישור",
    rejectRequest: "דחייה",
    hourlyWage: "שכר שעתי",
  },
  en: {
    demo: "Local demo",
    manager: "Manager",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    pickWeek: "Pick a week from the calendar",
    thisWeek: "This week",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    hebrewCalendar: "Hebrew calendar",
    hebrewCalendarHint: "Hebrew dates and Jewish holidays, in small print beside the Gregorian date.",
    previousYear: "Previous year",
    nextYear: "Next year",
    monthLabel: "Month",
    yearLabel: "Year",
    generate: "Generate",
    regenerate: "Regenerate",
    slotLock: "Lock shift",
    slotLockHint: "The people on this shift stay. Regenerate shuffles the other shifts, following the constraints and the rules.",
    slotLockEmpty: "A shift can be locked after someone is assigned to it.",
    copySchedule: "Copy schedule",
    pasteSchedule: "Paste schedule",
    clearSchedule: "Clear schedule",
    editShiftLabel: (filled, required) => `Edit shift, ${filled} of ${required}`,
    requiredOnShift: "Employees required",
    fewerRequired: "Fewer employees",
    moreRequired: "More employees",
    startHourLabel: (name) => `${name}'s start`,
    endHourLabel: (name) => `${name}'s end`,
    resetShiftHours: "Use the shift hours",
    shiftHoursHint: "Each person starts on the shift's hours. Hours that run into the next shift count there. A shortage or surplus that remains is noted, and publishing asks first.",
    coverageTitle: "Shortages and extras",
    callOffHint: "Mark a call-off for someone on this shift.",
    closePanel: "Close",
    publish: "Publish",
    publishAskTitle: "Publish anyway?",
    publishAnyway: "Publish anyway",
    publishStay: "Keep as draft",
    revert: "Edit schedule",
    undo: "Undo action",
    redo: "Redo action",
    publishedLock: "This week is published. Editing stays locked until it returns to draft.",
    createBeforePublish: "Generate a schedule before publishing.",
    allClear: "No violations and no open shifts. Ready to publish.",
    publishedClear: "No violations and no open shifts.",
    noSchedule: "Nothing is assigned yet. Generate fills the open seats.",
    issues: "Issues",
    violations: "Violations",
    laborTitle: "Hours of work and rest",
    laborOpen: "Open",
    laborClose: "Close",
    laborWillAsk: "There are notes on hours of work and rest. Publishing will ask first.",
    laborAskLead: "This schedule has notes under the Hours of Work and Rest Law. Assignment stays allowed, and publishing waits for confirmation.",
    openShifts: "Open shifts",
    underQuota: "Under the agreement",
    summaryTitle: "Week summary",
    summaryHint: "Shifts each person got against their agreed count.",
    summaryEmployee: "Employee",
    summaryShifts: "Shifts / quota",
    summaryHours: "Hours",
    summaryStatus: "Status",
    withinQuota: "On quota",
    noQuota: "No quota",
    summaryTotal: "Total",
    approve: "Approve",
    solutionAdd: "Add an available employee",
    solutionExtend: "Extend existing shifts",
    solutionChange: "Changes, moves, and swaps",
    addEmployee: "Add employee",
    availableForShift: "Available",
    unavailableForShift: "Unavailable",
    nobodyToAdd: "Nobody to add",
    remove: "Remove",
    covered: "Covered by an extension",
    cancelSelection: "Cancel selection",
    scrollHint: "Scroll sideways to see the whole week.",
    closed: "Closed",
    overQuota: "Over the agreement",
    hebrew: "עברית",
    english: "English",
    russian: "Русский",
    calendars: "Calendars",
    christianHolidays: "Christian holidays",
    muslimHolidays: "Muslim holidays",
    calendarsHint: "Show a Hebrew calendar, Christian holidays, or Muslim holidays.",
    navSchedule: "Create the schedule",
    navTeam: "Employees",
    navMine: "Clock in and out",
    navEmpty: "This account has no open screen.",
    authorityTitle: "Management and permissions",
    authorityHint: "The direct manager is the person who created the employee. Direct management can move to another manager in the company.",
    directManager: "Direct manager",
    directManagerEmpty: "Most senior person in the company",
    transferManager: "Move management",
    reportsBlock: "People report to this employee. Move them to another site manager before deleting.",
    capClock: "Clock in and out of work",
    capConstraints: "Submit weekly constraints",
    capAbsences: "Submit an absence request",
    capTrades: "Request a shift swap",
    capScheduleView: "View the work schedule",
    capScheduleEdit: "Edit the work schedule",
    capSiteSettings: "Edit site settings",
    capPeopleSite: "View the site employee list",
    capPeopleEdit: "Edit details of people they manage",
    capMessages: "Send messages",
    capInsights: "Dashboard and insights",
    capDocuments: "View and edit employee forms",
    createPerson: "New person",
    personWorker: "Scheduled employee",
    personLead: "Site manager",
    personBoth: "Employee and site manager",
    personWorkerHint: "Appears on the site team and can be placed on shifts.",
    personLeadHint: "Manages the site and its people, without being placed on shifts.",
    personBothHint: "Manages the site, and can also be placed on shifts.",
    siteManagers: "Site managers",
    staffGroup: "Employees",
    managerNotScheduled: "A site manager without shifts. They are not on the schedule and not in the site's employee list.",
    managedSites: "Sites they manage",
    personEmail: "Email for sign-in",
    personSchedulable: "Can be scheduled",
    personSchedulableHint: "A site manager who can also be placed on shifts. Turning this off leaves them as management only.",
    employeeName: "Name",
    contact: "Email",
    loginEmailHint: "Entering an email lets the employee open a user in Rota. Their access to each screen follows their permissions.",
    loginOpen: "Sign-in is open.",
    loginNone: "Without an email there is no sign-in. A manager enters their constraints.",
    saveChanges: "Save changes",
    cancelChanges: "Cancel",
    unsavedTitle: "Save the changes?",
    unsavedBody: "There are unsaved changes.",
    unsavedSave: "Save changes",
    unsavedDiscard: "Cancel changes",
    unsavedStay: "Stay",
    showPassword: "Show password",
    hidePassword: "Hide password",
    phone: "Phone",
    profilePersonal: "Personal details",
    profileContact: "Contact and address",
    profileEmployment: "Employment",
    profileFamily: "Family status",
    profileBank: "Bank details",
    nationalId: "ID",
    birthDate: "Date of birth",
    gender: "Gender",
    genderFemale: "Female",
    genderMale: "Male",
    mobile: "Mobile",
    city: "City",
    street: "Street",
    houseNumber: "House number",
    zip: "Postal code",
    startedOn: "Start date",
    endedOn: "End date",
    department: "Department",
    employeeNumber: "Employee number",
    maritalStatus: "Family status",
    maritalSingle: "Single",
    maritalMarried: "Married",
    maritalDivorced: "Divorced",
    maritalWidowed: "Widowed",
    bankName: "Bank",
    bankBranch: "Branch",
    bankAccount: "Account number",
    employeeForms: "Employee forms",
    employeeFormsHint: "Contracts, certificates and documents for this person.",
    employeeFormsEmpty: "No forms yet.",
    employeeFormsUpload: "Upload a form",
    employeeFormsUploading: "Uploading…",
    employeeFormsView: "View",
    employeeFormsDelete: "Delete",
    employeeFormsClose: "Close",
    employeeFormsDownload: "Download",
    employeeFormsOpenHint: "This file is ready to download.",
    employeeFormsLoading: "Loading forms…",
    employeeFormsTooBig: "The file is larger than 8 MB.",
    employeeFormsType: "Upload a PDF, image, Word, Excel or text file.",
    employeeFormsFull: "An employee can keep up to 30 forms.",
    employeeFormsFailed: "That didn't work. Try again.",
    employeeSites: "Sites",
    employeeSitesHint: "Constraints and the agreement are the same on every site.",
    primarySite: "Primary",
    reliefSite: "Reinforcement",
    primarySiteTitle: "Primary site",
    primarySiteHint: "The employee is scheduled automatically here, and their quota and all their shifts count here.",
    reliefSitesTitle: "Reinforcement sites (optional)",
    reliefSitesHint: "On reinforcement sites the employee is never scheduled automatically. They can be placed by hand only after the primary site's schedule is ready to publish.",
    noReliefSites: "The business has no other sites.",
    reliefRoster: "Reinforcement",
    reliefConstraints: "Constraints are set on the primary site. Here they can only be viewed.",
    reliefHeld: "{name} can fill this shift only once the primary site's schedule is ready to publish, with no violations and no open shifts.",
    role: "Role",
    primaryRole: "Primary role",
    secondaryRoles: "Secondary roles",
    secondaryRolesHint: "Automatic scheduling uses only the primary role. A secondary role can be placed by hand, or offered as a solution when a shift requiring it is short.",
    noRole: "No role",
    qualifications: "Qualifications",
    quota: "Shifts per week",
    hourCap: "Weekly hour cap",
    hourCapHint: "None: the site cap",
    hourCapNone: "None",
    active: "Active",
    inactive: "Inactive",
    observesShabbat: "Observes Shabbat",
    observesShabbatHint: "No shift that touches Friday 15:00 through Saturday 21:00. The block stays in the agreement, following the shift hours, and a click cannot turn it back on.",
    observesHolidays: "Observes Jewish festivals",
    observesHolidaysHint: "Turns on with Shabbat, and can be turned off on its own. In a week with a festival, the weekly constraints lock that shift from 15:00 the day before until 21:00 that night, and a click cannot clear it. Both days of Rosh Hashanah, Yom Kippur, Sukkot, Shemini Atzeret, Pesach and Shavuot.",
    observanceShabbat: "Shabbat",
    observanceHoliday: "Festival",
    holidayStaffing: "A festival day uses the Saturday staffing.",
    agreement: "Agreement",
    preferenceTitle: "Shift preferences",
    preferenceHint: "Scheduling favors the checked shifts when it can. An unchecked shift stays allowed by the agreement.",
    agreementForbids: "Agreement excludes this",
    unavailableWeek: "Unavailable this week",
    availableWeek: "Available this week",
    siteClosed: "Site closed",
    copyPrevious: "Copy previous week",
    notSubmitted: "No availability submitted. The engine treats them as available within the agreement.",
    submitted: "Availability is submitted for this week.",
    availabilityLocked: "Availability can be changed only on shifts the agreement does not block.",
    agreementReadOnly: "The agreement is read-only.",
    unlockAgreement: "Unlock the agreement",
    lockAgreement: "Lock the agreement",
    addPerson: "Add employee",
    pickEmployee: "Choose an employee from the list.",
    scheduleReadOnly: "The schedule is read-only.",
    callOff: "Call off",
    calledOff: "Called off",
    callOffReturn: "Return to the schedule",
    replacements: "Eligible replacements",
    noReplacement: "Nobody passed every rule. The seat stays open.",
    rejectedTitle: "Ruled out",
    emergency: "Emergency options",
    publishedOpen: "This week stays published. A seat is open after a call-off.",
    assignReplacement: "Assign",
    pasteTitle: "Written constraints",
    pasteHint: "Enter constraints received from the employee in a structured format. The constraints update accordingly.",
    pastePlaceholder: "For example:\nEmployee name\nSunday - not working morning\nTuesday - not working night\nWednesday to Friday - not available",
    approvePaste: "Approve availability",
    lineRecognized: "Recognized",
    lineAmbiguous: "Ambiguous",
    lineUnparsed: "Not understood",
    draftTitle: "Draft",
    beforeAfter: "Before and after",
    noCellChange: "No cells change. The agreement already decides this.",
    nothingToWrite: "No recognized line to write.",
    polarityOff: "unavailable",
    polarityOn: "available",
    polarityOnly: "only",
    allShifts: "every shift",
    employeeMatched: "Employee",
    askModel: "Ask the model about open lines",
    modelWorking: "The model is reading the lines…",
    modelOff: "Model suggestions are off here. The parser and approval keep working.",
    modelFailed: "The model did not answer. The lines stay for manual fixing.",
    modelNothing: "The model had no confident reading. The lines stay for manual fixing.",
    modelSuggestion: "Model suggestion",
    acceptSuggestion: "Accept",
    rejectSuggestion: "Reject",
    explain: "Explain",
    versionsTitle: "Versions",
    noVersions: "No versions yet. Publishing creates the first one.",
    versionPublish: "Published",
    versionCalloff: "Call-off cover",
    restoreVersion: "Restore as draft",
    diffAdded: "Added",
    diffRemoved: "Removed",
    diffExtended: "Hours changed",
    diffCalledOff: "Call-off",
    noDiff: "No assignment changed.",
    firstVersion: "First version of the week.",
    showChanges: "Show changes",
    hideChanges: "Hide changes",
    exportPng: "Export PNG",
    exportExcel: "Excel",
    exportCsv: "Export CSV",
    exportCalendar: "Calendar (ICS)",
    exportText: "Copy for WhatsApp",
    exportTextCopied: "Copied to clipboard",
    exportJson: "JSON backup",
    backupSectionTitle: "Site backup & restore (JSON — platform admin)",
    backupSectionHint:
      "The JSON file saves a full snapshot of the active site: site settings, shifts and staffing, employees and agreements, weekly constraints, and all schedules and versions. Uploading a backup file restores all of this data into the active site and saves it to the cloud.",
    downloadBackupJson: "Download JSON backup",
    restoreBackupJson: "Restore from JSON file",
    backupRestored: "Backup restored to the active site and saved.",
    backupInvalid: "The backup file is invalid or was not created by Rota.",
    exportPublishedOnly: "Available after publishing.",
    exportOpen: "Open",
    exportClosed: "Closed",
    exportLegend: "Red: extension or open seat",
    navBusiness: "Business settings",
    navConstraints: "Weekly constraints",
    submittedCount: "submitted availability this week",
    submittedShort: "Submitted",
    notSubmittedShort: "Not submitted, using the agreement",
    themeDark: "Dark mode",
    themeLight: "Light mode",
    exportMenu: "Export schedule",
    businessTitle: "Business",
    businessReadOnly: "Only a user with write access can change site settings.",
    bizName: "Name",
    bizType: "Type",
    minRest: "Minimum rest between shifts (h)",
    maxHours: "Max weekly hours",
    maxShift: "Max shift length when covering a gap (h)",
    maxDayHours: "Max hours per day (0 = no cap)",
    shiftsTitle: "Shifts & staffing",
    shiftName: "Shift",
    shiftStart: "Start",
    shiftEnd: "End",
    requiredRole: "Required role",
    anyRole: "Any role",
    rolesTitle: "Roles",
    rolesHint: "The roles people and shifts can be given.",
    addRole: "Add a role",
    roleName: "Role name",
    deleteRole: "Delete",
    staffingHint: "Numbers are employees required per day (0 = closed). A shift ending at or before its start crosses midnight. A festival day uses the Saturday staffing.",
    blockLimitTitle: "Limit weekly constraint blocks",
    blockLimitHint: "Off: no cap. On: choose how the blocks are split, and a number for each part.",
    blockLimitCount: "Allowed blocks",
    blockLimitStatus: (used, max) => `Blocks this week: ${used} of ${max}.`,
    blockLimitReached: "No more shifts can be blocked.",
    blockSplitTitle: "How blocks are split",
    blockSplitGeneral: "General",
    blockSplitWeekday: "Weekdays and weekend",
    blockSplitShift: "By shift",
    blockSplitGeneralHint: "One number for the whole week.",
    blockSplitWeekdayHint: "Sunday to Thursday counted separately from Friday and Saturday.",
    blockSplitShiftHint: "A separate number for each shift, across the week.",
    blockWeekdays: "Sunday–Thursday",
    blockWeekend: "Friday–Saturday",
    blockLimitBucket: (label, used, max) => `${label}: ${used} of ${max}.`,
    blockLimitHome: (name) => `The split follows the primary site, ${name}.`,
    customBlocksTitle: "Custom constraints",
    customBlocksHint: "Off: the primary site's numbers. On: this person's own numbers, in the same split.",
    customBlocksPerRole: "With more than one role, each role gets this cap on its own. Shifts at the same hours share the same cap.",
    customBlocksHome: (name) => `The split is set on the primary site, ${name}.`,
    markAll: "Select all",
    clearEverything: "Clear all",
    addShift: "Add shift",
    deleteShift: "Delete",
    newShift: "New shift",
    signInTitle: "Hi there!",
    signInHint: "Have we met before?",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signOut: "Sign out",
    signInFailed: "The email or password is wrong.",
    demoAccounts: "Demo account",
    createAccount: "Create account",
    goToSignup: "Don't have an account?",
    goToLogin: "Already have an account?",
    forgotPassword: "Forgot password",
    forgotHint: "Choose a new password for this email. No email is sent.",
    forgotSend: "Save password",
    forgotSent: "The password is updated. You can sign in.",
    forgotFailed: "The password could not be updated. Check the email and try again.",
    backToSignIn: "Back to sign in",
    backToLanding: "Back to the main page",
    rememberMe: "Remember me",
    rememberMeHint: "Stay signed in on this device, without typing the password each time.",
    newPasswordTitle: "New password",
    newPasswordHint: "Choose a password of at least 6 characters.",
    savePassword: "Save password",
    newPasswordFailed: "The password could not be updated. Try again.",
    signupTitle: "Create account",
    signupHint: "Choose a password of at least 6 characters.",
    passwordTooShort: "The password needs at least 6 characters.",
    signupFailed: "The account could not be created. Try again.",
    signupRateLimit: "Too many confirmation emails were sent, so the account was not created. Wait about an hour, then create the account again with the same email and password.",
    privacyPolicy: "Privacy policy",
    termsOfService: "Terms of service",
    refundPolicy: "Refund policy",
    cookiePolicy: "Cookie policy",
    legalDocuments: "Documents",
    signupTermsBefore: "I have read the ",
    signupTermsBetween: " and the ",
    signupTermsAfter: " and I agree.",
    signupAdult: "I am 18 or older. This account is for someone opening a business, not for children.",
    signupConsentNeeded: "An account can be created only after both agreements.",
    cookieNotice: "This device stores the sign-in, the theme, and the calendars. There are no advertising cookies and no traffic measurement.",
    cookieNoticeDismiss: "OK",
    deleteData: "Delete data",
    deleteLogin: "Delete my sign-in",
    deleteLoginHint: "The account is deleted. The name, assignments, and documents the business kept stay until a manager deletes the person.",
    deleteBusiness: "Delete the business",
    deleteBusinessHint: "This deletes the sites, schedules, people, documents, and punches of this business. Other people's accounts are not deleted. If this is your only sign-in, it is deleted too.",
    deleteTypeName: "To confirm, type the business name exactly.",
    deleteSoleOwner: "This is the only account for the business. Deleting the sign-in alone would leave a business with no owner, so it stops. Delete the business.",
    deleteUnavailable: "Data cannot be deleted while the platform admin is inside someone else's business.",
    deleteFailed: "The deletion did not finish. Try again.",
    deleteWorking: "Deleting…",
    deleteClose: "Close",
    profileOptional: "Optional. Scheduling does not use these details. Leave blank anything the business does not need.",
    bankOptional: "Optional. Rota does not move money and does not charge a fee.",
    businessDetails: "Business details",
    fullName: "Full name",
    accountNotApproved: "This email is not approved. A business owner needs approval from the system admin. An employee can create an account after their email is saved on their card.",
    approvalsTitle: "Approve an email",
    adminTabApprove: "New approval",
    adminTabEnter: "Open a business",
    enterCompany: "Open",
    supportBanner: "You are inside this business as the platform admin, with the company admin interface.",
    leaveSupport: "Back to admin",
    approvalsHint: "Approve the email and the owner's name here. They then create an account with a password and open the business.",
    ownerName: "Owner name",
    approveFounder: "Approve",
    approvalOpen: "Waiting for sign-up",
    approvalUsed: "Business created",
    notApprovedTitle: "This email is not approved. The system owner opens the company and approves the email.",
    inviteUser: "Add a shift manager",
    inviteHint: "The shift manager signs in to the checked sites. Any number of sites can be checked.",
    inviteSaved: "The sites are saved. Without an account they sign up with this email and choose a password. An existing account sees the sites on the next sign-in.",
    suspendCompany: "Suspend",
    activateCompany: "Activate",
    tenantSuspended: "This company is suspended. Contact the system owner.",
    accountPending: "The account was created. A confirmation email was sent to the address you entered. Open it, then sign in.",
    createOrgTitle: "First business",
    createOrgAction: "Create business",
    createSiteTitle: "First site",
    createSiteAction: "Create site",
    remoteDbMissing: "The server is missing the database URL. Add SUPABASE_DB_URL to the local environment file.",
    appDisconnected: "Rota is not connected to the cloud. Add a file named .env.local next to the project, then start the server again. Without that connection the app does not open.",
    saveFailed: "Saving to the cloud failed.",
    constraintHomeOnly: "Constraints are saved on the primary site.",
    accessOwner: "Company admin",
    accessWrite: "Shift manager",
    accessRead: "Employee",
    readOnlyBanner: "You have read access: you can see everything, and changes are locked.",
    site: "Site",
    sitesTitle: "Sites",
    siteSettings: "Site settings",
    siteName: "Site name",
    orgName: "Business name",
    orgReadOnly: "Only the company admin can change the business name and type.",
    addSite: "Add site",
    deleteSite: "Delete site",
    newSiteName: "New site name",
    siteNameTaken: "A site with this name already exists.",
    usersTitle: "Add shift managers",
    usersHint: "An employee clocks in and out, submits constraints, and sees a schedule after it is published. A shift manager edits their sites. Only the owner manages users.",
    addUser: "Add user",
    removeUser: "Remove",
    you: "(you)",
    deleteEmployee: "Delete employee",
    noEmployees: "No employees at this site yet.",
    settings: "Settings",
    appearance: "Appearance",
    lightShort: "Light",
    darkShort: "Dark",
    language: "Language",
    selectAll: "Select all",
    clearAll: "Clear",
    navDashboard: "Dashboard",
    navInsights: "Insights",
    navReports: "Reports",
    navMessages: "Messages",
    messagesHint: "A note to staff at this site. Choose who receives it, and when it appears for them.",
    messagesCompose: "New message",
    messagesBody: "Message",
    messagesAudience: "Who receives it",
    messagesAudienceAll: "Everyone at this site",
    messagesAudiencePeople: "Choose employees",
    messagesAudienceShift: "People on a shift",
    messagesDeliver: "When it is sent",
    messagesDeliverNow: "Now",
    messagesDeliverAt: "On a date and time",
    messagesDeliverShift: "At the start of a shift",
    messagesWhen: "Date and time",
    messagesPickPeople: "Choose employees",
    messagesPickShift: "Choose a shift",
    messagesSend: "Send",
    messagesSending: "Sending…",
    messagesEmpty: "Write a message, choose who it is for, then send.",
    messagesNone: "No messages at this site yet.",
    messagesScheduled: "Scheduled",
    messagesSent: "Sent",
    messagesDelete: "Delete",
    messagesFailed: "That didn't send. Try again.",
    messagesBodyNeeded: "The message is empty.",
    messagesNoRecipients: "Nobody matches that choice.",
    messagesReadOnly: "Only a shift manager can send a message.",
    messagesReadCount: (read, total) => `${read} of ${total} read`,
    messagesFrom: (name) => (name ? `From ${name}` : "From the manager"),
    messagesInbox: "Messages from the manager",
    messagesInboxEmpty: "No messages.",
    messagesPopupTitle: "Message from the manager",
    messagesPopupOk: "Got it",
    messagesUnread: (count) => (count === 1 ? "One unread message" : `${count} unread messages`),
    messagesCloseInbox: "Close",
    navAbsences: "Absences",
    absencesHint: "Sick leave and vacation reports from staff. After approval those days are blocked on the schedule and do not count as weekly constraint blocks.",
    absencesStaffHint: "Report sick leave or vacation, with dates. Attach a document for sick leave. After a manager approves, those days are blocked, and a sick-leave document is kept on the employee forms. Weekly constraints can still be submitted for the other days.",
    absencesKind: "Kind",
    absenceSick: "Sick leave",
    absenceVacation: "Vacation",
    absencesFrom: "From",
    absencesTo: "Until",
    absencesDays: "Days",
    absencesDaysHint: "Tap one day. Tap another day for a range. Tap the same day again to clear.",
    absencesNote: "Note",
    absencesFiles: "Sick-leave document",
    absencesFilesHint: "Attach the sick note here. After a manager approves, the file is also kept on the employee forms.",
    absencesUpload: "Upload a document",
    absencesSend: "Send report",
    absencesSending: "Sending…",
    absencesNone: "No reports.",
    absencesPending: "Waiting for approval",
    absencesApproved: "Approved",
    absencesRejected: "Rejected",
    absencesCancelled: "Cancelled",
    absencesApprove: "Approve",
    absencesReject: "Reject",
    absencesCancel: "Cancel",
    absencesDelete: "Delete",
    absencesFailed: "That didn't work. Try again.",
    absencesOverlap: "An open or approved report already covers those dates.",
    absencesWhen: "Pick a valid date range.",
    absencesPerson: "Employee",
    absencesRecord: "Record an absence",
    absencesLock: "Approved absence",
    railLabel: "Manage",
    staffRail: "Mine",
    nameSearch: "Search names",
    noNameMatches: "No matching names",
    inviteStaff: "Open a login",
    inviteStaffHint: "The employee signs in to clock in and out, to submit their constraints, and to see the schedule after it is published.",
    invitePending: "Waiting to sign in",
    staffConstraints: "My constraints",
    staffSchedule: "Schedule",
    staffAttendance: "Clock in / out",
    staffAbsences: "Absences",
    attendanceHint: "The time comes from the phone clock and is checked against the server and the site timezone. Location access is requested when this screen opens, and clock-in appears after the location locks.",
    attendanceIn: "Clock in",
    attendanceOut: "Clock out",
    attendanceHello: (name) => `Hello, ${name}`,
    attendanceReportIn: "Clock in",
    attendanceReportOut: "Clock out",
    attendanceLast: (kind, when) => `Last report: ${kind} ${when}`,
    attendanceAlreadyIn: "There is already an open clock-in.",
    attendanceAlreadyOut: "There is no open clock-in to clock out of.",
    attendanceClockOk: "Clock is current",
    attendanceClockBad: "Clock needs a fix",
    attendanceClockSkew: "The phone clock is not current. Turn on automatic time, then refresh.",
    attendanceClockZone: "The phone timezone does not match the site. Set the clock to the site timezone.",
    attendanceAsking: "Asking for location…",
    attendanceAllow: "Allow location",
    attendanceRetry: "Try again",
    attendanceLocating: "Finding location…",
    attendanceLocatingMeters: (meters) => `Finding location… ${meters} m`,
    attendanceCoarse: (meters) => `The radius is ${meters} m. Clock-in opens once the location locks.`,
    attendanceLocked: (meters) => `Location locked, ${meters} m`,
    attendanceDenied: "Allow location access while using the site to clock in or out.",
    attendanceForbidden: "Clocking in and out is not available at this site.",
    attendanceNoFix: "No location came back. Step outside and wait for GPS to lock.",
    attendanceWide: "The location is too wide. It has to be within 100 meters. Step outside and turn on precise location.",
    attendanceSaved: "Saved",
    attendanceEmpty: "No clock-ins or clock-outs yet.",
    attendanceDate: "Date",
    attendanceInAt: "In",
    attendanceOutAt: "Out",
    attendanceDuration: "Duration",
    attendancePlace: "Location",
    attendanceMap: "Map",
    attendanceOpen: "Open",
    attendanceSince: (time) => `Clocked in at ${time}`,
    attendanceLog: "Clock-ins and clock-outs",
    attendanceLogHint: "The time is the server time. The location and radius are what the phone measured.",
    attendanceShowMore: "Show more",
    attendanceShowLess: "Show less",
    attendanceLoading: "Loading…",
    attendanceCorrectHint: "Add a missed clock-in or clock-out, or change a time, up to 90 days back. The original time stays. Deleting removes the whole report, clock-in and clock-out together.",
    attendanceAddTitle: "Add a clock-in or clock-out",
    attendanceAddSave: "Add",
    attendanceEditTime: "Edit time",
    attendanceSaveTime: "Save time",
    attendanceTime: "Time",
    attendanceKind: "Type",
    attendanceOriginal: (time) => `Original time: ${time}`,
    attendanceAdded: "Added by a manager",
    attendanceFuture: "A time that has not arrived yet cannot be saved.",
    attendanceOld: "A correction can go back only 90 days.",
    attendanceSequence: "This time breaks the order: clock in, then clock out.",
    attendanceDuplicate: "There is already a report at that minute.",
    attendanceBadTime: "That time is not valid.",
    attendanceRemove: "Delete report",
    attendanceRemoveConfirm: "Delete this whole report? The clock-in and clock-out are deleted together.",
    attendanceNoSite: "There is no site to save to.",
    staffConstraintsHint: "Without a block cap, sending creates a request for the shift manager. Weekly constraints change only after it is approved.",
    staffUnpublished: "This week's schedule is not published yet.",
    staffUnlinked: "This account is not linked to anyone on the schedule yet.",
    addToCalendar: "Add to calendar",
    calendarEmpty: "You have no shifts on this schedule.",
    addEmployeesTitle: "Add employees",
    noShiftManagers: "This site has no shift managers yet.",
    noStaffLogins: "No employees have a login yet.",
    loginAlreadyOpen: (email) => `This person already has a login at: ${email}`,
    editAccess: "Edit",
    deleteAccess: "Delete",
    saveAccess: "Save",
    cancelEdit: "Cancel",
    loginPending: "Waiting for sign-up",
    managerSitesRequired: "Pick at least one site.",
    staffAccess: "Employee access",
    staffAccessHint: "Off: the shift manager enters constraints. On: the employee has a login and submits a request only inside the time window.",
    constraintWindow: "Constraint window",
    constraintWindowHint: "A person with the constraints permission submits them only inside this window.",
    constraintStart: "Start day",
    constraintEnd: "End day",
    constraintStartTime: "Start time",
    constraintEndTime: "End time",
    staffWindowClosed: "Constraints can be submitted only inside the site's time window",
    staffAccessOff: "The shift manager enters constraints. This site has no employee login.",
    staffSubmit: "Send request",
    staffSave: "Save constraints",
    staffAutoHint: "These constraints are inside the limit and are saved at once, without a manager.",
    staffPending: "The request is waiting for the shift manager",
    staffSameRequest: "These constraints match the ones already approved for this week. Change at least one shift to send a new request.",
    staffWeekOnly: "Constraints can be sent only for next week, not for the week already underway and not for a later week.",
    exceptionGrant: "Constraints without a cap",
    exceptionGrantHint: "This person can block any number of shifts this week, including every shift.",
    exceptionGranted: "A manager let you submit constraints without a block cap.",
    extraWindow: "Extra submission window",
    extraWindowHint: "Opens for every employee, in addition to the regular window, and closes when the time runs out. Up to 23 hours and 59 minutes.",
    extraWindowOpen: "Open window",
    extraWindowClose: "Close window",
    extraWindowHours: "Hours",
    extraWindowMinutes: "Minutes",
    extraWindowRemaining: (time) => `The extra window stays open for ${time}`,
    requestApproved: "Your constraint request was approved",
    requestRejected: "Your constraint request was rejected",
    requestDecisionOk: "Got it",
    tradeSwap: "Request a swap",
    tradeGiveaway: "Give away a shift",
    tradePickMine: "Pick one of your shifts. The table shows only your shifts.",
    tradePickTarget: "Pick another employee's shift. The table shows only employees you can swap this shift with, without breaking a constraint or a business or site rule.",
    tradePickGiveaway: "Pick the shift to give away. The table shows only your shifts, and anyone who can take it will be offered it.",
    tradeChecking: "Checking which shifts fit…",
    tradeNoTargets: "No shift can be swapped without breaking a constraint or rule.",
    tradeNoSeats: "You have no upcoming shifts in this week's published schedule.",
    tradeSend: "Send request",
    tradeOffer: "Offer the shift",
    tradeBack: "Back",
    tradeClose: "Close",
    tradeApprove: "Approve",
    tradeReject: "Reject",
    tradeTake: "Take the shift",
    tradeLater: "Later",
    tradeNotNow: "No thanks",
    tradeBothAgreed: "Both employees agreed",
    tradeGiveawayAsk: "This shift is up for grabs and you can take it.",
    tradeSwapAsk: "Someone wants to swap a shift with you.",
    tradeAnyone: "Whoever takes it",
    tradeMine: "Swaps and giveaways",
    tradeWithdraw: "Withdraw",
    tradeManagerQueue: (count) => `Swap requests (${count})`,
    tradeStatus: {
      open: "Waiting for the employee",
      accepted: "Waiting for the shift manager",
      approved: "Approved",
      rejected: "Rejected by the manager",
      declined: "Declined",
      cancelled: "Cancelled",
    },
    tradeError: {
      conflict: "The request no longer fits the constraints or the business and site rules.",
      stale: "The request is no longer valid. The schedule changed or someone already handled it.",
      duplicate: "This shift already has an open request.",
      forbidden: "You are not allowed to do that.",
      failed: "That didn't work. Try again.",
    },
    versionTrade: "Swap or giveaway",
    staffRequestTitle: "Constraint request",
    approveRequest: "Approve",
    rejectRequest: "Reject",
    hourlyWage: "Hourly wage",
  },
  ru,
};

function problemParts(lang: Lang, violations: number, unfilled: number, coverage: number): string {
  const parts = [
    tx(
      lang,
      unfilled === 1 ? "משמרת פתוחה אחת" : unfilled > 0 ? `${unfilled} משמרות פתוחות` : "",
      unfilled === 1 ? "1 open shift" : unfilled > 0 ? `${unfilled} open shifts` : "",
      unfilled === 1 ? "1 открытая смена" : unfilled > 0 ? `открытых смен: ${unfilled}` : "",
    ),
    tx(
      lang,
      violations === 1 ? "הפרה אחת" : violations > 0 ? `${violations} הפרות` : "",
      violations === 1 ? "1 violation" : violations > 0 ? `${violations} violations` : "",
      violations === 1 ? "1 нарушение" : violations > 0 ? `нарушений: ${violations}` : "",
    ),
    tx(
      lang,
      coverage === 1 ? "פער כיסוי אחד" : coverage > 0 ? `${coverage} פערי כיסוי` : "",
      coverage === 1 ? "1 coverage gap" : coverage > 0 ? `${coverage} coverage gaps` : "",
      coverage === 1 ? "1 пробел покрытия" : coverage > 0 ? `пробелов покрытия: ${coverage}` : "",
    ),
  ];
  return parts.filter(Boolean).join(", ");
}

export function publishBlocked(lang: Lang, violations: number, unfilled: number, coverage = 0): string {
  const body = problemParts(lang, violations, unfilled, coverage);
  return tx(lang, `פרסום חסום: ${body}.`, `Publish is blocked: ${body}.`, `Публикация закрыта: ${body}.`);
}

/** The sentence in the publish confirmation. The count is open shifts, violations, and coverage gaps. */
export function publishProblems(lang: Lang, violations: number, unfilled: number, coverage = 0): string {
  const count = violations + unfilled + coverage;
  const body = problemParts(lang, violations, unfilled, coverage);
  const lead = tx(
    lang,
    count === 1 ? "יש בעיה אחת" : `יש ${count} בעיות`,
    count === 1 ? "There is 1 problem" : `There are ${count} problems`,
    count === 1 ? "Есть 1 проблема" : `Проблем: ${count}`,
  );
  return body ? `${lead}: ${body}.` : `${lead}.`;
}

export function publishWillAsk(lang: Lang, count: number): string {
  return tx(
    lang,
    count === 1 ? "יש בעיה אחת. הפרסום יבקש אישור." : `יש ${count} בעיות. הפרסום יבקש אישור.`,
    count === 1 ? "There is 1 problem. Publishing will ask first." : `There are ${count} problems. Publishing will ask first.`,
    count === 1 ? "Есть 1 проблема. Публикация сначала спросит." : `Проблем: ${count}. Публикация сначала спросит.`,
  );
}

export function constraintBlocked(lang: Lang, count: number): string {
  return tx(
    lang,
    count === 1 ? "פרסום חסום: יש שיבוץ על אילוץ." : `פרסום חסום: יש ${count} שיבוצים על אילוץ.`,
    count === 1 ? "Publish is blocked: someone is scheduled against a constraint." : `Publish is blocked: ${count} assignments break a constraint.`,
    count === 1 ? "Публикация закрыта: кто-то стоит в смене против ограничения." : `Публикация закрыта: ${count} назначений нарушают ограничение.`,
  );
}

/** One suggested clock change. The time is the new start or the new end. */
export function hourFixText(lang: Lang, name: string, shift: string, edge: "start" | "end", clock: string): string {
  const time = `\u200E${clock}`;
  return edge === "start"
    ? tx(lang, `${name} — ${shift} מ-${time}`, `${name} starts ${shift} at ${time}`, `${name} начинает ${shift} в ${time}`)
    : tx(lang, `${name} — ${shift} עד ${time}`, `${name} finishes ${shift} at ${time}`, `${name} заканчивает ${shift} в ${time}`);
}

/** Shortage or surplus, without the shift name. The clock range is added beside it. */
export function coverageGapText(lang: Lang, delta: number): string {
  const count = Math.abs(delta);
  if (delta < 0) {
    return tx(
      lang,
      count === 1 ? "חוסר של עובד אחד" : `חוסר של ${count} עובדים`,
      count === 1 ? "One employee short" : `${count} employees short`,
      count === 1 ? "Не хватает одного сотрудника" : `Не хватает сотрудников: ${count}`,
    );
  }
  return tx(
    lang,
    count === 1 ? "עודף של עובד אחד" : `עודף של ${count} עובדים`,
    count === 1 ? "One extra employee" : `${count} extra employees`,
    count === 1 ? "Один лишний сотрудник" : `Лишних сотрудников: ${count}`,
  );
}

export function selectionHint(lang: Lang, name: string): string {
  return tx(
    lang,
    `${name} נבחר. לחצו על משמרת יעד, או גררו במחשב.`,
    `${name} is selected. Tap a destination shift, or drag on desktop.`,
    `${name} выбран. Нажмите смену назначения или перетащите на компьютере.`,
  );
}

export function removeLabel(lang: Lang, name: string): string {
  return tx(lang, `הסרת ${name}`, `Remove ${name}`, `Убрать ${name}`);
}

export function confirmDeleteForm(lang: Lang, name: string): string {
  return tx(lang, `למחוק את ${name}?`, `Delete ${name}?`, `Удалить ${name}?`);
}

export function confirmDeleteEmployee(lang: Lang, name: string): string {
  return tx(
    lang,
    `למחוק את ${name}? ההסכם, הזמינות והשיבוצים בטיוטות יימחקו. סידורים שפורסמו וגרסאות יישארו כמו שהם.`,
    `Delete ${name}? Their agreement, availability and draft seats are removed. Published weeks and versions stay as they are.`,
    `Удалить ${name}? Соглашение, доступность и места в черновиках удалятся. Опубликованные недели и версии останутся как есть.`,
  );
}

export function deleteEmployeeBlocked(lang: Lang, weeks: string): string {
  return tx(
    lang,
    `אי אפשר למחוק עכשיו: העובד משובץ בסידור שפורסם (${weeks}). החזירו את השבוע לטיוטה או דווחו חיסור, ואז מחקו.`,
    `Can't delete yet: they're seated in a published week (${weeks}). Return it to draft or report a call-off first.`,
    `Пока нельзя удалить: сотрудник стоит в опубликованной неделе (${weeks}). Верните её в черновик или снимите его со смены, затем удалите.`,
  );
}

export function confirmDeleteManager(lang: Lang, name: string): string {
  return tx(
    lang,
    `למחוק את מנהל המשמרות ${name}? המשתמש שלו יימחק והוא לא יוכל להיכנס.`,
    `Delete the shift manager ${name}? Their login is removed and they can no longer sign in.`,
    `Удалить менеджера смен ${name}? Его вход удалится, и он больше не сможет войти.`,
  );
}

export function confirmDeleteStaffLogin(lang: Lang, name: string): string {
  return tx(
    lang,
    `למחוק את הכניסה של ${name}? המשתמש יימחק, אבל ${name} יישאר בניהול העובדים ובסידורים.`,
    `Delete ${name}'s login? The login is removed, but ${name} stays on the team and in schedules.`,
    `Удалить вход ${name}? Вход удалится, но ${name} останется в списке сотрудников и в графиках.`,
  );
}

export function confirmDeleteSite(lang: Lang, name: string): string {
  return tx(
    lang,
    `למחוק את האתר ${name}? המשמרות, העובדים, הזמינות, הסידורים והגרסאות שלו יימחקו.`,
    `Delete the site ${name}? Its shifts, employees, availability, schedules and versions are removed.`,
    `Удалить объект ${name}? Его смены, сотрудники, доступность, графики и версии удалятся.`,
  );
}

export function userErrorText(lang: Lang, error: "name" | "email" | "duplicate" | "password"): string {
  const text = {
    name: tx(lang, "חסר שם.", "Name is missing.", "Нет имени."),
    email: tx(lang, "האימייל לא תקין.", "The email is not valid.", "Почта неверна."),
    duplicate: tx(lang, "כבר יש משתמש עם האימייל הזה.", "A user with this email exists.", "Пользователь с этой почтой уже есть."),
    password: tx(lang, "סיסמה של 6 תווים לפחות.", "Password needs at least 6 characters.", "Паролю нужно не меньше 6 символов."),
  };
  return text[error];
}

export function versionLabel(lang: Lang, number: number): string {
  return tx(lang, `גרסה ${number}`, `Version ${number}`, `Версия ${number}`);
}

export function deleteVersionLabel(lang: Lang, number: number): string {
  return tx(lang, `מחיקת גרסה ${number}`, `Delete version ${number}`, `Удалить версию ${number}`);
}

export function restoredFromText(lang: Lang, number: number): string {
  return tx(lang, `שוחזרה מגרסה ${number}`, `Restored from version ${number}`, `Восстановлено из версии ${number}`);
}

export function restoredDraftText(lang: Lang, number: number): string {
  return tx(
    lang,
    `הטיוטה שוחזרה מגרסה ${number}. פרסום יבדוק אותה שוב ויהפוך אותה לגרסה הבאה.`,
    `This draft was restored from version ${number}. Publishing checks it again and makes it the next version.`,
    `Черновик восстановлен из версии ${number}. Публикация проверит его снова и сделает следующей версией.`,
  );
}

export function sinceVersionText(lang: Lang, number: number): string {
  return tx(lang, `שינויים מאז גרסה ${number}`, `Changes since version ${number}`, `Изменения с версии ${number}`);
}

export function callOffLabel(lang: Lang, name: string): string {
  return tx(lang, `חיסור: ${name}`, `Call off ${name}`, `Снятие: ${name}`);
}

export function constraintReasonText(lang: Lang, reason: ConstraintReason): string {
  const he: Record<ConstraintReason, string> = {
    unknown_employee: "השם לא נמצא בצוות.",
    ambiguous_employee: "השם מתאים ליותר מעובד אחד.",
    ambiguous_shift: "המשמרת מתאימה ליותר מאפשרות אחת.",
    ambiguous_day: "היום לא חד-משמעי.",
    no_employee: "אין עובד ברור לשורה הזו.",
    missing_day: "אין יום ברור.",
    missing_shift: "אין משמרת ברורה.",
    missing_polarity: "לא ברור אם העובד זמין או לא.",
    conflict: "השורה סותרת את עצמה.",
  };
  const en: Record<ConstraintReason, string> = {
    unknown_employee: "That name is not on the team.",
    ambiguous_employee: "That name matches more than one person.",
    ambiguous_shift: "That shift word matches more than one shift.",
    ambiguous_day: "The day is ambiguous.",
    no_employee: "This line has no clear employee.",
    missing_day: "No clear day.",
    missing_shift: "No clear shift.",
    missing_polarity: "It is unclear whether they can work.",
    conflict: "The line contradicts itself.",
  };
  const russian: Record<ConstraintReason, string> = {
    unknown_employee: "Этого имени нет в команде.",
    ambiguous_employee: "Это имя подходит больше чем одному человеку.",
    ambiguous_shift: "Это слово смены подходит больше чем одной смене.",
    ambiguous_day: "День неоднозначен.",
    no_employee: "В этой строке нет ясного сотрудника.",
    missing_day: "Нет ясного дня.",
    missing_shift: "Нет ясной смены.",
    missing_polarity: "Неясно, может ли человек работать.",
    conflict: "Строка противоречит сама себе.",
  };
  return (lang === "he" ? he : lang === "ru" ? russian : en)[reason];
}

