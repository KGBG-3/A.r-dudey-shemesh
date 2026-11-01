/* ardudim.co.il · מערכת העבודות: connection settings shared by the admin screen (admin/) and the
   calculator's "בחירת יישוב ומועד" step on the site.
   The key below is the project's publishable key: it is meant to be public. What visitors may read
   or write is decided by the database rules (supabase/schema.sql): visitors can only send a request. */
window.ARDUDIM_JOBS = {
  url: '__SUPABASE_URL__',
  key: '__SUPABASE_PUBLISHABLE_KEY__',
  users: [
    { name: 'משה', email: 'moshe@ardudim.co.il' },
    { name: 'אבא', email: 'iliya@ardudim.co.il' }
  ],
  zone: 'Asia/Jerusalem'
};
