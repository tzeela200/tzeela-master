# תוכנית ביצוע — דשבורד המאסטר

**אפיון:** `docs/specs/2026-10-25-master-dashboard.md`
**מערכת:** `tzeela-master` · Next.js 15.5 · React 19 · Tailwind 4 · Supabase
**סך הכול:** 7 שלבים · 34 משימות · **כ-28 שעות עבודה**

---

## חלק א' — מה בדקתי לפני שכתבתי

ביקשת שאוודא ארבעה דברים. אלה הממצאים בפועל, מהקוד.

### 1. עיצוב — קיים ומלא. לא נוגעים בו.

| מה | מה יש |
|---|---|
| צבע מותג | `--c-primary: #cc0c6c` (ורוד) · `--c-accent: #ec5ba4` |
| סט טוקנים | צבעים, רדיוסים (`--r-card: 18px`), צללים |
| גופן | Heebo, נטען דרך `next/font` |
| כיווניות | `<html lang="he" dir="rtl">` ב-`app/layout.tsx` |

**כל מסך חדש משתמש בטוקנים האלה.** לא נכנס צבע חדש ולא גופן חדש.

### 2. רכיבים משותפים — 28 קיימים, וחלק גדול מהם בדיוק מה שצריך

| רכיב בנישה (מתוך 13) | רכיב קיים | מצב |
|---|---|---|
| 7 · גרירת קבצים | `DropOverlay.tsx` + `useFileDrop.ts` | **קיים — שימוש חוזר** |
| 9 · קלט קולי | `workspace/VoiceButton.tsx` | **קיים — שימוש חוזר** |
| 11 · שדה פנייה | `workspace/Composer.tsx` | **קיים — שימוש חוזר** |
| 12 · תוצרים | `outputs/OutputCard.tsx` | **קיים — שימוש חוזר** |
| מצב ריק | `EmptyState.tsx` | **קיים** |
| טעינה | `Skeleton.tsx` | **קיים** |
| הודעות | `Toast.tsx` | **קיים** |
| אישור פעולה | `ConfirmDialog.tsx` | **קיים — ישמש לשער "צאלה מאשרת"** |

**כלומר ארבעה מתוך 13 הרכיבים כבר בנויים.** נשאר לחבר אותם לנישה.

### 3. פעולות — מה המערכת יודעת לעשות היום

| פעולה | קיימת? | איפה |
|---|---|---|
| שיחה עם סוכן | כן | `/api/chat` |
| קריאת PDF / DOCX / XLSX | כן | `/api/extract` |
| שמירת תוצר | כן | `/api/outputs` |
| ייבוא הרג'יסטרי | כן | `/api/admin/import-registry` |
| **הרצת סקיל או חבילה** | **לא** | — |
| **שמירת מסמך לנישה** | **לא** | — |
| **שמירת הערה או החלטה** | **לא** | — |
| **רישום הרצה ועלות** | **לא** | — |

### 4. זיכרון והקשר — וזה הממצא החשוב ביותר

בקוד כתוב במפורש, ב-`lib/ai/context.ts`:

> *"ההקשר היחיד שנשלח למודל הוא מערך ההודעות של השיחה הנוכחית. **שום דבר משיחות אחרות,
> מסוכנים אחרים או מתוצרים לא מועבר לכאן לעולם.**"*

| | מצב |
|---|---|
| **הקשר בתוך שיחה** | ✅ יש. הודעות + קבצים מצורפים |
| **זיכרון בין שיחות** | ❌ **אין** |
| **המודל רואה מסמכים שהעלית** | ❌ לא |
| **המודל רואה החלטות שקיבלת** | ❌ לא |
| **המודל רואה את 481 הסקילים** | ❌ לא |
| חריג יחיד | סוכן-על קורא `agent_outputs.summary_text` לפי קטגוריה |

**זו הסיבה האמיתית שהייעוץ לא עובד לך.** לא כי הסוכנים גרועים — אלא כי בכל פעם שאת
שואלת, המערכת מתחילה מדף ריק. היא לא יודעת מה יש לך.

