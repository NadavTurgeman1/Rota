import type { Lang } from "../domain";
import type { ConstraintReason } from "../parser";

export interface Copy {
  demo: string;
  manager: string;
  previousWeek: string;
  nextWeek: string;
  generate: string;
  regenerate: string;
  publish: string;
  revert: string;
  undo: string;
  redo: string;
  publishedLock: string;
  createBeforePublish: string;
  allClear: string;
  publishedClear: string;
  noSchedule: string;
  issues: string;
  lawNotesTitle: string;
  lawNotesHint: string;
  showLawNotes: string;
  hideLawNotes: string;
  violations: string;
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
  addEmployee: string;
  remove: string;
  covered: string;
  cancelSelection: string;
  scrollHint: string;
  closed: string;
  overQuota: string;
  hebrew: string;
  english: string;
  navSchedule: string;
  navTeam: string;
  employeeName: string;
  contact: string;
  role: string;
  qualifications: string;
  quota: string;
  hourCap: string;
  hourCapHint: string;
  hourCapNone: string;
  active: string;
  inactive: string;
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
  exportJson: string;
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
  lawHint: string;
  shiftsTitle: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  requiredRole: string;
  anyRole: string;
  staffingHint: string;
  blockLimitTitle: string;
  blockLimitHint: string;
  blockLimitCount: string;
  blockLimitStatus: (used: number, max: number) => string;
  blockLimitReached: string;
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
  signupTitle: string;
  signupHint: string;
  passwordTooShort: string;
  signupFailed: string;
  signupRateLimit: string;
  fullName: string;
  accountNotApproved: string;
  approvalsTitle: string;
  adminTabApprove: string;
  adminTabEnter: string;
  enterCompany: string;
  supportBanner: string;
  leaveSupport: string;
  approvalsHint: string;
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
  navInsights: string;
  nameSearch: string;
  noNameMatches: string;
  inviteStaff: string;
  inviteStaffHint: string;
  invitePending: string;
  staffConstraints: string;
  staffSchedule: string;
  staffConstraintsHint: string;
  staffUnpublished: string;
  staffUnlinked: string;
  addToCalendar: string;
  calendarEmpty: string;
  addEmployeesTitle: string;
  noShiftManagers: string;
  noStaffLogins: string;
  loginAlreadyOpen: (email: string) => string;
  staffAccess: string;
  staffAccessHint: string;
  constraintWindow: string;
  constraintStart: string;
  constraintEnd: string;
  constraintStartTime: string;
  constraintEndTime: string;
  staffWindowClosed: string;
  staffAccessOff: string;
  staffSubmit: string;
  staffPending: string;
  requestApproved: string;
  requestRejected: string;
  requestDecisionOk: string;
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
    generate: "יצירת סידור",
    regenerate: "יצירה מחדש",
    publish: "פרסום",
    revert: "החזרה לטיוטה",
    undo: "ביטול",
    redo: "שחזר",
    publishedLock: "השבוע פורסם. העריכה נעולה עד החזרה לטיוטה.",
    createBeforePublish: "צרו סידור לפני פרסום.",
    allClear: "אין הפרות ואין חורים. אפשר לפרסם.",
    publishedClear: "אין הפרות ואין חורים.",
    noSchedule: "אין עדיין שיבוץ. יצירת הסידור תמלא את המושבים לפי המנוע.",
    issues: "בעיות",
    lawNotesTitle: "הערות לפי דיני העבודה",
    lawNotesHint: "הערות בלבד לפי חוק שעות עבודה ומנוחה ושבוע העבודה של 42 שעות. הן לא חוסמות פרסום, וייתכן היתר לענף השמירה.",
    showLawNotes: "הצגת הערות דיני העבודה",
    hideLawNotes: "הסתרת הערות דיני העבודה",
    violations: "הפרות",
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
    addEmployee: "הוספת עובד",
    remove: "הסרה",
    covered: "מכוסה בהארכה",
    cancelSelection: "ביטול בחירה",
    scrollHint: "גלול לצדדים כדי לראות את כל השבוע.",
    closed: "סגור",
    overQuota: "מעל המכסה",
    hebrew: "עברית",
    english: "English",
    navSchedule: "סידור שבועי",
    navTeam: "ניהול עובדים",
    employeeName: "שם",
    contact: "פרטי קשר",
    role: "תפקיד",
    qualifications: "הסמכות",
    quota: "משמרות בשבוע",
    hourCap: "תקרת שעות",
    hourCapHint: "ללא: תקרת האתר",
    hourCapNone: "ללא",
    active: "פעיל",
    inactive: "לא פעיל",
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
    availabilityLocked: "אי אפשר לפתוח כאן משמרת שההסכם סוגר.",
    agreementReadOnly: "ההסכם לקריאה בלבד.",
    unlockAgreement: "ביטול נעילת ההסכם",
    lockAgreement: "נעילת ההסכם",
    addPerson: "הוספת עובד",
    pickEmployee: "בחרו עובד מהרשימה.",
    scheduleReadOnly: "הסידור לקריאה בלבד.",
    callOff: "חיסור",
    calledOff: "חיסור",
    replacements: "מחליפים חוקיים",
    noReplacement: "אין מחליף שעבר את כל הכללים. המושב נשאר פתוח.",
    rejectedTitle: "נפסלו",
    emergency: "חלופות חירום",
    publishedOpen: "השבוע נשאר פורסם. יש מושב פתוח אחרי חיסור.",
    assignReplacement: "שיבוץ",
    pasteTitle: "הודעה מהעובד",
    pasteHint: "הדביקו הודעה. הזמינות נכתבת רק אחרי אישור, וההסכם לא משתנה.",
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
    exportJson: "גיבוי JSON",
    exportPublishedOnly: "ייצוא PNG זמין אחרי פרסום.",
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
    lawHint: "מגבלות המנוחה והשעות תלויות בחוק המקומי. קבעו אותן לפי החוק והמדיניות שלכם.",
    shiftsTitle: "משמרות ותקן",
    shiftName: "משמרת",
    shiftStart: "התחלה",
    shiftEnd: "סיום",
    requiredRole: "תפקיד נדרש",
    anyRole: "כל תפקיד",
    staffingHint: "המספרים הם עובדים נדרשים בכל יום (0 = סגור). משמרת שמסתיימת לפני שעת ההתחלה שלה חוצה חצות.",
    blockLimitTitle: "הגבלת כמות חסימות באילוצים השבועיים",
    blockLimitHint: "כבוי: בלי הגבלה. דלוק: לכל עובד יש מספר מרבי של משמרות שאפשר לחסום השבוע.",
    blockLimitCount: "כמה חסימות מותר",
    blockLimitStatus: (used, max) => `חסימות השבוע: ${used} מתוך ${max}.`,
    blockLimitReached: "אי אפשר לחסום עוד משמרת.",
    markAll: "סמן הכל",
    clearEverything: "נקה הכל",
    addShift: "הוספת משמרת",
    deleteShift: "מחיקה",
    newShift: "משמרת חדשה",
    signInTitle: "כניסה ל-Rota",
    signInHint: "כניסה לניהול הסידור, הצוות והאתרים.",
    email: "אימייל",
    password: "סיסמה",
    signIn: "כניסה",
    signOut: "יציאה",
    signInFailed: "האימייל או הסיסמה לא נכונים.",
    demoAccounts: "חשבון הדמו",
    createAccount: "יצירת חשבון",
    goToSignup: "אין חשבון? יצירת חשבון",
    goToLogin: "יש חשבון? כניסה",
    signupTitle: "יצירת חשבון",
    signupHint: "בוחרים כאן סיסמה של 6 תווים לפחות. אין סיסמה מוכנה. אחרי יצירת החשבון נכנסים עם אותה סיסמה.",
    passwordTooShort: "הסיסמה צריכה 6 תווים לפחות.",
    signupFailed: "יצירת החשבון נכשלה. נסו שוב.",
    signupRateLimit: "נשלחו יותר מדי אימיילי אישור, והחשבון לא נוצר. ממתינים כשעה ולוחצים שוב על יצירת חשבון עם אותו מייל ואותה סיסמה.",
    fullName: "שם מלא",
    accountNotApproved: "המייל הזה לא מאושר. אפשר ליצור חשבון רק אחרי שמנהל המערכת פותח את העסק.",
    approvalsTitle: "אישור מייל",
    adminTabApprove: "הוספת הרשאה",
    adminTabEnter: "כניסה לעסקים",
    enterCompany: "כניסה",
    supportBanner: "נכנסת לעסק הזה כמנהל המערכת, עם הממשק של מנהל העסק.",
    leaveSupport: "חזרה לניהול",
    approvalsHint: "מאשרים כאן מייל בלבד. בעל המייל נרשם עם שם מלא, ואז יוצר את העסק בעצמו.",
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
    accountPending: "החשבון נוצר. אם נשלח אימייל אישור, פתח אותו ואז היכנס.",
    createOrgTitle: "העסק הראשון",
    createOrgAction: "צור עסק",
    createSiteTitle: "האתר הראשון",
    createSiteAction: "צור אתר",
    remoteDbMissing: "חסרה כתובת מסד הנתונים בשרת. מוסיפים SUPABASE_DB_URL לקובץ הסביבה המקומי.",
    appDisconnected: "Rota לא מחובר לענן. צריך קובץ בשם .env.local ליד הפרויקט, ואז להפעיל מחדש את השרת. בלי החיבור הזה האפליקציה לא נפתחת.",
    saveFailed: "השמירה לענן נכשלה.",
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
    usersHint: "עובד מגיש אילוצים ורואה סידור אחרי פרסום. מנהל משמרות עורך את האתרים שלו. רק בעל העסק מנהל משתמשים.",
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
    navInsights: "תובנות AI",
    nameSearch: "חיפוש שם",
    noNameMatches: "אין שמות תואמים",
    inviteStaff: "פתיחת כניסה",
    inviteStaffHint: "העובד נכנס רק להגשת האילוצים שלו ולסידור אחרי שהוא מתפרסם.",
    invitePending: "ממתין לכניסה",
    staffConstraints: "האילוצים שלי",
    staffSchedule: "הסידור",
    staffConstraintsHint: "הבקשה ממתינה לאישור מנהל המשמרות. האילוצים השבועיים לא משתנים עד האישור.",
    staffUnpublished: "הסידור לשבוע הזה עוד לא פורסם.",
    staffUnlinked: "החשבון הזה עדיין לא מקושר לעובד בסידור.",
    addToCalendar: "הוספה ללוח שנה",
    calendarEmpty: "אין משמרות שלך בסידור הזה.",
    addEmployeesTitle: "הוספת עובדים",
    noShiftManagers: "עדיין אין מנהלי משמרות באתר הזה.",
    noStaffLogins: "עדיין אין עובדים עם כניסה מאושרת.",
    loginAlreadyOpen: (email) => `למשתמש זה כבר נפתחה כניסה במייל: ${email}`,
    staffAccess: "גישה לעובדים",
    staffAccessHint: "כבוי: מנהל המשמרות מזין את האילוצים. דלוק: לעובד יש משתמש, והוא מגיש בקשה רק בחלון הזמן.",
    constraintWindow: "חלון הגשת אילוצים",
    constraintStart: "יום התחלה",
    constraintEnd: "יום סיום",
    constraintStartTime: "שעת התחלה",
    constraintEndTime: "שעת סיום",
    staffWindowClosed: "אפשר להגיש אילוצים רק בחלון הזמן של האתר",
    staffAccessOff: "מנהל המשמרות מזין את האילוצים. אין כניסה עצמאית לאתר הזה.",
    staffSubmit: "שליחת בקשה",
    staffPending: "הבקשה ממתינה לאישור מנהל המשמרות",
    requestApproved: "בקשת האילוצים שלך אושרה",
    requestRejected: "בקשת האילוצים שלך נדחתה",
    requestDecisionOk: "הבנתי",
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
    generate: "Generate",
    regenerate: "Regenerate",
    publish: "Publish",
    revert: "Back to draft",
    undo: "Undo",
    redo: "Redo",
    publishedLock: "This week is published. Editing stays locked until it returns to draft.",
    createBeforePublish: "Generate a schedule before publishing.",
    allClear: "No violations and no open shifts. Ready to publish.",
    publishedClear: "No violations and no open shifts.",
    noSchedule: "Nothing is assigned yet. Generate fills the seats through the engine.",
    issues: "Issues",
    lawNotesTitle: "Employment-law notes",
    lawNotesHint: "Notes only, from the Hours of Work and Rest Law and the 42-hour week. They do not block publishing, and a guarding permit may apply.",
    showLawNotes: "Show employment-law notes",
    hideLawNotes: "Hide employment-law notes",
    violations: "Violations",
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
    addEmployee: "Add employee",
    remove: "Remove",
    covered: "Covered by an extension",
    cancelSelection: "Cancel selection",
    scrollHint: "Scroll sideways to see the whole week.",
    closed: "Closed",
    overQuota: "Over the agreement",
    hebrew: "עברית",
    english: "English",
    navSchedule: "Weekly schedule",
    navTeam: "Employees",
    employeeName: "Name",
    contact: "Contact",
    role: "Role",
    qualifications: "Qualifications",
    quota: "Shifts per week",
    hourCap: "Weekly hour cap",
    hourCapHint: "None: the site cap",
    hourCapNone: "None",
    active: "Active",
    inactive: "Inactive",
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
    availabilityLocked: "A shift the agreement closes stays closed here.",
    agreementReadOnly: "The agreement is read-only.",
    unlockAgreement: "Unlock the agreement",
    lockAgreement: "Lock the agreement",
    addPerson: "Add employee",
    pickEmployee: "Choose an employee from the list.",
    scheduleReadOnly: "The schedule is read-only.",
    callOff: "Call off",
    calledOff: "Called off",
    replacements: "Legal replacements",
    noReplacement: "Nobody passed every rule. The seat stays open.",
    rejectedTitle: "Ruled out",
    emergency: "Emergency options",
    publishedOpen: "This week stays published. A seat is open after a call-off.",
    assignReplacement: "Assign",
    pasteTitle: "Message from the team",
    pasteHint: "Paste a message. Availability is written only after approval, and the agreement stays as it is.",
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
    exportJson: "JSON backup",
    exportPublishedOnly: "PNG export is available after publishing.",
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
    lawHint: "Rest and hour limits depend on your jurisdiction. Set them to match local law and your policies.",
    shiftsTitle: "Shifts & staffing",
    shiftName: "Shift",
    shiftStart: "Start",
    shiftEnd: "End",
    requiredRole: "Required role",
    anyRole: "Any role",
    staffingHint: "Numbers are employees required per day (0 = closed). A shift ending at or before its start crosses midnight.",
    blockLimitTitle: "Limit weekly constraint blocks",
    blockLimitHint: "Off: no cap. On: each person can block only this many shifts in a week.",
    blockLimitCount: "Allowed blocks",
    blockLimitStatus: (used, max) => `Blocks this week: ${used} of ${max}.`,
    blockLimitReached: "No more shifts can be blocked.",
    markAll: "Select all",
    clearEverything: "Clear all",
    addShift: "Add shift",
    deleteShift: "Delete",
    newShift: "New shift",
    signInTitle: "Sign in to Rota",
    signInHint: "Sign in to manage the schedule, team and sites.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signOut: "Sign out",
    signInFailed: "The email or password is wrong.",
    demoAccounts: "Demo account",
    createAccount: "Create account",
    goToSignup: "No account? Create one",
    goToLogin: "Already have an account? Sign in",
    signupTitle: "Create account",
    signupHint: "Choose a password of at least 6 characters. There is no preset password. Sign in later with that same password.",
    passwordTooShort: "The password needs at least 6 characters.",
    signupFailed: "The account could not be created. Try again.",
    signupRateLimit: "Too many confirmation emails were sent, so the account was not created. Wait about an hour, then create the account again with the same email and password.",
    fullName: "Full name",
    accountNotApproved: "This email is not approved. An account can be created only after the system owner opens the company.",
    approvalsTitle: "Approve an email",
    adminTabApprove: "New approval",
    adminTabEnter: "Open a business",
    enterCompany: "Open",
    supportBanner: "You are inside this business as the platform admin, with the company admin interface.",
    leaveSupport: "Back to admin",
    approvalsHint: "Approve an email only. That person signs up with a full name, then creates the business.",
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
    accountPending: "The account was created. If a confirmation email arrived, open it and then sign in.",
    createOrgTitle: "First business",
    createOrgAction: "Create business",
    createSiteTitle: "First site",
    createSiteAction: "Create site",
    remoteDbMissing: "The server is missing the database URL. Add SUPABASE_DB_URL to the local environment file.",
    appDisconnected: "Rota is not connected to the cloud. Add a file named .env.local next to the project, then start the server again. Without that connection the app does not open.",
    saveFailed: "Saving to the cloud failed.",
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
    usersHint: "An employee submits constraints and sees a schedule after it is published. A shift manager edits their sites. Only the owner manages users.",
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
    navInsights: "AI insights",
    nameSearch: "Search names",
    noNameMatches: "No matching names",
    inviteStaff: "Open a login",
    inviteStaffHint: "The employee can only submit their constraints and see a schedule after it is published.",
    invitePending: "Waiting to sign in",
    staffConstraints: "My constraints",
    staffSchedule: "Schedule",
    staffConstraintsHint: "The request waits for the shift manager. Weekly constraints stay as they are until it is approved.",
    staffUnpublished: "This week's schedule is not published yet.",
    staffUnlinked: "This account is not linked to anyone on the schedule yet.",
    addToCalendar: "Add to calendar",
    calendarEmpty: "You have no shifts on this schedule.",
    addEmployeesTitle: "Add employees",
    noShiftManagers: "This site has no shift managers yet.",
    noStaffLogins: "No employees have a confirmed login yet.",
    loginAlreadyOpen: (email) => `This person already has a login at: ${email}`,
    staffAccess: "Employee access",
    staffAccessHint: "Off: the shift manager enters constraints. On: the employee has a login and submits a request only inside the time window.",
    constraintWindow: "Constraint window",
    constraintStart: "Start day",
    constraintEnd: "End day",
    constraintStartTime: "Start time",
    constraintEndTime: "End time",
    staffWindowClosed: "Constraints can be submitted only inside the site's time window",
    staffAccessOff: "The shift manager enters constraints. This site has no employee login.",
    staffSubmit: "Send request",
    staffPending: "The request is waiting for the shift manager",
    requestApproved: "Your constraint request was approved",
    requestRejected: "Your constraint request was rejected",
    requestDecisionOk: "Got it",
    staffRequestTitle: "Constraint request",
    approveRequest: "Approve",
    rejectRequest: "Reject",
    hourlyWage: "Hourly wage",
  },
};

