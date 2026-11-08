import type { Lang } from "../domain";

export const LEGAL_PAGES = ["privacy", "terms", "refund", "cookies"] as const;

export type LegalPageId = (typeof LEGAL_PAGES)[number];

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  sections: LegalSection[];
}

const UPDATED: Record<Lang, string> = {
  he: "8 בנובמבר 2026",
  en: "8 November 2026",
  ru: "8 ноября 2026",
};

const IMPRINT: Record<Lang, LegalSection> = {
  he: {
    heading: "פרטי המפעיל",
    paragraphs: [
      "השירות נקרא Rota. זה כלי לסידור עבודה, אילוצים, נוכחות והודעות של עסק ושל העובדים שלו.",
      "פניות למסמכים האלה: rota.ai.schedule@gmail.com.",
      "שם העוסק, הכתובת ומספר החברה מופיעים בחוזה עם כל עסק. הם לא מומצאים בעמוד הזה.",
      "התשלום, אם יש, נקבע בחוזה עם העסק. אין מחירון אחיד באתר, ואין עמלה שמנוכה מתוך המערכת.",
    ],
  },
  en: {
    heading: "Operator",
    paragraphs: [
      "The service is called Rota. It is a tool for a work schedule, constraints, attendance, and messages for a business and its staff.",
      "For these documents, write to rota.ai.schedule@gmail.com.",
      "The registered name, address, and company number appear in the agreement with each business. They are not invented on this page.",
      "Any fee is set in the agreement with that business. The site has no single price list, and the product does not take a commission out of the system.",
    ],
  },
  ru: {
    heading: "Оператор",
    paragraphs: [
      "Сервис называется Rota. Это инструмент графика, ограничений, явки и сообщений для бизнеса и его сотрудников.",
      "По этим документам пишите на rota.ai.schedule@gmail.com.",
      "Зарегистрированное имя, адрес и номер компании указаны в договоре с каждым бизнесом. На этой странице их не выдумывают.",
      "Плата, если она есть, задаётся договором с бизнесом. На сайте нет единого прайса, и сервис не удерживает комиссию из системы.",
    ],
  },
};