**שלב 5 בתוכנית מתקן בדיוק את זה.**

---

## חלק ב' — מפת השלבים

| שלב | מה | זמן | למה זה מקדם את הדשבורד |
|---|---|---|---|
| **0** | תשתית נתונים | 1.5ש | בלי זה אין איפה לשמור כלום |
| **1** | חדר הנישה — 13 הרכיבים | 8ש | הלב. פה את עובדת |
| **2** | מסך הבית — הריבועים | 3ש | הכניסה. אחרי שיש מה להראות |
| **3** | חבילות | 4ש | הופך סקילים בודדים לתהליך |
| **4** | פנקס הרצות + שער אישור | 4.5ש | הופך כפתור למשהו שבאמת רץ ונרשם |
| **5** | **זיכרון הנישה** | 4ש | **המערכת מתחילה לדעת מה יש לך** |
| **6** | מסך "איזה סקיל מתאים" | 3ש | הייעוץ שלא עבד |

---

# שלב 0 — תשתית נתונים · 1.5 שעות

### משימה 0.1 — מיגרציה `0005_dashboard.sql`

**קובץ:** `supabase/migrations/0005_dashboard.sql`

**מה הפעולה עושה:** יוצרת 9 טבלאות חדשות, מוסיפה את שדות המשימה, ומתקינה חיפוש עברי.

**אומת במסד החי לפני הכתיבה:**

| בדיקה | תוצאה | מסקנה |
|---|---|---|
| קידוד | UTF8 | תקין, עברית לא תישבר |
| אזור זמן | **UTC** | **לא משנים.** האפליקציה כבר מעצבת ב-`Asia/Jerusalem` בצד הדפדפן, וכל העמודות `timestamptz`. שינוי במערכת חיה בלי צורך = סיכון מיותר. כל שאילתה חדשה תמיר מפורשות |
| PostgreSQL | 17.11 | — |
| `pg_trgm` · `unaccent` | **חסרות** | מתקינים. בלעדיהן אין חיפוש בעברית |
| סכימת ההרחבות | `extensions` | כל קריאה תהיה מוסמכת בסכימה |
| הרשאות | 14 טבלאות, כולן `owner_all` עם `is_owner()` | מתאימים בדיוק לתבנית |
| `agent_niches` | קיימת (`agent_id`, `niche_id`) | "מי עובד" כבר קיים לסוכנים — מרחיבים |

