const fs=require('node:fs');
const path=require('node:path');
const root=path.dirname(require.resolve('@supabase/supabase-js/package.json'));
fs.mkdirSync('vendor',{recursive:true});
fs.copyFileSync(path.join(root,'dist/umd/supabase.js'),'vendor/supabase.js');
fs.copyFileSync(path.join(root,'LICENSE'),'vendor/SUPABASE-LICENSE');
console.log('Supabase SDK '+require('@supabase/supabase-js/package.json').version+' 번들을 갱신했습니다.');
