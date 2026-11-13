/* ardudim.co.il · מערכת העבודות: connection settings shared by the admin screen (admin/) and the
   calculator's "בחירת יישוב ומועד" step on the site.
   The key below is the project's publishable key: it is meant to be public. What visitors may read
   or write is decided by the database rules (supabase/schema.sql): visitors can only send a request. */
window.ARDUDIM_JOBS = {
  url: 'https://sbbljzrwfhnyknbojsau.supabase.co',
  key: 'sb_publishable_-Lxhudphtha0zfVar7VDsw_6ykvdigu',
  users: [
    { name: 'משה', email: 'moshe@ardudim.co.il' },
    // lang: the admin opens in Russian for him. simple: it opens on the simple screen (one list, big buttons,
    // a new job in short steps). He can switch both, and the choice is kept on his phone.
    { name: 'אבא', email: 'ilya@ardudim.co.il', lang: 'ru', simple: true }
  ],
  zone: 'Asia/Jerusalem'
};