```sql
-- ---------------------------------------------------------------
-- חיפוש בעברית
-- ---------------------------------------------------------------
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- עוטף IMMUTABLE. בלעדיו אי אפשר להשתמש ב-unaccent בעמודה מחושבת.
create or replace function public.f_unaccent(text)
returns text language sql immutable parallel safe strict as
$$ select extensions.unaccent('extensions.unaccent', $1) $$;

-- ---------------------------------------------------------------
-- מי עובד, מי עושה, מי פועל
-- ---------------------------------------------------------------
create table if not exists public.niche_performers (
  id         uuid primary key default gen_random_uuid(),
  niche_id   uuid not null references public.niches (id) on delete cascade,
  kind       text not null check (kind in ('agent','claude-code','script','person','service')),
  agent_id   uuid null references public.agents (id) on delete set null,
  label      text not null default '',   -- "סוכן מעמ" · "Claude Code" · "צאלה" · "Apify"
  role_text  text not null default '',   -- מה הוא עושה בנישה הזאת
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists niche_performers_niche_idx
  on public.niche_performers (niche_id, is_active);

-- מסמכים ששייכים לנישה
create table if not exists public.niche_documents (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  name        text not null,
  file_path   text not null,
  kind        text not null default '',
  size_bytes  bigint not null default 0,
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists niche_documents_niche_idx
  on public.niche_documents (niche_id, created_at desc);

-- הערות, החלטות והזנות ידניות
create table if not exists public.niche_notes (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  kind        text not null default 'note',   -- note | decision
  body        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists niche_notes_niche_idx
  on public.niche_notes (niche_id, created_at desc);

-- קישורים למערכות חיות
create table if not exists public.niche_links (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  label       text not null,
  url         text not null,
  sort        int  not null default 0
);

-- שלב נוכחי ומפת דרכים
create table if not exists public.niche_status (
  niche_id     uuid primary key references public.niches (id) on delete cascade,
  done_text    text not null default '',
  doing_text   text not null default '',
  todo_text    text not null default '',
  health       text not null default 'unknown',  -- ok | warn | down | unknown
  checked_at   timestamptz null,
  updated_at   timestamptz not null default now()
);

-- חבילות
create table if not exists public.skill_packages (
  id          uuid primary key default gen_random_uuid(),
  name_he     text not null,
  description text not null default '',
  niche_id    uuid null references public.niches (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- סקיל בתוך חבילה: שלב, סדר, וחלופה
create table if not exists public.skill_package_items (
  id          uuid primary key default gen_random_uuid(),
  package_id  uuid not null references public.skill_packages (id) on delete cascade,
  skill_id    text not null references public.skills (id) on delete cascade,
  stage       int  not null default 1,          -- מספר השלב בשרשרת
  sort        int  not null default 0,          -- סדר בתוך השלב
  is_alternative boolean not null default false -- חלופה לסקיל אחר באותו שלב
);
create index if not exists skill_package_items_pkg_idx
  on public.skill_package_items (package_id, stage, sort);

-- פנקס ההרצות
create table if not exists public.runs (
  id            uuid primary key default gen_random_uuid(),
  niche_id      uuid null references public.niches (id) on delete set null,
  package_id    uuid null references public.skill_packages (id) on delete set null,
  skill_id      text null references public.skills (id) on delete set null,
  title         text not null default '',
  performer     text not null default '',   -- agent | claude-code | script | manual
  environment   text not null default '',   -- supabase | claude-code | in-app | cloud
  status        text not null default 'pending',
  -- pending | awaiting_approval | running | done | failed | cancelled
  estimate_text text not null default '',
  budget_cap    numeric null,
  cost          numeric null,
  output_text   text not null default '',
  output_path   text not null default '',
  channel       text not null default '',   -- ChatGPT | Claude Desktop | Claude Code | app
  error_text    text not null default '',
  started_at    timestamptz null,
  finished_at   timestamptz null,
  created_at    timestamptz not null default now()
);
create index if not exists runs_niche_idx on public.runs (niche_id, created_at desc);

-- צילומי מצב מכפתור הסנכרון
create table if not exists public.niche_snapshots (
  id          uuid primary key default gen_random_uuid(),
  niche_id    uuid not null references public.niches (id) on delete cascade,
  summary     text not null default '',
  docs_count  int not null default 0,
  tasks_done  int not null default 0,
  created_at  timestamptz not null default now()
);

-- 4 שדות תבנית המשימה שחסרים
alter table public.tasks add column if not exists performer      text not null default '';
alter table public.tasks add column if not exists prerequisites  text not null default '';
alter table public.tasks add column if not exists estimate_text  text not null default '';
alter table public.tasks add column if not exists budget_cap     numeric null;
alter table public.tasks add column if not exists deliverable    text not null default '';
alter table public.tasks add column if not exists needs_approval boolean not null default false;

-- ערוץ המקור ביומן
alter table public.activity_log add column if not exists channel text not null default '';
```

**התוצר הרצוי:** 8 טבלאות קיימות, `tasks` מחזיקה את כל 5 שדות התבנית.

**איך זה עוזר לך:** מהרגע הזה יש איפה לשמור מסמך, הערה, החלטה והרצה. בלי זה כל שאר
השלבים לא יכולים לעבוד.

- [ ] **צעד 1:** לכתוב את קובץ המיגרציה
- [ ] **צעד 2:** להריץ אותה מול `gxualbicmmmqnnkzlzmx` (אני מריץ, לא את)
- [ ] **צעד 3:** לאמת שכל 8 הטבלאות נוצרו ושב-`tasks` יש 6 עמודות חדשות
- [ ] **צעד 4:** `git add supabase/migrations/0005_dashboard.sql && git commit -m "feat: dashboard schema"`