const DOCUMENTS: Record<LegalPageId, Record<Lang, { title: string; sections: LegalSection[] }>> = {
  privacy: {
    he: {
      title: "מדיניות פרטיות",
      sections: [
        {
          heading: "מה נאסף בחשבון",
          paragraphs: [
            "יצירת חשבון מבקשת אימייל וסיסמה, והסכמה לתנאים ולמדיניות הפרטיות. השם לא מוזן במסך הזה. לעובד השם נלקח מהכרטיס שכבר נשמר. לבעל עסק השם נלקח מהאישור שנתן מנהל המערכת.",
            "הסיסמה נשמרת מוצפנת אצל Supabase, ספק ההתחברות, ולא כטקסט אצל Rota.",
            "לפני הכניסה הראשונה יכול להישלח אימייל לאישור הכתובת. זו הודעת שירות, לא דיוור שיווקי.",
          ],
        },
        {
          heading: "למה הנתונים נשמרים",
          paragraphs: [
            "הנתונים נשמרים כדי להפעיל את החשבון, את הסידור, את האילוצים, את הנוכחות, את ההודעות ואת הדוחות של העסק.",
            "העסק שמכניס פרטים על עובדים הוא זה שמחליט מה למלא, והוא אחראי כלפי העובדים שלו. Rota מפעילה את המערכת שעליה הנתונים נשמרים.",
          ],
        },
        {
          heading: "מה העסק מזין על אנשים",
          paragraphs: [
            "כדי לסדר משמרות נשמרים שם, טלפון, אימייל לכניסה, תפקיד, זמינות, שיבוצים, היעדרויות, מסמכים, הודעות עבודה, והחתמות כניסה ויציאה.",
            "כרטיס אישי עם תעודת זהות, תאריך לידה, מגדר, מצב משפחתי, כתובת ופרטי בנק הוא רשות. השיבוץ לא קורא אותו. משאירים ריק כל שדה שהעסק לא צריך.",
            "Rota לא מעבירה כסף ולא משתמשת בפרטי הבנק לצורך גבייה.",
          ],
        },
        {
          heading: "מיקום",
          paragraphs: [
            "מיקום נדרש רק במסך הכניסה והיציאה, כדי לרשום את ההחתמה. אין מעקב ברקע ואין איסוף מיקום במסכים האחרים.",
          ],
        },
        {
          heading: "שירותים חיצוניים",
          paragraphs: [
            "Supabase שומר את ההתחברות ואת נתוני העסק. האתר עצמו מוגש דרך Vercel. הנתונים יכולים להיות מעובדים מחוץ לישראל. זה נדרש כדי שהמערכת תעבוד.",
            "גופני Heebo ו-Inter מגיעים עם היישום עצמו. הדפדפן לא פונה ל-Google כדי להציג אותם.",
            "לוח השנה העברי מחושב במכשיר, בלי פנייה החוצה.",
            "אם מנהל מבקש הסבר לשיבוץ או קריאה של הודעת אילוצים, ויש מפתח של OpenAI או Anthropic, נשלחים אליהם הטקסט של הבקשה, שם העובד והמשמרת. בלי מפתח הבקשה נשארת בשרת. אין ערכת פרסום, ניתוח תנועה או מעקב שגיאות.",
          ],
        },
        {
          heading: "דיוור",
          paragraphs: [
            "אין רשימת דיוור ואין דוא״ל שיווקי, ולכן אין קישור להסרה מרשימה. הודעות בתוך המערכת הן הודעות עבודה מהמעסיק, לא עלון.",
          ],
        },
        {
          heading: "כמה זמן",
          paragraphs: [
            "הנתונים נשמרים כל עוד חשבון העסק פעיל, אלא אם החוזה עם העסק קובע אחרת.",
            "מחיקת העסק מוחקת את האתרים, הסידורים, העובדים, המסמכים וההחתמות שלו.",
          ],
        },
        {
          heading: "זכויות",
          paragraphs: [
            "אפשר לבקש לעיין בנתונים, לתקן אותם או לבקש מחיקה, בכתובת rota.ai.schedule@gmail.com.",
            "עובד ששואל על פרטים שהעסק הזין פונה קודם לעסק. העסק הוא זה שהחליט מה לשמור עליו.",
          ],
        },
        {
          heading: "מחיקה",
          paragraphs: [
            "בהגדרות יש מחיקת נתונים. בעל העסק יכול למחוק את העסק: אתרים, סידורים, עובדים, מסמכים והחתמות.",
            "מי שאינו הבעלים היחיד יכול למחוק את הכניסה שלו. הרשומה שהעסק שמר נשארת עד שמנהל מוחק את העובד ממסך הניהול.",
          ],
        },
        {
          heading: "גיל",
          paragraphs: [
            "חשבון חדש מיועד לבני 18 ומעלה, למי שפותח עסק. Rota אינה מיועדת לילדים. עובד יכול להיות צעיר יותר. תאריך לידה, אם ממלאים אותו, הוא שדה רשות של העסק ולא שער גיל.",
          ],
        },
      ],
    },
    en: {
      title: "Privacy policy",
      sections: [
        {
          heading: "Account",
          paragraphs: [
            "Creating an account asks for an email and a password, and for agreement to these terms and the privacy policy. The name is not typed on that screen. For an employee it is taken from the card already saved. For a business owner it is taken from the approval the system admin entered.",
            "The password is stored encrypted by Supabase, the sign-in provider, not as plain text in Rota.",
            "Before the first sign-in, a message may be sent to confirm the address. That is a service message, not marketing mail.",
          ],
        },
        {
          heading: "Why the data is kept",
          paragraphs: [
            "The data is kept to run the account, the schedule, the constraints, attendance, messages, and the business reports.",
            "The business that enters details about workers decides what to fill in, and it is responsible toward its workers. Rota runs the system where that data is stored.",
          ],
        },
        {
          heading: "What a business enters about people",
          paragraphs: [
            "Scheduling stores a name, phone, sign-in email, role, availability, assignments, absences, documents, work messages, and clock punches.",
            "The personal card, with identity number, date of birth, gender, marital status, address, and bank details, is optional. Scheduling does not read it. Leave blank anything the business does not need.",
            "Rota does not move money and does not use bank details to collect a fee.",
          ],
        },
        {
          heading: "Location",
          paragraphs: [
            "Location is requested only on the clock-in screen, to record the punch. There is no background tracking and no location collection on other screens.",
          ],
        },
        {
          heading: "Outside services",
          paragraphs: [
            "Supabase stores sign-in and the business data. The site itself is served through Vercel. Data may be processed outside Israel. The product needs that to run.",
            "The Heebo and Inter fonts ship with the app. The browser does not call Google to show them.",
            "The Hebrew calendar is calculated on the device, with no outside call.",
            "If a manager asks for a scheduling explanation or a reading of an availability note, and an OpenAI or Anthropic key is configured, that request text, the employee name, and the shift are sent there. Without a key, the request stays on the server. There is no advertising kit, traffic analytics, or error tracker.",
          ],
        },
        {
          heading: "Mail",
          paragraphs: [
            "There is no mailing list and no marketing email, so there is no unsubscribe link. Messages inside the product are work messages from the employer, not a newsletter.",
          ],
        },
        {
          heading: "How long",
          paragraphs: [
            "The data is kept while the business account is active, unless the agreement with that business says otherwise.",
            "Deleting the business deletes its sites, schedules, people, documents, and punches.",
          ],
        },
        {
          heading: "Rights",
          paragraphs: [
            "A request to see data, correct it, or ask for deletion can be sent to rota.ai.schedule@gmail.com.",
            "A worker who asks about details the business entered should start with the business. The business decided what to keep.",
          ],
        },
        {
          heading: "Deletion",
          paragraphs: [
            "Settings includes data deletion. The business owner can delete the business: sites, schedules, people, documents, and punches.",
            "Someone who is not the only owner can delete their own sign-in. The record the business kept stays until a manager deletes that person from the team screen.",
          ],
        },
        {
          heading: "Age",
          paragraphs: [
            "A new account is for someone 18 or older who is opening a business. Rota is not for children. A worker can be younger. A date of birth, if filled in, is an optional business field, not an age gate.",
          ],
        },
      ],
    },
    ru: {
      title: "Политика конфиденциальности",
      sections: [
        {
          heading: "Учётная запись",
          paragraphs: [
            "Для учётной записи нужны почта и пароль, и согласие с условиями и политикой конфиденциальности. Имя на этом экране не вводят. У сотрудника имя берётся из уже сохранённой карточки. У владельца бизнеса имя берётся из одобрения, которое ввёл администратор системы.",
            "Пароль хранится у Supabase, службы входа, в зашифрованном виде, а не открытым текстом в Rota.",
            "Перед первым входом может прийти письмо для подтверждения адреса. Это служебное письмо, не реклама.",
          ],
        },
        {
          heading: "Зачем данные хранятся",
          paragraphs: [
            "Данные хранятся, чтобы работали учётная запись, график, ограничения, явка, сообщения и отчёты бизнеса.",
            "Бизнес, который вводит сведения о работниках, решает, что заполнять, и отвечает перед своими работниками. Rota ведёт систему, в которой эти данные хранятся.",
          ],
        },
        {
          heading: "Что бизнес вводит о людях",
          paragraphs: [
            "Для графика хранятся имя, телефон, почта для входа, роль, доступность, назначения, отсутствия, документы, рабочие сообщения и отметки входа и выхода.",
            "Личная карточка с номером документа, датой рождения, полом, семейным положением, адресом и банком необязательна. График её не читает. Пустым оставляют всё, что бизнесу не нужно.",
            "Rota не переводит деньги и не использует банковские данные для получения платы.",
          ],
        },
        {
          heading: "Местоположение",
          paragraphs: [
            "Местоположение запрашивается только на экране отметки, чтобы записать её. Фонового слежения нет, и на других экранах местоположение не собирается.",
          ],
        },
        {
          heading: "Внешние службы",
          paragraphs: [
            "Supabase хранит вход и данные бизнеса. Сам сайт отдаёт Vercel. Данные могут обрабатываться за пределами Израиля. Без этого продукт не работает.",
            "Шрифты Heebo и Inter поставляются с приложением. Браузер не обращается к Google, чтобы показать их.",
            "Еврейский календарь считается на устройстве, без внешнего запроса.",
            "Если руководитель просит объяснение графика или чтение заметки о доступности и задан ключ OpenAI или Anthropic, туда уходят текст запроса, имя сотрудника и смена. Без ключа запрос остаётся на сервере. Рекламного набора, аналитики трафика и слежения за ошибками нет.",
          ],
        },
        {
          heading: "Почта",
          paragraphs: [
            "Списка рассылки и рекламных писем нет, поэтому нет ссылки на отписку. Сообщения внутри продукта — рабочие сообщения работодателя, не рассылка.",
          ],
        },
        {
          heading: "Срок",
          paragraphs: [
            "Данные хранятся, пока учётная запись бизнеса активна, если договор с бизнесом не говорит иначе.",
            "Удаление бизнеса удаляет его площадки, графики, людей, документы и отметки.",
          ],
        },
        {
          heading: "Права",
          paragraphs: [
            "Попросить посмотреть данные, исправить их или удалить можно по адресу rota.ai.schedule@gmail.com.",
            "Работник, который спрашивает о сведениях, введённых бизнесом, сначала обращается к бизнесу. Бизнес решил, что хранить.",
          ],
        },
        {
          heading: "Удаление",
          paragraphs: [
            "В настройках есть удаление данных. Владелец бизнеса может удалить бизнес: площадки, графики, людей, документы и отметки.",
            "Тот, кто не единственный владелец, может удалить свой вход. Запись, которую сохранил бизнес, остаётся, пока руководитель не удалит человека с экрана команды.",
          ],
        },
        {
          heading: "Возраст",
          paragraphs: [
            "Новая учётная запись для человека от 18 лет, который открывает бизнес. Rota не для детей. Сотрудник может быть моложе. Дата рождения, если её заполнили, — необязательное поле бизнеса, а не проверка возраста.",
          ],
        },
      ],
    },
  },
  terms: {
    he: {
      title: "תנאי שימוש",
      sections: [
        {
          heading: "השירות",
          paragraphs: [
            "Rota מסדרת משמרות, אילוצים, נוכחות והודעות לעסק ולעובדים שלו. החשבון נפתח רק למייל שאושר, עם הסכמה לתנאים האלה ולמדיניות הפרטיות, והצהרה שפותחים את החשבון בגיל 18 או יותר.",
          ],
        },
        {
          heading: "אחריות העסק",
          paragraphs: [
            "בעל החשבון הוא שמכניס נתונים על אנשים. עליו לוודא שיש לו בסיס להחזיק את הנתונים האלה.",
            "השיבוץ הוא כלי. החובות כלפי העובדים נשארות על העסק.",
          ],
        },
        {
          heading: "תשלום",
          paragraphs: [
            "אין מחירון אחיד באתר. הסכום, התקופה ומה כלול בהם נקבעים בחוזה עם כל עסק, ויכולים להשתנות מחוזה לחוזה.",
            "האתר לא גובה כרטיס אשראי בעצמו. תשלום, אם סוכם, נעשה לפי החוזה ולא מוסתר במסך מאוחר.",
            "החזר, זיכוי או ביטול נקבעים באותו חוזה. הפירוט נמצא במדיניות ההחזרים.",
          ],
        },
        {
          heading: "מה אין כאן",
          paragraphs: [
            "אין ביקורות של לקוחות, אין דירוגים ואין הבטחה לתוצאה מסוימת.",
          ],
        },
      ],
    },
    en: {
      title: "Terms of service",
      sections: [
        {
          heading: "The service",
          paragraphs: [
            "Rota schedules shifts, constraints, attendance, and messages for a business and its staff. An account opens only for an approved email, with agreement to these terms and the privacy policy, and a statement that the person opening it is 18 or older.",
          ],
        },
        {
          heading: "The business",
          paragraphs: [
            "The account owner is the one who enters data about people. They need a basis for holding that data.",
            "Scheduling is a tool. Duties toward workers stay with the business.",
          ],
        },
        {
          heading: "Payment",
          paragraphs: [
            "The site has no single price list. The amount, the period, and what they include are set in the agreement with each business, and can differ from contract to contract.",
            "The site does not charge a card by itself. If a payment was agreed, it follows the contract and is not hidden on a later screen.",
            "A refund, a credit, or a cancellation is set in that same agreement. The detail is in the refund policy.",
          ],
        },
        {
          heading: "What is not here",
          paragraphs: [
            "There are no customer reviews, no ratings, and no promise of a particular result.",
          ],
        },
      ],
    },
    ru: {
      title: "Условия использования",
      sections: [
        {
          heading: "Сервис",
          paragraphs: [
            "Rota ведёт смены, ограничения, явку и сообщения для бизнеса и его сотрудников. Учётная запись открывается только для одобренной почты, с согласием на эти условия и политику конфиденциальности и с заявлением, что её открывает человек от 18 лет.",
          ],
        },
        {
          heading: "Бизнес",
          paragraphs: [
            "Данные о людях вводит владелец учётной записи. Ему нужно основание, чтобы хранить эти данные.",
            "График — инструмент. Обязанности перед работниками остаются на бизнесе.",
          ],
        },
        {
          heading: "Оплата",
          paragraphs: [
            "На сайте нет единого прайса. Сумма, срок и то, что в них входит, задаются договором с каждым бизнесом и могут отличаться от договора к договору.",
            "Сайт сам не списывает карту. Если оплата согласована, она идёт по договору и не прячется на позднем экране.",
            "Возврат, зачёт или отмена задаются тем же договором. Подробности в политике возврата.",
          ],
        },
        {
          heading: "Чего здесь нет",
          paragraphs: [
            "Нет отзывов клиентов, нет оценок и нет обещания определённого результата.",
          ],
        },
      ],
    },
  },
  refund: {
    he: {
      title: "מדיניות החזרים",
      sections: [
        {
          heading: "איך נקבע תשלום",
          paragraphs: [
            "אין מחירון אחיד באתר. הסכום, התקופה ומה כלול בהם נקבעים בחוזה עם כל עסק, ויכולים להשתנות מחוזה לחוזה.",
            "האתר לא גובה כרטיס אשראי בעצמו. אין מסך תשלום שמציג מחיר רק בסוף.",
          ],
        },
        {
          heading: "החזר וביטול",
          paragraphs: [
            "החזר, זיכוי או ביטול נקבעים בחוזה עם העסק. מה שאפשר לקבל בחזרה, ומתי, כתוב שם.",
            "אם החוזה שותק, כותבים אל rota.ai.schedule@gmail.com לפני שמניחים שיש החזר או שאין החזר.",
            "מחיקת עסק או כניסה מתוך ההגדרות סוגרת את הגישה לנתונים. היא לא מחליפה את תנאי ההחזר שבחוזה.",
          ],
        },
      ],
    },
    en: {
      title: "Refund policy",
      sections: [
        {
          heading: "How a fee is set",
          paragraphs: [
            "The site has no single price list. The amount, the period, and what they include are set in the agreement with each business, and can differ from contract to contract.",
            "The site does not charge a card by itself. There is no payment screen that shows a price only at the end.",
          ],
        },
        {
          heading: "Refund and cancellation",
          paragraphs: [
            "A refund, a credit, or a cancellation is set in the agreement with the business. What can come back, and when, is written there.",
            "If the agreement is silent, write to rota.ai.schedule@gmail.com before assuming there is a refund or that there is none.",
            "Deleting a business or a sign-in from settings closes access to the data. It does not replace the refund terms in the agreement.",
          ],
        },
      ],
    },
    ru: {
      title: "Политика возврата",
      sections: [
        {
          heading: "Как задаётся плата",
          paragraphs: [
            "На сайте нет единого прайса. Сумма, срок и то, что в них входит, задаются договором с каждым бизнесом и могут отличаться от договора к договору.",
            "Сайт сам не списывает карту. Нет экрана оплаты, который показывает цену только в конце.",
          ],
        },
        {
          heading: "Возврат и отмена",
          paragraphs: [
            "Возврат, зачёт или отмена задаются договором с бизнесом. Что можно вернуть и когда написано там.",
            "Если договор молчит, пишите на rota.ai.schedule@gmail.com до того, как решить, что возврат есть или что его нет.",
            "Удаление бизнеса или входа из настроек закрывает доступ к данным. Оно не заменяет условия возврата в договоре.",
          ],
        },
      ],
    },
  },
  cookies: {
    he: {
      title: "מדיניות עוגיות",
      sections: [
        {
          heading: "מה נשמר במכשיר",
          paragraphs: [
            "ההתחברות נשמרת בדפדפן כדי שלא תצטרכו להקליד סיסמה בכל מסך. זה הכרחי לשימוש. אם בוחרים לזכור את המייל, גם הוא נשמר במכשיר.",
            "ערכת הנושא ולוחות השנה נשמרים במכשיר. השפה לא נשמרת.",
            "אחרי שסוגרים את ההודעה על האחסון, נשמר סימן מקומי כדי שההודעה לא תחזור. אין באפשרות הזו אישור או סירוב למעקב, כי אין מעקב.",
          ],
        },
        {
          heading: "מה לא נשמר",
          paragraphs: [
            "אין עוגיות פרסום, אין רשת חברתית ואין מדידת תנועה של צד שלישי.",
            "ההודעה בתחתית המסך מסבירה את זה. היא לא חוסמת את הכניסה ולא מבקשת הסכמה לדבר שהמערכת לא עושה.",
          ],
        },
      ],
    },
    en: {
      title: "Cookie policy",
      sections: [
        {
          heading: "What is stored on the device",
          paragraphs: [
            "Sign-in is stored in the browser so a password is not typed on every screen. The product needs that. If the email is chosen to be remembered, it is stored on the device too.",
            "The theme and calendars are stored on the device. The language is not stored.",
            "After the storage notice is closed, a local mark is kept so the notice does not return. That choice is not consent or refusal of tracking, because there is no tracking.",
          ],
        },
        {
          heading: "What is not stored",
          paragraphs: [
            "There are no advertising cookies, no social network, and no third-party traffic measurement.",
            "The notice at the bottom of the screen says this. It does not block sign-in and does not ask for consent to something the product does not do.",
          ],
        },
      ],
    },
    ru: {
      title: "Политика cookie",
      sections: [
        {
          heading: "Что хранится на устройстве",
          paragraphs: [
            "Вход хранится в браузере, чтобы не вводить пароль на каждом экране. Продукту это нужно. Если почту выбирают запомнить, она тоже хранится на устройстве.",
            "На устройстве хранятся тема и календари. Язык не хранится.",
            "После закрытия заметки о хранении остаётся местная отметка, чтобы заметка не вернулась. Это не согласие и не отказ от слежения, потому что слежения нет.",
          ],
        },
        {
          heading: "Чего нет",
          paragraphs: [
            "Нет рекламных cookie, нет социальной сети и нет стороннего измерения трафика.",
            "Заметка внизу экрана говорит об этом. Она не блокирует вход и не просит согласие на то, чего продукт не делает.",
          ],
        },
      ],
    },
  },
};

export function isLegalPage(value: string): value is LegalPageId {
  return (LEGAL_PAGES as readonly string[]).includes(value);
}

export function legalLang(value: string | undefined): Lang {
  return value === "en" || value === "ru" ? value : "he";
}

export function legalDocument(page: LegalPageId, lang: Lang): LegalDocument {
  const document = DOCUMENTS[page][lang];
  return {
    title: document.title,
    updated: UPDATED[lang],
    sections: [...document.sections, IMPRINT[lang]],
  };
}
