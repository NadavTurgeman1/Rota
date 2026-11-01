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
  he: "1 בנובמבר 2026",
  en: "1 November 2026",
  ru: "1 ноября 2026",
};

const IMPRINT: Record<Lang, LegalSection> = {
  he: {
    heading: "פרטי המפעיל",
    paragraphs: [
      "השירות נקרא Rota. זה כלי לסידור משמרות של עסק אחד ושל העובדים שלו.",
      "שם עוסק רשום, כתובת ומספר חברה לא הוגדרו במערכת, ולכן הם לא מוצגים. לא הומצאו כאן פרטים כאלה.",
      "השם שהעובדים רואים הוא שם העסק שבעל החשבון הקליד. אין תשלום, אין מנוי ואין עמלה.",
    ],
  },
  en: {
    heading: "Operator",
    paragraphs: [
      "The service is called Rota. It is a shift schedule for one business and its staff.",
      "A registered business name, address, and company number are not configured, so they are not shown. None were invented here.",
      "The name staff see is the business name the account owner typed. There is no fee, subscription, or commission.",
    ],
  },
  ru: {
    heading: "Оператор",
    paragraphs: [
      "Сервис называется Rota. Это график смен одного бизнеса и его сотрудников.",
      "Зарегистрированное имя, адрес и номер компании не заданы, поэтому они не показаны. Здесь их не выдумывали.",
      "Имя, которое видят сотрудники, вводит владелец учётной записи. Платы, подписки и комиссии нет.",
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
            "יצירת חשבון מבקשת שם, אימייל וסיסמה. הסיסמה נשמרת אצל Supabase, ספק ההתחברות, ולא כטקסט אצל Rota.",
            "לא מבקשים תאריך לידה, תעודת זהות או כתובת כדי לפתוח חשבון.",
          ],
        },
        {
          heading: "מה העסק מזין על אנשים",
          paragraphs: [
            "כדי לסדר משמרות נשמרים שם, טלפון, אימייל לכניסה, תפקיד, זמינות, שיבוצים, היעדרויות, מסמכים, הודעות עבודה, והחתמות כניסה ויציאה.",
            "כרטיס אישי עם תעודת זהות, תאריך לידה, מגדר, מצב משפחתי, כתובת ופרטי בנק הוא רשות. השיבוץ לא קורא אותו. משאירים ריק כל שדה שהעסק לא צריך.",
            "Rota לא מעבירה כסף ולא משתמשת בפרטי הבנק.",
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
            "Supabase שומר את ההתחברות ואת נתוני העסק. זה נדרש כדי שהמערכת תעבוד.",
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
            "Creating an account asks for a name, email, and password. The password is stored by Supabase, the sign-in provider, not as plain text in Rota.",
            "A date of birth, identity number, or address is not required to open an account.",
          ],
        },
        {
          heading: "What a business enters about people",
          paragraphs: [
            "Scheduling stores a name, phone, sign-in email, role, availability, assignments, absences, documents, work messages, and clock punches.",
            "The personal card, with identity number, date of birth, gender, marital status, address, and bank details, is optional. Scheduling does not read it. Leave blank anything the business does not need.",
            "Rota does not move money and does not use bank details.",
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
            "Supabase stores sign-in and the business data. The product needs that to run.",
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
            "Для учётной записи нужны имя, почта и пароль. Пароль хранит Supabase, служба входа, а не Rota в открытом виде.",
            "Дата рождения, номер документа и адрес для открытия учётной записи не нужны.",
          ],
        },
        {
          heading: "Что бизнес вводит о людях",
          paragraphs: [
            "Для графика хранятся имя, телефон, почта для входа, роль, доступность, назначения, отсутствия, документы, рабочие сообщения и отметки входа и выхода.",
            "Личная карточка с номером документа, датой рождения, полом, семейным положением, адресом и банком необязательна. График её не читает. Пустым оставляют всё, что бизнесу не нужно.",
            "Rota не переводит деньги и не использует банковские данные.",
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
            "Supabase хранит вход и данные бизнеса. Без этого продукт не работает.",
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
            "Rota מסדרת משמרות לעסק ולעובדים שלו. החשבון נפתח רק למייל שאושר, עם הסכמה לתנאים האלה ולמדיניות הפרטיות, והצהרה שפותחים את החשבון בגיל 18 או יותר.",
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
          heading: "כסף",
          paragraphs: [
            "אין מחיר, אין מנוי ואין עמלה. אם יתווסף תשלום, הוא יוצג לפני החיוב, ובמדיניות ההחזרים ייכתב מה אפשר לקבל בחזרה.",
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
            "Rota schedules shifts for a business and its staff. An account opens only for an approved email, with agreement to these terms and the privacy policy, and a statement that the person opening it is 18 or older.",
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
          heading: "Money",
          paragraphs: [
            "There is no price, subscription, or commission. If a charge is added, it will be shown before anyone pays, and the refund policy will say what can be returned.",
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
            "Rota составляет смены для бизнеса и его сотрудников. Учётная запись открывается только для одобренной почты, с согласием на эти условия и политику конфиденциальности и с заявлением, что её открывает человек от 18 лет.",
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
          heading: "Деньги",
          paragraphs: [
            "Цены, подписки и комиссии нет. Если появится плата, её покажут до списания, а в политике возврата будет написано, что можно вернуть.",
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
          heading: "אין חיוב",
          paragraphs: [
            "Rota לא גובה כסף, לא מוכרת מנוי ולא גובה עמלה. אין מה להחזיר.",
            "אין מסך תשלום ואין מחיר שמוסתר בשלב מאוחר יותר.",
          ],
        },
        {
          heading: "אם זה ישתנה",
          paragraphs: [
            "חיוב לא יתחיל בלי שמחיר יוצג לפני כן, והעמוד הזה יעודכן באותו זמן.",
          ],
        },
      ],
    },
    en: {
      title: "Refund policy",
      sections: [
        {
          heading: "No charge",
          paragraphs: [
            "Rota does not take payment, sell a subscription, or charge a commission. There is nothing to refund.",
            "There is no payment screen and no price that appears only at a later step.",
          ],
        },
        {
          heading: "If that changes",
          paragraphs: [
            "A charge will not start unless the price is shown first, and this page will be updated at the same time.",
          ],
        },
      ],
    },
    ru: {
      title: "Политика возврата",
      sections: [
        {
          heading: "Списания нет",
          paragraphs: [
            "Rota не принимает оплату, не продаёт подписку и не берёт комиссию. Возвращать нечего.",
            "Экрана оплаты нет, и цена не появляется на позднем шаге.",
          ],
        },
        {
          heading: "Если это изменится",
          paragraphs: [
            "Списание не начнётся, пока цену не покажут заранее, и эта страница обновится тогда же.",
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
            "ההתחברות נשמרת בדפדפן כדי שלא תצטרכו להקליד סיסמה בכל מסך. זה הכרחי לשימוש.",
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
            "Sign-in is stored in the browser so a password is not typed on every screen. The product needs that.",
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
            "Вход хранится в браузере, чтобы не вводить пароль на каждом экране. Продукту это нужно.",
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