### משימה 0.2 — טיפוסים ו-RLS · 20 דקות

**קבצים:** `lib/types.ts` · המשך `0005_dashboard.sql`

**מה:** להוסיף טיפוסי TypeScript לכל טבלה חדשה, ולהחיל RLS באותה מדיניות של הטבלאות
הקיימות (משתמשת מחוברת בלבד).

**התוצר:** אי אפשר לכתוב קוד ששובר את מבנה הנתונים, והנתונים מוגנים.

- [ ] **צעד 1:** לקרוא את מדיniות ה-RLS של `niches` ב-`0002` ולשכפל אותה ל-8 החדשות
- [ ] **צעד 2:** להוסיף את הטיפוסים ל-`lib/types.ts`
- [ ] **צעד 3:** `npm run build` — חייב לעבור
- [ ] **צעד 4:** commit

---

# שלב 1 — חדר הנישה · 8 שעות

**הקובץ המרכזי:** `app/(app)/niches/[id]/page.tsx` — היום 91 שורות.
**החלטה מבנית:** לא מנפחים אותו. כל אחת מארבע הקבוצות הופכת לרכיב נפרד תחת
`components/niches/room/`, והעמוד רק מרכיב אותם. כך כל קובץ נשאר קטן ומובן.

```
components/niches/room/
  NicheRoom.tsx          ← המעטפת, מרכיבה את ארבע הקבוצות
  StatusGroup.tsx        ← רכיבים 1-3
  AssetsGroup.tsx        ← רכיבים 4-5
  DeskGroup.tsx          ← רכיבים 6-10
  EngineGroup.tsx        ← רכיבים 11-13
```

### משימה 1.1 — מעטפת החדר · 45 דק'

**מה:** `NicheRoom.tsx` עם ארבע הקבוצות כאזורים, ושימוש ב-`PageHeader` הקיים.

**התוצר:** החדר נפתח, מציג ארבע כותרות קבוצה, וכל אזור מציג `EmptyState` זמני.

**איך זה עוזר:** מרגע זה יש שלד קבוע וזהה לכל נישה — וזה מה שביקשת: *"אותו מבנה בכל נישה"*.

**שימוש חוזר:** `PageHeader`, `EmptyState`, טוקני העיצוב.

- [ ] שלד `NicheRoom.tsx` עם ארבעה אזורים
- [ ] חיבור ב-`app/(app)/niches/[id]/page.tsx`
- [ ] בדיקה בדפדפן ב-360px ו-1280px
- [ ] commit

### משימה 1.2 — קבוצה 1: סטטוס, שלב וסנכרון · 1.5ש

**קבצים:** `components/niches/room/StatusGroup.tsx` · `app/api/niches/[id]/snapshot/route.ts`

**מה כל רכיב עושה:**

* **סטטוס תפעולי** — קורא מ-`niche_status.health` ומציג נורה. **מציג מצב, לא ערך**:
  "מפתח Morning מוגדר · נבדק 25/10 · תוקף עד 24/01/27". בלי המפתח עצמו.
* **שלב נוכחי** — שלוש עמודות מ-`done_text` / `doing_text` / `todo_text`, ניתנות לעריכה.
* **כפתור סנכרון** — סופר מסמכים שנוספו ומשימות שנסגרו מאז הצילום הקודם, כותב שורה
  ל-`niche_snapshots` ול-`activity_log`.

**התוצר הרצוי:** נכנסת לנישה ויודעת תוך שתי שניות אם משהו שבור ואיפה הדברים עומדים.

**איך זה עוזר:** זה מחליף את "לפתוח עשרה אתרים כדי לבדוק אם הכל עובד".

- [ ] `StatusGroup.tsx` — שלושת הרכיבים
- [ ] `POST /api/niches/[id]/snapshot`
- [ ] בדיקה: ללחוץ סנכרון, לוודא שנוצרה שורה בשתי הטבלאות
- [ ] commit