export function publishBlocked(lang: Lang, violations: number, unfilled: number): string {
  if (lang === "en") {
    const holes = unfilled === 1 ? "1 open shift" : `${unfilled} open shifts`;
    const breaks = violations === 1 ? "1 violation" : `${violations} violations`;
    return `Publish is blocked: ${holes}, ${breaks}.`;
  }
  const holes = unfilled === 1 ? "משמרת פתוחה אחת" : `${unfilled} משמרות פתוחות`;
  const breaks = violations === 1 ? "הפרה אחת" : `${violations} הפרות`;
  return `פרסום חסום: ${holes}, ${breaks}.`;
}

export function selectionHint(lang: Lang, name: string): string {
  return lang === "he"
    ? `${name} נבחר. לחצו על משמרת יעד, או גררו במחשב.`
    : `${name} is selected. Tap a destination shift, or drag on desktop.`;
}

export function removeLabel(lang: Lang, name: string): string {
  return lang === "he" ? `הסרת ${name}` : `Remove ${name}`;
}

export function confirmDeleteEmployee(lang: Lang, name: string): string {
  return lang === "he"
    ? `למחוק את ${name}? ההסכם, הזמינות והשיבוצים בטיוטות יימחקו. סידורים שפורסמו וגרסאות יישארו כמו שהם.`
    : `Delete ${name}? Their agreement, availability and draft seats are removed. Published weeks and versions stay as they are.`;
}

