import './auth-screen.css';

export function createAuthScreen({getClient,onSignedIn}) {
  const root=document.querySelector('#auth-root');
  let mode='signin',busy=false;
  root.innerHTML=`<div class="auth-shell"><section class="auth-story" aria-label="Welcome to SONIX">
    <a class="auth-brand" href="#home"><img src="${import.meta.env.BASE_URL}icon.svg" alt=""/>SONIX<span>YOUR WORLD, ON REPEAT</span></a>
    <div class="auth-story-copy"><span class="auth-kicker">A SPACE THAT SOUNDS LIKE YOU</span><h2>Less noise.<br/>More <em>you.</em></h2><p>Your favorite songs. Your late-night playlists.<br/>A little world you can come back to.</p>
    <div class="auth-art" aria-hidden="true"><img src="${import.meta.env.BASE_URL}art/night.jpg" alt=""/><div class="auth-art-caption"><span>YOUR NEXT FAVORITE AWAITS</span><strong>Find your flow.</strong><div class="auth-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div></div>
    <p class="auth-story-footer">Your playlists, saved. Your music, always yours.</p></section>
    <section class="auth-form-side"><div class="auth-card"><span class="auth-kicker">YOUR PERSONAL MUSIC SPACE</span><h1 id="auth-title">Welcome back.</h1><p id="auth-intro">Sign in to pick up where you left off.</p>
    <div class="auth-tabs" role="group" aria-label="Account options"><button type="button" data-auth-mode="signin" aria-pressed="true">Sign in</button><button type="button" data-auth-mode="signup" aria-pressed="false">Create account</button></div>
    <form id="entry-form"><div id="signup-name" hidden><label for="entry-name">Your name</label><input id="entry-name" name="name" autocomplete="name" maxlength="80" placeholder="What should we call you?"/></div>
    <label for="entry-email">Email address</label><input id="entry-email" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" required placeholder="you@example.com"/>
    <label for="entry-password">Password</label><div class="auth-password"><input id="entry-password" name="password" type="password" autocomplete="current-password" required placeholder="Enter your password"/><button type="button" id="show-password" aria-label="Show password" aria-pressed="false">Show</button></div>
    <div id="signup-confirm" hidden><label for="entry-confirm">Confirm password</label><input id="entry-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Enter your password again"/><p class="auth-password-help">Use at least 8 characters.</p></div>
    <p id="entry-message" role="status" aria-live="polite"></p><button class="auth-submit" type="submit" disabled>Opening your music…</button></form>
    <p class="auth-switch">New to SONIX? <button type="button" data-auth-mode="signup">Create an account</button></p>
    <div class="auth-save-note"><span aria-hidden="true">✓</span><p>Your favorites and playlists are saved to your account. Your imported audio stays on this device.</p></div>
    </div><p class="auth-footnote">A little less noise. A little more music.</p></section></div>`;
  const form=root.querySelector('#entry-form'),message=root.querySelector('#entry-message'),submit=form.querySelector('[type="submit"]');
  function notify(text,error=false){message.textContent=text;message.classList.toggle('error',error);}
  function setBusy(value,label){busy=value;form.setAttribute('aria-busy',String(value));root.querySelectorAll('button,input').forEach(el=>el.disabled=value);submit.textContent=label||(mode==='signup'?'Create my account':'Sign in');}
  function show(next='signin',text=''){
    mode=next;root.hidden=false;document.querySelector('#app').hidden=true;
    const signup=mode==='signup';
    root.querySelector('#auth-title').textContent=signup?'Make yourself at home.':'Welcome back.';
    root.querySelector('#auth-intro').textContent=signup?'Create your account. Start your own soundtrack.':'Sign in to pick up where you left off.';
    root.querySelector('#signup-name').hidden=!signup;root.querySelector('#entry-name').required=signup;
    root.querySelector('#signup-confirm').hidden=!signup;root.querySelector('#entry-confirm').required=signup;
    const password=root.querySelector('#entry-password');password.autocomplete=signup?'new-password':'current-password';password.minLength=signup?8:1;
    root.querySelectorAll('.auth-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode===mode)));
    root.querySelector('.auth-switch').innerHTML=signup?'Already have an account? <button type="button" data-auth-mode="signin">Sign in</button>':'New to SONIX? <button type="button" data-auth-mode="signup">Create an account</button>';
    setBusy(false);notify(text);window.scrollTo(0,0);
  }
  root.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||busy)return;
    if(button.dataset.authMode){show(button.dataset.authMode);return;}
    if(button.id==='show-password'){const field=root.querySelector('#entry-password'),visible=field.type==='password';field.type=visible?'text':'password';button.textContent=visible?'Hide':'Show';button.setAttribute('aria-label',visible?'Hide password':'Show password');button.setAttribute('aria-pressed',String(visible));}
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    const values=new FormData(form),email=String(values.get('email')).trim(),password=String(values.get('password'));
    if(mode==='signup'&&password!==values.get('confirm')){notify('Your passwords do not match.',true);root.querySelector('#entry-confirm').focus();return;}
    setBusy(true,mode==='signup'?'Creating your account…':'Signing in…');notify('');
    try{
      const client=await getClient();if(!client)throw Error('Account sign-in is not configured yet. Please try again later.');
      const result=mode==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname,data:{display_name:String(values.get('name')).trim()}}}):await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      form.querySelectorAll('input[type="password"]').forEach(input=>input.value='');root.querySelector('#entry-password').value='';
      if(result.data.session){await onSignedIn(result.data.session);}
      else show('signin','Check your email for the confirmation link, then return here to sign in.');
    }catch(error){notify(error.message||'Could not sign in. Check your connection and try again.',true);}
    finally{setBusy(false);}
  });
  return {show,hide(){root.hidden=true;document.querySelector('#app').hidden=false;},loading(text='Opening your music…'){root.hidden=false;document.querySelector('#app').hidden=true;setBusy(true,text);notify('');},error(text){show('signin');notify(text,true);}};
}