### משימה 1.3 — קבוצה 2: קישורים ומסמכים · 2ש

**קבצים:** `components/niches/room/AssetsGroup.tsx` · `app/api/niches/[id]/documents/route.ts`

**מה:** רשימת קישורים ניתנת לעריכה, ומאגר מסמכים אמיתי — העלאה ל-Storage, רשומה
ב-`niche_documents`, הורדה, מחיקה.

**התוצר הרצוי:** את גוררת אפיון או אקסל, והוא **נשאר שם** ושייך לנישה.

**איך זה עוזר:** זה הפער מספר 1 שדיווחת עליו — *"לא הצלחתי להעלות מסמכים"*. עד היום
קובץ נקרא בצ'אט ונעלם. מעכשיו הוא נשמר.

**שימוש חוזר:** `ATTACH_BUCKET` ו-`lib/files.ts` הקיימים · `/api/extract` לקריאת תוכן.

- [ ] CRUD קישורים
- [ ] העלאה ל-Storage + רשומה ב-`niche_documents`
- [ ] רשימה עם הורדה ומחיקה (עם `ConfirmDialog`)
- [ ] בדיקה: להעלות PDF, לרענן את הדף, לוודא שהוא עדיין שם
- [ ] commit

### משימה 1.4 — קבוצה 3: משימות · 1.5ש

**קבצים:** `components/niches/room/DeskGroup.tsx` · `components/tasks/TaskForm.tsx`

**מה:** רשימת משימות בשלוש עמודות — לביצוע · בבדיקה · ממתינות לאישור. טופס עם
**חמשת השדות** משלב 0.

**התוצר הרצוי:** כל משימה אומרת מי מבצע, מה צריך לפניה, כמה תעלה, מה התוצר ואיפה
יישמר, והאם היא צריכה אישור לפני יציאה החוצה.

- [ ] `TaskForm.tsx` עם 5 השדות
- [ ] שלוש העמודות לפי `status`
- [ ] בדיקה: ליצור משימה עם כל השדות, לוודא שנשמרה
- [ ] commit

### משימה 1.5 — קבוצה 3: גרירה, הערות וקול · 1ש

**מה:** חיבור שלושת הרכיבים **הקיימים** לנישה.

| רכיב | קיים ב | מה משתנה |
|---|---|---|
| גרירת קבצים | `DropOverlay` + `useFileDrop` | היעד הוא `niche_documents` במקום הצ'אט |
| קלט קולי | `workspace/VoiceButton` | התמלול נשמר כ-`niche_notes` |
| הערה ידנית | חדש, קטן | `niche_notes` עם `kind='note'` |

**התוצר הרצוי:** מהנייד, בלחיצה אחת, את מקליטה הערה והיא נשמרת בנישה הנכונה.

**איך זה עוזר:** זה הפער מספר 2 — *"לא הצלחתי לשמור נתונים"*.

- [ ] חיבור `useFileDrop` ל-`niche_documents`
- [ ] חיבור `VoiceButton` ל-`niche_notes`
- [ ] שדה הערה מהירה
- [ ] בדיקה בנייד (360px): להקליט הערה ולוודא שנשמרה
- [ ] commit

### משימה 1.6 — קבוצה 4: פנייה, תוצרים ויומן · 1.5ש

**קבצים:** `components/niches/room/EngineGroup.tsx`

**מה:** שדה פנייה פתוח (`Composer` הקיים) · תוצרים אחרונים (`OutputCard` הקיים) ·
יומן מקומי מ-`activity_log` מסונן לנישה · **קישור למחברת הסקילים**.

**התוצר הרצוי:** שואלת שאלה בלי לבחור סוכן, ורואה מה נעשה בנישה הזאת לאחרונה.

**שימוש חוזר:** `Composer`, `OutputCard`, `Markdown`.

- [ ] חיבור `Composer` עם `niche_id`
- [ ] רשימת תוצרים אחרונים
- [ ] יומן מקומי
- [ ] קישור למחברת: `https://notebook.google.com/notebook/800f5c98-054a-4242-9926-90ad21852da7`
- [ ] commit