export function deleteEmployeeBlocked(lang: Lang, weeks: string): string {
  return lang === "he"
    ? `אי אפשר למחוק עכשיו: העובד משובץ בסידור שפורסם (${weeks}). החזירו את השבוע לטיוטה או דווחו חיסור, ואז מחקו.`
    : `Can't delete yet: they're seated in a published week (${weeks}). Return it to draft or report a call-off first.`;
}

export function confirmDeleteSite(lang: Lang, name: string): string {
  return lang === "he"
    ? `למחוק את האתר ${name}? המשמרות, העובדים, הזמינות, הסידורים והגרסאות שלו יימחקו.`
    : `Delete the site ${name}? Its shifts, employees, availability, schedules and versions are removed.`;
}

export function userErrorText(lang: Lang, error: "name" | "email" | "duplicate" | "password"): string {
  const he = { name: "חסר שם.", email: "האימייל לא תקין.", duplicate: "כבר יש משתמש עם האימייל הזה.", password: "סיסמה של 6 תווים לפחות." };
  const en = { name: "Name is missing.", email: "The email is not valid.", duplicate: "A user with this email exists.", password: "Password needs at least 6 characters." };
  return (lang === "he" ? he : en)[error];
}

export function versionLabel(lang: Lang, number: number): string {
  return lang === "he" ? `גרסה ${number}` : `Version ${number}`;
}

export function restoredFromText(lang: Lang, number: number): string {
  return lang === "he" ? `שוחזרה מגרסה ${number}` : `Restored from version ${number}`;
}

export function restoredDraftText(lang: Lang, number: number): string {
  return lang === "he"
    ? `הטיוטה שוחזרה מגרסה ${number}. פרסום יבדוק אותה שוב ויהפוך אותה לגרסה הבאה.`
    : `This draft was restored from version ${number}. Publishing checks it again and makes it the next version.`;
}

export function sinceVersionText(lang: Lang, number: number): string {
  return lang === "he" ? `שינויים מאז גרסה ${number}` : `Changes since version ${number}`;
}

export function callOffLabel(lang: Lang, name: string): string {
  return lang === "he" ? `חיסור: ${name}` : `Call off ${name}`;
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
  return (lang === "he" ? he : en)[reason];
}