### משימה 1.7 — שישה מצבי מסך · 45 דק'

**מה:** לכל אזור: טעינה (`Skeleton`) · ריק (`EmptyState`) · חלקי · מוכן · שגיאה · אין תוצאות.

**התוצר הרצוי:** נישת הסריקות, שאין בה כלום, תסביר מה חסר ומה הצעד הבא — **ולא תהיה מסך לבן.**

- [ ] שישה המצבים בכל אזור
- [ ] בדיקה על נישה ריקה
- [ ] commit

---

# שלב 2 — מסך הבית · 3 שעות

### משימה 2.1 — ריבועי הנישות · 1.5ש

**קבצים:** `components/home/NicheTiles.tsx` · `app/(app)/page.tsx` (132 שורות היום)

**מה:** ריבוע לכל נישה — שם, נורה, מספר משימות פתוחות, זמן שינוי אחרון.

**התוצר הרצוי:** פותחת את המאסטר ורואה הכל במבט אחד.

**שימוש חוזר:** `components/niches/NichesBoard.tsx` כבר מציג נישות — מרחיבים אותו.

- [ ] שאילתה שמביאה ספירות לכל נישה בקריאה אחת
- [ ] רשת ריבועים רספונסיבית (1 / 2 / 3 עמודות)
- [ ] בדיקה ב-360px, 768px, 1280px
- [ ] commit

### משימה 2.2 — מרכז משימות ופניות חמות · 1ש

**מה:** כל המשימות מכל הנישות, מסוננות לפי סטטוס · ורשימת מה שדורש מענה אישי.

**התוצר הרצוי:** רשימת "מה עליי לעשות היום" אחת, בלי להיכנס לכל נישה.

- [ ] טבלת משימות מאוחדת עם סינון
- [ ] אזור פניות חמות
- [ ] commit

### משימה 2.3 — יומן ראשי · 30 דק'

**מה:** `activity_log` מכל הנישות, כרונולוגי, עם **ערוץ המקור** (ChatGPT · Claude Desktop · Claude Code).

**התוצר הרצוי:** לראות מה קרה במערכת ואיפה זה בוצע.

- [ ] רשימה עם סינון לפי נישה וערוץ
- [ ] commit

---

# שלב 3 — חבילות · 4 שעות

### משימה 3.1 — רשימת חבילות · 1ש

**קבצים:** `app/(app)/packages/page.tsx` · `components/packages/PackageCard.tsx`

**מה:** רשימה, יצירה, מחיקה, שיוך לנישה.

**התוצר הרצוי:** רואה את כל החבילות שלך ומה כל אחת עושה.

- [ ] מסך רשימה + טופס יצירה
- [ ] commit

### משימה 3.2 — עורך החבילה · 2ש

**קבצים:** `components/packages/PackageEditor.tsx`

**מה:** הוספת סקילים מתוך 481, סידור לשלבים ממוספרים, סימון חלופות.

```
שלב 1   israeli-receipt-scanner    ⟋  il-invoice-organizer   ← חלופות
שלב 2   israeli-expense-categorizer
שלב 3   green-invoice              ⟋  israeli-bookkeeping-automation
שלב 4   israeli-e-invoice
שלב 5   israeli-vat-reporting
```

**התוצר הרצוי:** בונה חבילה כמו שתיארת — שלבים, סדר, וחלופות בתוך שלב.

- [ ] בוחר סקילים עם חיפוש מתוך 481
- [ ] סידור לשלבים
- [ ] סימון חלופה
- [ ] בדיקה: לבנות את חבילת המע"מ בחמשת השלבים
- [ ] commit

### משימה 3.3 — חבילת המע"מ כנתוני התחלה · 1ש

**קובץ:** `supabase/migrations/0006_seed_vat_package.sql`

**מה:** חבילת המע"מ נכנסת כנתון אמיתי, לא כדוגמה.

**התוצר הרצוי:** נכנסת למסך החבילות ויש שם כבר חבילה עובדת.

**הערה:** אם סקיל מהשרשרת לא קיים ברג'יסטרי — הוא יסומן "חסר" ולא יומצא.

- [ ] לבדוק אילו מחמשת הסקילים קיימים ב-`skills`
- [ ] seed של החבילה
- [ ] commit

---

# שלב 4 — פנקס הרצות ושער אישור · 4.5 שעות

### משימה 4.1 — מסך ארבע השאלות · 1.5ש

**קבצים:** `components/runs/RunPreflight.tsx`

**מה:** לפני כל הרצה — מי מבצע · כמה זמן · איפה רץ · מה יוצא ואיפה נשמר. אישור או ביטול.

**התוצר הרצוי:** שום דבר לא רץ בלי שראית מראש מה הולך לקרות וכמה זה יעלה.

**שימוש חוזר:** `ConfirmDialog`.

- [ ] הרכיב עם ארבעת השדות
- [ ] יוצר רשומה ב-`runs` עם `status='awaiting_approval'`
- [ ] commit

### משימה 4.2 — מנוע ההרצה · 2ש

**קבצים:** `app/api/runs/route.ts` · `lib/runs/executor.ts`

**מה:** מריץ לפי `environment`, ורושם הכל.

| סביבה | מי מבצע |
|---|---|
| `in-app` | פיקס דיגיטל, דרך ה-Connector |
| `supabase` | שאילתה או Edge Function |
| `cloud` | Apify / Bright Data / Firecrawl ב-API |
| `claude-code` | **כותב פקודת הרצה. קלוד קוד מרים ומחזיר תוצאה** |

**התוצר הרצוי:** לוחצת כפתור, רואה את ההרצה רצה, ובסוף יש תוצר שמור ושורת יומן.

**איך זה עוזר:** זה מה שהופך את המנוע מ"ישות תיאורטית" למשהו שמבצע — בדיוק מה שחזרת עליו.

- [ ] `executor.ts` עם ארבע הסביבות
- [ ] עדכון `runs` בכל שינוי מצב
- [ ] שורת `activity_log` עם ערוץ ועלות
- [ ] בדיקה: הרצה אמיתית אחת מול פיקס דיגיטל (קריאה בלבד)
- [ ] commit

### משימה 4.3 — שער "צאלה מאשרת" · 1ש

**מה:** כל הרצה עם `needs_approval` עוצרת ומחכה. לא ממשיכה בלי לחיצה.

**התוצר הרצוי:** שום הודעה, דוח או פרסום לא יוצא החוצה בלי שאישרת.

- [ ] חסימה ב-`executor.ts`
- [ ] התראה במסך הבית
- [ ] בדיקה: הרצה עם אישור נעצרת ולא ממשיכה
- [ ] commit

---

# שלב 5 — זיכרון הנישה · 4 שעות ⭐

**זה השלב שפותר את "המאסטר לא ברור לי" ו"הייעוץ לא עובד".**

### משימה 5.1 — אוסף ההקשר · 2ש

**קובץ חדש:** `lib/ai/niche-memory.ts`

**מה הפעולה עושה:** כשאת שואלת שאלה **בתוך נישה**, המערכת אוספת לפני השליחה למודל:

| מה | מאיפה | כמה |
|---|---|---|
| שלב נוכחי | `niche_status` | הכל |
| מסמכים | `niche_documents` | 20 אחרונים, שמות ותקצירים |
| הערות והחלטות | `niche_notes` | 30 אחרונות |
| משימות פתוחות | `tasks` | הכל |
| הרצות אחרונות | `runs` | 10 אחרונות |
| תוצרים | `agent_outputs` | 10 אחרונים |

**התוצר הרצוי:** את שואלת *"איפה אני עומדת עם המע"מ?"* והמערכת **יודעת** — כי היא
רואה את המסמכים, ההחלטות וההרצות שלך.

**איך זה עוזר:** היום היא מתחילה מדף ריק בכל שאלה. זה מה שישתנה.

**חשוב:** זה **לא שובר** את בידוד השיחות. השיחה עדיין לא רואה שיחות אחרות — אבל היא
כן רואה את **הנכסים של הנישה**. זו תוספת, לא ביטול.

- [ ] `collectNicheMemory(supabase, nicheId)`
- [ ] עיצוב הטקסט שנכנס להנחיית המערכת
- [ ] תקרת גודל, שלא יתפוצץ
- [ ] commit

### משימה 5.2 — חיבור ל-`/api/chat` · 1ש

**קובץ:** `app/api/chat/route.ts:200-204`

**מה:** כשיש `niche_id`, מוסיפים את זיכרון הנישה להנחיית המערכת.

```ts
const system = [
  buildSystem(agent),
  agent.is_master ? masterContext(agent, await masterOutputs(supabase, agent)) : "",
  nicheId ? await collectNicheMemory(supabase, nicheId) : "",
].filter(Boolean).join("\n\n");
```

- [ ] השינוי ב-`route.ts`
- [ ] בדיקה: להעלות מסמך, לשאול עליו, לוודא שהתשובה מתייחסת אליו
- [ ] commit

### משימה 5.3 — הרג'יסטרי בהקשר · 1ש

**מה:** 481 הסקילים והחבילות נכנסים כאינדקס לחיפוש — שם, מתי להשתמש, מתי לא.

**התוצר הרצוי:** את שואלת *"איזה סקיל מתאים להגשת מע"מ?"* והמערכת עונה מתוך **המאגר
שלך**, לא מהידע הכללי.

- [ ] אינדקס מצומצם של הרג'יסטרי
- [ ] חיפוש לפי `when_to_use`
- [ ] commit

---

# שלב 6 — מסך "איזה סקיל מתאים" · 3 שעות

### משימה 6.1 — המסך · 2ש

**קובץ:** `app/(app)/advisor/page.tsx`

**מה:** כותבת משימה בשפה חופשית. המסך מחזיר: סקילים מתאימים · חבילות מתאימות ·
ואם אין כלום — הצעה לבנות חבילה חדשה.

**התוצר הרצוי:** בדיוק שלושת המצבים שתיארת: למשוך סקיל קיים · לשדרג קיים · לבנות חדש.

- [ ] שדה חיפוש חופשי
- [ ] תוצאות בשלוש הקבוצות
- [ ] כפתור "בנה חבילה מזה"
- [ ] commit

### משימה 6.2 — קישור מכל מקום · 1ש

**מה:** כפתור "מה מתאים לזה?" ליד כל שדה פנייה בכל נישה · וקישור למחברת בכל מסך סקילים.

- [ ] הכפתור בחדר הנישה
- [ ] קישור למחברת בכל מסך רלוונטי
- [ ] commit

---

## אימות — בסוף כל שלב

אין מסגרת בדיקות בריפו, ואני לא מוסיף אחת שלא ביקשת. האימות:

1. `npm run lint` — נקי
2. `npm run build` — עובר
3. בדיקה בדפדפן ב-360px · 768px · 1280px
4. בדיקת מצב ריק על נישה בלי נתונים
5. אימות שהנתונים נשמרו — לרענן ולראות שהם שם

**לא נדחף ל-`main` בלי אישור שלך** — ורסל פורסת משם אוטומטית לאתר החי.

---

## סיכום זמנים

| שלב | שעות | מצטבר |
|---|---|---|
| 0 · תשתית נתונים | 1.5 | 1.5 |
| 1 · חדר הנישה | 8 | 9.5 |
| 2 · מסך הבית | 3 | 12.5 |
| 3 · חבילות | 4 | 16.5 |
| 4 · פנקס הרצות | 4.5 | 21 |
| 5 · **זיכרון** | 4 | 25 |
| 6 · מסך ייעוץ | 3 | **28** |

**נקודת העצירה המומלצת הראשונה: סוף שלב 1 (9.5 שעות).** בנקודה הזאת כבר יש לך חדר
נישה עובד עם מסמכים, משימות והערות — וזה לבדו פותר את שני הפערים הגדולים שדיווחת עליהם.
